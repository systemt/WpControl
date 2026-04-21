// DigiForce Central — tiny admin-UI helpers. Kept dependency-free so it works
// even on pages that don't use it (event listeners just never attach).

(function () {
  'use strict';

  function initBulkPluginSelector() {
    var form = document.getElementById('bulk-update-form');
    if (!form) return;

    var checkboxes = Array.prototype.slice.call(
      document.querySelectorAll('input[data-bulk-check]')
    );
    if (checkboxes.length === 0) return;

    var selectAll = document.querySelector('[data-bulk-select-all]');
    var submitBtn = document.querySelector('[data-bulk-submit]');
    var countEl = document.querySelector('[data-bulk-count]');

    function update() {
      var selected = 0;
      checkboxes.forEach(function (cb) {
        if (cb.checked) selected++;
      });
      if (submitBtn) submitBtn.disabled = selected === 0;
      if (countEl) countEl.textContent = String(selected);
      if (selectAll) {
        if (selected === 0) {
          selectAll.checked = false;
          selectAll.indeterminate = false;
        } else if (selected === checkboxes.length) {
          selectAll.checked = true;
          selectAll.indeterminate = false;
        } else {
          selectAll.checked = false;
          selectAll.indeterminate = true;
        }
      }
    }

    if (selectAll) {
      selectAll.addEventListener('change', function () {
        checkboxes.forEach(function (cb) {
          cb.checked = selectAll.checked;
        });
        update();
      });
    }
    checkboxes.forEach(function (cb) {
      cb.addEventListener('change', update);
    });

    form.addEventListener('submit', function (event) {
      var selected = checkboxes.filter(function (cb) {
        return cb.checked;
      }).length;
      if (selected === 0) {
        event.preventDefault();
        window.alert('Select at least one plugin.');
        return;
      }
      var label = selected === 1 ? 'plugin' : 'plugins';
      if (!window.confirm('Queue a bulk update for ' + selected + ' ' + label + '?')) {
        event.preventDefault();
      }
    });

    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBulkPluginSelector);
  } else {
    initBulkPluginSelector();
  }
})();
