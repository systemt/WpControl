<?php
/**
 * Manages site identity (UUID + secret) and outbound sync to the central server.
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class ConnectionManager {

	public const CRON_HOOK = 'digiforce_wpa_cron_sync';

	public function __construct(
		private Settings $settings,
		private Logger $logger,
		private UpdateScanner $scanner
	) {}

	public function register_hooks() : void {
		add_action( self::CRON_HOOK, array( $this, 'run_scheduled_sync' ) );
		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time() + 300, 'twicedaily', self::CRON_HOOK );
		}
	}

	/**
	 * Generate UUID and secret if they don't exist yet.
	 */
	public function ensure_identity() : void {
		$uuid   = (string) $this->settings->get( 'site_uuid', '' );
		$secret = (string) $this->settings->get( 'secret_key', '' );

		$dirty = array();
		if ( '' === $uuid ) {
			$dirty['site_uuid'] = Utils::generate_uuid_v4();
		}
		if ( '' === $secret ) {
			$dirty['secret_key'] = Utils::generate_secret_key();
		}
		if ( ! empty( $dirty ) ) {
			$this->settings->update_many( $dirty );
		}
	}

	public function regenerate_uuid() : string {
		$uuid = Utils::generate_uuid_v4();
		$this->settings->set( 'site_uuid', $uuid );
		$this->logger->log( Logger::LEVEL_INFO, Logger::CATEGORY_SYSTEM, 'regenerate_uuid', 'system', '', __( 'Site UUID regenerated.', 'digiforce-wp-agent' ) );
		return $uuid;
	}

	public function rotate_secret() : string {
		$secret = Utils::generate_secret_key();
		$this->settings->set( 'secret_key', $secret );
		$this->logger->log( Logger::LEVEL_WARNING, Logger::CATEGORY_SYSTEM, 'rotate_secret', 'system', '', __( 'Secret key rotated.', 'digiforce-wp-agent' ) );
		return $secret;
	}

	public function run_scheduled_sync() : void {
		if ( ! (bool) $this->settings->get( 'connection_enabled', false ) ) {
			return;
		}
		$this->sync_now();
	}

	/**
	 * Run an update scan and, if configured, push a summary to the central server.
	 */
	public function sync_now() : array {
		$summary = $this->scanner->summary( true );
		$this->settings->update_many(
			array(
				'last_sync_at'           => time(),
				'last_connection_status' => 'ok',
			)
		);

		$this->logger->log(
			Logger::LEVEL_INFO,
			Logger::CATEGORY_SYNC,
			'sync_now',
			'system',
			'',
			__( 'Local sync completed.', 'digiforce-wp-agent' ),
			array(
				'plugins_need' => count( $summary['plugins_need_update'] ),
				'themes_need'  => count( $summary['themes_need_update'] ),
				'core_update'  => $summary['core_need_update'],
			)
		);

		$central_url = trim( (string) $this->settings->get( 'central_server_url', '' ) );
		if ( '' !== $central_url && (bool) $this->settings->get( 'connection_enabled', false ) ) {
			$this->push_to_central( $central_url, $summary );
		}
		return $summary;
	}

	private function push_to_central( string $url, array $summary ) : void {
		$body = wp_json_encode(
			array(
				'site_uuid' => (string) $this->settings->get( 'site_uuid', '' ),
				'site_url'  => home_url( '/' ),
				'summary'   => $summary,
				'sent_at'   => time(),
			)
		);
		if ( ! is_string( $body ) ) {
			return;
		}

		$timestamp = (string) time();
		$route     = '/agent/ingest';
		$signature = hash_hmac(
			'sha256',
			$body . '|' . $timestamp . '|' . $route,
			(string) $this->settings->get( 'secret_key', '' )
		);

		$response = wp_remote_post(
			rtrim( $url, '/' ) . $route,
			array(
				'timeout' => 15,
				'headers' => array(
					'Content-Type' => 'application/json',
					'X-Site-UUID'  => (string) $this->settings->get( 'site_uuid', '' ),
					'X-Timestamp'  => $timestamp,
					'X-Request-ID' => Utils::generate_uuid_v4(),
					'X-Signature'  => $signature,
				),
				'body'    => $body,
			)
		);

		if ( is_wp_error( $response ) ) {
			$this->settings->set( 'last_connection_status', 'error: ' . $response->get_error_message() );
			$this->logger->log( Logger::LEVEL_ERROR, Logger::CATEGORY_SYNC, 'push_to_central', 'central', $url, $response->get_error_message() );
			return;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$this->settings->set( 'last_connection_status', 'http_' . $code );
		$this->logger->log(
			( $code >= 200 && $code < 300 ) ? Logger::LEVEL_INFO : Logger::LEVEL_WARNING,
			Logger::CATEGORY_SYNC,
			'push_to_central',
			'central',
			$url,
			sprintf(
				/* translators: %d: HTTP status code */
				__( 'Central server replied with HTTP %d.', 'digiforce-wp-agent' ),
				$code
			)
		);
	}
}
