// ── Logout Page ──

// Confirm logout — destroys session via logout_action.php, then redirects
function confirmLogout() {
  window.top.location.href = '/homepage/homepage.php';
}

// Cancel — go back to previous page
function cancelLogout() {
  history.back();
}