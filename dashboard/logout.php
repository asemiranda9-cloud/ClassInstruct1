<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Log Out · ClassInstruct</title>
  <link rel="stylesheet" href="sidebar.css" />
  <link rel="stylesheet" href="logout.css" />
</head>
<body data-page="logout">
<div class="app">

  <!-- ══════════════ MAIN ══════════════ -->
  <div class="main">
    <div class="logout-page">
      <div class="logout-card">
        <div class="logout-icon">
          <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </div>
        <div class="logout-title">Log out of ClassInstruct?</div>
        <div class="logout-desc">You'll need to sign in again to access your dashboard, students, and grades.</div>
        <div class="logout-btns">
          <button class="btn btn-danger" onclick="confirmLogout()">Yes, Log me out</button>
          <button class="btn btn-ghost" onclick="cancelLogout()">Cancel</button>
        </div>
      </div>
    </div>
  </div>

</div>
<script src="shared.js"></script>
<script src="logout.js"></script>
</body>
</html>