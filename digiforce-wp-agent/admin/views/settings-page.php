<?php
/**
 * Admin settings page view.
 *
 * @package DigiForce\WPAgent
 *
 * @var array  $settings
 * @var array  $summary
 * @var array  $logs
 * @var array  $site_info
 * @var string $nonce_field
 * @var string $nonce_action
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$notice          = isset( $_GET['notice'] ) ? sanitize_key( (string) wp_unslash( $_GET['notice'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
$notice_messages = array(
	'saved'            => __( 'Settings saved.', 'digiforce-wp-agent' ),
	'uuid_regenerated' => __( 'A new Site UUID has been generated.', 'digiforce-wp-agent' ),
	'secret_rotated'   => __( 'The secret key has been rotated. Update your central server immediately.', 'digiforce-wp-agent' ),
	'scanned'          => __( 'Update scan completed.', 'digiforce-wp-agent' ),
	'synced'           => __( 'Sync completed.', 'digiforce-wp-agent' ),
);
?>
<div class="wrap digiforce-wpa-wrap">
	<h1><?php esc_html_e( 'DigiForce WP Agent', 'digiforce-wp-agent' ); ?></h1>

	<?php if ( '' !== $notice && isset( $notice_messages[ $notice ] ) ) : ?>
		<div class="notice notice-success is-dismissible">
			<p><?php echo esc_html( $notice_messages[ $notice ] ); ?></p>
		</div>
	<?php endif; ?>

	<div class="digiforce-wpa-grid">
		<div class="digiforce-wpa-card">
			<h2><?php esc_html_e( 'Site Overview', 'digiforce-wp-agent' ); ?></h2>
			<table class="widefat striped digiforce-wpa-info">
				<tbody>
					<tr>
						<th><?php esc_html_e( 'Plugin Version', 'digiforce-wp-agent' ); ?></th>
						<td><?php echo esc_html( $site_info['plugin_version'] ); ?></td>
					</tr>
					<tr>
						<th><?php esc_html_e( 'Site UUID', 'digiforce-wp-agent' ); ?></th>
						<td><code><?php echo esc_html( $site_info['site_uuid'] ); ?></code></td>
					</tr>
					<tr>
						<th><?php esc_html_e( 'Central Server URL', 'digiforce-wp-agent' ); ?></th>
						<td>
							<?php if ( '' !== $site_info['central_server_url'] ) : ?>
								<code><?php echo esc_html( $site_info['central_server_url'] ); ?></code>
							<?php else : ?>
								<em><?php esc_html_e( 'Not configured', 'digiforce-wp-agent' ); ?></em>
							<?php endif; ?>
						</td>
					</tr>
					<tr>
						<th><?php esc_html_e( 'Connection Enabled', 'digiforce-wp-agent' ); ?></th>
						<td>
							<?php if ( $site_info['connection_enabled'] ) : ?>
								<span class="digiforce-wpa-badge on"><?php esc_html_e( 'Enabled', 'digiforce-wp-agent' ); ?></span>
							<?php else : ?>
								<span class="digiforce-wpa-badge off"><?php esc_html_e( 'Disabled', 'digiforce-wp-agent' ); ?></span>
							<?php endif; ?>
						</td>
					</tr>
					<tr>
						<th><?php esc_html_e( 'Connection Status', 'digiforce-wp-agent' ); ?></th>
						<td><?php echo esc_html( '' !== $site_info['last_connection_status'] ? $site_info['last_connection_status'] : __( 'Unknown', 'digiforce-wp-agent' ) ); ?></td>
					</tr>
					<tr>
						<th><?php esc_html_e( 'Last Sync', 'digiforce-wp-agent' ); ?></th>
						<td>
							<?php
							if ( $site_info['last_sync_at'] > 0 ) {
								printf(
									/* translators: %s: human-readable time difference */
									esc_html__( '%s ago', 'digiforce-wp-agent' ),
									esc_html( human_time_diff( $site_info['last_sync_at'], time() ) )
								);
							} else {
								esc_html_e( 'Never', 'digiforce-wp-agent' );
							}
							?>
						</td>
					</tr>
					<tr>
						<th><?php esc_html_e( 'WordPress Version', 'digiforce-wp-agent' ); ?></th>
						<td><?php echo esc_html( $site_info['wp_version'] ); ?></td>
					</tr>
					<tr>
						<th><?php esc_html_e( 'PHP Version', 'digiforce-wp-agent' ); ?></th>
						<td><?php echo esc_html( $site_info['php_version'] ); ?></td>
					</tr>
					<tr>
						<th><?php esc_html_e( 'Installed Plugins', 'digiforce-wp-agent' ); ?></th>
						<td><?php echo esc_html( (string) $site_info['plugins_installed'] ); ?></td>
					</tr>
					<tr>
						<th><?php esc_html_e( 'Plugins Needing Updates', 'digiforce-wp-agent' ); ?></th>
						<td><?php echo esc_html( (string) $site_info['plugins_need_update'] ); ?></td>
					</tr>
					<tr>
						<th><?php esc_html_e( 'Themes Needing Updates', 'digiforce-wp-agent' ); ?></th>
						<td><?php echo esc_html( (string) $site_info['themes_need_update'] ); ?></td>
					</tr>
					<tr>
						<th><?php esc_html_e( 'Core Update Available', 'digiforce-wp-agent' ); ?></th>
						<td><?php echo $site_info['core_update_available'] ? esc_html__( 'Yes', 'digiforce-wp-agent' ) : esc_html__( 'No', 'digiforce-wp-agent' ); ?></td>
					</tr>
				</tbody>
			</table>

			<div class="digiforce-wpa-actions">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="digiforce-wpa-inline-form">
					<?php wp_nonce_field( $nonce_action, $nonce_field ); ?>
					<input type="hidden" name="action" value="digiforce_wpa_scan_now" />
					<button type="submit" class="button"><?php esc_html_e( 'Scan Updates Now', 'digiforce-wp-agent' ); ?></button>
				</form>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="digiforce-wpa-inline-form">
					<?php wp_nonce_field( $nonce_action, $nonce_field ); ?>
					<input type="hidden" name="action" value="digiforce_wpa_sync_now" />
					<button type="submit" class="button button-primary"><?php esc_html_e( 'Sync Status Now', 'digiforce-wp-agent' ); ?></button>
				</form>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="digiforce-wpa-inline-form" onsubmit="return confirm('<?php echo esc_js( __( 'Generate a new Site UUID? The central server will lose track of this site until updated.', 'digiforce-wp-agent' ) ); ?>');">
					<?php wp_nonce_field( $nonce_action, $nonce_field ); ?>
					<input type="hidden" name="action" value="digiforce_wpa_regenerate_uuid" />
					<button type="submit" class="button"><?php esc_html_e( 'Generate New Site UUID', 'digiforce-wp-agent' ); ?></button>
				</form>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="digiforce-wpa-inline-form" onsubmit="return confirm('<?php echo esc_js( __( 'Rotate the secret key? Signed requests using the old key will stop working until the central server is updated.', 'digiforce-wp-agent' ) ); ?>');">
					<?php wp_nonce_field( $nonce_action, $nonce_field ); ?>
					<input type="hidden" name="action" value="digiforce_wpa_rotate_secret" />
					<button type="submit" class="button"><?php esc_html_e( 'Rotate Secret Key', 'digiforce-wp-agent' ); ?></button>
				</form>
			</div>
		</div>

		<div class="digiforce-wpa-card">
			<h2><?php esc_html_e( 'Connection Settings', 'digiforce-wp-agent' ); ?></h2>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<?php wp_nonce_field( $nonce_action, $nonce_field ); ?>
				<input type="hidden" name="action" value="digiforce_wpa_save_settings" />

				<table class="form-table">
					<tr>
						<th scope="row"><label for="digiforce_wpa_central"><?php esc_html_e( 'Central Server URL', 'digiforce-wp-agent' ); ?></label></th>
						<td>
							<input type="url" id="digiforce_wpa_central" class="regular-text"
								name="digiforce_wpa[central_server_url]"
								value="<?php echo esc_attr( $settings['central_server_url'] ); ?>"
								placeholder="https://example.com" />
							<p class="description"><?php esc_html_e( 'The base URL of the DigiForce central management system.', 'digiforce-wp-agent' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="digiforce_wpa_env"><?php esc_html_e( 'Environment', 'digiforce-wp-agent' ); ?></label></th>
						<td>
							<select id="digiforce_wpa_env" name="digiforce_wpa[environment]">
								<?php foreach ( array( 'production', 'staging', 'development' ) as $env ) : ?>
									<option value="<?php echo esc_attr( $env ); ?>" <?php selected( $settings['environment'], $env ); ?>>
										<?php echo esc_html( ucfirst( $env ) ); ?>
									</option>
								<?php endforeach; ?>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Connection Enabled', 'digiforce-wp-agent' ); ?></th>
						<td>
							<label>
								<input type="checkbox" name="digiforce_wpa[connection_enabled]" value="1"
									<?php checked( (bool) $settings['connection_enabled'] ); ?> />
								<?php esc_html_e( 'Allow the central server to issue commands to this site.', 'digiforce-wp-agent' ); ?>
							</label>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Require Signed Requests', 'digiforce-wp-agent' ); ?></th>
						<td>
							<label>
								<input type="checkbox" name="digiforce_wpa[require_signed_requests]" value="1"
									<?php checked( (bool) $settings['require_signed_requests'] ); ?> />
								<?php esc_html_e( 'Require HMAC SHA256 signature on all REST requests (strongly recommended).', 'digiforce-wp-agent' ); ?>
							</label>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="digiforce_wpa_ips"><?php esc_html_e( 'Allowed IPs (optional)', 'digiforce-wp-agent' ); ?></label></th>
						<td>
							<input type="text" id="digiforce_wpa_ips" class="regular-text"
								name="digiforce_wpa[allowed_ips]"
								value="<?php echo esc_attr( $settings['allowed_ips'] ); ?>"
								placeholder="203.0.113.5, 203.0.113.6" />
							<p class="description"><?php esc_html_e( 'Comma-separated list of IPs that are allowed to reach the REST endpoints. Leave empty to allow all.', 'digiforce-wp-agent' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Remote Permissions', 'digiforce-wp-agent' ); ?></th>
						<td>
							<label><input type="checkbox" name="digiforce_wpa[allow_remote_plugin_updates]" value="1" <?php checked( (bool) $settings['allow_remote_plugin_updates'] ); ?> /> <?php esc_html_e( 'Allow remote plugin updates', 'digiforce-wp-agent' ); ?></label><br />
							<label><input type="checkbox" name="digiforce_wpa[allow_bulk_updates]" value="1" <?php checked( (bool) $settings['allow_bulk_updates'] ); ?> /> <?php esc_html_e( 'Allow bulk plugin updates', 'digiforce-wp-agent' ); ?></label><br />
							<label><input type="checkbox" name="digiforce_wpa[allow_remote_activation]" value="1" <?php checked( (bool) $settings['allow_remote_activation'] ); ?> /> <?php esc_html_e( 'Allow remote plugin activation', 'digiforce-wp-agent' ); ?></label><br />
							<label><input type="checkbox" name="digiforce_wpa[allow_remote_deactivation]" value="1" <?php checked( (bool) $settings['allow_remote_deactivation'] ); ?> /> <?php esc_html_e( 'Allow remote plugin deactivation', 'digiforce-wp-agent' ); ?></label>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="digiforce_wpa_retention"><?php esc_html_e( 'Log Retention (days)', 'digiforce-wp-agent' ); ?></label></th>
						<td>
							<input type="number" min="1" max="365" id="digiforce_wpa_retention"
								name="digiforce_wpa[log_retention_days]"
								value="<?php echo esc_attr( (string) $settings['log_retention_days'] ); ?>" />
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Debug Mode', 'digiforce-wp-agent' ); ?></th>
						<td>
							<label>
								<input type="checkbox" name="digiforce_wpa[debug_mode]" value="1" <?php checked( (bool) $settings['debug_mode'] ); ?> />
								<?php esc_html_e( 'Log extra diagnostic details.', 'digiforce-wp-agent' ); ?>
							</label>
						</td>
					</tr>
				</table>

				<p class="submit">
					<button type="submit" class="button button-primary"><?php esc_html_e( 'Save Settings', 'digiforce-wp-agent' ); ?></button>
				</p>
			</form>
		</div>
	</div>

	<div class="digiforce-wpa-card">
		<h2><?php esc_html_e( 'Recent Activity', 'digiforce-wp-agent' ); ?></h2>
		<?php if ( empty( $logs ) ) : ?>
			<p><?php esc_html_e( 'No log entries yet.', 'digiforce-wp-agent' ); ?></p>
		<?php else : ?>
			<table class="widefat striped digiforce-wpa-logs">
				<thead>
					<tr>
						<th><?php esc_html_e( 'When', 'digiforce-wp-agent' ); ?></th>
						<th><?php esc_html_e( 'Level', 'digiforce-wp-agent' ); ?></th>
						<th><?php esc_html_e( 'Category', 'digiforce-wp-agent' ); ?></th>
						<th><?php esc_html_e( 'Action', 'digiforce-wp-agent' ); ?></th>
						<th><?php esc_html_e( 'Target', 'digiforce-wp-agent' ); ?></th>
						<th><?php esc_html_e( 'Message', 'digiforce-wp-agent' ); ?></th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ( $logs as $log ) : ?>
						<tr>
							<td><?php echo esc_html( (string) $log['created_at'] ); ?></td>
							<td><span class="digiforce-wpa-level digiforce-wpa-level-<?php echo esc_attr( (string) $log['level'] ); ?>"><?php echo esc_html( (string) $log['level'] ); ?></span></td>
							<td><?php echo esc_html( (string) $log['category'] ); ?></td>
							<td><?php echo esc_html( (string) $log['action'] ); ?></td>
							<td>
								<?php
								$target = trim( ( (string) $log['target_type'] ) . ' ' . ( (string) $log['target_name'] ) );
								echo esc_html( '' !== $target ? $target : '—' );
								?>
							</td>
							<td><?php echo esc_html( (string) $log['message'] ); ?></td>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>
		<?php endif; ?>
	</div>
</div>
