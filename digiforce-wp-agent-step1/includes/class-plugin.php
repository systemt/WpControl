<?php
/**
 * Central plugin orchestrator and activation lifecycle.
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
	public UpdateScanner $scanner;
	public AutoUpdateManager $auto_updates;
	public Security $security;
	public CommandRunner $runner;
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
		$this->scanner      = new UpdateScanner();
		$this->auto_updates = new AutoUpdateManager();
		$this->security     = new Security( $this->settings, $this->logger );
		$this->runner       = new CommandRunner( $this->settings, $this->scanner, $this->auto_updates, $this->logger );
		$this->rest         = new RestController(
			$this->settings,
			$this->logger,
			$this->scanner,
			$this->security,
			$this->runner
		);
		$this->admin        = new AdminPage( $this->settings, $this->logger, $this->scanner );
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

		$this->admin->register_hooks();
		$this->rest->register_hooks();
	}

	/**
	 * Activation hook: seed defaults, create the log table, ensure identity.
	 */
	public static function activate() : void {
		require_once DIGIFORCE_WPA_PATH . 'includes/class-loader.php';
		Loader::register();

		$settings = new Settings();
		$settings->ensure_defaults();
		$settings->ensure_identity();

		$logger = new Logger();
		$logger->install_table();

		$logger->info(
			Logger::CATEGORY_SYSTEM,
			'activate',
			__( 'Plugin activated.', 'digiforce-wp-agent' ),
			'plugin',
			'digiforce-wp-agent'
		);
	}

	/**
	 * Deactivation hook — flush the cached scan summary; preserve everything else.
	 */
	public static function deactivate() : void {
		delete_transient( RestController::CACHE_KEY );
	}
}
