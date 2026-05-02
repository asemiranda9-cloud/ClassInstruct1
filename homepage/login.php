<?php session_start(); ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClassInstruct — Sign In / Register</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <style>

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0818;
      color: #1a1a2e;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }

    a { text-decoration: none; color: inherit; }
    button, input, select, textarea { font-family: inherit; font-size: 100%; margin: 0; }

    /* ── CSS Variables — mirrors homepage exactly ── */
    :root {
      --gold:          #6c63ff;
      --gold-dark:     #5548e8;
      --off-white:     #f5f4ff;
      --dark:          #1a1a2e;
      --mid:           #6b6b6b;
      --border:        #e5e4f8;
      --surface:       #ede9ff;
      --primary:       #6c63ff;
      --primary-dark:  #5548e8;
      --primary-light: #ede9ff;
      --success:       #10b981;
      --error:         #ef4444;
      --white:         #ffffff;
      --gray-50:       #f9fafb;
      --gray-100:      #f3f4f6;
      --gray-200:      #e5e7eb;
      --gray-300:      #d1d5db;
      --gray-400:      #9ca3af;
      --gray-500:      #6b7280;
      --gray-700:      #374151;
      --gray-800:      #1f2937;
      --gray-900:      #111827;
      --shadow-md:     0 4px 6px -1px rgb(0 0 0/.1), 0 2px 4px -2px rgb(0 0 0/.1);
      --shadow-lg:     0 10px 15px -3px rgb(0 0 0/.1), 0 4px 6px -4px rgb(0 0 0/.1);
      --shadow-xl:     0 20px 25px -5px rgb(0 0 0/.15), 0 8px 10px -6px rgb(0 0 0/.1);
      --radius-base:   0.5rem;
      --radius-md:     0.75rem;
      --radius-xl:     1.5rem;
      --radius-full:   9999px;
      --transition:    250ms ease;
    }

    /* ══════════════════════════════
       FULL-SCREEN SPLIT LAYOUT
    ══════════════════════════════ */
    .auth-page {
      display: grid;
      grid-template-columns: 1fr 560px;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Left hero panel ── */
    .auth-hero {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 48px 56px;
      overflow: hidden;
      height: 100vh;
    }

    .auth-hero-bg {
      position: absolute; inset: 0;
      background: url('https://cdn.wonder.so/images/019d44da-e731-707b-938e-e22b33072424/82b263bcc8299c7256b2d45ab95c629ab4e8209177f8ef0d7b61894e5e5debc8.jpg') center/cover no-repeat;
      opacity: 0.38;
      z-index: 0;
    }

    .auth-hero-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(140deg, rgba(13,12,8,.88) 0%, rgba(13,12,8,.6) 55%, rgba(108,99,255,.1) 100%);
      z-index: 1;
    }

    /* Decorative rings */
    .hero-ring {
      position: absolute; border-radius: 50%;
      border: 1px solid rgba(108,99,255,.16);
      z-index: 1; pointer-events: none;
      animation: slowSpin 40s linear infinite;
    }
    .hero-ring-1 { width: 560px; height: 560px; top: -140px; right: -180px; }
    .hero-ring-2 { width: 360px; height: 360px; top: 40px;   right: -50px;  border-color:rgba(108,99,255,.09); animation-direction:reverse; animation-duration:28s; }
    .hero-ring-3 { width: 200px; height: 200px; bottom: 90px; left: 70px;  border-color:rgba(108,99,255,.13); }
    @keyframes slowSpin { to { transform: rotate(360deg); } }

    /* Floating orbs */
    .orb { position: absolute; border-radius: 50%; z-index: 1; pointer-events: none; animation: floatOrb 8s ease-in-out infinite; }
    .orb-1 { width:6px; height:6px; background:var(--gold);  opacity:.7; top:30%; right:22%; }
    .orb-2 { width:4px; height:4px; background:#a78bfa;       opacity:.5; top:55%; right:35%; animation-delay:2.5s; }
    .orb-3 { width:5px; height:5px; background:var(--gold);  opacity:.6; top:70%; right:14%; animation-delay:5s; }
    @keyframes floatOrb { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-16px) scale(1.3)} }

    .auth-hero-inner { position: relative; z-index: 2; }

    /* Brand */
    .hero-brand { display: flex; align-items: center; gap: 12px; }
    .hero-logo-mark {
      width: 44px; height: 44px;
      background: linear-gradient(135deg, var(--gold), #a78bfa);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(108,99,255,.45);
    }
    .hero-logo-mark i { color: #1a1a2e; font-size: 20px; }
    .hero-brand-name { font-family:'Playfair Display',serif; font-size:22px; font-weight:600; color:#fff; letter-spacing:-.3px; }

    /* Hero copy */
    .hero-copy { margin-top: auto; padding-top: 64px; }

    .hero-eyebrow { display:flex; align-items:center; gap:14px; margin-bottom:28px; }
    .hero-eyebrow-line { width:36px; height:1px; background:var(--gold); }
    .hero-eyebrow span { font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:500; letter-spacing:2px; text-transform:uppercase; color:var(--gold); }

    .hero-headline { font-family:'Playfair Display',serif; font-size:clamp(36px,4vw,54px); line-height:1.1; letter-spacing:-1px; color:#fff; margin-bottom:24px; }
    .hero-headline em { color:var(--gold); font-style:italic; }

    .hero-desc { font-size:15px; line-height:1.75; color:rgba(255,255,255,.52); max-width:420px; margin-bottom:40px; }

    .hero-pills { display:flex; flex-wrap:wrap; gap:10px; }
    .hero-pill {
      display:inline-flex; align-items:center; gap:7px;
      background:rgba(255,255,255,.07); border:1px solid rgba(108,99,255,.28);
      border-radius:100px; padding:6px 14px; font-size:12px;
      color:rgba(255,255,255,.72); backdrop-filter:blur(4px);
    }
    .hero-pill-dot { width:6px; height:6px; border-radius:50%; background:var(--gold); flex-shrink:0; }

    /* Hero footer */
    .hero-footer {
      position: relative; z-index: 2;
      display: flex; align-items:center; justify-content:space-between;
      font-family:'JetBrains Mono',monospace; font-size:10px;
      letter-spacing:1.5px; text-transform:uppercase; color:rgba(255,255,255,.2);
    }
    .back-home {
      font-family:'Inter',sans-serif; font-size:12px; text-transform:none; letter-spacing:0;
      color:rgba(255,255,255,.38); display:flex; align-items:center; gap:5px;
      transition:color .2s;
    }
    .back-home:hover { color:var(--gold); }

    /* ── Right form panel ── */
    .auth-form-panel {
      background: #f5f4ff;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 32px 48px;
      overflow-y: auto;
      position: relative;
      height: 100vh;
    }
    .auth-form-panel::before {
      content: '';
      position: absolute; top:0; left:0; right:0; height:3px;
      background: linear-gradient(90deg, var(--gold), #a78bfa, var(--gold));
    }

    .auth-form-wrap { width:100%; max-width:440px; }

    /* ── Tab switcher ── */
    .auth-tabs {
      display: flex; background: var(--gray-100);
      border-radius: 10px; padding: 4px; margin-bottom: 20px; gap: 4px;
    }
    .auth-tab {
      flex:1; padding:9px 16px; border:none; background:transparent;
      border-radius:7px; font-family:inherit; font-size:13.5px; font-weight:500;
      color:var(--gray-500); cursor:pointer;
      transition: background .2s, color .2s, box-shadow .2s;
    }
    .auth-tab.active { background:#fff; color:var(--dark); box-shadow:0 1px 4px rgba(0,0,0,.12); }

    /* ── Sliding panel container ── */
    .auth-panels-slider {
      position: relative;
      overflow: hidden;
      width: 100%;
    }

    .auth-panel-section {
      position: absolute;
      top: 0; left: 0;
      width: 100%;
      opacity: 0;
      pointer-events: none;
      transform: translateX(60px);
      transition: transform 0.38s cubic-bezier(0.4, 0, 0.2, 1),
                  opacity  0.38s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform, opacity;
    }

    .auth-panel-section.slide-out-left {
      transform: translateX(-60px);
      opacity: 0;
      pointer-events: none;
    }

    .auth-panel-section.slide-out-right {
      transform: translateX(60px);
      opacity: 0;
      pointer-events: none;
    }

    .auth-panel-section.active {
      position: relative;
      opacity: 1;
      pointer-events: auto;
      transform: translateX(0);
    }

    /* ══════════════════════════════
       MODAL STYLES — copied verbatim
       from homepage.php <style>
    ══════════════════════════════ */
    .modal-brand { display:flex; align-items:center; gap:.5rem; margin-bottom:1rem; }
    .modal-brand-icon {
      width:36px; height:36px; border-radius:var(--radius-base);
      background:linear-gradient(135deg,var(--primary),var(--primary-dark));
      display:flex; align-items:center; justify-content:center;
      color:white; font-size:1rem;
    }
    .modal-brand-name { font-weight:700; font-size:1rem; color:var(--gray-900); }

    .modal-title { font-family:'Playfair Display',serif; font-size:1.4rem; font-weight:700; color:var(--gray-900); margin-bottom:.25rem; line-height:1.2; }
    .modal-subtitle { font-size:.875rem; color:var(--gray-500); margin-bottom:1.1rem; line-height:1.5; }

    /* Register-specific tighter spacing */
    #sectionRegister .modal-brand { margin-bottom:.75rem; }
    #sectionRegister .modal-title { font-size:1.3rem; margin-bottom:.2rem; }
    #sectionRegister .modal-subtitle { margin-bottom:.9rem; }

    .form-group { margin-bottom:.9rem; }
    .form-group label { display:block; font-size:.875rem; font-weight:500; color:var(--gray-700); margin-bottom:.3rem; }
    .input-wrap { position:relative; }

    .form-input {
      width:100%; padding:.6rem .875rem .6rem 2.5rem;
      border:1.5px solid var(--gray-200); border-radius:var(--radius-md);
      font-family:inherit; font-size:.9rem; color:var(--gray-900);
      background:var(--white); outline:none;
      transition: border-color var(--transition), box-shadow var(--transition), background var(--transition);
    }
    .form-input:focus { border-color:var(--primary); background:var(--white); box-shadow:0 0 0 3px rgba(108,99,255,.12); }
    .form-input.error { border-color:var(--error); }

    .field-error { font-size:.8125rem; color:var(--error); margin-top:.25rem; display:none; }
    .field-error.show { display:block; }

    /* Buttons */
    .btn-primary {
      display:inline-flex; align-items:center; justify-content:center; gap:8px;
      width:100%; padding:.75rem 1.5rem;
      background:linear-gradient(135deg,var(--primary),var(--primary-dark));
      border:none; border-radius:var(--radius-md);
      font-family:inherit; font-size:.9375rem; font-weight:600; color:#fff;
      cursor:pointer; box-shadow:var(--shadow-md);
      position:relative; overflow:hidden;
      transition:transform var(--transition), box-shadow var(--transition), opacity var(--transition);
    }
    .btn-primary::before {
      content:''; position:absolute; top:0; left:-100%; width:100%; height:100%;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent);
      transition:left .5s;
    }
    .btn-primary:hover:not(:disabled)::before { left:100%; }
    .btn-primary:hover:not(:disabled) { transform:translateY(-1px); box-shadow:var(--shadow-lg); }
    .btn-primary:disabled { opacity:.65; cursor:not-allowed; transform:none; }

    .spinner {
      width:16px; height:16px;
      border:2px solid rgba(255,255,255,.4); border-top-color:white;
      border-radius:50%; animation:spin .7s linear infinite; display:none;
    }
    .btn-primary.loading .btn-label { display:none; }
    .btn-primary.loading .spinner   { display:block; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .divider { display:flex; align-items:center; gap:.75rem; margin:.9rem 0; }
    .divider-line { flex:1; height:1px; background:var(--gray-200); }
    .divider-text { font-size:.75rem; color:var(--gray-400); font-weight:500; white-space:nowrap; }

    .btn-google {
      width:100%; padding:.7rem 1.25rem; background:var(--white);
      border:1.5px solid var(--gray-200); border-radius:var(--radius-md);
      font-family:inherit; font-size:.9375rem; font-weight:500; color:var(--gray-700);
      cursor:pointer; display:flex; align-items:center; justify-content:center; gap:.625rem;
      transition:border-color var(--transition), background var(--transition), box-shadow var(--transition);
    }
    .btn-google:hover { border-color:var(--gray-300); background:var(--gray-50); box-shadow:var(--shadow-md); }
    #btnRegister { background:var(--primary); color:#fff; border-color:var(--primary); }
    #btnRegister:hover { background:var(--primary-dark) !important; border-color:var(--primary-dark) !important; }

    .modal-footer-note { margin-top:.9rem; text-align:center; font-size:.8125rem; color:var(--gray-400); }
    .modal-footer-note a { color:var(--primary); font-weight:500; cursor:pointer; }
    .modal-footer-note a:hover { color:var(--primary-dark); }

    /* OTP */
    .otp-email-display {
      display:inline-flex; align-items:center; gap:.375rem;
      background:rgba(108,99,255,.08); color:var(--primary-dark);
      padding:.25rem .75rem; border-radius:var(--radius-full);
      font-size:.8125rem; font-weight:500; margin-bottom:1.75rem;
    }

    .otp-inputs { display:flex; gap:.625rem; justify-content:center; margin-bottom:1.25rem; }

    .otp-digit {
      width:52px; height:58px; border:1.5px solid var(--gray-200);
      border-radius:var(--radius-md); background:var(--gray-50);
      font-family:inherit; font-size:1.5rem; font-weight:700;
      text-align:center; color:var(--gray-900); outline:none;
      transition:border-color var(--transition), box-shadow var(--transition), background var(--transition);
      caret-color:var(--primary);
    }
    .otp-digit:focus { border-color:var(--primary); background:var(--white); box-shadow:0 0 0 3px rgba(108,99,255,.12); }
    .otp-digit.filled { border-color:rgba(108,99,255,.4); background:var(--white); }
    .otp-digit.error-shake { border-color:var(--error); animation:shake .4s ease; }

    @keyframes shake {
      0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)}
      40%{transform:translateX(6px)}   60%{transform:translateX(-4px)}
      80%{transform:translateX(4px)}
    }

    .otp-meta { display:flex; align-items:center; justify-content:space-between; font-size:.8125rem; margin-bottom:1.5rem; }
    .otp-timer { color:var(--gray-500); display:flex; align-items:center; gap:.375rem; }
    .otp-timer-count { font-weight:600; color:var(--gray-700); font-variant-numeric:tabular-nums; }

    .btn-resend {
      background:none; border:none; cursor:pointer;
      color:var(--primary); font-family:inherit; font-size:.8125rem; font-weight:500; padding:0;
      transition:color var(--transition);
    }
    .btn-resend:hover:not(:disabled) { color:var(--primary-dark); }
    .btn-resend:disabled { color:var(--gray-400); cursor:not-allowed; }

    .otp-error { text-align:center; font-size:.8125rem; color:var(--error); margin-bottom:1rem; min-height:1.2em; }

    .btn-back {
      background:none; border:none; cursor:pointer;
      color:var(--gray-500); font-family:inherit; font-size:.8125rem;
      display:inline-flex; align-items:center; gap:.375rem;
      padding:0; margin-bottom:1.5rem; transition:color var(--transition);
    }
    .btn-back:hover { color:var(--gray-800); }

    /* Success */
    .success-step { text-align:center; padding:.5rem 0 .25rem; }
    .success-icon {
      width:64px; height:64px; border-radius:50%;
      background:linear-gradient(135deg,#d1fae5,#a7f3d0);
      display:flex; align-items:center; justify-content:center;
      margin:0 auto 1.25rem; font-size:1.875rem;
      box-shadow:0 0 0 8px rgba(16,185,129,.1);
      animation:popIn .5s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes popIn { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
    .success-title { font-size:1.25rem; font-weight:700; color:var(--gray-900); margin-bottom:.5rem; }
    .success-msg   { font-size:.875rem; color:var(--gray-500); line-height:1.6; margin-bottom:1.75rem; }

    /* Step panels — same class as homepage modal */
    .step { display:none; }
    .step.active { display:block; }

    /* Password strength bar */
    #regStrengthBar { height:100%; width:0%; border-radius:2px; transition:width .3s, background .3s; }

    /* Responsive */
    @media (max-width:900px) {
      .auth-page { grid-template-columns:1fr; height:auto; overflow:visible; }
      .auth-hero  { display:none; }
      .auth-form-panel { padding:40px 24px; height:auto; min-height:100vh; }
    }
    @media (max-width:480px) {
      .otp-digit { width:44px; height:52px; font-size:1.25rem; }
      .auth-form-panel { padding:32px 16px; }
    }
  </style>
</head>
<body>

<div class="auth-page">

  <!-- ══ LEFT atmospheric hero ══ -->
  <div class="auth-hero">
    <div class="auth-hero-bg"></div>
    <div class="auth-hero-overlay"></div>
    <div class="hero-ring hero-ring-1"></div>
    <div class="hero-ring hero-ring-2"></div>
    <div class="hero-ring hero-ring-3"></div>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>

    <div class="auth-hero-inner">
      <div class="hero-brand">
        <div class="hero-logo-mark"><i class="fa-solid fa-graduation-cap"></i></div>
        <span class="hero-brand-name">ClassInstruct</span>
      </div>
      <a href="../index.php" class="back-home" style="margin-top:14px;">← Back to home</a>
    </div>

    <div class="auth-hero-inner hero-copy">
      <div class="hero-eyebrow">
        <div class="hero-eyebrow-line"></div>
        <span>AI-Powered Teaching Assistant</span>
      </div>
      <h1 class="hero-headline">Teach Smarter,<br><em>Not Harder.</em></h1>
      <p class="hero-desc">ClassInstruct transforms your instructional materials into structured lesson plans, interactive assessments, and mastery-level insights — completely free.</p>

    </div>

    <div class="hero-footer">
      <span>© 2025 ClassInstruct</span>
    </div>
  </div>

  <!-- ══ RIGHT form panel ══ -->
  <div class="auth-form-panel">
    <div class="auth-form-wrap">

      <!-- Tab switcher -->
      <div class="auth-tabs">
        <button class="auth-tab active" id="tabSignIn"   onclick="switchTab('signin')">Sign In</button>
        <button class="auth-tab"        id="tabRegister" onclick="switchTab('register')">Register</button>
      </div>

      <!-- Sliding panels wrapper -->
      <div class="auth-panels-slider" id="authPanelsSlider">

      <!-- ══════════════════════════════════════
           SIGN-IN SECTION
           Identical HTML to homepage modal inner
      ══════════════════════════════════════ -->
      <div id="sectionSignIn" class="auth-panel-section active">

        <div class="modal-brand">
          <div class="modal-brand-icon">🎓</div>
          <span class="modal-brand-name">ClassInstruct</span>
        </div>

        <!-- STEP 1 : Email + Password -->
        <div class="step active" id="stepEmail">
          <h2 class="modal-title">Welcome back</h2>
          <p class="modal-subtitle">Enter your email address to continue. We'll send a one-time code to verify it's you.</p>

          <div class="form-group">
            <label for="emailInput">Email address</label>
            <div class="input-wrap">
              <span style="position:absolute;left:.75rem;top:50%;transform:translateY(-50%);color:var(--gray-400);pointer-events:none;">✉</span>
              <input class="form-input" type="email" id="emailInput" placeholder="you@example.com" autocomplete="email" inputmode="email">
            </div>
            <span class="field-error" id="emailError"></span>
          </div>

          <div class="form-group">
            <label for="passwordInput">Password</label>
            <div class="input-wrap">
              <span style="position:absolute;left:.75rem;top:50%;transform:translateY(-50%);color:var(--gray-400);pointer-events:none;">🔒</span>
              <input class="form-input" type="password" id="passwordInput" placeholder="Enter your password" autocomplete="current-password">
            </div>
            <span class="field-error" id="passwordError"></span>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;margin-top:-.25rem;">
            <a id="linkForgotPassword" style="font-size:.8125rem;color:var(--primary);font-weight:500;cursor:pointer;text-decoration:none;"
               onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">
              Forgot password?
            </a>
            <a id="linkUnlockAccount" style="font-size:.8125rem;color:var(--gray-500);font-weight:500;cursor:pointer;text-decoration:none;display:none;"
               onmouseover="this.style.color='var(--primary)';this.style.textDecoration='underline'"
               onmouseout="this.style.color='var(--gray-500)';this.style.textDecoration='none'">
              🔓 Unlock account
            </a>
          </div>

          <button class="btn-primary" id="btnSendOtp">
            <span class="btn-label">Send verification code</span>
            <div class="spinner"></div>
          </button>

          <div class="divider">
            <div class="divider-line"></div>
            <span class="divider-text">or</span>
            <div class="divider-line"></div>
          </div>

          <button class="btn-google" id="btnRegister">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <line x1="19" y1="8" x2="19" y2="14"></line>
              <line x1="22" y1="11" x2="16" y2="11"></line>
            </svg>
            Register
          </button>

          <p class="modal-footer-note">
            Don't have an account? <a id="linkSignUp">Sign up free</a>
          </p>
        </div><!-- /stepEmail -->

        <!-- STEP 2 : OTP -->
        <div class="step" id="stepOtp">
          <button class="btn-back" id="btnBack">← Back</button>
          <h2 class="modal-title">Check your email</h2>
          <p class="modal-subtitle">We sent a 6-digit code to</p>
          <div class="otp-email-display" id="otpEmailDisplay">✉ you@example.com</div>

          <div class="otp-inputs" id="otpInputs" role="group" aria-label="6-digit verification code">
            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" aria-label="Digit 1">
            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" aria-label="Digit 2">
            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" aria-label="Digit 3">
            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" aria-label="Digit 4">
            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" aria-label="Digit 5">
            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" aria-label="Digit 6">
          </div>

          <div class="otp-error" id="otpError"></div>

          <div class="otp-meta">
            <span class="otp-timer">⏱ Code expires in <span class="otp-timer-count" id="timerCount">2:00</span></span>
            <button class="btn-resend" id="btnResend" disabled>Resend code</button>
          </div>

          <button class="btn-primary" id="btnVerifyOtp">
            <span class="btn-label">Verify &amp; Sign In</span>
            <div class="spinner"></div>
          </button>

          <p class="modal-footer-note">Didn't receive it? Check your spam folder or <a id="linkResend2">resend</a>.</p>
        </div><!-- /stepOtp -->

        <!-- STEP 3 : Success -->
        <div class="step" id="stepSuccess">
          <div class="success-step">
            <div class="success-icon">✓</div>
            <h2 class="success-title">You're signed in!</h2>
            <p class="success-msg">Welcome back to <strong>ClassInstruct</strong>.<br>Redirecting you to your dashboard…</p>
            <button class="btn-primary" id="btnGoToDashboard">
              <span class="btn-label">Go to Dashboard →</span>
              <div class="spinner"></div>
            </button>
          </div>
        </div><!-- /stepSuccess -->

      </div><!-- /sectionSignIn -->


      <!-- ══════════════════════════════════════
           REGISTER SECTION
           Identical HTML to homepage register modal inner
      ══════════════════════════════════════ -->
      <div id="sectionRegister" class="auth-panel-section">

        <div class="modal-brand">
          <div class="modal-brand-icon">🎓</div>
          <span class="modal-brand-name">ClassInstruct</span>
        </div>

        <!-- STEP REG-1 : Registration form -->
        <div class="step active" id="regStepForm">
          <h2 class="modal-title">Create your account</h2>
          <p class="modal-subtitle">Join thousands of educators. It's completely free.</p>

          <!-- First Name + Last Name on same row -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:.9rem;">
            <div>
              <label for="regFirstName" style="display:block;font-size:.875rem;font-weight:500;color:var(--gray-700);margin-bottom:.375rem;">First Name</label>
              <div class="input-wrap">
                <input class="form-input" type="text" id="regFirstName" placeholder="Juan" autocomplete="given-name" style="padding-left:.875rem;">
              </div>
              <span class="field-error" id="regFirstNameError"></span>
            </div>
            <div>
              <label for="regLastName" style="display:block;font-size:.875rem;font-weight:500;color:var(--gray-700);margin-bottom:.375rem;">Last Name</label>
              <div class="input-wrap">
                <input class="form-input" type="text" id="regLastName" placeholder="dela Cruz" autocomplete="family-name" style="padding-left:.875rem;">
              </div>
              <span class="field-error" id="regLastNameError"></span>
            </div>
          </div>

          <!-- Gender + Email on same row -->
          <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:.6rem;margin-bottom:.9rem;">
            <div>
              <label for="regGender" style="display:block;font-size:.875rem;font-weight:500;color:var(--gray-700);margin-bottom:.375rem;">Gender</label>
              <div class="input-wrap">
                <select class="form-input" id="regGender" autocomplete="sex" style="padding-left:.875rem;cursor:pointer;background:var(--white);font-size:.875rem;">
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <span class="field-error" id="regGenderError"></span>
            </div>
            <div>
              <label for="regEmail" style="display:block;font-size:.875rem;font-weight:500;color:var(--gray-700);margin-bottom:.375rem;">Email address</label>
              <div class="input-wrap">
                <input class="form-input" type="email" id="regEmail" placeholder="you@example.com" autocomplete="email" inputmode="email" style="padding-left:.875rem;">
              </div>
              <span class="field-error" id="regEmailError"></span>
            </div>
          </div>

          <div class="form-group">
            <label for="regPassword">Password</label>
            <div class="input-wrap">
              <input class="form-input" type="password" id="regPassword" placeholder="At least 8 characters" autocomplete="new-password">
            </div>
            <span class="field-error" id="regPasswordError"></span>
          </div>

          <div class="form-group">
            <label for="regPasswordConfirm">Confirm Password</label>
            <div class="input-wrap">
              <input class="form-input" type="password" id="regPasswordConfirm" placeholder="Re-enter your password" autocomplete="new-password">
            </div>
            <span class="field-error" id="regPasswordConfirmError"></span>
          </div>

          <!-- Password strength bar -->
          <div style="margin-bottom:.75rem;">
            <div style="height:4px;background:var(--gray-200);border-radius:2px;overflow:hidden;">
              <div id="regStrengthBar"></div>
            </div>
            <span id="regStrengthLabel" style="font-size:.75rem;color:var(--gray-400);margin-top:3px;display:block;"></span>
          </div>

          <button class="btn-primary" id="btnRegisterSubmit">
            <span class="btn-label">Create Account &amp; Send Code</span>
            <div class="spinner"></div>
          </button>

          <p class="modal-footer-note" style="margin-top:1rem;">
            Already have an account? <a id="linkBackToSignIn">Sign in</a>
          </p>
        </div><!-- /regStepForm -->

        <!-- STEP REG-2 : OTP -->
        <div class="step" id="regStepOtp">
          <button class="btn-back" id="regBtnBack">← Back</button>
          <h2 class="modal-title">Verify your email</h2>
          <p class="modal-subtitle">We sent a 6-digit code to</p>
          <div class="otp-email-display" id="regOtpEmailDisplay">✉ you@example.com</div>

          <div class="otp-inputs" id="regOtpInputs" role="group" aria-label="6-digit verification code">
            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" aria-label="Digit 1">
            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" aria-label="Digit 2">
            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" aria-label="Digit 3">
            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" aria-label="Digit 4">
            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" aria-label="Digit 5">
            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" aria-label="Digit 6">
          </div>

          <div class="otp-error" id="regOtpError"></div>

          <div class="otp-meta">
            <span class="otp-timer">⏱ Code expires in <span class="otp-timer-count" id="regTimerCount">2:00</span></span>
            <button class="btn-resend" id="regBtnResend" disabled>Resend code</button>
          </div>

          <button class="btn-primary" id="regBtnVerifyOtp">
            <span class="btn-label">Verify &amp; Complete Registration</span>
            <div class="spinner"></div>
          </button>

          <p class="modal-footer-note">Didn't receive it? Check your spam folder or <a id="regLinkResend2">resend</a>.</p>
        </div><!-- /regStepOtp -->

        <!-- STEP REG-3 : Success -->
        <div class="step" id="regStepSuccess">
          <div class="success-step">
            <div class="success-icon">🎉</div>
            <h2 class="success-title">Account Created!</h2>
            <p class="success-msg">Welcome to <strong>ClassInstruct</strong>!<br>Your account is ready. Please sign in to continue.</p>
            <button class="btn-primary" id="regBtnGoToDashboard">
              <span class="btn-label">Sign In →</span>
              <div class="spinner"></div>
            </button>
          </div>
        </div><!-- /regStepSuccess -->

      </div><!-- /sectionRegister -->

      </div><!-- /auth-panels-slider -->

    </div><!-- /auth-form-wrap -->
  </div><!-- /auth-form-panel -->

</div><!-- /auth-page -->

<script>
/* ══════════════════════════════════════════════════════
   BASE PATH  (same as both JS files use)
══════════════════════════════════════════════════════ */
const BASE     = window.location.pathname.replace(/\/[^\/]+$/, '');
const REG_BASE = BASE;

/* ══════════════════════════════════════════════════════
   TAB SWITCHER — with slide animation
══════════════════════════════════════════════════════ */
let currentTab = 'signin';

function switchTab(which) {
  if (which === currentTab) return;

  const si   = document.getElementById('sectionSignIn');
  const reg  = document.getElementById('sectionRegister');
  const tSi  = document.getElementById('tabSignIn');
  const tReg = document.getElementById('tabRegister');
  const slider = document.getElementById('authPanelsSlider');

  const outgoing = which === 'register' ? si  : reg;
  const incoming = which === 'register' ? reg : si;
  const slideInFrom  = which === 'register' ? 'translateX(60px)'  : 'translateX(-60px)';

  // Fix slider height to current height before transition
  slider.style.height = slider.offsetHeight + 'px';

  // Slide outgoing panel out
  outgoing.classList.remove('active');
  outgoing.classList.add(which === 'register' ? 'slide-out-left' : 'slide-out-right');

  // Position incoming panel off-screen (no transition yet)
  incoming.style.transition = 'none';
  incoming.style.transform = slideInFrom;
  incoming.style.opacity = '0';
  incoming.style.position = 'absolute';
  incoming.style.pointerEvents = 'none';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Re-enable transition and slide in
      incoming.style.transition = '';
      incoming.style.transform = '';
      incoming.style.opacity = '';
      incoming.style.position = '';
      incoming.style.pointerEvents = '';
      incoming.classList.add('active');

      // Update tab buttons
      if (which === 'signin') {
        tSi.classList.add('active');   tReg.classList.remove('active');
      } else {
        tReg.classList.add('active');  tSi.classList.remove('active');
      }

      currentTab = which;

      // Release fixed height after transition completes
      setTimeout(() => {
        slider.style.height = '';
        outgoing.classList.remove('slide-out-left', 'slide-out-right');
        // Focus first field
        if (which === 'signin') {
          document.getElementById('emailInput').focus();
        } else {
          document.getElementById('regFirstName').focus();
        }
      }, 400);
    });
  });
}

/* ══════════════════════════════════════════════════════
   SIGN-IN LOGIC
   (extracted from signin_modal_wired.js, stripped of
    all modal open/close/backdrop references)
══════════════════════════════════════════════════════ */
(function () {

  const stepEmail   = document.getElementById('stepEmail');
  const stepOtp     = document.getElementById('stepOtp');
  const stepSuccess = document.getElementById('stepSuccess');

  const emailInput    = document.getElementById('emailInput');
  const emailError    = document.getElementById('emailError');
  const passwordInput = document.getElementById('passwordInput');
  const passwordError = document.getElementById('passwordError');
  const btnSendOtp    = document.getElementById('btnSendOtp');
  const btnRegister   = document.getElementById('btnRegister');

  const otpDigits    = document.querySelectorAll('#otpInputs .otp-digit');
  const otpEmailDisp = document.getElementById('otpEmailDisplay');
  const otpError     = document.getElementById('otpError');
  const btnVerify    = document.getElementById('btnVerifyOtp');
  const btnBack      = document.getElementById('btnBack');
  const btnResend    = document.getElementById('btnResend');
  const timerEl      = document.getElementById('timerCount');
  const btnDash      = document.getElementById('btnGoToDashboard');

  let timerInterval = null;
  let timerSeconds  = 120;
  let currentEmail  = '';

  /* ── Step switcher ── */
  function showStep(step) {
    [stepEmail, stepOtp, stepSuccess].forEach(s => s.classList.remove('active'));
    step.classList.add('active');
  }

  /* ── Error helpers ── */
  function showFieldError(errorEl, inputEl, msg) {
    if (inputEl)  inputEl.classList.add('error');
    if (errorEl) { errorEl.textContent = msg; errorEl.classList.add('show'); }
  }

  function hideFieldError(errorEl, inputEl) {
    if (inputEl)  inputEl.classList.remove('error');
    if (errorEl)  errorEl.classList.remove('show');
  }

  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }

  /* ── Input listeners ── */
  emailInput.addEventListener('input',    () => hideFieldError(emailError,    emailInput));
  passwordInput.addEventListener('input', () => hideFieldError(passwordError, passwordInput));

  /* ── Send OTP ── */
  btnSendOtp.addEventListener('click', sendOtp);
  emailInput.addEventListener('keydown',    e => { if (e.key === 'Enter') sendOtp(); });
  passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendOtp(); });

  async function sendOtp() {
    const email    = emailInput.value.trim();
    const password = passwordInput.value;

    hideFieldError(emailError,    emailInput);
    hideFieldError(passwordError, passwordInput);

    if (!isValidEmail(email)) {
      showFieldError(emailError, emailInput, 'Please enter a valid email address.');
      emailInput.focus(); return;
    }
    if (!password) {
      showFieldError(passwordError, passwordInput, 'Please enter your password.');
      passwordInput.focus(); return;
    }

    setLoading(btnSendOtp, true);
    try {
      const res  = await fetch(`${BASE}/send_otp.php`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email, password }), credentials: 'include',
      });
      let data;
      try { data = await res.json(); }
      catch { showFieldError(emailError, emailInput, 'Server error. Please try again.'); return; }

      if (!data.success) {
        const msg = data.error || 'Failed to send code. Please try again.';
        if (data.perm_locked)  { showLockedState(msg); return; }
        if (data.temp_locked)  { showTempLocked(msg, data.wait_seconds || 1800); return; }
        const isPwErr = /password|incorrect|attempt/i.test(msg);
        if (isPwErr) { showFieldError(passwordError, passwordInput, msg); passwordInput.focus(); }
        else         { showFieldError(emailError,    emailInput,    msg); emailInput.focus(); }
        return;
      }

      currentEmail = email;
      otpEmailDisp.textContent = `✉ ${email}`;
      showStep(stepOtp);
      clearOtpDigits();
      otpError.textContent = '';
      startTimer();
      otpDigits[0].focus();

    } catch (err) {
      showFieldError(emailError, emailInput, 'Network error — could not reach the server.');
    } finally {
      setLoading(btnSendOtp, false);
    }
  }

  /* ── Register button → switch to register tab ── */
  btnRegister.addEventListener('click', () => switchTab('register'));

  /* ── Sign Up link ── */
  document.getElementById('linkSignUp').addEventListener('click', () => switchTab('register'));

  /* ── OTP digit input ── */
  otpDigits.forEach((input, i) => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace') {
        if (!input.value && i > 0) { otpDigits[i-1].value = ''; otpDigits[i-1].classList.remove('filled'); otpDigits[i-1].focus(); }
        else { input.value = ''; input.classList.remove('filled'); }
        e.preventDefault(); return;
      }
      if (e.key === 'ArrowLeft'  && i > 0) { otpDigits[i-1].focus(); return; }
      if (e.key === 'ArrowRight' && i < 5) { otpDigits[i+1].focus(); return; }
    });
    input.addEventListener('input', () => {
      const val = input.value.replace(/\D/g, '');
      if (!val) { input.value = ''; input.classList.remove('filled'); return; }
      if (val.length > 1) {
        const digits = val.slice(0,6).split('');
        digits.forEach((d,j) => { if (otpDigits[i+j]) { otpDigits[i+j].value = d; otpDigits[i+j].classList.add('filled'); } });
        otpDigits[Math.min(i+digits.length, 5)].focus(); return;
      }
      input.value = val[0]; input.classList.add('filled');
      if (i < 5) otpDigits[i+1].focus();
      if (getOtpValue().length === 6) verifyOtp();
    });
    input.addEventListener('focus', () => input.select());
  });

  function getOtpValue() { return Array.from(otpDigits).map(d => d.value).join(''); }
  function clearOtpDigits() { otpDigits.forEach(d => { d.value = ''; d.classList.remove('filled','error-shake'); }); }

  /* ── Verify OTP ── */
  btnVerify.addEventListener('click', verifyOtp);

  async function verifyOtp() {
    const entered = getOtpValue();
    if (entered.length < 6) { otpError.textContent = 'Please enter all 6 digits.'; return; }
    otpError.textContent = '';
    setLoading(btnVerify, true);
    try {
      const res  = await fetch(`${BASE}/verify_otp.php`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ otp: entered }), credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        clearInterval(timerInterval);
        if (data.token) sessionStorage.setItem('ci_token', data.token);
        sessionStorage.setItem('ci_first_name', data.first_name || '');
        sessionStorage.setItem('ci_last_name',  data.last_name  || '');
        sessionStorage.setItem('ci_gender',     data.gender     || '');
        sessionStorage.setItem('ci_email',      data.email      || '');
        sessionStorage.setItem('ci_picture',    data.picture    || '');
        if (data.picture) localStorage.setItem('ci_google_photo', data.picture);
        showStep(stepSuccess);
        setTimeout(() => { window.location.href = '/dashboard/sidebar.html'; }, 1500);
      } else {
        otpError.textContent = data.error || 'Incorrect code. Please try again.';
        otpDigits.forEach(d => d.classList.add('error-shake'));
        setTimeout(() => otpDigits.forEach(d => d.classList.remove('error-shake')), 500);
        clearOtpDigits(); otpDigits[0].focus();
      }
    } catch { otpError.textContent = 'Network error. Please try again.'; }
    finally  { setLoading(btnVerify, false); }
  }

  /* ── Timer ── */
  function startTimer() {
    clearInterval(timerInterval);
    timerSeconds = 120;
    btnResend.disabled = true;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      timerSeconds--;
      updateTimerDisplay();
      if (timerSeconds <= 0) { clearInterval(timerInterval); timerEl.textContent = '0:00'; btnResend.disabled = false; }
    }, 1000);
  }
  function updateTimerDisplay() {
    const m = Math.floor(timerSeconds/60), s = timerSeconds%60;
    timerEl.textContent = `${m}:${String(s).padStart(2,'0')}`;
  }

  /* ── Resend ── */
  async function resendOtp() {
    btnResend.disabled = true; otpError.textContent = ''; clearOtpDigits();
    try {
      const res  = await fetch(`${BASE}/send_otp.php`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email: currentEmail }), credentials:'include',
      });
      const data = await res.json();
      if (!data.success) { otpError.textContent = data.error || 'Could not resend.'; return; }
      startTimer(); otpDigits[0].focus();
    } catch { otpError.textContent = 'Network error.'; btnResend.disabled = false; }
  }

  btnResend.addEventListener('click', resendOtp);
  document.getElementById('linkResend2').addEventListener('click', resendOtp);

  /* ── Back ── */
  btnBack.addEventListener('click', () => { clearInterval(timerInterval); showStep(stepEmail); });

  /* ── Go to Dashboard ── */
  btnDash.addEventListener('click', () => { window.location.href = '/dashboard/sidebar.html'; });

  /* ── Forgot Password & Unlock ── */
  document.getElementById('linkForgotPassword').addEventListener('click', () => {
    const email = emailInput.value.trim();
    window.location.href = BASE + '/forgot_password.php' + (email ? '?email=' + encodeURIComponent(email) : '');
  });
  document.getElementById('linkUnlockAccount').addEventListener('click', () => {
    const email = emailInput.value.trim();
    window.location.href = BASE + '/unlock_account.php' + (email ? '?email=' + encodeURIComponent(email) : '');
  });

  /* ── Lockout helpers ── */
  function showTempLocked(msg, waitSeconds) {
    hideFieldError(emailError, emailInput);
    hideFieldError(passwordError, passwordInput);
    if (passwordInput) passwordInput.disabled = true;
    emailInput.disabled = true;
    const toHide = [btnSendOtp, stepEmail.querySelector('.divider'), document.getElementById('btnRegister'), stepEmail.querySelector('.modal-footer-note')];
    toHide.forEach(el => { if (el) el.style.display = 'none'; });
    let banner = document.getElementById('ciTempLockBanner');
    if (!banner) {
      banner = document.createElement('div'); banner.id = 'ciTempLockBanner';
      banner.style.cssText = 'background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;font-size:14px;color:#3730a3;line-height:1.6;text-align:center';
      btnSendOtp.insertAdjacentElement('beforebegin', banner);
    }
    banner.style.display = 'block';
    let remaining = waitSeconds;
    function tick() {
      const m = Math.floor(remaining/60), s = remaining%60;
      banner.innerHTML = `⏳ <strong>Too many failed attempts.</strong><br>Try again in <strong>${m}:${String(s).padStart(2,'0')}</strong>`;
      if (remaining-- <= 0) {
        clearInterval(lockTimer); banner.style.display = 'none';
        toHide.forEach(el => { if (el) el.style.display = ''; });
        btnSendOtp.disabled = false;
        if (passwordInput) passwordInput.disabled = false;
        emailInput.disabled = false; emailInput.focus();
      }
    }
    tick(); const lockTimer = setInterval(tick, 1000);
  }

  function showLockedState(msg) {
    hideFieldError(emailError, emailInput); hideFieldError(passwordError, passwordInput);
    document.getElementById('linkForgotPassword').style.display = 'none';
    document.getElementById('linkUnlockAccount').style.display = '';
    stepEmail.querySelectorAll('.form-group, #btnSendOtp, .divider, #btnRegister, .modal-footer-note').forEach(el => el.style.display = 'none');
    let panel = document.getElementById('ciLockedPanel');
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'ciLockedPanel';
      panel.innerHTML = `<div style="text-align:center;padding:4px 0 8px;">
        <div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#ede9ff,#c4b5fd);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 0 0 8px rgba(108,99,255,.08);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        <h3 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 8px;">Account Locked</h3>
        <p style="font-size:13px;color:#6b7280;margin:0 0 24px;line-height:1.65;">Too many failed sign-in attempts. Unlock your account or reset your password to continue.</p>
        <button id="ciUnlockBtn" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;margin-bottom:10px;background:linear-gradient(135deg,#6c63ff,#5548e8);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(108,99,255,.3);">
          🔓 Unlock My Account
        </button>
        <p style="margin-top:20px;font-size:12px;color:#9ca3af;">Need help? <a href="mailto:support@classinstruct.com" style="color:#6c63ff;font-weight:500;">support@classinstruct.com</a></p>
      </div>`;
      stepEmail.appendChild(panel);
      document.getElementById('ciUnlockBtn').addEventListener('click', () => {
        window.location.href = `${BASE}/unlock_account.php?email=${encodeURIComponent(emailInput.value.trim())}`;
      });
    }
    panel.style.display = 'block';
  }

  /* ── Loading helper ── */
  function setLoading(btn, loading) { btn.classList.toggle('loading', loading); btn.disabled = loading; }

  /* ── Check URL for auth_error on load ── */
  window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('auth_error')) {
      showFieldError(emailError, emailInput, params.get('auth_error'));
      history.replaceState(null, '', window.location.pathname);
    }
    if (params.get('tab') === 'register') switchTab('register');
  });

})();


