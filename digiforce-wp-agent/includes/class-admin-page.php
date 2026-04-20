<?php
/**
 * Admin menu page and admin-post handlers.
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AdminPage {

	public const MENU_SLUG    = 'digiforce-wp-agent';
	public const NONCE_ACTION = 'digiforce_wpa_admin';
	public const NONCE_FIELD  = 'digiforce_wpa_nonce';

	public function __construct(
		private Settings $settings,
		private Logger $logger,
		private UpdateScanner $scanner,
		private ConnectionManager $connection
	) {}

	public function register_hooks() : void {
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );

		add_action( 'admin_post_digiforce_wpa_save_settings', array( $this, 'handle_save_settings' ) );
		add_action( 'admin_post_digiforce_wpa_regenerate_uuid', array( $this, 'handle_regenerate_uuid' ) );
		add_action( 'admin_post_digiforce_wpa_rotate_secret', array( $this, 'handle_rotate_secret' ) );
		add_action( 'admin_post_digiforce_wpa_scan_now', array( $this, 'handle_scan_now' ) );
		add_action( 'admin_post_digiforce_wpa_sync_now', array( $this, 'handle_sync_now' ) );
	}

	public function register_menu() : void {
		add_menu_page(
			__( 'DigiForce Agent', 'digiforce-wp-agent' ),
			__( 'DigiForce Agent', 'digiforce-wp-agent' ),
			'manage_options',
			self::MENU_SLUG,
			array( $this, 'render_page' ),
			'dashicons-cloud',
			81
		);
	}

	public function enqueue_assets( string $hook_suffix ) : void {
		if ( false === strpos( $hook_suffix, self::MENU_SLUG ) ) {
			return;
		}
		wp_enqueue_style(
			'digiforce-wpa-admin',
			DIGIFORCE_WPA_URL . 'admin/css/admin.css',
			array(),
			DIGIFORCE_WPA_VERSION
		);
		wp_enqueue_script(
			'digiforce-wpa-admin',
			DIGIFORCE_WPA_URL . 'admin/js/admin.js',
			array( 'jquery' ),
			DIGIFORCE_WPA_VERSION,
			true
		);
	}

	public function render_page() : void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to view this page.', 'digiforce-wp-agent' ) );
		}

		$settings = $this->settings->all();
		$summary  = $this->scanner->summary( false );
		$logs     = $this->logger->get_recent( 20 );

		$site_info = array(
			'plugin_version'         => DIGIFORCE_WPA_VERSION,
			'site_uuid'              => (string) $settings['site_uuid'],
			'central_server_url'     => (string) $settings['central_server_url'],
			'connection_enabled'     => (bool) $settings['connection_enabled'],
			'last_connection_status' => (string) $settings['last_connection_status'],
			'last_sync_at'           => (int) $settings['last_sync_at'],
			'wp_version'             => get_bloginfo( 'version' ),
			'php_version'            => PHP_VERSION,
			'plugins_installed'      => $summary['counts']['plugins_installed'],
			'plugins_need_update'    => $summary['counts']['plugins_need_update'],
			'themes_need_update'     => $summary['counts']['themes_need_update'],
			'core_update_available'  => (bool) $summary['core_need_update'],
		);

		$nonce_field  = self::NONCE_FIELD;
		$nonce_action = self::NONCE_ACTION;

		include DIGIFORCE_WPA_PATH . 'admin/views/settings-page.php';
	}

	/* ------------------------------------------------------------------ */
	/*  admin-post.php handlers                                            */
	/* ------------------------------------------------------------------ */

	public function handle_save_settings() : void {
		$this->verify_request();

		$input = isset( $_POST['digiforce_wpa'] ) && is_array( $_POST['digiforce_wpa'] )
			? wp_unslash( $_POST['digiforce_wpa'] )
			: array();

		$sanitized = $this->settings->sanitize( $input );

		$this->settings->update_many(
			array(
				'central_server_url'          => $sanitized['central_server_url'],
				'environment'                 => $sanitized['environment'],
				'connection_enabled'          => $sanitized['connection_enabled'],
				'allow_remote_plugin_updates' => $sanitized['allow_remote_plugin_updates'],
				'allow_remote_activation'     => $sanitized['allow_remote_activation'],
				'allow_remote_deactivation'   => $sanitized['allow_remote_deactivation'],
				'allow_bulk_updates'          => $sanitized['allow_bulk_updates'],
				'require_signed_requests'     => $sanitized['require_signed_requests'],
				'allowed_ips'                 => $sanitized['allowed_ips'],
				'log_retention_days'          => $sanitized['log_retention_days'],
				'debug_mode'                  => $sanitized['debug_mode'],
			)
		);

		$this->logger->prune( (int) $sanitized['log_retention_days'] );
		$this->logger->log( Logger::LEVEL_INFO, Logger::CATEGORY_SYSTEM, 'save_settings', 'system', '', __( 'Settings saved.', 'digiforce-wp-agent' ) );

		$this->redirect_with_notice( 'saved' );
	}

	public function handle_regenerate_uuid() : void {
		$this->verify_request();
		$this->connection->regenerate_uuid();
		$this->redirect_with_notice( 'uuid_regenerated' );
	}

	public function handle_rotate_secret() : void {
		$this->verify_request();
		$this->connection->rotate_secret();
		$this->redirect_with_notice( 'secret_rotated' );
	}

	public function handle_scan_now() : void {
		$this->verify_request();
		$this->scanner->summary( true );
		$this->logger->log( Logger::LEVEL_INFO, Logger::CATEGORY_SCAN, 'scan_now', 'admin', '', __( 'Manual scan triggered.', 'digiforce-wp-agent' ) );
		$this->redirect_with_notice( 'scanned' );
	}

	public function handle_sync_now() : void {
		$this->verify_request();
		$this->connection->sync_now();
		$this->redirect_with_notice( 'synced' );
	}

	private function verify_request() : void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to perform this action.', 'digiforce-wp-agent' ) );
		}
		check_admin_referer( self::NONCE_ACTION, self::NONCE_FIELD );
	}

	private function redirect_with_notice( string $notice ) : void {
		$url = add_query_arg(
			array(
				'page'   => self::MENU_SLUG,
				'notice' => sanitize_key( $notice ),
			),
			admin_url( 'admin.php' )
		);
		wp_safe_redirect( $url );
		exit;
	}
}
