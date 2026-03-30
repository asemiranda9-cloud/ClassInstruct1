<?php
session_start();  // needed so OTP session works
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ClassInstruct - AI-Powered Teaching Platform</title>
    <link rel="stylesheet" href="globals.css">
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <style>
    /* ── Paste your globals.css & style.css variables here in production ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f9fafb;
      color: #1f2937;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* ── Variables (from your style.css) ── */
    :root {
      --primary-color: #6366f1;
      --primary-dark: #4f46e5;
      --primary-light: #818cf8;
      --secondary-color: #8b5cf6;
      --success-color: #10b981;
      --error-color: #ef4444;
      --white: #ffffff;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-300: #d1d5db;
      --gray-400: #9ca3af;
      --gray-500: #6b7280;
      --gray-600: #4b5563;
      --gray-700: #374151;
      --gray-800: #1f2937;
      --gray-900: #111827;
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1);
      --radius-sm: 0.375rem;
      --radius-base: 0.5rem;
      --radius-md: 0.75rem;
      --radius-lg: 1rem;
      --radius-xl: 1.5rem;
      --radius-full: 9999px;
      --transition-base: 250ms ease;
      --header-height: 80px;
    }

    /* ── Minimal header (matches your existing header) ── */
    .header {
      position: fixed; top: 0; left: 0; right: 0;
      height: var(--header-height);
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--gray-200);
      z-index: 100;
      display: flex; align-items: center;
    }
    .nav-container {
      display: flex; align-items: center;
      justify-content: space-between;
      width: 100%; max-width: 1200px;
      margin: 0 auto; padding: 0 1.5rem;
    }
    .logo { font-size: 1.25rem; font-weight: 700; color: var(--gray-900); }
    .btn-nav {
      background: var(--primary-color); color: var(--white);
      padding: 0.5rem 1.25rem; border-radius: var(--radius-full);
      font-size: 0.875rem; font-weight: 500; cursor: pointer;
      border: none; font-family: inherit;
      transition: background var(--transition-base), transform var(--transition-base);
    }
    .btn-nav:hover { background: var(--primary-dark); transform: translateY(-1px); }

    /* ── Demo hero (placeholder behind modal) ── */
    .demo-bg {
      margin-top: var(--header-height);
      flex: 1;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, var(--gray-50) 0%, var(--white) 100%);
      position: relative; overflow: hidden;
      padding: 4rem 1.5rem;
    }
    .demo-bg::before {
      content: '';
      position: absolute; inset: 0;
      background:
        radial-gradient(circle at 25% 25%, rgba(99,102,241,0.08) 0%, transparent 55%),
        radial-gradient(circle at 75% 75%, rgba(139,92,246,0.08) 0%, transparent 55%);
      pointer-events: none;
    }
    .demo-hint {
      text-align: center; position: relative; z-index: 1;
    }
    .demo-hint h1 {
      font-size: 2.5rem; font-weight: 700;
      color: var(--gray-900); margin-bottom: 1rem; line-height: 1.2;
    }
    .gradient-text {
      background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .demo-hint p { color: var(--gray-500); font-size: 1rem; }

    /* ══════════════════════════════════════════════
       MODAL OVERLAY
    ══════════════════════════════════════════════ */
    .modal-overlay {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
      opacity: 0; visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }
    .modal-overlay.active { opacity: 1; visibility: visible; }

    .modal-backdrop {
      position: absolute; inset: 0;
      background: rgba(17,24,39,0.55);
      backdrop-filter: blur(4px);
    }

    .modal-box {
      position: relative; z-index: 1;
      background: var(--white);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl);
      width: 100%; max-width: 420px;
      overflow: hidden;
      transform: translateY(24px) scale(0.97);
      transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;
      opacity: 0;
    }
    .modal-overlay.active .modal-box {
      transform: translateY(0) scale(1);
      opacity: 1;
    }

    /* Decorative top bar */
    .modal-accent {
      height: 4px;
      background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
    }

    .modal-inner { padding: 2rem 2rem 2.5rem; }

    /* Close button */
    .modal-close {
      position: absolute; top: 1rem; right: 1rem;
      background: var(--gray-100); border: none; cursor: pointer;
      width: 32px; height: 32px; border-radius: var(--radius-full);
      display: flex; align-items: center; justify-content: center;
      color: var(--gray-500); font-size: 1.1rem;
      transition: background var(--transition-base), color var(--transition-base);
    }
    .modal-close:hover { background: var(--gray-200); color: var(--gray-800); }

    /* Brand mark inside modal */
    .modal-brand {
      display: flex; align-items: center; gap: 0.5rem;
      margin-bottom: 1.5rem;
    }
    .modal-brand-icon {
      width: 36px; height: 36px; border-radius: var(--radius-base);
      background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 1rem;
    }
    .modal-brand-name { font-weight: 700; font-size: 1rem; color: var(--gray-900); }

    /* Step headings */
    .modal-title { font-size: 1.375rem; font-weight: 700; color: var(--gray-900); margin-bottom: 0.375rem; }
    .modal-subtitle { font-size: 0.875rem; color: var(--gray-500); margin-bottom: 1.75rem; line-height: 1.5; }

    /* ── Form ── */
    .form-group { margin-bottom: 1.25rem; }
    .form-group label {
      display: block; font-size: 0.875rem; font-weight: 500;
      color: var(--gray-700); margin-bottom: 0.375rem;
    }

    .input-wrap { position: relative; }
    .input-icon {
      position: absolute; left: 0.875rem; top: 50%; transform: translateY(-50%);
      color: var(--gray-400); font-size: 1rem; pointer-events: none;
    }
    .form-input {
      width: 100%;
      padding: 0.75rem 0.875rem 0.75rem 2.5rem;
      border: 1.5px solid var(--gray-200);
      border-radius: var(--radius-md);
      font-family: inherit; font-size: 0.9375rem;
      color: var(--gray-900);
      background: var(--gray-50);
      transition: border-color var(--transition-base), box-shadow var(--transition-base), background var(--transition-base);
      outline: none;
    }
    .form-input:focus {
      border-color: var(--primary-color);
      background: var(--white);
      box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
    }
    .form-input.error { border-color: var(--error-color); box-shadow: 0 0 0 3px rgba(239,68,68,0.1); }
    .form-input.success { border-color: var(--success-color); }

    .field-error {
      font-size: 0.8125rem; color: var(--error-color);
      margin-top: 0.375rem; display: none;
    }
    .field-error.show { display: block; }

    /* ── Primary CTA button ── */
    .btn-primary {
      width: 100%;
      padding: 0.8125rem 1.5rem;
      background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
      color: var(--white); border: none; border-radius: var(--radius-md);
      font-family: inherit; font-size: 0.9375rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      gap: 0.5rem; box-shadow: var(--shadow-md);
      transition: transform var(--transition-base), box-shadow var(--transition-base);
      position: relative; overflow: hidden;
    }
    .btn-primary::before {
      content: ''; position: absolute; top: 0; left: -100%;
      width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
      transition: left 0.5s;
    }
    .btn-primary:hover:not(:disabled)::before { left: 100%; }
    .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--shadow-lg); }
    .btn-primary:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }

    /* Spinner */
    .spinner {
      width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
      border-top-color: white; border-radius: 50%;
      animation: spin 0.7s linear infinite; display: none;
    }
    .btn-primary.loading .btn-label { display: none; }
    .btn-primary.loading .spinner { display: block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Divider ── */
    .divider { display: flex; align-items: center; gap: 0.75rem; margin: 1.25rem 0; }
    .divider-line { flex: 1; height: 1px; background: var(--gray-200); }
    .divider-text { font-size: 0.75rem; color: var(--gray-400); font-weight: 500; white-space: nowrap; }

    /* ── Google sign-in button ── */
    .btn-google {
      width: 100%; padding: 0.75rem 1.25rem;
      background: var(--white); border: 1.5px solid var(--gray-200);
      border-radius: var(--radius-md); font-family: inherit;
      font-size: 0.9375rem; font-weight: 500; color: var(--gray-700);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      gap: 0.625rem; transition: border-color var(--transition-base),
        background var(--transition-base), box-shadow var(--transition-base);
    }
    .btn-google:hover { border-color: var(--gray-300); background: var(--gray-50); box-shadow: var(--shadow-md); }
    .btn-google svg { flex-shrink: 0; }

    /* ── Footer note ── */
    .modal-footer-note {
      margin-top: 1.5rem; text-align: center;
      font-size: 0.8125rem; color: var(--gray-400);
    }
    .modal-footer-note a { color: var(--primary-color); font-weight: 500; cursor: pointer; }
    .modal-footer-note a:hover { color: var(--primary-dark); }

    /* ══════════════════════════════════════════════
       OTP STEP
    ══════════════════════════════════════════════ */
    .otp-email-display {
      display: inline-flex; align-items: center; gap: 0.375rem;
      background: rgba(99,102,241,0.08); color: var(--primary-dark);
      padding: 0.25rem 0.75rem; border-radius: var(--radius-full);
      font-size: 0.8125rem; font-weight: 500; margin-bottom: 1.75rem;
    }

    /* OTP digit inputs */
    .otp-inputs {
      display: flex; gap: 0.625rem; justify-content: center;
      margin-bottom: 1.25rem;
    }
    .otp-digit {
      width: 52px; height: 58px;
      border: 1.5px solid var(--gray-200);
      border-radius: var(--radius-md);
      background: var(--gray-50);
      font-family: inherit; font-size: 1.5rem; font-weight: 700;
      text-align: center; color: var(--gray-900); outline: none;
      transition: border-color var(--transition-base), box-shadow var(--transition-base), background var(--transition-base);
      caret-color: var(--primary-color);
    }
    .otp-digit:focus {
      border-color: var(--primary-color);
      background: var(--white);
      box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
    }
    .otp-digit.filled { border-color: var(--primary-light); background: var(--white); }
    .otp-digit.error-shake { border-color: var(--error-color); animation: shake 0.4s ease; }
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20% { transform: translateX(-6px); }
      40% { transform: translateX(6px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }

    /* Timer & resend */
    .otp-meta {
      display: flex; align-items: center; justify-content: space-between;
      font-size: 0.8125rem; margin-bottom: 1.5rem;
    }
    .otp-timer { color: var(--gray-500); display: flex; align-items: center; gap: 0.375rem; }
    .otp-timer-count { font-weight: 600; color: var(--gray-700); font-variant-numeric: tabular-nums; }
    .btn-resend {
      background: none; border: none; cursor: pointer;
      color: var(--primary-color); font-family: inherit;
      font-size: 0.8125rem; font-weight: 500; padding: 0;
      transition: color var(--transition-base);
    }
    .btn-resend:hover:not(:disabled) { color: var(--primary-dark); }
    .btn-resend:disabled { color: var(--gray-400); cursor: not-allowed; }

    .otp-error {
      text-align: center; font-size: 0.8125rem; color: var(--error-color);
      margin-bottom: 1rem; min-height: 1.2em;
    }

    /* Back link */
    .btn-back {
      background: none; border: none; cursor: pointer;
      color: var(--gray-500); font-family: inherit;
      font-size: 0.8125rem; display: inline-flex; align-items: center;
      gap: 0.375rem; padding: 0; margin-bottom: 1.5rem;
      transition: color var(--transition-base);
    }
    .btn-back:hover { color: var(--gray-800); }

    /* ══════════════════════════════════════════════
       SUCCESS STEP
    ══════════════════════════════════════════════ */
    .success-step { text-align: center; padding: 0.5rem 0 0.25rem; }
    .success-icon {
      width: 64px; height: 64px; border-radius: 50%;
      background: linear-gradient(135deg, #d1fae5, #a7f3d0);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1.25rem; font-size: 1.875rem;
      box-shadow: 0 0 0 8px rgba(16,185,129,0.1);
      animation: popIn 0.5s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes popIn {
      from { transform: scale(0); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .success-title { font-size: 1.25rem; font-weight: 700; color: var(--gray-900); margin-bottom: 0.5rem; }
    .success-msg { font-size: 0.875rem; color: var(--gray-500); line-height: 1.6; margin-bottom: 1.75rem; }

    /* ── Step panels ── */
    .step { display: none; }
    .step.active { display: block; }

    /* ── Responsive ── */
    @media (max-width: 480px) {
      .modal-inner { padding: 1.5rem 1.25rem 2rem; }
      .otp-digit { width: 44px; height: 52px; font-size: 1.25rem; }
      .modal-title { font-size: 1.2rem; }
    }
  </style>
</head>
<body>
    <!-- Skip to main content for accessibility -->
    <a href="#main-content" class="skip-link">Skip to main content</a>
    
    <!-- Header -->
    <header class="header" role="banner">
        <nav class="nav-container" role="navigation" aria-label="Main navigation">
            <div class="nav-brand">
                <img src="../image/logo.png" alt="ClassInstruct Logo" class="logo-image">
                <h1 class="logo">ClassInstruct</h1>
            </div>
            
            <button class="nav-toggle" aria-label="Toggle navigation menu" aria-expanded="false">
                <span class="hamburger-line"></span>
                <span class="hamburger-line"></span>
                <span class="hamburger-line"></span>
            </button>
            
            <ul class="nav-menu" role="menubar">
                <li role="none"><a href="#features" class="nav-link" role="menuitem">Features</a></li>
                <li role="none"><a href="#resources" class="nav-link" role="menuitem">Resources</a></li>
                <li role="none"><a href="#about" class="nav-link" role="menuitem">About</a></li>
                <li role="none"><a href="#contact" class="nav-link" role="menuitem">Contact</a></li>
<li role="none"><button class="nav-link btn-nav" id="openSignIn" role="menuitem">Sign In</button></li>
            </ul>
        </nav>
    </header>

  <!-- ═══════════════════════════════════════
       SIGN-IN MODAL
  ════════════════════════════════════════ -->
  <div class="modal-overlay" id="signInModal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-backdrop" id="modalBackdrop"></div>

    <div class="modal-box">
      <div class="modal-accent"></div>
      <button class="modal-close" id="closeModal" aria-label="Close sign in">✕</button>

      <div class="modal-inner">

        <!-- Brand -->
        <div class="modal-brand">
          <div class="modal-brand-icon">🎓</div>
          <span class="modal-brand-name">ClassInstruct</span>
        </div>

        <!-- ───────── STEP 1 : Email ───────── -->
        <div class="step active" id="stepEmail">
          <h2 class="modal-title" id="modal-title">Welcome back</h2>
          <p class="modal-subtitle">Enter your Gmail address to continue. We'll send a one-time code to verify it's you.</p>

          <div class="form-group">
            <label for="emailInput">Gmail address</label>
            <div class="input-wrap">
              <span class="input-icon">✉</span>
              <input
                class="form-input"
                type="email"
                id="emailInput"
                placeholder="you@gmail.com"
                autocomplete="email"
                inputmode="email"
              >
            </div>
            <span class="field-error" id="emailError">Please enter a valid Gmail address.</span>
          </div>

          <button class="btn-primary" id="btnSendOtp">
            <span class="btn-label">Send verification code</span>
            <div class="spinner"></div>
          </button>

          <div class="divider">
            <div class="divider-line"></div>
            <span class="divider-text">or continue with</span>
            <div class="divider-line"></div>
          </div>

          <button class="btn-google" id="btnGoogle">
            <!-- Google "G" logo -->
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p class="modal-footer-note">
            Don't have an account? <a id="linkSignUp">Sign up free</a>
          </p>
        </div>

        <!-- ───────── STEP 2 : OTP ───────── -->
        <div class="step" id="stepOtp">
          <button class="btn-back" id="btnBack">← Back</button>

          <h2 class="modal-title">Check your email</h2>
          <p class="modal-subtitle">We sent a 6-digit code to</p>
          <div class="otp-email-display" id="otpEmailDisplay">✉ you@gmail.com</div>

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
            <span class="otp-timer">
              ⏱ Code expires in <span class="otp-timer-count" id="timerCount">2:00</span>
            </span>
            <button class="btn-resend" id="btnResend" disabled>Resend code</button>
          </div>

          <button class="btn-primary" id="btnVerifyOtp">
            <span class="btn-label">Verify & Sign In</span>
            <div class="spinner"></div>
          </button>

          <p class="modal-footer-note">Didn't receive it? Check your spam folder or <a id="linkResend2">resend</a>.</p>
        </div>

        <!-- ───────── STEP 3 : Success ───────── -->
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
        </div>

      </div><!-- /.modal-inner -->
    </div><!-- /.modal-box -->
  </div><!-- /.modal-overlay -->

    <!-- Main Content -->
    <main id="main-content">
        <!-- Hero Section -->
        <section class="hero" aria-labelledby="hero-title">
            <div class="hero-container">
                <div class="hero-content">
                    <div class="hero-badge" aria-label="Platform feature">
                        <span class="badge-icon">🚀</span>
                        AI-Powered Platform
                    </div>
                    <h1 id="hero-title" class="hero-title">
                        Plan and Teach Clearly with 
                        <span class="gradient-text">ClassInstruct</span>
                    </h1>
                    <p class="hero-description">
                        Streamline lesson planning, enable interactive assessments, and provide mastery-driven analytics. 
                        Empower teachers to deliver impactful and inclusive learning experiences.
                    </p>
                    <div class="hero-actions">
                        <button class="btn btn-primary">Get Started Free</button>
                        <button class="btn btn-secondary">Watch Demo</button>
                    </div>
                    <div class="hero-stats">
                        <div class="stat-item">
                            <span class="stat-number">10K+</span>
                            <span class="stat-label">Teachers</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">500K+</span>
                            <span class="stat-label">Students</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">98%</span>
                            <span class="stat-label">Satisfaction</span>
                        </div>
                    </div>
                </div>
                <div class="hero-visual">
                    <div class="hero-image-container">
                        <img src="../image/home.png" alt="ClassInstruct platform dashboard showing lesson planning interface" class="hero-image">
                        <div class="floating-card card-1">
                            <div class="card-icon">📚</div>
                            <div class="card-content">
                                <h4>Lesson Plans</h4>
                                <p>AI-Generated</p>
                            </div>
                        </div>
                        <div class="floating-card card-2">
                            <div class="card-icon">📊</div>
                            <div class="card-content">
                                <h4>Analytics</h4>
                                <p>Real-time</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Features Section -->
        <section id="features" class="features" aria-labelledby="features-title">
            <div class="container">
                <div class="section-header">
                    <div class="section-badge">✨ Features</div>
                    <h2 id="features-title" class="section-title">Everything You Need to Excel</h2>
                    <p class="section-description">
                        Comprehensive AI-powered tools designed to enhance every aspect of your teaching workflow
                    </p>
                </div>

                <div class="features-grid">
                    <article class="feature-card" tabindex="0">
                        <div class="feature-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </div>
                        <div class="feature-content">
                            <h3>AI Lesson Planning</h3>
                            <p>Create comprehensive lesson plans in minutes with AI-powered suggestions tailored to your curriculum standards and student needs.</p>
                            <ul class="feature-list">
                                <li>Time-saving automation</li>
                                <li>Customizable templates</li>
                                <li>Curriculum alignment</li>
                            </ul>
                            <button class="btn btn-outline">Learn More</button>
                        </div>
                    </article>

                    <article class="feature-card" tabindex="0">
                        <div class="feature-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                                <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </div>
                        <div class="feature-content">
                            <h3>Interactive Quizzes</h3>
                            <p>Design engaging quizzes with multiple question types, instant feedback, and gamification elements to keep students motivated.</p>
                            <ul class="feature-list">
                                <li>Multiple question formats</li>
                                <li>Instant grading</li>
                                <li>Engagement analytics</li>
                            </ul>
                            <button class="btn btn-outline">Learn More</button>
                        </div>
                    </article>

                    <article class="feature-card" tabindex="0">
                        <div class="feature-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 3v18h18" stroke="currentColor" stroke-width="2"/>
                                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </div>
                        <div class="feature-content">
                            <h3>Mastery Analytics</h3>
                            <p>Gain deep insights into student performance with comprehensive analytics dashboards and progress tracking.</p>
                            <ul class="feature-list">
                                <li>Performance tracking</li>
                                <li>Learning gap identification</li>
                                <li>Progress reports</li>
                            </ul>
                            <button class="btn btn-outline">Learn More</button>
                        </div>
                    </article>
                </div>
            </div>
        </section>

        <!-- Resources Section -->
        <section id="resources" class="resources" aria-labelledby="resources-title">
            <div class="container">
                <div class="section-header">
                    <div class="section-badge">📚 Resources</div>
                    <h2 id="resources-title" class="section-title">Everything You Need to Succeed</h2>
                    <p class="section-description">
                        Access a wealth of resources designed to help you get the most out of ClassInstruct
                    </p>
                </div>

                <div class="resources-grid">
                    <article class="resource-card">
                        <div class="resource-icon">💡</div>
                        <h3>Best Practices</h3>
                        <p>Learn proven strategies for maximizing student engagement and learning outcomes</p>
                        <button class="btn btn-text">Explore →</button>
                    </article>

                    <article class="resource-card">
                        <div class="resource-icon">❓</div>
                        <h3>Help Center</h3>
                        <p>Find answers to common questions and get support when you need it</p>
                        <button class="btn btn-text">Explore →</button>
                    </article>

                    <article class="resource-card">
                        <div class="resource-icon">🎥</div>
                        <h3>Video Tutorials</h3>
                        <p>Step-by-step video tutorials to help you master every feature</p>
                        <button class="btn btn-text">Explore →</button>
                    </article>

                    <article class="resource-card">
                        <div class="resource-icon">📄</div>
                        <h3>Templates</h3>
                        <p>Ready-to-use lesson plan templates across all subjects and grade levels</p>
                        <button class="btn btn-text">Explore →</button>
                    </article>
                </div>
            </div>
        </section>

        <!-- About Section -->
        <section id="about" class="about" aria-labelledby="about-title">
            <div class="container">
                <div class="about-content">
                    <div class="about-text">
                        <h2 id="about-title" class="section-title">About ClassInstruct</h2>
                        <p class="about-description">
                            At ClassInstruct, we believe that instruction should be clear, efficient, and motivating. 
                            Our AI-powered platform empowers educators by streamlining lesson planning, automating 
                            quiz creation, and providing comprehensive analytics.
                        </p>
                        <p class="about-description">
                            We understand the challenges educators face in balancing time, creativity, and clarity. 
                            ClassInstruct combines cutting-edge technology with practical tools to make teaching 
                            more efficient and less stressful.
                        </p>
                        <div class="about-features">
                            <div class="about-feature">
                                <span class="feature-number">5M+</span>
                                <span class="feature-text">Lessons Created</span>
                            </div>
                            <div class="about-feature">
                                <span class="feature-number">50+</span>
                                <span class="feature-text">Countries</span>
                            </div>
                            <div class="about-feature">
                                <span class="feature-number">24/7</span>
                                <span class="feature-text">Support</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Contact Section -->
        <section id="contact" class="contact" aria-labelledby="contact-title">
            <div class="container">
                <div class="contact-content">
                    <div class="contact-info">
                        <h2 id="contact-title" class="section-title">Get in Touch</h2>
                        <p class="contact-description">
                            Ready to transform your teaching experience? Contact us to learn more about ClassInstruct.
                        </p>
                        
                        <div class="contact-methods">
                            <div class="contact-method">
                                <div class="method-icon">📧</div>
                                <div class="method-content">
                                    <h4>Email Us</h4>
                                    <a href="mailto:hello@classinstruct.com">hello@classinstruct.com</a>
                                </div>
                            </div>
                            
                            <div class="contact-method">
                                <div class="method-icon">📞</div>
                                <div class="method-content">
                                    <h4>Call Us</h4>
                                    <a href="tel:+1-555-123-4567">+1 (555) 123-4567</a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <form class="contact-form" aria-labelledby="contact-form-title">
                        <h3 id="contact-form-title" class="sr-only">Contact Form</h3>
                        
                        <div class="form-group">
                            <label for="name">Full Name</label>
                            <input type="text" id="name" name="name" required aria-describedby="name-error">
                            <span id="name-error" class="error-message" role="alert"></span>
                        </div>
                        
                        <div class="form-group">
                            <label for="email">Email Address</label>
                            <input type="email" id="email" name="email" required aria-describedby="email-error">
                            <span id="email-error" class="error-message" role="alert"></span>
                        </div>
                        
                        <div class="form-group">
                            <label for="subject">Subject</label>
                            <select id="subject" name="subject" required aria-describedby="subject-error">
                                <option value="">Select a subject</option>
                                <option value="demo">Request Demo</option>
                                <option value="support">Technical Support</option>
                                <option value="billing">Billing Question</option>
                                <option value="other">Other</option>
                            </select>
                            <span id="subject-error" class="error-message" role="alert"></span>
                        </div>
                        
                        <div class="form-group">
                            <label for="message">Message</label>
                            <textarea id="message" name="message" rows="5" required aria-describedby="message-error"></textarea>
                            <span id="message-error" class="error-message" role="alert"></span>
                        </div>
                        
                        <button type="submit" class="btn btn-primary btn-full">Send Message</button>
                    </form>
                </div>
            </div>
        </section>
    </main>

    <!-- Footer -->
    <footer class="footer" role="contentinfo">
        <div class="container">
            <div class="footer-content">
                <div class="footer-brand">
                    <h3 class="footer-logo">ClassInstruct</h3>
                    <p class="footer-description">
                        Empowering educators with AI-powered teaching tools for better learning outcomes.
                    </p>
                </div>
                
                <div class="footer-links">
                    <div class="footer-column">
                        <h4>Product</h4>
                        <ul>
                            <li><a href="#features">Features</a></li>
                            <li><a href="#resources">Resources</a></li>
                            <li><a href="#">Pricing</a></li>
                        </ul>
                    </div>
                    
                    <div class="footer-column">
                        <h4>Support</h4>
                        <ul>
                            <li><a href="#contact">Contact</a></li>
                            <li><a href="#">Help Center</a></li>
                            <li><a href="#">Documentation</a></li>
                        </ul>
                    </div>
                    
                    <div class="footer-column">
                        <h4>Company</h4>
                        <ul>
                            <li><a href="#about">About</a></li>
                            <li><a href="#">Privacy</a></li>
                            <li><a href="#">Terms</a></li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <div class="footer-bottom">
                <p>&copy; 2024 ClassInstruct. All rights reserved.</p>
            </div>
        </div>
    </footer>

    <script src="script.js"></script>
    <script src="signin_modal_wired.js"></script>

    <script>
(function () {
  /* ── Elements ── */
  const modal        = document.getElementById('signInModal');
  const openBtn      = document.getElementById('openSignIn');
  const closeBtn     = document.getElementById('closeModal');
  const backdrop     = document.getElementById('modalBackdrop');

  const stepEmail    = document.getElementById('stepEmail');
  const stepOtp      = document.getElementById('stepOtp');
  const stepSuccess  = document.getElementById('stepSuccess');

  const emailInput   = document.getElementById('emailInput');
  const emailError   = document.getElementById('emailError');
  const btnSendOtp   = document.getElementById('btnSendOtp');
  const btnGoogle    = document.getElementById('btnGoogle');

  const otpDigits    = document.querySelectorAll('.otp-digit');
  const otpEmailDisp = document.getElementById('otpEmailDisplay');
  const otpError     = document.getElementById('otpError');
  const btnVerify    = document.getElementById('btnVerifyOtp');
  const btnBack      = document.getElementById('btnBack');
  const btnResend    = document.getElementById('btnResend');
  const timerEl      = document.getElementById('timerCount');
  const btnDash      = document.getElementById('btnGoToDashboard');

  /* Demo OTP (in production this is generated server-side) */
  let DEMO_OTP = '';
  let timerInterval = null;
  let timerSeconds  = 120;

  /* ── Modal open/close ── */
  function openModal() { modal.classList.add('active'); emailInput.focus(); }
  function closeModal() {
    modal.classList.remove('active');
    setTimeout(resetAll, 350);
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('active')) closeModal(); });

  /* ── Step switcher ── */
  function showStep(step) {
    [stepEmail, stepOtp, stepSuccess].forEach(s => s.classList.remove('active'));
    step.classList.add('active');
  }

  /* ── Email validation ── */
  function isValidGmail(v) {
    return /^[^\s@]+@gmail\.com$/i.test(v.trim());
  }

  function setEmailError(show) {
    emailInput.classList.toggle('error', show);
    emailError.classList.toggle('show', show);
  }

  emailInput.addEventListener('input', () => {
    if (emailInput.value.trim()) setEmailError(false);
  });

  /* ── Send OTP ── */
  btnSendOtp.addEventListener('click', () => sendOtp());
  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendOtp(); });

  async function sendOtp() {
    const email = emailInput.value.trim();
    if (!isValidGmail(email)) { setEmailError(true); emailInput.focus(); return; }

    setEmailError(false);
    setLoading(btnSendOtp, true);

    /* Simulate API call */
    await delay(1500);

    /* Generate demo OTP */
    DEMO_OTP = String(Math.floor(100000 + Math.random() * 900000));
    console.info(`%c[ClassInstruct Demo] OTP: ${DEMO_OTP}`, 'color:#6366f1;font-weight:bold;font-size:14px');

    setLoading(btnSendOtp, false);

    /* Show OTP step */
    otpEmailDisp.textContent = `✉ ${email}`;
    showStep(stepOtp);
    clearOtpDigits();
    otpError.textContent = '';
    startTimer();
    otpDigits[0].focus();
  }

  /* ── Google button (demo placeholder) ── */
  btnGoogle.addEventListener('click', () => {
    alert('In production, this redirects to Google OAuth. For this demo, use the email OTP flow above.');
  });

  /* ── OTP digit input handling ── */
  otpDigits.forEach((input, i) => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace') {
        if (!input.value && i > 0) { otpDigits[i-1].value = ''; otpDigits[i-1].classList.remove('filled'); otpDigits[i-1].focus(); }
        else { input.value = ''; input.classList.remove('filled'); }
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowLeft' && i > 0) { otpDigits[i-1].focus(); return; }
      if (e.key === 'ArrowRight' && i < 5) { otpDigits[i+1].focus(); return; }
    });

    input.addEventListener('input', e => {
      /* Accept only digits */
      const val = input.value.replace(/\D/g, '');
      if (!val) { input.value = ''; input.classList.remove('filled'); return; }

      /* Handle paste of full OTP */
      if (val.length > 1) {
        const digits = val.slice(0, 6).split('');
        digits.forEach((d, j) => {
          if (otpDigits[i + j]) { otpDigits[i+j].value = d; otpDigits[i+j].classList.add('filled'); }
        });
        const next = Math.min(i + digits.length, 5);
        otpDigits[next].focus();
        return;
      }

      input.value = val[0];
      input.classList.add('filled');
      if (i < 5) otpDigits[i+1].focus();

      /* Auto-verify if all filled */
      if (getOtpValue().length === 6) verifyOtp();
    });

    input.addEventListener('focus', () => input.select());
  });

  function getOtpValue() {
    return Array.from(otpDigits).map(d => d.value).join('');
  }

  function clearOtpDigits() {
    otpDigits.forEach(d => { d.value = ''; d.classList.remove('filled','error-shake'); });
  }

  /* ── Verify OTP ── */
  btnVerify.addEventListener('click', verifyOtp);

  async function verifyOtp() {
    const entered = getOtpValue();
    if (entered.length < 6) {
      otpError.textContent = 'Please enter all 6 digits.';
      return;
    }

    otpError.textContent = '';
    setLoading(btnVerify, true);
    await delay(1400);
    setLoading(btnVerify, false);

    if (entered === DEMO_OTP) {
      clearInterval(timerInterval);
      showStep(stepSuccess);
    } else {
      otpError.textContent = 'Incorrect code. Please try again.';
      otpDigits.forEach(d => { d.classList.add('error-shake'); });
      setTimeout(() => otpDigits.forEach(d => d.classList.remove('error-shake')), 500);
      clearOtpDigits();
      otpDigits[0].focus();
    }
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
      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerEl.textContent = '0:00';
        btnResend.disabled = false;
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const m = Math.floor(timerSeconds / 60);
    const s = timerSeconds % 60;
    timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  /* ── Resend ── */
  async function resendOtp() {
    btnResend.disabled = true;
    otpError.textContent = '';
    DEMO_OTP = String(Math.floor(100000 + Math.random() * 900000));
    console.info(`%c[ClassInstruct Demo] New OTP: ${DEMO_OTP}`, 'color:#6366f1;font-weight:bold;font-size:14px');
    clearOtpDigits();
    startTimer();
    otpDigits[0].focus();
  }

  btnResend.addEventListener('click', resendOtp);
  document.getElementById('linkResend2').addEventListener('click', resendOtp);

  /* ── Back ── */
  btnBack.addEventListener('click', () => {
    clearInterval(timerInterval);
    showStep(stepEmail);
  });

  /* ── Dashboard (demo) ── */
  btnDash.addEventListener('click', async () => {
    setLoading(btnDash, true);
    await delay(1000);
    alert('In production this redirects to /dashboard. Demo complete!');
    setLoading(btnDash, false);
    closeModal();
  });

  /* ── Sign Up link (demo) ── */
  document.getElementById('linkSignUp').addEventListener('click', () => {
    alert('In production this navigates to /signup.');
  });

  /* ── Helpers ── */
  function setLoading(btn, loading) {
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function resetAll() {
    showStep(stepEmail);
    emailInput.value = '';
    setEmailError(false);
    clearOtpDigits();
    otpError.textContent = '';
    clearInterval(timerInterval);
  }
 <script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script>
    <script src="script.js"></script>

    <script>
    (function () {
      /* ── Elements ── */
      const modal        = document.getElementById('signInModal');
      const openBtn      = document.getElementById('openSignIn');
      ...
      // (hundreds of lines of demo code)
      ...
})();

    </script>
</body>
</html>
