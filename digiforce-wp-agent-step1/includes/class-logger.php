<?php
/**
 * Local logger backed by a custom database table.
 *
 * @package DigiForce\WPAgent
 */

namespace DigiForce\WPAgent;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Logger {

	public const LEVEL_INFO    = 'info';
	public const LEVEL_WARNING = 'warning';
	public const LEVEL_ERROR   = 'error';

	public const CATEGORY_SECURITY = 'security';
	public const CATEGORY_SYNC     = 'sync';
	public const CATEGORY_SCAN     = 'scan';
	public const CATEGORY_COMMAND  = 'command';
	public const CATEGORY_UPDATE   = 'update';
	public const CATEGORY_SYSTEM   = 'system';

	private const DB_VERSION        = '1.0.0';
	private const DB_VERSION_OPTION = 'digiforce_wpa_db_version';

	/**
	 * Fully-qualified table name with the site prefix.
	 */
	public function table() : string {
		global $wpdb;
		return $wpdb->prefix . DIGIFORCE_WPA_LOG_TABLE;
	}

	/**
	 * Create or update the log table via dbDelta.
	 */
	public function install_table() : void {
		global $wpdb;
		$table           = $this->table();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table} (
			id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			level VARCHAR(16) NOT NULL DEFAULT 'info',
			category VARCHAR(32) NOT NULL DEFAULT 'system',
			action VARCHAR(64) NOT NULL DEFAULT '',
			target_type VARCHAR(32) NOT NULL DEFAULT '',
			target_name VARCHAR(191) NOT NULL DEFAULT '',
			message TEXT NULL,
			context_json LONGTEXT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY idx_level (level),
			KEY idx_category (category),
			KEY idx_created (created_at)
		) {$charset_collate};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
		update_option( self::DB_VERSION_OPTION, self::DB_VERSION, false );
	}

	/**
	 * Canonical log entry point.
	 */
	public function log(
		string $level,
		string $category,
		string $action,
		string $target_type = '',
		string $target_name = '',
		string $message = '',
		array $context = array()
	) : void {
		global $wpdb;

		$allowed_levels = array( self::LEVEL_INFO, self::LEVEL_WARNING, self::LEVEL_ERROR );
		$clean_level    = in_array( $level, $allowed_levels, true ) ? $level : self::LEVEL_INFO;

		$wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$this->table(),
			array(
				'level'        => $clean_level,
				'category'     => sanitize_key( $category ) ?: self::CATEGORY_SYSTEM,
				'action'       => substr( sanitize_text_field( $action ), 0, 64 ),
				'target_type'  => substr( sanitize_text_field( $target_type ), 0, 32 ),
				'target_name'  => substr( sanitize_text_field( $target_name ), 0, 191 ),
				'message'      => wp_strip_all_tags( (string) $message ),
				'context_json' => ! empty( $context ) ? wp_json_encode( $context ) : null,
				'created_at'   => current_time( 'mysql' ),
			),
			array( '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s' )
		);
	}

	public function info( string $category, string $action, string $message = '', string $target_type = '', string $target_name = '', array $context = array() ) : void {
		$this->log( self::LEVEL_INFO, $category, $action, $target_type, $target_name, $message, $context );
	}

	public function warning( string $category, string $action, string $message = '', string $target_type = '', string $target_name = '', array $context = array() ) : void {
		$this->log( self::LEVEL_WARNING, $category, $action, $target_type, $target_name, $message, $context );
	}

	public function error( string $category, string $action, string $message = '', string $target_type = '', string $target_name = '', array $context = array() ) : void {
		$this->log( self::LEVEL_ERROR, $category, $action, $target_type, $target_name, $message, $context );
	}

	/**
	 * Retrieve the most recent log rows.
	 *
	 * @return array<int,array<string,mixed>>
	 */
	public function get_recent( int $limit = 20 ) : array {
		global $wpdb;
		$limit = max( 1, min( $limit, 500 ) );
		$rows  = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$wpdb->prepare( "SELECT * FROM {$this->table()} ORDER BY id DESC LIMIT %d", $limit ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			ARRAY_A
		);
		return is_array( $rows ) ? $rows : array();
	}

	/**
	 * Delete rows older than N days.
	 */
	public function prune( int $retention_days ) : void {
		global $wpdb;
		$days = max( 1, $retention_days );
		$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$wpdb->prepare(
				"DELETE FROM {$this->table()} WHERE created_at < DATE_SUB(NOW(), INTERVAL %d DAY)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$days
			)
		);
	}
}
