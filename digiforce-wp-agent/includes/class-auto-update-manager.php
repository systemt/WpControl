<?php
/**
 * Helpers for WordPress 5.5+ per-plugin auto-update state.
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AutoUpdateManager {

	private const PLUGIN_OPTION = 'auto_update_plugins';
	private const THEME_OPTION  = 'auto_update_themes';

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

	public function is_theme_auto_update_enabled( string $stylesheet ) : bool {
		$enabled = (array) get_site_option( self::THEME_OPTION, array() );
		return in_array( $stylesheet, $enabled, true );
	}
}
