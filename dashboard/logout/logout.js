// ── Logout Page ──

// Confirm logout — destroys session via logout_action.php, then redirects
function confirmLogout() {
  window.top.location.href = '/index.php';
}

// Cancel — go back to previous page
function cancelLogout() {
  history.back();
}