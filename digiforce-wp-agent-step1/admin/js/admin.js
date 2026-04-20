/*
 * DigiForce WP Agent – admin script.
 *
 * Adds a "Scanning…" progress state to the scan form so the user knows the
 * manual scan is running (WordPress update checks can take several seconds).
 */
(function ($) {
	'use strict';

	var l10n = window.digiforceWpaAdmin || {};

	$(function () {
		// Generic confirmation hook: any button with `.digiforce-wpa-confirm`
		// and a `data-confirm` string will prompt before submit.
		$('.digiforce-wpa-confirm').on('click', function (event) {
			var message = $(this).data('confirm');
			if (message && !window.confirm(message)) {
				event.preventDefault();
			}
		});

		// Scan progress state.
		$('form[data-scan-form]').on('submit', function () {
			var $btn = $(this).find('button[type="submit"]');
			$btn.prop('disabled', true);
			if (l10n.scanningLabel) {
				$btn.text(l10n.scanningLabel);
			}
		});
	});
})(jQuery);
