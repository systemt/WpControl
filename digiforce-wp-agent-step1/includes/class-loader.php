<?php
/**
 * Class loader — explicit requires keep the plugin self-contained (no Composer).
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Loader {

	public static function register() : void {
		$base = DIGIFORCE_WPA_PATH . 'includes/';

		require_once $base . 'class-utils.php';
		require_once $base . 'class-logger.php';
		require_once $base . 'class-settings.php';
		require_once $base . 'class-update-scanner.php';
		require_once $base . 'class-auto-update-manager.php';
		require_once $base . 'class-security.php';
		require_once $base . 'class-command-runner.php';
		require_once $base . 'class-rest-controller.php';
		require_once $base . 'class-admin-page.php';
		require_once $base . 'class-plugin.php';
	}
}
