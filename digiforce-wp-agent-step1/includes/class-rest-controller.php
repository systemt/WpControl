<?php
/**
 * REST API surface — registers `/health`, `/scan`, and `/command` under the
 * `digiforce-agent/v1` namespace.
 *
 * `/scan` and `/command` are gated by `Security::authorize()`; `/health` is public.
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class RestController {

	public const CACHE_KEY = 'digiforce_wpa_last_scan_summary';
	public const CACHE_TTL = HOUR_IN_SECONDS;

	public function __construct(
		private Settings $settings,
		private Logger $logger,
		private UpdateScanner $scanner,
		private Security $security,
		private CommandRunner $runner
	) {}

	public function register_hooks() : void {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Registers every REST route. Idempotent — safe to run more than once.
	 */
	public function register_routes() : void {
		$namespace = DIGIFORCE_WPA_REST_NAMESPACE;

		register_rest_route(
			$namespace,
			'/health',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'handle_health' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			$namespace,
			'/scan',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'handle_scan' ),
				'permission_callback' => array( $this->security, 'authorize' ),
			)
		);

		register_rest_route(
			$namespace,
			'/command',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'handle_command' ),
				'permission_callback' => array( $this->security, 'authorize' ),
			)
		);
	}

	/* ------------------------------------------------------------------ */
	/*  Route handlers                                                     */
	/* ------------------------------------------------------------------ */

	public function handle_health( WP_REST_Request $request ) : WP_REST_Response {
		unset( $request );

		$data = array(
			'plugin'         => 'DigiForce WP Agent',
			'plugin_version' => DIGIFORCE_WPA_VERSION,
			'site_uuid'      => (string) $this->settings->get( 'site_uuid', '' ),
			'site_url'       => home_url( '/' ),
			'connected'      => (bool) $this->settings->get( 'connection_enabled', false ),
			'server_time'    => (string) wp_date( 'c', time() ),
		);

		return new WP_REST_Response(
			array(
				'success' => true,
				'data'    => $data,
			),
			200
		);
	}

	public function handle_scan( WP_REST_Request $request ) : WP_REST_Response {
		unset( $request );

		$summary = $this->scanner->summary( true );
		set_transient( self::CACHE_KEY, $summary, self::CACHE_TTL );

		$this->logger->info(
			Logger::CATEGORY_SCAN,
			'rest_scan',
			__( 'Update scan via REST.', 'digiforce-wp-agent' ),
			'route',
			'/scan',
			array(
				'plugins_need_update' => $summary['counts']['plugins_need_update'],
				'themes_need_update'  => $summary['counts']['themes_need_update'],
				'core_need_update'    => $summary['core_need_update'],
			)
		);

		$payload = array(
			'success' => true,
			'message' => __( 'Scan completed', 'digiforce-wp-agent' ),
			'data'    => array(
				'plugins_need_update' => (int) $summary['counts']['plugins_need_update'],
				'themes_need_update'  => (int) $summary['counts']['themes_need_update'],
				'core_need_update'    => (bool) $summary['core_need_update'],
				'counts'              => array(
					'plugins_total' => (int) $summary['counts']['plugins_installed'],
					'themes_total'  => (int) $summary['counts']['themes_installed'],
				),
				'scanned_at'          => (string) wp_date( 'c', (int) $summary['scanned_at'] ),
			),
		);

		return new WP_REST_Response( $payload, 200 );
	}

	public function handle_command( WP_REST_Request $request ) : WP_REST_Response {
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			$params = array();
		}

		$command_id = isset( $params['command_id'] ) ? sanitize_text_field( (string) $params['command_id'] ) : '';
		$action     = isset( $params['action'] ) ? sanitize_key( (string) $params['action'] ) : '';
		$payload    = isset( $params['payload'] ) && is_array( $params['payload'] ) ? $params['payload'] : array();

		$payload = $this->sanitize_payload( $payload );

		$result = $this->runner->handle( $command_id, $action, $payload );
		$status = ! empty( $result['success'] ) ? 200 : 400;

		if ( ! empty( $result['error']['code'] ) ) {
			$status = match ( $result['error']['code'] ) {
				'unauthorized_request'         => 403,
				'plugin_not_found'             => 404,
				'plugin_already_active',
				'plugin_already_inactive',
				'plugin_update_not_available'  => 409,
				'invalid_payload',
				'missing_plugin_file',
				'missing_command_id',
				'missing_action',
				'unsupported_action'           => 400,
				'filesystem_not_ready',
				'internal_server_error'        => 500,
				default                        => 400,
			};
		}

		return new WP_REST_Response( $result, $status );
	}

	/**
	 * Shallow payload sanitisation: keys → sanitize_key, scalar values →
	 * sanitize_text_field, one-level array values sanitised the same way.
	 */
	private function sanitize_payload( array $payload ) : array {
		$clean = array();
		foreach ( $payload as $key => $value ) {
			$k = sanitize_key( (string) $key );
			if ( '' === $k ) {
				continue;
			}
			if ( is_array( $value ) ) {
				$clean[ $k ] = array_map(
					static fn ( $v ) => is_scalar( $v ) ? sanitize_text_field( (string) $v ) : '',
					$value
				);
			} elseif ( is_scalar( $value ) ) {
				$clean[ $k ] = sanitize_text_field( (string) $value );
			}
		}
		return $clean;
	}
}
