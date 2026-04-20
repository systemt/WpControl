<?php
/**
 * Plugin Name:       DigiForce WP Agent
 * Plugin URI:        https://digiforce.example.com/wp-agent
 * Description:       Connects a WordPress site to a central DigiForce management system, reports core/plugin/theme update status, and securely accepts signed remote commands.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      8.1
 * Author:            DigiForce
 * Author URI:        https://digiforce.example.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       digiforce-wp-agent
 * Domain Path:       /languages
 *
 * @package DigiForce\WPAgent
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'DIGIFORCE_WPA_VERSION', '1.0.0' );
define( 'DIGIFORCE_WPA_FILE', __FILE__ );
define( 'DIGIFORCE_WPA_PATH', plugin_dir_path( __FILE__ ) );
define( 'DIGIFORCE_WPA_URL', plugin_dir_url( __FILE__ ) );
define( 'DIGIFORCE_WPA_BASENAME', plugin_basename( __FILE__ ) );
define( 'DIGIFORCE_WPA_REST_NAMESPACE', 'digiforce-agent/v1' );
define( 'DIGIFORCE_WPA_OPTION_KEY', 'digiforce_wpa_settings' );
define( 'DIGIFORCE_WPA_LOG_TABLE', 'digiforce_wpa_logs' );
define( 'DIGIFORCE_WPA_REPLAY_PREFIX', 'dfwpa_rep_' );
define( 'DIGIFORCE_WPA_TEXT_DOMAIN', 'digiforce-wp-agent' );

require_once DIGIFORCE_WPA_PATH . 'includes/class-loader.php';

\DigiForce\WPAgent\Loader::register();

register_activation_hook( __FILE__, array( '\\DigiForce\\WPAgent\\Plugin', 'activate' ) );
register_deactivation_hook( __FILE__, array( '\\DigiForce\\WPAgent\\Plugin', 'deactivate' ) );

add_action(
	'plugins_loaded',
	static function () {
		\DigiForce\WPAgent\Plugin::instance()->boot();
	}
);
