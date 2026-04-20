<?php
/**
 * Collects core / plugin / theme update status from the WordPress update APIs.
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class UpdateScanner {

	public function __construct( private AutoUpdateManager $auto_updates ) {}

	/**
	 * Force-refresh update transients.
	 */
	public function force_refresh() : void {
		if ( ! function_exists( 'wp_update_plugins' ) ) {
			require_once ABSPATH . 'wp-includes/update.php';
		}
		if ( function_exists( 'wp_clean_plugins_cache' ) ) {
			wp_clean_plugins_cache( true );
		}
		if ( function_exists( 'wp_clean_themes_cache' ) ) {
			wp_clean_themes_cache( true );
		}
		wp_update_plugins();
		wp_update_themes();
		wp_version_check();
	}

	/**
	 * Full scan snapshot.
	 */
	public function scan( bool $force = false ) : array {
		if ( $force ) {
			$this->force_refresh();
		}
		return array(
			'plugins'    => $this->scan_plugins(),
			'themes'     => $this->scan_themes(),
			'core'       => $this->scan_core(),
			'scanned_at' => time(),
		);
	}

	/**
	 * Condensed summary suitable for /scan responses and admin UI.
	 */
	public function summary( bool $force = false ) : array {
		$scan = $this->scan( $force );

		$plugins_need = array_values(
			array_filter(
				$scan['plugins'],
				static fn ( $p ) => ! empty( $p['has_update'] )
			)
		);
		$themes_need  = array_values(
			array_filter(
				$scan['themes'],
				static fn ( $t ) => ! empty( $t['has_update'] )
			)
		);

		return array(
			'plugins_need_update' => $plugins_need,
			'themes_need_update'  => $themes_need,
			'core_need_update'    => (bool) $scan['core']['has_update'],
			'core'                => $scan['core'],
			'counts'              => array(
				'plugins_installed'     => count( $scan['plugins'] ),
				'themes_installed'      => count( $scan['themes'] ),
				'plugins_need_update'   => count( $plugins_need ),
				'themes_need_update'    => count( $themes_need ),
				'core_update_available' => $scan['core']['has_update'] ? 1 : 0,
			),
			'scanned_at'          => $scan['scanned_at'],
		);
	}

	/**
	 * Per-plugin status.
	 */
	public function scan_plugins() : array {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$all          = get_plugins();
		$update_data  = get_site_transient( 'update_plugins' );
		$response_map = ( is_object( $update_data ) && isset( $update_data->response ) && is_array( $update_data->response ) )
			? $update_data->response
			: array();

		$out = array();
		foreach ( $all as $plugin_file => $data ) {
			$installed_version = isset( $data['Version'] ) ? (string) $data['Version'] : '';
			$available_version = $installed_version;
			$has_update        = false;

			if ( isset( $response_map[ $plugin_file ] ) && is_object( $response_map[ $plugin_file ] ) ) {
				$entry = $response_map[ $plugin_file ];
				if ( ! empty( $entry->new_version ) ) {
					$available_version = (string) $entry->new_version;
					$has_update        = version_compare( $available_version, $installed_version, '>' );
				}
			}

			$slug = '';
			if ( ! empty( $data['TextDomain'] ) ) {
				$slug = (string) $data['TextDomain'];
			} elseif ( false !== strpos( $plugin_file, '/' ) ) {
				$slug = substr( $plugin_file, 0, strpos( $plugin_file, '/' ) );
			} else {
				$slug = basename( $plugin_file, '.php' );
			}

			$out[] = array(
				'plugin_file'         => $plugin_file,
				'slug'                => $slug,
				'name'                => isset( $data['Name'] ) ? (string) $data['Name'] : $plugin_file,
				'version_installed'   => $installed_version,
				'version_available'   => $available_version,
				'has_update'          => $has_update,
				'is_active'           => is_plugin_active( $plugin_file ),
				'auto_update_enabled' => $this->auto_updates->is_plugin_auto_update_enabled( $plugin_file ),
				'author'              => isset( $data['Author'] ) ? wp_strip_all_tags( (string) $data['Author'] ) : '',
				'requires_wp'         => isset( $data['RequiresWP'] ) ? (string) $data['RequiresWP'] : '',
				'requires_php'        => isset( $data['RequiresPHP'] ) ? (string) $data['RequiresPHP'] : '',
			);
		}
		return $out;
	}

	/**
	 * Per-theme status.
	 */
	public function scan_themes() : array {
		$themes       = function_exists( 'wp_get_themes' ) ? wp_get_themes() : array();
		$update_data  = get_site_transient( 'update_themes' );
		$response_map = ( is_object( $update_data ) && isset( $update_data->response ) && is_array( $update_data->response ) )
			? $update_data->response
			: array();

		$active_stylesheet = get_stylesheet();

		$out = array();
		foreach ( $themes as $stylesheet => $theme ) {
			$installed_version = (string) $theme->get( 'Version' );
			$available_version = $installed_version;
			$has_update        = false;

			if ( isset( $response_map[ $stylesheet ] ) && is_array( $response_map[ $stylesheet ] ) && ! empty( $response_map[ $stylesheet ]['new_version'] ) ) {
				$available_version = (string) $response_map[ $stylesheet ]['new_version'];
				$has_update        = version_compare( $available_version, $installed_version, '>' );
			}

			$out[] = array(
				'stylesheet'          => (string) $stylesheet,
				'template'            => (string) $theme->get_template(),
				'name'                => (string) $theme->get( 'Name' ),
				'version_installed'   => $installed_version,
				'version_available'   => $available_version,
				'has_update'          => $has_update,
				'is_active'           => ( (string) $stylesheet === $active_stylesheet ),
				'auto_update_enabled' => $this->auto_updates->is_theme_auto_update_enabled( (string) $stylesheet ),
			);
		}
		return $out;
	}

	/**
	 * Core update status.
	 */
	public function scan_core() : array {
		global $wp_version;
		$current = isset( $wp_version ) ? (string) $wp_version : get_bloginfo( 'version' );

		if ( ! function_exists( 'get_core_updates' ) ) {
			require_once ABSPATH . 'wp-admin/includes/update.php';
		}

		$latest      = $current;
		$has_update  = false;
		$update_type = '';

		$updates = function_exists( 'get_core_updates' ) ? get_core_updates() : array();
		if ( is_array( $updates ) && ! empty( $updates ) ) {
			foreach ( $updates as $u ) {
				if ( ! is_object( $u ) ) {
					continue;
				}
				if ( ! empty( $u->response ) && 'upgrade' === $u->response && ! empty( $u->current ) ) {
					$latest     = (string) $u->current;
					$has_update = version_compare( $latest, $current, '>' );
					if ( ! empty( $u->partial_version ) ) {
						$update_type = 'partial';
					} else {
						$update_type = 'full';
					}
					break;
				}
			}
		}

		return array(
			'current_version' => $current,
			'latest_version'  => $latest,
			'has_update'      => $has_update,
			'update_type'     => $update_type,
		);
	}
}
