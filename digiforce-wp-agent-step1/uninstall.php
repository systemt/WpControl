<?php
/**
 * Uninstall handler — removes plugin options, transients, and the custom log table.
 *
 * @package DigiForce\WPAgent
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

global $wpdb;

// Remove plugin options (both single-site and multisite network-wide).
$options_to_delete = array(
	'digiforce_wpa_settings',
	'digiforce_wpa_db_version',
);

foreach ( $options_to_delete as $opt ) {
	delete_option( $opt );
	delete_site_option( $opt );
}

// Flush the cached scan summary.
delete_transient( 'digiforce_wpa_last_scan_summary' );

// Clear replay-protection transients (and their timeout rows).
$wpdb->query(
	$wpdb->prepare(
		"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s", // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		'_transient_dfwpa_rep_%',
		'_transient_timeout_dfwpa_rep_%'
	)
);

// Drop the custom log table.
$table = $wpdb->prefix . 'digiforce_wpa_logs';
$wpdb->query( "DROP TABLE IF EXISTS `{$table}`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery
