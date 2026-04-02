<?php session_start(); ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClassInstruct — AI-Powered Teaching Assistant</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <style>

    /* =============================================
       RESET & BASE
    ============================================= */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #fafaf8;
      color: #1a1a1a;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      overflow-x: hidden;
    }

    a { background-color: transparent; text-decoration: none; color: inherit; }

    img { border-style: none; max-width: 100%; height: auto; }

    button, input, select, textarea {
      font-family: inherit;
      font-size: 100%;
      line-height: 1.15;
      margin: 0;
    }

    textarea { overflow: auto; resize: vertical; }

    /* =============================================
       ACCESSIBILITY
    ============================================= */
    .sr-only {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    :focus-visible { outline: 2px solid #b8860b; outline-offset: 2px; }
    :focus:not(:focus-visible) { outline: none; }

    /* =============================================
       TYPOGRAPHY HELPERS
    ============================================= */
    .font-serif { font-family: 'Playfair Display', Georgia, serif; }
    .font-sans  { font-family: 'Inter', sans-serif; }
    .font-mono  { font-family: 'JetBrains Mono', monospace; }

    /* =============================================
       CSS VARIABLES
    ============================================= */
    :root {
      /* Brand */
      --gold:        #b8860b;
      --gold-dark:   #a07609;
      --off-white:   #fafaf8;
      --dark:        #1a1a1a;
      --mid:         #6b6b6b;
      --border:      #e8e4df;
      --surface:     #f5f3f0;

      /* Modal palette */
      --primary:      #6366f1;
      --primary-dark: #4f46e5;
      --primary-light:#818cf8;
      --secondary:    #8b5cf6;
      --success:      #10b981;
      --error:        #ef4444;
      --white:        #ffffff;
      --gray-50:      #f9fafb;
      --gray-100:     #f3f4f6;
      --gray-200:     #e5e7eb;
      --gray-300:     #d1d5db;
      --gray-400:     #9ca3af;
      --gray-500:     #6b7280;
      --gray-700:     #374151;
      --gray-800:     #1f2937;
      --gray-900:     #111827;
      --shadow-md:    0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      --shadow-lg:    0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      --shadow-xl:    0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1);
      --radius-base:  0.5rem;
      --radius-md:    0.75rem;
      --radius-xl:    1.5rem;
      --radius-full:  9999px;
      --transition:   250ms ease;
    }

    /* =============================================
       SECTION TAG
    ============================================= */
    .section-tag {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 32px;
    }

    .section-tag .line { width: 40px; height: 1px; background: var(--border); }

    .section-tag span {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 1.8px;
      text-transform: uppercase;
      color: var(--gold);
    }

    /* =============================================
       BUTTONS
    ============================================= */
    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: var(--gold);
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.42px;
      padding: 10px 24px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s;
      width: fit-content;
      white-space: nowrap;
    }

    .btn-primary:hover { background: var(--gold-dark); }

    .btn-primary svg { width: 16px; height: 16px; stroke: #fff; fill: none; stroke-width: 2; }

    .btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      background: transparent;
      color: var(--dark);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.42px;
      padding: 14px 32px;
      border-radius: 6px;
      border: 1px solid var(--dark);
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s;
    }

    .btn-secondary:hover { background: rgba(0, 0, 0, 0.04); }

    .btn-secondary-dark {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      background: transparent;
      color: var(--off-white);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.42px;
      padding: 14px 32px;
      border-radius: 6px;
      border: 1px solid rgba(250, 250, 248, 0.3);
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s;
    }

    .btn-secondary-dark:hover { background: rgba(255, 255, 255, 0.05); }

    /* =============================================
       NAVBAR
    ============================================= */
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 64px;
      border-bottom: 1px solid var(--border);
    }

    .navbar > .btn-primary { width: auto; flex-shrink: 0; }

    .logo { display: flex; align-items: center; gap: 8px; }

    .logo-mark { width: 28px; height: 28px; background: var(--gold); border-radius: 6px; }

    .logo-text { font-family: 'Playfair Display', serif; font-size: 20px; color: var(--dark); }

    .nav-links { display: flex; align-items: center; gap: 32px; }

    .nav-links a {
      color: var(--mid);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.7px;
      text-decoration: none;
      transition: color 0.2s;
    }

    .nav-links a:hover { color: var(--dark); }

    /* =============================================
       HERO
    ============================================= */
    .hero {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 128px 64px 144px;
      overflow: hidden;
    }

    .hero-bg {
      position: absolute;
      inset: 0;
      background: url('https://cdn.wonder.so/images/019d44da-e731-707b-938e-e22b33072424/60e721895e12f8c274dc4bfb1ba1f8d289a8a66860aa9625aa60deffa4cf0c4b.jpg') center/cover no-repeat;
      opacity: 0.06;
    }

    .hero-content {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 900px;
    }

    .hero h1 {
      font-family: 'Playfair Display', serif;
      font-size: 72px;
      line-height: 1.1;
      letter-spacing: -1.44px;
      text-align: center;
      color: var(--dark);
    }

    .hero h1 em { color: var(--gold); font-style: italic; }

    .hero-description {
      max-width: 560px;
      margin: 32px 0 40px;
      color: var(--mid);
      font-size: 18px;
      line-height: 1.75;
      text-align: center;
    }

    .hero-cta { display: flex; align-items: center; gap: 16px; }

    .hero .btn-primary { padding: 14px 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

    /* =============================================
       FEATURES
    ============================================= */
    .features { padding: 128px 64px 144px; border-bottom: 1px solid var(--border); }

    .features-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 80px;
    }

    .features-title h2 {
      font-family: 'Playfair Display', serif;
      font-size: 40px;
      line-height: 1.2;
      letter-spacing: -0.4px;
      color: var(--dark);
    }

    .features-title h2 em { font-style: italic; }

    .features-header .features-desc {
      max-width: 380px;
      padding-top: 40px;
      color: var(--mid);
      font-size: 16px;
      line-height: 1.75;
    }

    .features-grid { display: flex; gap: 32px; }

    .feature-card {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .feature-card.featured { border: none; border-top: 2px solid var(--gold); }

    .feature-icon {
      width: 48px; height: 48px;
      display: flex;
      justify-content: center;
      align-items: center;
      background: var(--off-white);
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 32px;
    }

    .feature-icon svg {
      width: 20px; height: 20px;
      stroke: var(--gold);
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .feature-card h3 {
      font-family: 'Playfair Display', serif;
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--dark);
    }

    .feature-card p { color: var(--mid); font-size: 14px; line-height: 1.75; }

    /* =============================================
       HOW IT WORKS
    ============================================= */
    .how-it-works { padding: 128px 64px 144px; border-bottom: 1px solid var(--border); }

    .how-it-works .section-title {
      font-family: 'Playfair Display', serif;
      font-size: 40px;
      line-height: 1.2;
      letter-spacing: -0.4px;
      color: var(--dark);
      margin-bottom: 80px;
    }

    .steps-grid { display: flex; gap: 32px; }

    .step-card {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 40px;
    }

    .step-number {
      font-family: 'Playfair Display', serif;
      font-size: 24px;
      color: var(--gold);
      margin-bottom: 32px;
    }

    .step-card h3 {
      font-family: 'Playfair Display', serif;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--dark);
    }

    .step-card p { color: var(--mid); font-size: 14px; line-height: 1.75; }

    .step-icon-area {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100px;
      margin-top: 32px;
      background: var(--surface);
      border-radius: 6px;
    }

    .step-icon-area svg {
      width: 28px; height: 28px;
      stroke: var(--gold);
      fill: none;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* =============================================
       TESTIMONIALS
    ============================================= */
    .testimonials { padding: 128px 64px 144px; border-bottom: 1px solid var(--border); }

    .testimonials .section-title {
      font-family: 'Playfair Display', serif;
      font-size: 40px;
      line-height: 1.2;
      letter-spacing: -0.4px;
      color: var(--dark);
      margin-bottom: 80px;
    }

    .testimonials-grid { display: flex; gap: 32px; }

    .testimonial-card {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 40px;
    }

    .testimonial-card.featured { border: none; border-top: 2px solid var(--gold); }

    .stars { display: flex; gap: 4px; margin-bottom: 24px; }
    .stars svg { width: 16px; height: 16px; }
    .stars.gold svg { stroke: var(--gold); fill: var(--gold); }
    .stars.red  svg { stroke: #ff3000;    fill: #ff3000; }

    .testimonial-card blockquote {
      font-family: 'Playfair Display', serif;
      font-size: 16px;
      font-style: italic;
      line-height: 1.75;
      color: var(--dark);
      margin-bottom: 40px;
      flex: 1;
    }

    .author-name { font-size: 14px; font-weight: 600; color: var(--dark); margin-bottom: 4px; }
    .author-role { font-size: 12px; color: var(--mid); }

    /* =============================================
       ABOUT
    ============================================= */
    .about { padding: 128px 64px 144px; border-top: 1px solid var(--border); }

    .about-title h2 {
      font-family: 'Playfair Display', serif;
      font-size: 40px;
      line-height: 1.2;
      letter-spacing: -0.4px;
      color: var(--dark);
      margin-bottom: 4px;
    }

    .about-title h2 em { color: var(--gold); font-style: italic; }

    .about-title .accent {
      display: block;
      color: var(--gold);
      font-family: 'Playfair Display', serif;
      font-size: 40px;
      font-style: italic;
      line-height: 1.2;
      letter-spacing: -0.4px;
      margin-bottom: 64px;
    }

    .about-columns { display: flex; gap: 64px; margin-bottom: 80px; }

    .about-columns p { flex: 1; color: var(--mid); font-size: 16px; line-height: 1.75; }

    .values-grid { display: flex; gap: 32px; }

    .value-card {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 40px;
    }

    .value-card.featured { border: none; border-top: 2px solid var(--gold); }

    .value-card svg {
      width: 20px; height: 20px;
      stroke: var(--gold);
      fill: none;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      margin-bottom: 24px;
    }

    .value-card h3 {
      font-family: 'Playfair Display', serif;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--dark);
    }

    .value-card p { color: var(--mid); font-size: 14px; line-height: 1.75; }

    /* =============================================
       CTA SECTION
    ============================================= */
    .cta-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: var(--dark);
      padding: 144px 64px;
    }

    .cta-section .section-tag .line { background: rgba(250, 250, 248, 0.2); }

    .cta-section h2 {
      font-family: 'Playfair Display', serif;
      font-size: 56px;
      line-height: 1.15;
      letter-spacing: -1.12px;
      text-align: center;
      color: var(--off-white);
    }

    .cta-section h2 em { color: var(--gold); font-style: italic; display: block; margin-bottom: 32px; }

    .cta-section .cta-desc {
      max-width: 520px;
      margin-bottom: 48px;
      color: rgba(250, 250, 248, 0.5);
      font-size: 18px;
      line-height: 1.75;
      text-align: center;
    }

    .cta-buttons { display: flex; align-items: center; gap: 16px; }

    /* =============================================
       CONTACT SECTION
    ============================================= */
    .contact-section { display: flex; background: var(--surface); padding: 80px 64px; gap: 64px; }

    .contact-left { flex: 1; display: flex; flex-direction: column; }

    .contact-left h2 {
      font-family: 'Playfair Display', serif;
      font-size: 36px;
      letter-spacing: -0.72px;
      color: var(--dark);
      margin-bottom: 24px;
    }

    .contact-left .contact-desc {
      max-width: 440px;
      color: var(--mid);
      font-size: 16px;
      line-height: 1.75;
      margin-bottom: 48px;
    }

    .contact-row { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; }

    .contact-icon {
      width: 48px; height: 48px;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 6px;
      flex-shrink: 0;
    }

    .contact-icon svg {
      width: 20px; height: 20px;
      stroke: var(--gold);
      fill: none;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .contact-label { font-size: 14px; font-weight: 600; color: var(--dark); margin-bottom: 4px; }
    .contact-value { font-size: 14px; color: var(--gold); }

    .contact-form {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 40px;
    }

    .form-field { display: flex; flex-direction: column; margin-bottom: 24px; }

    .form-field label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 1.8px;
      text-transform: uppercase;
      color: var(--dark);
      margin-bottom: 8px;
    }

    .form-field input,
    .form-field select,
    .form-field textarea {
      border: none;
      border-bottom: 1px solid var(--border);
      padding: 12px 0;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      color: var(--dark);
      background: transparent;
      outline: none;
      transition: border-color 0.2s;
    }

    .form-field input:focus,
    .form-field select:focus,
    .form-field textarea:focus { border-bottom-color: var(--gold); }

    .form-field textarea { height: 128px; resize: none; }
    .form-field select { color: rgba(107, 107, 107, 0.5); appearance: none; }
    .form-field:last-of-type { margin-bottom: 32px; }

    .submit-btn {
      display: flex;
      justify-content: center;
      align-items: center;
      background: var(--gold);
      color: #fff;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.42px;
      padding: 14px 0;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      transition: background 0.2s;
    }

    .submit-btn:hover { background: var(--gold-dark); }

    /* =============================================
       FOOTER
    ============================================= */
    .footer { background: var(--dark); border-top: 1px solid rgba(250, 250, 248, 0.1); }

    .footer-content { display: flex; padding: 64px; gap: 80px; }

    .footer-brand { display: flex; flex-direction: column; }

    .footer-logo { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; }

    .footer-logo .logo-mark { width: 20px; height: 20px; background: var(--gold); border-radius: 4px; }

    .footer-logo .logo-text { font-family: 'Playfair Display', serif; font-size: 18px; color: var(--off-white); }

    .footer-tagline { max-width: 300px; color: rgba(250, 250, 248, 0.4); font-size: 14px; line-height: 1.75; }

    .footer-links-col { display: flex; flex-direction: column; }

    .footer-links-col h4 {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 1.8px;
      text-transform: uppercase;
      color: var(--off-white);
      margin-bottom: 24px;
    }

    .footer-links-col a { color: #6b6b6b; font-size: 14px; text-decoration: none; margin-bottom: 12px; transition: color 0.2s; }
    .footer-links-col a:last-child { margin-bottom: 0; }
    .footer-links-col a:hover { color: var(--off-white); }

    .footer-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 64px;
      border-top: 1px solid rgba(250, 250, 248, 0.1);
    }

    .footer-bottom span { color: rgba(250, 250, 248, 0.3); font-size: 12px; }

    /* =============================================
       SIGN-IN MODAL
    ============================================= */
    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }

    .modal-overlay.active { opacity: 1; visibility: visible; }

    .modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(17, 24, 39, 0.55);
      backdrop-filter: blur(4px);
    }

    .modal-box {
      position: relative;
      z-index: 1;
      background: var(--white);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl);
      width: 100%;
      max-width: 420px;
      overflow: hidden;
      transform: translateY(24px) scale(0.97);
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
      opacity: 0;
    }

    .modal-overlay.active .modal-box { transform: translateY(0) scale(1); opacity: 1; }

    .modal-accent { height: 4px; background: linear-gradient(90deg, var(--primary), var(--secondary)); }

    .modal-inner { padding: 2rem 2rem 2.5rem; }

    .modal-close {
      position: absolute;
      top: 1rem; right: 1rem;
      background: var(--gray-100);
      border: none;
      cursor: pointer;
      width: 32px; height: 32px;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--gray-500);
      font-size: 1.1rem;
      transition: background var(--transition), color var(--transition);
    }

    .modal-close:hover { background: var(--gray-200); color: var(--gray-800); }

    .modal-brand { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem; }

    .modal-brand-icon {
      width: 36px; height: 36px;
      border-radius: var(--radius-base);
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1rem;
    }

    .modal-brand-name { font-weight: 700; font-size: 1rem; color: var(--gray-900); }

    .modal-title { font-size: 1.375rem; font-weight: 700; color: var(--gray-900); margin-bottom: 0.375rem; }
    .modal-subtitle { font-size: 0.875rem; color: var(--gray-500); margin-bottom: 1.75rem; line-height: 1.5; }

    /* Modal form */
    .form-group { margin-bottom: 1.25rem; }

    .form-group label { display: block; font-size: 0.875rem; font-weight: 500; color: var(--gray-700); margin-bottom: 0.375rem; }

    .input-wrap { position: relative; }

    .form-input {
      width: 100%;
      padding: 0.75rem 0.875rem 0.75rem 2.5rem;
      border: 1.5px solid var(--gray-200);
      border-radius: var(--radius-md);
      font-family: inherit;
      font-size: 0.9375rem;
      color: var(--gray-900);
      background: var(--gray-50);
      transition: border-color var(--transition), box-shadow var(--transition), background var(--transition);
      outline: none;
    }

    .form-input:focus { border-color: var(--primary); background: var(--white); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12); }
    .form-input.error { border-color: var(--error); }

    .field-error { font-size: 0.8125rem; color: var(--error); margin-top: 0.375rem; display: none; }
    .field-error.show { display: block; }

    /* Modal primary button override */
    .modal-inner .btn-primary {
      width: 100%;
      padding: 0.8125rem 1.5rem;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      border-radius: var(--radius-md);
      font-size: 0.9375rem;
      font-weight: 600;
      box-shadow: var(--shadow-md);
      position: relative;
      overflow: hidden;
    }

    .modal-inner .btn-primary::before {
      content: '';
      position: absolute;
      top: 0; left: -100%;
      width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
      transition: left 0.5s;
    }

    .modal-inner .btn-primary:hover:not(:disabled)::before { left: 100%; }
    .modal-inner .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--shadow-lg); }
    .modal-inner .btn-primary:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }

    .spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: none;
    }

    .btn-primary.loading .btn-label { display: none; }
    .btn-primary.loading .spinner  { display: block; }

    @keyframes spin { to { transform: rotate(360deg); } }

    .divider { display: flex; align-items: center; gap: 0.75rem; margin: 1.25rem 0; }
    .divider-line { flex: 1; height: 1px; background: var(--gray-200); }
    .divider-text { font-size: 0.75rem; color: var(--gray-400); font-weight: 500; white-space: nowrap; }

    .btn-google {
      width: 100%;
      padding: 0.75rem 1.25rem;
      background: var(--white);
      border: 1.5px solid var(--gray-200);
      border-radius: var(--radius-md);
      font-family: inherit;
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--gray-700);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.625rem;
      transition: border-color var(--transition), background var(--transition), box-shadow var(--transition);
    }

    .btn-google:hover { border-color: var(--gray-300); background: var(--gray-50); box-shadow: var(--shadow-md); }
    .btn-google svg { flex-shrink: 0; }

    .modal-footer-note { margin-top: 1.5rem; text-align: center; font-size: 0.8125rem; color: var(--gray-400); }
    .modal-footer-note a { color: var(--primary); font-weight: 500; cursor: pointer; }
    .modal-footer-note a:hover { color: var(--primary-dark); }

    /* OTP */
    .otp-email-display {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      background: rgba(99, 102, 241, 0.08);
      color: var(--primary-dark);
      padding: 0.25rem 0.75rem;
      border-radius: var(--radius-full);
      font-size: 0.8125rem;
      font-weight: 500;
      margin-bottom: 1.75rem;
    }

    .otp-inputs { display: flex; gap: 0.625rem; justify-content: center; margin-bottom: 1.25rem; }

    .otp-digit {
      width: 52px; height: 58px;
      border: 1.5px solid var(--gray-200);
      border-radius: var(--radius-md);
      background: var(--gray-50);
      font-family: inherit;
      font-size: 1.5rem;
      font-weight: 700;
      text-align: center;
      color: var(--gray-900);
      outline: none;
      transition: border-color var(--transition), box-shadow var(--transition), background var(--transition);
      caret-color: var(--primary);
    }

    .otp-digit:focus { border-color: var(--primary); background: var(--white); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12); }
    .otp-digit.filled { border-color: var(--primary-light); background: var(--white); }
    .otp-digit.error-shake { border-color: var(--error); animation: shake 0.4s ease; }

    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20% { transform: translateX(-6px); }
      40% { transform: translateX(6px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }

    .otp-meta { display: flex; align-items: center; justify-content: space-between; font-size: 0.8125rem; margin-bottom: 1.5rem; }
    .otp-timer { color: var(--gray-500); display: flex; align-items: center; gap: 0.375rem; }
    .otp-timer-count { font-weight: 600; color: var(--gray-700); font-variant-numeric: tabular-nums; }

    .btn-resend {
      background: none; border: none; cursor: pointer;
      color: var(--primary); font-family: inherit;
      font-size: 0.8125rem; font-weight: 500; padding: 0;
      transition: color var(--transition);
    }

    .btn-resend:hover:not(:disabled) { color: var(--primary-dark); }
    .btn-resend:disabled { color: var(--gray-400); cursor: not-allowed; }

    .otp-error { text-align: center; font-size: 0.8125rem; color: var(--error); margin-bottom: 1rem; min-height: 1.2em; }

    .btn-back {
      background: none; border: none; cursor: pointer;
      color: var(--gray-500); font-family: inherit;
      font-size: 0.8125rem;
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0; margin-bottom: 1.5rem;
      transition: color var(--transition);
    }

    .btn-back:hover { color: var(--gray-800); }

    /* Success */
    .success-step { text-align: center; padding: 0.5rem 0 0.25rem; }

    .success-icon {
      width: 64px; height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #d1fae5, #a7f3d0);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1.25rem;
      font-size: 1.875rem;
      box-shadow: 0 0 0 8px rgba(16, 185, 129, 0.1);
      animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes popIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .success-title { font-size: 1.25rem; font-weight: 700; color: var(--gray-900); margin-bottom: 0.5rem; }
    .success-msg   { font-size: 0.875rem; color: var(--gray-500); line-height: 1.6; margin-bottom: 1.75rem; }

    /* Step panels */
    .step { display: none; }
    .step.active { display: block; }

    /* =============================================
       REDUCED MOTION
    ============================================= */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }

    /* =============================================
       RESPONSIVE (modal)
    ============================================= */
    @media (max-width: 480px) {
      .modal-inner { padding: 1.5rem 1.25rem 2rem; }
      .otp-digit   { width: 44px; height: 52px; font-size: 1.25rem; }
      .modal-title { font-size: 1.2rem; }
    }

  </style>
</head>
<body>

  <!-- Skip to main content for accessibility -->
  <a href="#main-content" class="sr-only">Skip to main content</a>

  <!-- ===== NAVBAR ===== -->
  <nav class="navbar">
    <div class="logo">
      <div class="logo-mark"></div>
      <span class="logo-text font-serif">ClassInstruct</span>
    </div>
    <div class="nav-links">
      <a href="#" class="font-sans">Platform</a>
      <a href="#features" class="font-sans">Features</a>
      <a href="#how-it-works" class="font-sans">Method</a>
      <a href="#about" class="font-sans">About</a>
      <a href="#contact" class="font-sans">Contact</a>
    </div>
    <button class="btn-primary font-sans" id="openSignIn">Sign In</button>
  </nav>

  <!-- ===== SIGN-IN MODAL ===== -->
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

        <!-- STEP 1 : Email -->
        <div class="step active" id="stepEmail">
          <h2 class="modal-title" id="modal-title">Welcome back</h2>
          <p class="modal-subtitle">Enter your Gmail address to continue. We'll send a one-time code to verify it's you.</p>

          <div class="form-group">
            <label for="emailInput">Gmail address</label>
            <div class="input-wrap">
              <input
                class="form-input"
                type="email"
                id="emailInput"
                placeholder="✉ you@gmail.com"
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

        <!-- STEP 2 : OTP -->
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
        </div>

      </div><!-- /.modal-inner -->
    </div><!-- /.modal-box -->
  </div><!-- /.modal-overlay -->

  <!-- ===== MAIN CONTENT ===== -->
  <main id="main-content">

    <!-- ===== HERO ===== -->
    <section class="hero">
      <div class="hero-bg"></div>
      <div class="section-tag" style="position:relative; z-index:10;">
        <div class="line"></div>
        <div class="line"></div>
        <span>AI-Powered Teaching Assistant</span>
      </div>
      <div class="hero-content">
        <h1 class="font-serif">
          Teach Smarter,<br>
          <em>Not Harder.</em>
        </h1>
        <p class="hero-description font-sans">
          ClassInstruct transforms your instructional materials into structured lesson plans, interactive assessments, and mastery-level insights — completely free, so you can focus on what matters most.
        </p>
        <div class="hero-cta">
          <a href="#" class="btn-primary font-sans">Get Started — Free</a>
          <a href="#" class="btn-secondary font-sans">Watch Demo</a>
        </div>
      </div>
    </section>

    <!-- ===== FEATURES ===== -->
    <section id="features" class="features">
      <div class="features-header">
        <div class="features-title">
          <div class="section-tag">
            <div class="line"></div>
            <div class="line"></div>
            <span>Core Capabilities</span>
          </div>
          <h2 class="font-serif">What ClassInstruct<br><em>Does For You</em></h2>
        </div>
        <p class="features-desc font-sans">
          A digital assistant that complements your teaching — organizing content, generating assessments, and surfacing insights without replacing your expertise.
        </p>
      </div>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </div>
          <h3 class="font-serif">Lesson Structuring</h3>
          <p class="font-sans">Upload your materials and ClassInstruct converts them into organized, sequenced lesson plans aligned with your curriculum goals and teaching style.</p>
        </div>
        <div class="feature-card featured">
          <div class="feature-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <polyline points="9 11 12 14 22 4"></polyline>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          </div>
          <h3 class="font-serif">Smart Assessments</h3>
          <p class="font-sans">Generate quizzes, rubrics, and interactive assessments that adapt to different learning levels — from recall to critical analysis.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          </div>
          <h3 class="font-serif">Mastery Insights</h3>
          <p class="font-sans">Track student progress with mastery-level analytics that reveal knowledge gaps, learning patterns, and areas needing reinforcement.</p>
        </div>
      </div>
    </section>

    <!-- ===== HOW IT WORKS ===== -->
    <section id="how-it-works" class="how-it-works">
      <div class="section-tag">
        <div class="line"></div>
        <div class="line"></div>
        <span>The Method</span>
      </div>
      <h2 class="section-title font-serif">How It Works</h2>
      <div class="steps-grid">
        <div class="step-card">
          <div class="step-number font-serif">01</div>
          <h3 class="font-serif">Upload Materials</h3>
          <p class="font-sans">Import your existing syllabi, textbooks, notes, or any instructional content. ClassInstruct accepts PDFs, documents, slides, and web links.</p>
          <div class="step-icon-area">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
        </div>
        <div class="step-card">
          <div class="step-number font-serif">02</div>
          <h3 class="font-serif">AI Processes</h3>
          <p class="font-sans">Our engine analyzes your content, identifies key concepts, maps learning objectives, and structures everything into a coherent teaching framework.</p>
          <div class="step-icon-area">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
              <rect x="9" y="9" width="6" height="6"></rect>
              <line x1="9" y1="1" x2="9" y2="4"></line>
              <line x1="15" y1="1" x2="15" y2="4"></line>
              <line x1="9" y1="20" x2="9" y2="23"></line>
              <line x1="15" y1="20" x2="15" y2="23"></line>
              <line x1="20" y1="9" x2="23" y2="9"></line>
              <line x1="20" y1="14" x2="23" y2="14"></line>
              <line x1="1" y1="9" x2="4" y2="9"></line>
              <line x1="1" y1="14" x2="4" y2="14"></line>
            </svg>
          </div>
        </div>
        <div class="step-card">
          <div class="step-number font-serif">03</div>
          <h3 class="font-serif">Teach &amp; Iterate</h3>
          <p class="font-sans">Receive structured lesson plans, assessments, and insights. Customize outputs, track student mastery, and refine your approach over time.</p>
          <div class="step-icon-area">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== TESTIMONIALS ===== -->
    <section class="testimonials">
      <div class="section-tag">
        <div class="line"></div>
        <div class="line"></div>
        <span>Testimonials</span>
      </div>
      <h2 class="section-title font-serif">What Educators Say</h2>
      <div class="testimonials-grid">
        <div class="testimonial-card">
          <div class="stars red">
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </div>
          <blockquote class="font-serif">"ClassInstruct cut my lesson prep time in half. The AI understands curriculum structure better than any tool I've used — and the assessments it generates are genuinely thoughtful."</blockquote>
          <div class="author-info">
            <div class="author-name font-sans">Dr. Sarah Chen</div>
            <div class="author-role font-sans">AP Biology, Lincoln High School</div>
          </div>
        </div>

        <div class="testimonial-card featured">
          <div class="stars gold">
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </div>
          <blockquote class="font-serif">"I was skeptical about AI in education, but ClassInstruct doesn't try to replace me. It organizes my chaos into something my students can actually follow. The mastery insights are a game-changer."</blockquote>
          <div class="author-info">
            <div class="author-name font-sans">Prof. Elena Vasquez</div>
            <div class="author-role font-sans">Comparative Literature, State University</div>
          </div>
        </div>

        <div class="testimonial-card">
          <div class="stars gold">
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </div>
          <blockquote class="font-serif">"As a department head, I needed something that could scale across 12 instructors. ClassInstruct made onboarding seamless — everyone's materials are now structured, searchable, and aligned."</blockquote>
          <div class="author-info">
            <div class="author-name font-sans">Dr. James Okafor</div>
            <div class="author-role font-sans">Dept. Chair, History, Westfield College</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== ABOUT ===== -->
    <section id="about" class="about">
      <div class="section-tag">
        <div class="line"></div>
        <div class="line"></div>
        <span>About Us</span>
      </div>
      <div class="about-title">
        <h2 class="font-serif">Built To Support Teachers,</h2>
        <span class="accent font-serif">Not Replace Them.</span>
      </div>
      <div class="about-columns">
        <p class="font-sans">At ClassInstruct, we believe that instruction should be clear, efficient, and motivating. Our AI-powered platform empowers educators by streamlining lesson planning, automating quiz creation, and providing comprehensive analytics.</p>
        <p class="font-sans">We understand the challenges educators face in balancing time, creativity, and clarity. ClassInstruct combines cutting-edge technology with practical tools to make teaching more efficient and less stressful.</p>
      </div>
      <div class="values-grid">
        <div class="value-card">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <h3 class="font-serif">Teacher-First</h3>
          <p class="font-sans">Every feature adapts to your curriculum, methods, and voice.</p>
        </div>
        <div class="value-card featured">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <h3 class="font-serif">Free Forever</h3>
          <p class="font-sans">No hidden costs, no premium tiers. Free for all educators.</p>
        </div>
        <div class="value-card">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <h3 class="font-serif">Community Driven</h3>
          <p class="font-sans">Our roadmap is shaped by the teachers who use ClassInstruct.</p>
        </div>
      </div>
    </section>

    <!-- ===== CTA SECTION ===== -->
    <section class="cta-section">
      <div class="section-tag">
        <div class="line"></div>
        <div class="line"></div>
        <span>Get Started</span>
      </div>
      <h2 class="font-serif">
        Ready To Transform<br>
        <em>Your Teaching?</em>
      </h2>
      <p class="cta-desc font-sans">ClassInstruct is completely free for all educators. Start organizing your instructional materials, generating assessments, and gaining mastery-level insights today.</p>
      <div class="cta-buttons">
        <a href="#" class="btn-primary font-sans">
          Get Started — Free
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </a>
        <a href="#" class="btn-secondary-dark font-sans">Watch Demo</a>
      </div>
    </section>

    <!-- ===== CONTACT ===== -->
    <section id="contact" class="contact-section">
      <div class="contact-left">
        <h2 class="font-serif">Get In Touch</h2>
        <p class="contact-desc font-sans">Ready to transform your teaching experience? Contact us to learn more about ClassInstruct.</p>
        <div class="contact-row">
          <div class="contact-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </div>
          <div>
            <div class="contact-label font-sans">Email Us</div>
            <div class="contact-value font-sans"><a href="mailto:support@classinstruct.com">support@classinstruct.com</a></div>
          </div>
        </div>
        <div class="contact-row">
          <div class="contact-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.21 12.8a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </div>
          <div>
            <div class="contact-label font-sans">Call Us</div>
            <div class="contact-value font-sans">+1 (555) 123-4567</div>
          </div>
        </div>
      </div>
      <div class="contact-form">
        <div class="form-field">
          <label class="font-mono">Full Name</label>
          <input type="text" name="name" placeholder="">
        </div>
        <div class="form-field">
          <label class="font-mono">Email Address</label>
          <input type="email" name="email" placeholder="">
        </div>
        <div class="form-field">
          <label class="font-mono">Subject</label>
          <select name="subject">
            <option value="" disabled selected>Select a subject</option>
            <option value="demo">Request Demo</option>
            <option value="support">Technical Support</option>
            <option value="billing">Billing Question</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="form-field">
          <label class="font-mono">Message</label>
          <textarea name="message"></textarea>
        </div>
        <button type="button" class="submit-btn font-sans">Send Message</button>
      </div>
    </section>

  </main>

  <!-- ===== FOOTER ===== -->
  <footer class="footer">
    <div class="footer-content">
      <div class="footer-brand">
        <div class="footer-logo">
          <div class="logo-mark"></div>
          <span class="logo-text font-serif">ClassInstruct</span>
        </div>
        <p class="footer-tagline font-sans">AI-powered learning assistant that transforms instructional materials into structured, adaptive teaching tools.</p>
      </div>
      <div class="footer-links-col">
        <h4 class="font-mono">Platform</h4>
        <a href="#" class="font-sans">Lesson Plans</a>
        <a href="#" class="font-sans">Assessments</a>
        <a href="#" class="font-sans">Mastery Insights</a>
        <a href="#" class="font-sans">Integrations</a>
      </div>
      <div class="footer-links-col">
        <h4 class="font-mono">Company</h4>
        <a href="#about" class="font-sans">About</a>
        <a href="#" class="font-sans">Blog</a>
        <a href="#" class="font-sans">Careers</a>
        <a href="#contact" class="font-sans">Contact</a>
      </div>
      <div class="footer-links-col">
        <h4 class="font-mono">Legal</h4>
        <a href="#" class="font-sans">Privacy Policy</a>
        <a href="#" class="font-sans">Terms of Service</a>
        <a href="#" class="font-sans">Security</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="font-sans">© 2025 ClassInstruct. All rights reserved.</span>
    </div>
  </footer>

  <script src="script.js"></script>
  <script src="signin_modal_wired.js"></script>

</body>
</html>
