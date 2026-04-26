// ── Settings Page ──

// Sync the dark mode toggle in Appearance card with current theme on load
document.addEventListener('DOMContentLoaded', function () {
  const darkToggle = document.getElementById('settingsDarkToggle');
  if (darkToggle) {
    const current = document.documentElement.getAttribute('data-theme');
    darkToggle.classList.toggle('on', current === 'dark');
  }
});

// Override toggleTheme to also keep the settings toggle in sync
// shared.js defines toggleTheme first, so we wrap it here safely
(function () {
  const _orig = window.toggleTheme;
  window.toggleTheme = function () {
    _orig();
    const darkToggle = document.getElementById('settingsDarkToggle');
    if (darkToggle) {
      const updated = document.documentElement.getAttribute('data-theme');
      darkToggle.classList.toggle('on', updated === 'dark');
    }
  };
})();

// Save account changes (stub)
function saveAccount() {
  alert('Account changes saved.');
}

// Update password (stub)
function updatePassword() {
  const cur = document.getElementById('currentPassword');
  if (cur && !cur.value) {
    alert('Please enter your current password.');
    return;
  }
  const np = document.getElementById('newPassword');
  const cp = document.getElementById('confirmPassword');
  if (np && cp && np.value !== cp.value) {
    alert('New passwords do not match.');
    return;
  }
  alert('Password updated successfully.');
  if (cur) cur.value = '';
  if (np) np.value = '';
  if (cp) cp.value = '';
}