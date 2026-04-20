<?php
/**
 * Class loader for DigiForce WP Agent.
 *
 * Uses explicit requires (no Composer) so the plugin is self-contained.
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Loader {

	/**
	 * Register all plugin classes.
	 */
	public static function register() : void {
		$base = DIGIFORCE_WPA_PATH . 'includes/';

		require_once $base . 'class-utils.php';
		require_once $base . 'class-logger.php';
		require_once $base . 'class-settings.php';
		require_once $base . 'class-security.php';
		require_once $base . 'class-auto-update-manager.php';
		require_once $base . 'class-update-scanner.php';
		require_once $base . 'class-command-runner.php';
		require_once $base . 'class-connection-manager.php';
		require_once $base . 'class-rest-controller.php';
		require_once $base . 'class-admin-page.php';
		require_once $base . 'class-plugin.php';
	}
}
