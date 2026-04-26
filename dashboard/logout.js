// ── Logout Page ──

// Confirm logout — redirects to logout.php
function confirmLogout() {
  window.location.href = 'logout.php';
}

// Cancel — go back to previous page
function cancelLogout() {
  history.back();
}