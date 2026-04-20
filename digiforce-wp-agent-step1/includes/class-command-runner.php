<?php
/**
 * Executes remote commands received over POST /command.
 *
 * Every command goes through `handle()` which logs the attempt, validates the
 * envelope, dispatches to an action method, catches any throwable, logs the
 * result, and returns a structured JSON response.
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CommandRunner {

	public const SUPPORTED_ACTIONS = array(
		'sync_status',
		'scan_updates',
		'update_plugin',
		'bulk_update_plugins',
		'activate_plugin',
		'deactivate_plugin',
		'enable_plugin_auto_update',
		'disable_plugin_auto_update',
	);

	public function __construct(
		private Settings $settings,
		private UpdateScanner $scanner,
		private AutoUpdateManager $auto_updates,
		private Logger $logger
	) {}

	/**
	 * Top-level dispatcher.
	 *
	 * @return array the JSON-ready command response
	 */
	public function handle( string $command_id, string $action, array $payload ) : array {
		$this->logger->info(
			Logger::CATEGORY_COMMAND,
			'command_attempt',
			sprintf( 'Command attempt: %s', '' !== $action ? $action : '(missing)' ),
			'command',
			'' !== $command_id ? $command_id : '(missing)',
			array( 'payload_keys' => array_keys( $payload ) )
		);

		if ( '' === $command_id ) {
			$result = $this->failure( '', $action, 'missing_command_id', __( 'Missing command_id.', 'digiforce-wp-agent' ) );
		} elseif ( '' === $action ) {
			$result = $this->failure( $command_id, '', 'missing_action', __( 'Missing action.', 'digiforce-wp-agent' ) );
		} elseif ( ! in_array( $action, self::SUPPORTED_ACTIONS, true ) ) {
			$result = $this->failure( $command_id, $action, 'unsupported_action', __( 'Action is not supported.', 'digiforce-wp-agent' ) );
		} else {
			try {
				$result = match ( $action ) {
					'sync_status'                => $this->sync_status( $command_id ),
					'scan_updates'               => $this->scan_updates( $command_id ),
					'update_plugin'              => $this->update_plugin( $command_id, $payload ),
					'bulk_update_plugins'        => $this->bulk_update_plugins( $command_id, $payload ),
					'activate_plugin'            => $this->activate_plugin_action( $command_id, $payload ),
					'deactivate_plugin'          => $this->deactivate_plugin_action( $command_id, $payload ),
					'enable_plugin_auto_update'  => $this->enable_auto_update( $command_id, $payload ),
					'disable_plugin_auto_update' => $this->disable_auto_update( $command_id, $payload ),
				};
			} catch ( \Throwable $e ) {
				$this->logger->error(
					Logger::CATEGORY_COMMAND,
					$action,
					$e->getMessage(),
					'command',
					$command_id
				);
				$result = $this->failure( $command_id, $action, 'internal_server_error', $e->getMessage() );
			}
		}

		$this->log_result( $command_id, $action, $result );
		return $result;
	}

	/* ------------------------------------------------------------------ */
	/*  Action handlers                                                    */
	/* ------------------------------------------------------------------ */

	private function sync_status( string $command_id ) : array {
		$snapshot = $this->scanner->scan( false );
		return $this->success(
			$command_id,
			'sync_status',
			__( 'Status returned.', 'digiforce-wp-agent' ),
			$snapshot
		);
	}

	private function scan_updates( string $command_id ) : array {
		$summary = $this->scanner->summary( true );
		set_transient( RestController::CACHE_KEY, $summary, RestController::CACHE_TTL );
		return $this->success(
			$command_id,
			'scan_updates',
			__( 'Update scan completed.', 'digiforce-wp-agent' ),
			$summary
		);
	}

	private function update_plugin( string $command_id, array $payload ) : array {
		if ( ! (bool) $this->settings->get( 'allow_remote_plugin_updates', true ) ) {
			return $this->failure( $command_id, 'update_plugin', 'unauthorized_request', __( 'Remote plugin updates are disabled.', 'digiforce-wp-agent' ) );
		}
		$plugin_file = isset( $payload['plugin_file'] ) ? (string) $payload['plugin_file'] : '';
		if ( '' === $plugin_file ) {
			return $this->failure( $command_id, 'update_plugin', 'missing_plugin_file', __( 'Missing plugin_file.', 'digiforce-wp-agent' ) );
		}
		$result = $this->run_plugin_update( $plugin_file );
		if ( ! $result['success'] ) {
			return $this->failure( $command_id, 'update_plugin', $result['code'], $result['message'], array( 'plugin_file' => $plugin_file ) );
		}
		$this->logger->info(
			Logger::CATEGORY_UPDATE,
			'update_plugin',
			sprintf( '%s -> %s', $result['old_version'], $result['new_version'] ),
			'plugin',
			$plugin_file
		);
		return $this->success(
			$command_id,
			'update_plugin',
			__( 'Plugin updated successfully', 'digiforce-wp-agent' ),
			array(
				'plugin_file' => $plugin_file,
				'old_version' => $result['old_version'],
				'new_version' => $result['new_version'],
			)
		);
	}

	private function bulk_update_plugins( string $command_id, array $payload ) : array {
		if ( ! (bool) $this->settings->get( 'allow_bulk_updates', true ) ) {
			return $this->failure( $command_id, 'bulk_update_plugins', 'unauthorized_request', __( 'Bulk updates are disabled.', 'digiforce-wp-agent' ) );
		}
		$plugin_files = isset( $payload['plugin_files'] ) && is_array( $payload['plugin_files'] ) ? $payload['plugin_files'] : array();
		if ( empty( $plugin_files ) ) {
			return $this->failure( $command_id, 'bulk_update_plugins', 'invalid_payload', __( 'plugin_files must be a non-empty array.', 'digiforce-wp-agent' ) );
		}

		$results = array();
		foreach ( $plugin_files as $plugin_file ) {
			$plugin_file = (string) $plugin_file;
			if ( '' === $plugin_file ) {
				$results[] = array(
					'plugin_file' => '',
					'success'     => false,
					'code'        => 'missing_plugin_file',
					'message'     => __( 'Empty plugin_file.', 'digiforce-wp-agent' ),
					'old_version' => '',
					'new_version' => '',
				);
				continue;
			}
			$r = $this->run_plugin_update( $plugin_file );
			$results[] = array_merge( array( 'plugin_file' => $plugin_file ), $r );

			$this->logger->log(
				$r['success'] ? Logger::LEVEL_INFO : Logger::LEVEL_ERROR,
				Logger::CATEGORY_UPDATE,
				'bulk_update_plugins',
				'plugin',
				$plugin_file,
				$r['message']
			);
		}

		$all_ok  = ! in_array( false, array_column( $results, 'success' ), true );
		$message = $all_ok
			? __( 'All plugins updated successfully.', 'digiforce-wp-agent' )
			: __( 'Some plugins failed to update.', 'digiforce-wp-agent' );

		if ( $all_ok ) {
			return $this->success( $command_id, 'bulk_update_plugins', $message, array( 'results' => $results ) );
		}

		return array(
			'success'    => false,
			'command_id' => $command_id,
			'action'     => 'bulk_update_plugins',
			'message'    => $message,
			'error'      => array(
				'code'    => 'plugin_update_failed',
				'details' => __( 'One or more plugin updates failed.', 'digiforce-wp-agent' ),
			),
			'data'       => array( 'results' => $results ),
		);
	}

	private function activate_plugin_action( string $command_id, array $payload ) : array {
		if ( ! (bool) $this->settings->get( 'allow_remote_activation', true ) ) {
			return $this->failure( $command_id, 'activate_plugin', 'unauthorized_request', __( 'Remote activation is disabled.', 'digiforce-wp-agent' ) );
		}
		$plugin_file = isset( $payload['plugin_file'] ) ? (string) $payload['plugin_file'] : '';
		if ( '' === $plugin_file ) {
			return $this->failure( $command_id, 'activate_plugin', 'missing_plugin_file', __( 'Missing plugin_file.', 'digiforce-wp-agent' ) );
		}
		if ( ! function_exists( 'activate_plugin' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		if ( ! array_key_exists( $plugin_file, get_plugins() ) ) {
			return $this->failure( $command_id, 'activate_plugin', 'plugin_not_found', __( 'Plugin not installed.', 'digiforce-wp-agent' ), array( 'plugin_file' => $plugin_file ) );
		}
		if ( is_plugin_active( $plugin_file ) ) {
			return $this->failure( $command_id, 'activate_plugin', 'plugin_already_active', __( 'Plugin is already active.', 'digiforce-wp-agent' ), array( 'plugin_file' => $plugin_file ) );
		}
		$result = activate_plugin( $plugin_file );
		if ( is_wp_error( $result ) ) {
			return $this->failure( $command_id, 'activate_plugin', 'plugin_update_failed', $result->get_error_message(), array( 'plugin_file' => $plugin_file ) );
		}
		return $this->success(
			$command_id,
			'activate_plugin',
			__( 'Plugin activated.', 'digiforce-wp-agent' ),
			array( 'plugin_file' => $plugin_file )
		);
	}

	private function deactivate_plugin_action( string $command_id, array $payload ) : array {
		if ( ! (bool) $this->settings->get( 'allow_remote_deactivation', true ) ) {
			return $this->failure( $command_id, 'deactivate_plugin', 'unauthorized_request', __( 'Remote deactivation is disabled.', 'digiforce-wp-agent' ) );
		}
		$plugin_file = isset( $payload['plugin_file'] ) ? (string) $payload['plugin_file'] : '';
		if ( '' === $plugin_file ) {
			return $this->failure( $command_id, 'deactivate_plugin', 'missing_plugin_file', __( 'Missing plugin_file.', 'digiforce-wp-agent' ) );
		}
		if ( ! function_exists( 'deactivate_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		if ( ! array_key_exists( $plugin_file, get_plugins() ) ) {
			return $this->failure( $command_id, 'deactivate_plugin', 'plugin_not_found', __( 'Plugin not installed.', 'digiforce-wp-agent' ), array( 'plugin_file' => $plugin_file ) );
		}
		// Never let the agent deactivate itself — that would sever all future control.
		if ( $plugin_file === DIGIFORCE_WPA_BASENAME ) {
			return $this->failure( $command_id, 'deactivate_plugin', 'unauthorized_request', __( 'Refusing to deactivate the agent itself.', 'digiforce-wp-agent' ), array( 'plugin_file' => $plugin_file ) );
		}
		if ( ! is_plugin_active( $plugin_file ) ) {
			return $this->failure( $command_id, 'deactivate_plugin', 'plugin_already_inactive', __( 'Plugin is already inactive.', 'digiforce-wp-agent' ), array( 'plugin_file' => $plugin_file ) );
		}
		deactivate_plugins( $plugin_file );
		return $this->success(
			$command_id,
			'deactivate_plugin',
			__( 'Plugin deactivated.', 'digiforce-wp-agent' ),
			array( 'plugin_file' => $plugin_file )
		);
	}

	private function enable_auto_update( string $command_id, array $payload ) : array {
		$plugin_file = isset( $payload['plugin_file'] ) ? (string) $payload['plugin_file'] : '';
		if ( '' === $plugin_file ) {
			return $this->failure( $command_id, 'enable_plugin_auto_update', 'missing_plugin_file', __( 'Missing plugin_file.', 'digiforce-wp-agent' ) );
		}
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		if ( ! array_key_exists( $plugin_file, get_plugins() ) ) {
			return $this->failure( $command_id, 'enable_plugin_auto_update', 'plugin_not_found', __( 'Plugin not installed.', 'digiforce-wp-agent' ), array( 'plugin_file' => $plugin_file ) );
		}
		$this->auto_updates->enable_plugin_auto_update( $plugin_file );
		return $this->success(
			$command_id,
			'enable_plugin_auto_update',
			__( 'Auto-update enabled.', 'digiforce-wp-agent' ),
			array( 'plugin_file' => $plugin_file )
		);
	}

	private function disable_auto_update( string $command_id, array $payload ) : array {
		$plugin_file = isset( $payload['plugin_file'] ) ? (string) $payload['plugin_file'] : '';
		if ( '' === $plugin_file ) {
			return $this->failure( $command_id, 'disable_plugin_auto_update', 'missing_plugin_file', __( 'Missing plugin_file.', 'digiforce-wp-agent' ) );
		}
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		if ( ! array_key_exists( $plugin_file, get_plugins() ) ) {
			return $this->failure( $command_id, 'disable_plugin_auto_update', 'plugin_not_found', __( 'Plugin not installed.', 'digiforce-wp-agent' ), array( 'plugin_file' => $plugin_file ) );
		}
		$this->auto_updates->disable_plugin_auto_update( $plugin_file );
		return $this->success(
			$command_id,
			'disable_plugin_auto_update',
			__( 'Auto-update disabled.', 'digiforce-wp-agent' ),
			array( 'plugin_file' => $plugin_file )
		);
	}

	/* ------------------------------------------------------------------ */
	/*  Plugin update helper                                               */
	/* ------------------------------------------------------------------ */

	/**
	 * Run a single-plugin upgrade using WP_Upgrader.
	 *
	 * @return array{success:bool,code:string,message:string,old_version:string,new_version:string}
	 */
	private function run_plugin_update( string $plugin_file ) : array {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		if ( ! function_exists( 'request_filesystem_credentials' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
		require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
		if ( ! class_exists( 'WP_Ajax_Upgrader_Skin' ) ) {
			require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader-skins.php';
		}

		$plugins = get_plugins();
		if ( ! isset( $plugins[ $plugin_file ] ) ) {
			return array(
				'success'     => false,
				'code'        => 'plugin_not_found',
				'message'     => __( 'Plugin not installed.', 'digiforce-wp-agent' ),
				'old_version' => '',
				'new_version' => '',
			);
		}
		$old_version = isset( $plugins[ $plugin_file ]['Version'] ) ? (string) $plugins[ $plugin_file ]['Version'] : '';

		// Initialise the filesystem with direct/in-process credentials.
		$creds = request_filesystem_credentials( '', '', false, false, null );
		if ( false === $creds || ! WP_Filesystem( $creds ) ) {
			return array(
				'success'     => false,
				'code'        => 'filesystem_not_ready',
				'message'     => __( 'Filesystem is not ready for updates.', 'digiforce-wp-agent' ),
				'old_version' => $old_version,
				'new_version' => '',
			);
		}

		wp_update_plugins();
		$update_data = get_site_transient( 'update_plugins' );
		if ( ! is_object( $update_data ) || empty( $update_data->response ) || ! isset( $update_data->response[ $plugin_file ] ) ) {
			return array(
				'success'     => false,
				'code'        => 'plugin_update_not_available',
				'message'     => __( 'No update available for this plugin.', 'digiforce-wp-agent' ),
				'old_version' => $old_version,
				'new_version' => $old_version,
			);
		}

		$skin     = new \WP_Ajax_Upgrader_Skin();
		$upgrader = new \Plugin_Upgrader( $skin );
		$result   = $upgrader->upgrade( $plugin_file );

		if ( is_wp_error( $result ) ) {
			return array(
				'success'     => false,
				'code'        => 'plugin_update_failed',
				'message'     => $result->get_error_message(),
				'old_version' => $old_version,
				'new_version' => $old_version,
			);
		}

		$skin_errors = $skin->get_errors();
		if ( is_wp_error( $skin_errors ) && $skin_errors->has_errors() ) {
			return array(
				'success'     => false,
				'code'        => 'plugin_update_failed',
				'message'     => $skin_errors->get_error_message(),
				'old_version' => $old_version,
				'new_version' => $old_version,
			);
		}

		if ( false === $result || null === $result ) {
			return array(
				'success'     => false,
				'code'        => 'plugin_update_failed',
				'message'     => __( 'Plugin update failed.', 'digiforce-wp-agent' ),
				'old_version' => $old_version,
				'new_version' => $old_version,
			);
		}

		wp_clean_plugins_cache( true );
		$plugins_after = get_plugins();
		$new_version   = isset( $plugins_after[ $plugin_file ]['Version'] ) ? (string) $plugins_after[ $plugin_file ]['Version'] : $old_version;

		return array(
			'success'     => true,
			'code'        => 'ok',
			'message'     => __( 'Plugin updated.', 'digiforce-wp-agent' ),
			'old_version' => $old_version,
			'new_version' => $new_version,
		);
	}

	/* ------------------------------------------------------------------ */
	/*  Response + logging helpers                                         */
	/* ------------------------------------------------------------------ */

	private function log_result( string $command_id, string $action, array $result ) : void {
		$level   = ! empty( $result['success'] ) ? Logger::LEVEL_INFO : Logger::LEVEL_ERROR;
		$context = array();
		if ( isset( $result['error'] ) && is_array( $result['error'] ) ) {
			$context['error'] = $result['error'];
		}
		if ( isset( $result['data']['plugin_file'] ) ) {
			$context['plugin_file'] = (string) $result['data']['plugin_file'];
		}
		$this->logger->log(
			$level,
			Logger::CATEGORY_COMMAND,
			'command_result:' . ( '' !== $action ? $action : 'none' ),
			'command',
			'' !== $command_id ? $command_id : '(missing)',
			isset( $result['message'] ) ? (string) $result['message'] : '',
			$context
		);
	}

	public function success( string $command_id, string $action, string $message, array $data = array() ) : array {
		return array(
			'success'    => true,
			'command_id' => $command_id,
			'action'     => $action,
			'message'    => $message,
			'data'       => $data,
		);
	}

	public function failure( string $command_id, string $action, string $code, string $details, array $data = array() ) : array {
		return array(
			'success'    => false,
			'command_id' => $command_id,
			'action'     => $action,
			'message'    => $details,
			'error'      => array(
				'code'    => $code,
				'details' => $details,
			),
			'data'       => $data,
		);
	}
}
