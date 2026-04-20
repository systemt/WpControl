<?php
/**
 * Per-plugin auto-update state helpers.
 *
 * Backed by the WordPress 5.5+ `auto_update_plugins` site option so the agent
 * stays in sync with core's own auto-update UI.
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AutoUpdateManager {

	private const PLUGIN_OPTION = 'auto_update_plugins';

	public function is_plugin_auto_update_enabled( string $plugin_file ) : bool {
		$enabled = (array) get_site_option( self::PLUGIN_OPTION, array() );
		return in_array( $plugin_file, $enabled, true );
	}

	public function enable_plugin_auto_update( string $plugin_file ) : bool {
		$enabled = (array) get_site_option( self::PLUGIN_OPTION, array() );
		if ( ! in_array( $plugin_file, $enabled, true ) ) {
			$enabled[] = $plugin_file;
			update_site_option( self::PLUGIN_OPTION, array_values( array_unique( $enabled ) ) );
		}
		return true;
	}

	public function disable_plugin_auto_update( string $plugin_file ) : bool {
		$enabled  = (array) get_site_option( self::PLUGIN_OPTION, array() );
		$filtered = array_values( array_diff( $enabled, array( $plugin_file ) ) );
		update_site_option( self::PLUGIN_OPTION, $filtered );
		return true;
	}
}
