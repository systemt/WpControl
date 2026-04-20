/*
 * DigiForce WP Agent – admin script.
 * Kept intentionally small; the UI is server-rendered.
 */
(function ($) {
	'use strict';

	$(function () {
		// Graceful confirm fallback for buttons marked with `.digiforce-wpa-confirm`.
		$('.digiforce-wpa-confirm').on('click', function (event) {
			var message = $(this).data('confirm');
			if (message && !window.confirm(message)) {
				event.preventDefault();
			}
		});
	});
})(jQuery);
