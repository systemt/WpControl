<?php
/**
 * Request-signing + replay-protection layer.
 *
 * Canonical REST permission gate for every protected endpoint. Validates:
 *   - connection_enabled
 *   - optional IP allowlist
 *   - HMAC-SHA256 signature of body|timestamp|route
 *   - 5 minute clock-skew window
 *   - X-Request-ID replay window (transient-backed)
 *
 * When `require_signed_requests` is turned off we drop to a dev-mode bypass
 * that only verifies the X-Site-UUID header — the full signing layer remains
 * for production.
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

use WP_Error;
use WP_REST_Request;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Security {

	/**
	 * Maximum allowable clock skew / replay window (seconds).
	 */
	public const REPLAY_WINDOW_SECONDS = 300;

	public function __construct(
		private Settings $settings,
		private Logger $logger
	) {}

	/**
	 * Permission callback for protected REST routes.
	 *
	 * @return true|WP_Error
	 */
	public function authorize( WP_REST_Request $request ) : bool|WP_Error {
		if ( ! (bool) $this->settings->get( 'connection_enabled', false ) ) {
			$this->log_failure( $request, 'connection_disabled', 'Agent connection is disabled.' );
			return new WP_Error(
				'unauthorized_request',
				__( 'Agent connection is disabled.', 'digiforce-wp-agent' ),
				array( 'status' => 403 )
			);
		}

		$ip_check = $this->check_ip_allowlist();
		if ( is_wp_error( $ip_check ) ) {
			$this->log_failure( $request, 'ip_blocked', $ip_check->get_error_message() );
			return $ip_check;
		}

		// Development bypass — still requires a matching Site UUID header so it
		// can't be hit anonymously.
		if ( ! (bool) $this->settings->get( 'require_signed_requests', true ) ) {
			$provided_uuid = (string) $request->get_header( 'x_site_uuid' );
			$expected      = (string) $this->settings->get( 'site_uuid', '' );
			if ( '' === $expected || '' === $provided_uuid || ! hash_equals( $expected, $provided_uuid ) ) {
				$this->log_failure( $request, 'uuid_mismatch_dev', 'Site UUID mismatch in dev mode.' );
				return new WP_Error(
					'unauthorized_request',
					__( 'Site UUID mismatch.', 'digiforce-wp-agent' ),
					array( 'status' => 401 )
				);
			}
			return true;
		}

		$site_uuid  = (string) $request->get_header( 'x_site_uuid' );
		$timestamp  = (string) $request->get_header( 'x_timestamp' );
		$request_id = (string) $request->get_header( 'x_request_id' );
		$signature  = (string) $request->get_header( 'x_signature' );

		if ( '' === $site_uuid || '' === $timestamp || '' === $request_id || '' === $signature ) {
			$this->log_failure( $request, 'missing_headers', 'Missing required security headers.' );
			return new WP_Error(
				'unauthorized_request',
				__( 'Missing required security headers.', 'digiforce-wp-agent' ),
				array( 'status' => 401 )
			);
		}

		$expected_uuid = (string) $this->settings->get( 'site_uuid', '' );
		if ( '' === $expected_uuid || ! hash_equals( $expected_uuid, $site_uuid ) ) {
			$this->log_failure( $request, 'uuid_mismatch', 'Site UUID mismatch.' );
			return new WP_Error(
				'unauthorized_request',
				__( 'Site UUID mismatch.', 'digiforce-wp-agent' ),
				array( 'status' => 401 )
			);
		}

		$ts = (int) $timestamp;
		if ( $ts <= 0 || abs( time() - $ts ) > self::REPLAY_WINDOW_SECONDS ) {
			$this->log_failure( $request, 'invalid_timestamp', 'Timestamp too old or invalid.' );
			return new WP_Error(
				'invalid_timestamp',
				__( 'Request timestamp is invalid or expired.', 'digiforce-wp-agent' ),
				array( 'status' => 401 )
			);
		}

		$clean_request_id = preg_replace( '/[^A-Za-z0-9\-_.]/', '', $request_id );
		if ( null === $clean_request_id || '' === $clean_request_id || strlen( $clean_request_id ) > 128 ) {
			$this->log_failure( $request, 'invalid_request_id', 'Invalid X-Request-ID.' );
			return new WP_Error(
				'unauthorized_request',
				__( 'Invalid request ID.', 'digiforce-wp-agent' ),
				array( 'status' => 401 )
			);
		}

		if ( $this->is_replayed( $clean_request_id ) ) {
			$this->log_failure( $request, 'replay_detected', 'Replayed request ID.' );
			return new WP_Error(
				'request_replayed',
				__( 'This request has already been processed.', 'digiforce-wp-agent' ),
				array( 'status' => 409 )
			);
		}

		$secret = (string) $this->settings->get( 'secret_key', '' );
		if ( '' === $secret ) {
			$this->log_failure( $request, 'missing_secret', 'Secret key not configured.' );
			return new WP_Error(
				'unauthorized_request',
				__( 'Secret key not configured.', 'digiforce-wp-agent' ),
				array( 'status' => 500 )
			);
		}

		$body     = (string) $request->get_body();
		$route    = $this->build_route_for_signature( $request );
		$payload  = $body . '|' . $timestamp . '|' . $route;
		$expected = hash_hmac( 'sha256', $payload, $secret );

		if ( ! hash_equals( $expected, strtolower( $signature ) ) ) {
			$this->log_failure( $request, 'invalid_signature', 'HMAC signature mismatch.' );
			return new WP_Error(
				'invalid_signature',
				__( 'Invalid request signature.', 'digiforce-wp-agent' ),
				array( 'status' => 401 )
			);
		}

		$this->mark_processed( $clean_request_id );
		return true;
	}

	/**
	 * Enforce the optional IP allowlist.
	 *
	 * @return true|WP_Error
	 */
	public function check_ip_allowlist() : bool|WP_Error {
		$raw = trim( (string) $this->settings->get( 'allowed_ips', '' ) );
		if ( '' === $raw ) {
			return true;
		}
		$allowed = array_filter( array_map( 'trim', explode( ',', $raw ) ) );
		if ( empty( $allowed ) ) {
			return true;
		}
		$ip = Utils::client_ip();
		if ( '' === $ip || ! in_array( $ip, $allowed, true ) ) {
			return new WP_Error(
				'unauthorized_request',
				__( 'IP address not allowed.', 'digiforce-wp-agent' ),
				array( 'status' => 403 )
			);
		}
		return true;
	}

	private function is_replayed( string $request_id ) : bool {
		return false !== get_transient( DIGIFORCE_WPA_REPLAY_PREFIX . $request_id );
	}

	private function mark_processed( string $request_id ) : void {
		set_transient( DIGIFORCE_WPA_REPLAY_PREFIX . $request_id, 1, self::REPLAY_WINDOW_SECONDS * 2 );
	}

	/**
	 * Build the full REST route string used when computing the HMAC.
	 * `WP_REST_Request::get_route()` already returns the namespaced route.
	 */
	private function build_route_for_signature( WP_REST_Request $request ) : string {
		$route = $request->get_route();
		if ( '' === $route ) {
			return '';
		}
		if ( '/' !== $route[0] ) {
			$route = '/' . $route;
		}
		return $route;
	}

	private function log_failure( WP_REST_Request $request, string $action, string $message ) : void {
		$this->logger->warning(
			Logger::CATEGORY_SECURITY,
			$action,
			$message,
			'route',
			(string) $request->get_route(),
			array(
				'ip'               => Utils::client_ip(),
				'site_uuid_header' => (string) $request->get_header( 'x_site_uuid' ),
				'request_id'       => (string) $request->get_header( 'x_request_id' ),
			)
		);
	}
}