/* ══════════════════════════════════════════════════════
   REGISTER LOGIC
   (extracted from register_modal.js, stripped of all
    modal open/close/backdrop references)
══════════════════════════════════════════════════════ */
(function () {

  const regStepForm    = document.getElementById('regStepForm');
  const regStepOtp     = document.getElementById('regStepOtp');
  const regStepSuccess = document.getElementById('regStepSuccess');

  const regFirstName        = document.getElementById('regFirstName');
  const regLastName         = document.getElementById('regLastName');
  const regEmail            = document.getElementById('regEmail');
  const regPassword         = document.getElementById('regPassword');
  const regPasswordConfirm  = document.getElementById('regPasswordConfirm');
  const btnRegisterSubmit   = document.getElementById('btnRegisterSubmit');

  const regFirstNameError      = document.getElementById('regFirstNameError');
  const regLastNameError       = document.getElementById('regLastNameError');
  const regEmailError          = document.getElementById('regEmailError');
  const regPasswordError       = document.getElementById('regPasswordError');
  const regPasswordConfirmError= document.getElementById('regPasswordConfirmError');

  const regStrengthBar   = document.getElementById('regStrengthBar');
  const regStrengthLabel = document.getElementById('regStrengthLabel');

  const regOtpEmailDisp = document.getElementById('regOtpEmailDisplay');
  const regOtpDigits    = document.querySelectorAll('#regOtpInputs .otp-digit');
  const regOtpError     = document.getElementById('regOtpError');
  const regBtnVerify    = document.getElementById('regBtnVerifyOtp');
  const regBtnBack      = document.getElementById('regBtnBack');
  const regBtnResend    = document.getElementById('regBtnResend');
  const regTimerEl      = document.getElementById('regTimerCount');
  const regLinkResend2  = document.getElementById('regLinkResend2');
  const regBtnDash      = document.getElementById('regBtnGoToDashboard');

  let regTimerInterval = null;
  let regTimerSeconds  = 120;
  let currentEmail     = '';

  /* ── Step switcher ── */
  function showStep(step) {
    [regStepForm, regStepOtp, regStepSuccess].forEach(s => s.classList.remove('active'));
    step.classList.add('active');
  }

  /* ── Password strength ── */
  regPassword.addEventListener('input', () => {
    const val = regPassword.value;
    let score = 0;
    if (val.length >= 8)          score++;
    if (/[A-Z]/.test(val))        score++;
    if (/[0-9]/.test(val))        score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const levels = [
      { pct:'0%',   color:'transparent', label:'' },
      { pct:'25%',  color:'#ef4444',     label:'Weak' },
      { pct:'50%',  color:'#f59e0b',     label:'Fair' },
      { pct:'75%',  color:'#3b82f6',     label:'Good' },
      { pct:'100%', color:'#10b981',     label:'Strong' },
    ];
    const lvl = levels[score] ?? levels[0];
    regStrengthBar.style.width      = lvl.pct;
    regStrengthBar.style.background = lvl.color;
    regStrengthLabel.textContent    = lvl.label;
    regStrengthLabel.style.color    = lvl.color;
  });

  /* ── Validation helpers ── */
  function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }

  function setFieldError(input, errorEl, show, msg) {
    input.classList.toggle('error', show);
    errorEl.classList.toggle('show', show);
    if (msg) errorEl.textContent = msg;
  }

  regFirstName.addEventListener('input',       () => setFieldError(regFirstName,       regFirstNameError,       false));
  regLastName.addEventListener('input',        () => setFieldError(regLastName,        regLastNameError,        false));
  regEmail.addEventListener('input',           () => setFieldError(regEmail,           regEmailError,           false));
  regPassword.addEventListener('input',        () => setFieldError(regPassword,        regPasswordError,        false));
  regPasswordConfirm.addEventListener('input', () => setFieldError(regPasswordConfirm, regPasswordConfirmError, false));

  /* ── Submit registration ── */
  btnRegisterSubmit.addEventListener('click', submitRegistration);
  [regFirstName, regLastName, regEmail, regPasswordConfirm].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') submitRegistration(); });
  });

  async function submitRegistration() {
    const firstName = regFirstName.value.trim();
    const lastName  = regLastName.value.trim();
    const gender    = document.getElementById('regGender').value.trim();
    const email     = regEmail.value.trim();
    const password  = regPassword.value;
    const confirm   = regPasswordConfirm.value;
    let hasError = false;

    if (!firstName) { setFieldError(regFirstName, regFirstNameError, true, 'Please enter your first name.'); hasError = true; }
    if (!lastName)  { setFieldError(regLastName,  regLastNameError,  true, 'Please enter your last name.');  hasError = true; }
    if (!gender || !['Male','Female','Other'].includes(gender)) {
      const gEl  = document.getElementById('regGender');
      const gErr = document.getElementById('regGenderError');
      if (gEl)  gEl.classList.add('error');
      if (gErr) { gErr.textContent = 'Please select a gender.'; gErr.classList.add('show'); }
      hasError = true;
    }
    if (!isValidEmail(email))   { setFieldError(regEmail,    regEmailError,    true, 'Please enter a valid email address.');     hasError = true; }
    if (password.length < 8)    { setFieldError(regPassword, regPasswordError, true, 'Password must be at least 8 characters.'); hasError = true; }
    if (password !== confirm)   { setFieldError(regPasswordConfirm, regPasswordConfirmError, true, 'Passwords do not match.'); hasError = true; }
    if (hasError) return;

    setLoading(btnRegisterSubmit, true);
    try {
      const res  = await fetch(`${REG_BASE}/register_otp.php`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ firstName, lastName, gender, email, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) { setFieldError(regEmail, regEmailError, true, data.error || 'Failed to send code. Please try again.'); return; }
      currentEmail = email;
      regOtpEmailDisp.textContent = `✉ ${email}`;
      showStep(regStepOtp);
      clearOtpDigits(); regOtpError.textContent = '';
      startTimer(); regOtpDigits[0].focus();
    } catch { setFieldError(regEmail, regEmailError, true, 'Network error. Please check your connection.'); }
    finally  { setLoading(btnRegisterSubmit, false); }
  }

  /* ── OTP digit input ── */
  regOtpDigits.forEach((input, i) => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace') {
        if (!input.value && i > 0) { regOtpDigits[i-1].value = ''; regOtpDigits[i-1].classList.remove('filled'); regOtpDigits[i-1].focus(); }
        else { input.value = ''; input.classList.remove('filled'); }
        e.preventDefault(); return;
      }
      if (e.key === 'ArrowLeft'  && i > 0) { regOtpDigits[i-1].focus(); return; }
      if (e.key === 'ArrowRight' && i < 5) { regOtpDigits[i+1].focus(); return; }
    });
    input.addEventListener('input', () => {
      const val = input.value.replace(/\D/g,'');
      if (!val) { input.value = ''; input.classList.remove('filled'); return; }
      if (val.length > 1) {
        const digits = val.slice(0,6).split('');
        digits.forEach((d,j) => { if (regOtpDigits[i+j]) { regOtpDigits[i+j].value = d; regOtpDigits[i+j].classList.add('filled'); } });
        regOtpDigits[Math.min(i+digits.length, 5)].focus(); return;
      }
      input.value = val[0]; input.classList.add('filled');
      if (i < 5) regOtpDigits[i+1].focus();
      if (getOtpValue().length === 6) verifyOtp();
    });
    input.addEventListener('focus', () => input.select());
  });

  function getOtpValue()  { return Array.from(regOtpDigits).map(d => d.value).join(''); }
  function clearOtpDigits() { regOtpDigits.forEach(d => { d.value = ''; d.classList.remove('filled','error-shake'); }); }

  /* ── Verify OTP ── */
  regBtnVerify.addEventListener('click', verifyOtp);

  async function verifyOtp() {
    const entered = getOtpValue();
    if (entered.length < 6) { regOtpError.textContent = 'Please enter all 6 digits.'; return; }
    regOtpError.textContent = '';
    setLoading(regBtnVerify, true);
    try {
      const res  = await fetch(`${REG_BASE}/register_verify.php`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ otp: entered }), credentials:'include',
      });
      const data = await res.json();
      if (data.success) {
        clearInterval(regTimerInterval);
        if (data.token) sessionStorage.setItem('ci_token', data.token);
        sessionStorage.setItem('ci_first_name', data.first_name || '');
        sessionStorage.setItem('ci_last_name',  data.last_name  || '');
        sessionStorage.setItem('ci_gender',     data.gender     || '');
        sessionStorage.setItem('ci_email',      data.email      || regEmail?.value?.trim() || '');
        sessionStorage.setItem('ci_picture',    data.picture    || '');
        showStep(regStepSuccess);
        /* After 2s switch to sign-in tab */
        setTimeout(() => switchTab('signin'), 2000);
      } else {
        regOtpError.textContent = data.error || 'Incorrect code. Please try again.';
        regOtpDigits.forEach(d => d.classList.add('error-shake'));
        setTimeout(() => regOtpDigits.forEach(d => d.classList.remove('error-shake')), 500);
        clearOtpDigits(); regOtpDigits[0].focus();
      }
    } catch { regOtpError.textContent = 'Network error. Please try again.'; }
    finally  { setLoading(regBtnVerify, false); }
  }

  /* ── Timer ── */
  function startTimer()       { runTimer(120); }
  function startResendTimer() { runTimer(30); }

  function runTimer(seconds) {
    clearInterval(regTimerInterval);
    regTimerSeconds = seconds;
    regBtnResend.disabled = true;
    updateTimerDisplay();
    regTimerInterval = setInterval(() => {
      regTimerSeconds--;
      updateTimerDisplay();
      if (regTimerSeconds <= 0) { clearInterval(regTimerInterval); regTimerEl.textContent = '0:00'; regBtnResend.disabled = false; }
    }, 1000);
  }
  function updateTimerDisplay() {
    const m = Math.floor(regTimerSeconds/60), s = regTimerSeconds%60;
    regTimerEl.textContent = `${m}:${String(s).padStart(2,'0')}`;
  }

  /* ── Resend ── */
  async function resendOtp() {
    regBtnResend.disabled = true; regOtpError.textContent = ''; clearOtpDigits();
    try {
      const res  = await fetch(`${REG_BASE}/register_otp.php`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ resend: true }), credentials:'include',
      });
      const data = await res.json();
      if (!data.success) {
        regOtpError.textContent = data.error?.includes('No pending') ? 'Session expired — go back and fill in the form again.' : (data.error || 'Could not resend.');
        regBtnResend.disabled = false; return;
      }
      startResendTimer(); regOtpDigits[0].focus();
    } catch { regOtpError.textContent = 'Network error.'; regBtnResend.disabled = false; }
  }

  regBtnResend.addEventListener('click', resendOtp);
  regLinkResend2.addEventListener('click', resendOtp);

  /* ── Back ── */
  regBtnBack.addEventListener('click', () => { clearInterval(regTimerInterval); showStep(regStepForm); });

  /* ── Success → Sign In ── */
  regBtnDash.addEventListener('click', () => switchTab('signin'));

  /* ── "Already have an account?" link ── */
  document.getElementById('linkBackToSignIn').addEventListener('click', () => switchTab('signin'));

  /* ── Loading helper ── */
  function setLoading(btn, loading) { btn.classList.toggle('loading', loading); btn.disabled = loading; }

})();
</script>

</body>
</html>