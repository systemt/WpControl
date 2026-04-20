<?php
/**
 * REST API surface — registers routes and normalises responses.
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class RestController {

	public function __construct(
		private Settings $settings,
		private Security $security,
		private CommandRunner $runner,
		private UpdateScanner $scanner,
		private Logger $logger
	) {}

	public function register_hooks() : void {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	public function register_routes() : void {
		register_rest_route(
			DIGIFORCE_WPA_REST_NAMESPACE,
			'/health',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'handle_health' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			DIGIFORCE_WPA_REST_NAMESPACE,
			'/scan',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'handle_scan' ),
				'permission_callback' => array( $this, 'authorize' ),
			)
		);

		register_rest_route(
			DIGIFORCE_WPA_REST_NAMESPACE,
			'/command',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'handle_command' ),
				'permission_callback' => array( $this, 'authorize' ),
			)
		);
	}

	/**
	 * Bridge to the Security layer.
	 *
	 * @return true|WP_Error
	 */
	public function authorize( WP_REST_Request $request ) : bool|WP_Error {
		$result = $this->security->authorize( $request );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return true;
	}

	public function handle_health( WP_REST_Request $request ) : WP_REST_Response {
		unset( $request );
		$data = array(
			'success'     => true,
			'plugin'      => 'DigiForce WP Agent',
			'version'     => DIGIFORCE_WPA_VERSION,
			'site_uuid'   => (string) $this->settings->get( 'site_uuid', '' ),
			'site_url'    => home_url( '/' ),
			'connected'   => (bool) $this->settings->get( 'connection_enabled', false ),
			'server_time' => time(),
		);
		return new WP_REST_Response( $data, 200 );
	}

	public function handle_scan( WP_REST_Request $request ) : WP_REST_Response {
		unset( $request );
		$summary = $this->scanner->summary( true );
		$this->logger->log( Logger::LEVEL_INFO, Logger::CATEGORY_SCAN, 'rest_scan', 'route', '/scan', __( 'Update scan via REST.', 'digiforce-wp-agent' ) );
		return new WP_REST_Response(
			array(
				'success' => true,
				'data'    => $summary,
			),
			200
		);
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
	 * Shallow sanitise of the payload object: keys are sanitised as keys, scalar
	 * values are sanitised as text fields, and one level of array values is
	 * allowed for fields like `plugin_files`.
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
