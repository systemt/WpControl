<?php
/**
 * Uninstall handler for DigiForce WP Agent.
 *
 * Removes plugin options, the custom log table, and replay-protection transients.
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

// Drop custom log table.
$table = $wpdb->prefix . 'digiforce_wpa_logs';
$wpdb->query( "DROP TABLE IF EXISTS `{$table}`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

// Clear replay-protection transients.
$wpdb->query(
	$wpdb->prepare(
		"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
		'_transient_dfwpa_rep_%',
		'_transient_timeout_dfwpa_rep_%'
	)
);

// Unschedule any cron hooks.
$hook = 'digiforce_wpa_cron_sync';
$ts   = wp_next_scheduled( $hook );
while ( false !== $ts ) {
	wp_unschedule_event( $ts, $hook );
	$ts = wp_next_scheduled( $hook );
}
