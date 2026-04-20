<?php
/**
 * Centralised settings access for DigiForce WP Agent.
 *
 * All options are persisted under a single `digiforce_wpa_settings` array
 * so the plugin owns exactly one wp_options row.
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Settings {

	public const KEY = DIGIFORCE_WPA_OPTION_KEY;

	/**
	 * Default option values. Any key absent here is considered unknown.
	 */
	private const DEFAULTS = array(
		'central_server_url'          => '',
		'site_uuid'                   => '',
		'secret_key'                  => '',
		'connection_enabled'          => false,
		'environment'                 => 'production',
		'last_sync_at'                => 0,
		'last_connection_status'      => '',
		'allow_remote_plugin_updates' => true,
		'allow_remote_activation'     => true,
		'allow_remote_deactivation'   => true,
		'allow_bulk_updates'          => true,
		'require_signed_requests'     => true,
		'allowed_ips'                 => '',
		'log_retention_days'          => 30,
		'debug_mode'                  => false,
	);

	/**
	 * Return all settings merged with defaults.
	 */
	public function all() : array {
		$saved = get_option( self::KEY, array() );
		if ( ! is_array( $saved ) ) {
			$saved = array();
		}
		return array_merge( self::DEFAULTS, $saved );
	}

	public function get( string $key, mixed $default = null ) : mixed {
		$all = $this->all();
		return array_key_exists( $key, $all ) ? $all[ $key ] : $default;
	}

	public function set( string $key, mixed $value ) : void {
		$all         = $this->all();
		$all[ $key ] = $value;
		update_option( self::KEY, $all, false );
	}

	public function update_many( array $values ) : void {
		$all = $this->all();
		foreach ( $values as $k => $v ) {
			$all[ $k ] = $v;
		}
		update_option( self::KEY, $all, false );
	}

	/**
	 * Write defaults on first activation without clobbering existing values.
	 */
	public function ensure_defaults() : void {
		$saved = get_option( self::KEY, null );
		if ( null === $saved ) {
			update_option( self::KEY, self::DEFAULTS, false );
			return;
		}
		if ( is_array( $saved ) ) {
			$merged = array_merge( self::DEFAULTS, $saved );
			if ( $merged !== $saved ) {
				update_option( self::KEY, $merged, false );
			}
		}
	}

	public function defaults() : array {
		return self::DEFAULTS;
	}

	/**
	 * Sanitise a raw $_POST payload against the allowed settings.
	 */
	public function sanitize( array $input ) : array {
		$out = $this->all();

		if ( array_key_exists( 'central_server_url', $input ) ) {
			$out['central_server_url'] = esc_url_raw( trim( (string) $input['central_server_url'] ) );
		}

		if ( array_key_exists( 'environment', $input ) ) {
			$env                 = sanitize_key( (string) $input['environment'] );
			$out['environment']  = in_array( $env, array( 'production', 'staging', 'development' ), true ) ? $env : 'production';
		}

		$booleans = array(
			'connection_enabled',
			'allow_remote_plugin_updates',
			'allow_remote_activation',
			'allow_remote_deactivation',
			'allow_bulk_updates',
			'require_signed_requests',
			'debug_mode',
		);

		// Checkboxes are only present when checked, so always normalise.
		foreach ( $booleans as $b ) {
			$out[ $b ] = ! empty( $input[ $b ] );
		}

		if ( array_key_exists( 'allowed_ips', $input ) ) {
			$ips                 = (string) $input['allowed_ips'];
			$out['allowed_ips']  = implode(
				',',
				array_filter(
					array_map(
						static function ( $v ) {
							$v = trim( $v );
							return filter_var( $v, FILTER_VALIDATE_IP ) ? $v : '';
						},
						explode( ',', $ips )
					)
				)
			);
		}

		if ( array_key_exists( 'log_retention_days', $input ) ) {
			$days = (int) $input['log_retention_days'];
			if ( $days < 1 ) {
				$days = 1;
			}
			if ( $days > 365 ) {
				$days = 365;
			}
			$out['log_retention_days'] = $days;
		}

		return $out;
	}
}
