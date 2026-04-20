<?php
/**
 * Shared static helpers.
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Utils {

	/**
	 * Generate an RFC 4122 v4 UUID.
	 */
	public static function generate_uuid_v4() : string {
		$data    = random_bytes( 16 );
		$data[6] = chr( ( ord( $data[6] ) & 0x0f ) | 0x40 );
		$data[8] = chr( ( ord( $data[8] ) & 0x3f ) | 0x80 );
		return vsprintf( '%s%s-%s-%s-%s-%s%s%s', str_split( bin2hex( $data ), 4 ) );
	}

	/**
	 * Generate a cryptographically strong hex secret key.
	 */
	public static function generate_secret_key( int $bytes = 48 ) : string {
		$bytes = max( 16, $bytes );
		return bin2hex( random_bytes( $bytes ) );
	}

	/**
	 * Format a Unix timestamp using the site's date+time format.
	 * Returns an em-dash for empty/zero values.
	 */
	public static function format_timestamp( int $timestamp ) : string {
		if ( $timestamp <= 0 ) {
			return '—';
		}
		$format = trim( (string) get_option( 'date_format' ) . ' ' . (string) get_option( 'time_format' ) );
		if ( '' === $format ) {
			$format = 'Y-m-d H:i';
		}
		return (string) wp_date( $format, $timestamp );
	}

	/**
	 * Safe nested array access with dot-notation keys.
	 */
	public static function array_get( array $array, string $key, mixed $default = null ) : mixed {
		if ( false === strpos( $key, '.' ) ) {
			return array_key_exists( $key, $array ) ? $array[ $key ] : $default;
		}
		$cursor = $array;
		foreach ( explode( '.', $key ) as $segment ) {
			if ( ! is_array( $cursor ) || ! array_key_exists( $segment, $cursor ) ) {
				return $default;
			}
			$cursor = $cursor[ $segment ];
		}
		return $cursor;
	}

	/**
	 * Cast a mixed value to int with a fallback default.
	 */
	public static function safe_int( mixed $value, int $default = 0 ) : int {
		return is_numeric( $value ) ? (int) $value : $default;
	}
}
