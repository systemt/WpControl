<?php
/**
 * Shared helpers for DigiForce WP Agent.
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
	 * Best-effort client IP detection honouring reverse proxies.
	 */
	public static function client_ip() : string {
		$candidates = array();

		if ( ! empty( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) {
			$xff = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_FORWARDED_FOR'] ) );
			foreach ( explode( ',', $xff ) as $part ) {
				$candidates[] = trim( $part );
			}
		}
		if ( ! empty( $_SERVER['REMOTE_ADDR'] ) ) {
			$candidates[] = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) );
		}

		foreach ( $candidates as $candidate ) {
			if ( filter_var( $candidate, FILTER_VALIDATE_IP ) ) {
				return $candidate;
			}
		}
		return '';
	}

	/**
	 * Cast a mixed value to int with a fallback default.
	 */
	public static function safe_int( mixed $value, int $default = 0 ) : int {
		return is_numeric( $value ) ? (int) $value : $default;
	}
}
