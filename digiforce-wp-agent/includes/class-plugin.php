<?php
/**
 * Main orchestrator for DigiForce WP Agent. Wires every collaborator together
 * and handles the WordPress activation lifecycle.
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Plugin {

	private static ?self $instance = null;
	private bool $booted = false;

	public Settings $settings;
	public Logger $logger;
	public Security $security;
	public UpdateScanner $scanner;
	public CommandRunner $runner;
	public AutoUpdateManager $auto_updates;
	public ConnectionManager $connection;
	public RestController $rest;
	public AdminPage $admin;

	public static function instance() : self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		$this->settings     = new Settings();
		$this->logger       = new Logger();
		$this->security     = new Security( $this->settings, $this->logger );
		$this->auto_updates = new AutoUpdateManager();
		$this->scanner      = new UpdateScanner( $this->auto_updates );
		$this->runner       = new CommandRunner( $this->settings, $this->scanner, $this->auto_updates, $this->logger );
		$this->connection   = new ConnectionManager( $this->settings, $this->logger, $this->scanner );
		$this->rest         = new RestController( $this->settings, $this->security, $this->runner, $this->scanner, $this->logger );
		$this->admin        = new AdminPage( $this->settings, $this->logger, $this->scanner, $this->connection );
	}

	public function boot() : void {
		if ( $this->booted ) {
			return;
		}
		$this->booted = true;

		load_plugin_textdomain(
			DIGIFORCE_WPA_TEXT_DOMAIN,
			false,
			dirname( DIGIFORCE_WPA_BASENAME ) . '/languages'
		);

		$this->rest->register_hooks();
		$this->admin->register_hooks();
		$this->connection->register_hooks();
	}

	/**
	 * Activation hook — create schema, seed defaults, ensure identity.
	 */
	public static function activate() : void {
		require_once DIGIFORCE_WPA_PATH . 'includes/class-loader.php';
		Loader::register();

		$settings = new Settings();
		$settings->ensure_defaults();

		$logger = new Logger();
		$logger->install_table();

		$auto_updates = new AutoUpdateManager();
		$scanner      = new UpdateScanner( $auto_updates );
		$connection   = new ConnectionManager( $settings, $logger, $scanner );
		$connection->ensure_identity();

		$logger->log(
			Logger::LEVEL_INFO,
			Logger::CATEGORY_SYSTEM,
			'activate',
			'plugin',
			'digiforce-wp-agent',
			__( 'Plugin activated.', 'digiforce-wp-agent' )
		);
	}

	/**
	 * Deactivation hook — unschedule cron, keep data intact.
	 */
	public static function deactivate() : void {
		$hook = ConnectionManager::CRON_HOOK;
		$ts   = wp_next_scheduled( $hook );
		while ( false !== $ts ) {
			wp_unschedule_event( $ts, $hook );
			$ts = wp_next_scheduled( $hook );
		}
	}
}
