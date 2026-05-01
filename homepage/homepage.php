<?php session_start(); ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClassInstruct — AI-Powered Teaching Assistant</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
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
      background: #f5f4ff;
      color: #1a1a2e;
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

    :focus-visible { outline: 2px solid #6c63ff; outline-offset: 2px; }
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
      /* ── Brand ── */
      --primary:       #6c63ff;
      --primary-dark:  #5548e8;
      --primary-light: rgba(108,99,255,0.10);
      --primary-glow:  rgba(108,99,255,0.25);
      --accent:        #a78bfa;   /* soft violet accent */

      /* ── Surface / layout ── */
      --off-white:  #f5f4ff;
      --dark:       #1a1a2e;
      --mid:        #6b7280;
      --border:     #e5e4f8;
      --surface:    #f0effe;

      /* ── Semantic ── */
      --success:    #10b981;
      --error:      #ef4444;
      --white:      #ffffff;

      /* ── Gray scale ── */
      --gray-50:    #f9fafb;
      --gray-100:   #f3f4f6;
      --gray-200:   #e5e7eb;
      --gray-300:   #d1d5db;
      --gray-400:   #9ca3af;
      --gray-500:   #6b7280;
      --gray-700:   #374151;
      --gray-800:   #1f2937;
      --gray-900:   #111827;

      /* ── Shadows ── */
      --shadow-sm:  0 1px 3px rgba(108,99,255,0.08);
      --shadow-md:  0 4px 6px -1px rgba(108,99,255,0.12), 0 2px 4px -2px rgba(0,0,0,0.08);
      --shadow-lg:  0 10px 15px -3px rgba(108,99,255,0.15), 0 4px 6px -4px rgba(0,0,0,0.08);
      --shadow-xl:  0 20px 25px -5px rgba(108,99,255,0.18), 0 8px 10px -6px rgba(0,0,0,0.10);

      /* ── Radii & timing ── */
      --radius-base: 0.5rem;
      --radius-md:   0.75rem;
      --radius-xl:   1.5rem;
      --radius-full: 9999px;
      --transition:  250ms ease;
    }

    /* =============================================
       ANIMATION KEYFRAMES
    ============================================= */
    @keyframes starPulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.2) rotate(10deg); }
      100% { transform: scale(1); }
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideInLeft {
      from {
        opacity: 0;
        transform: translateX(-50px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(50px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes glow {
      0%, 100% { box-shadow: 0 0 5px rgba(108,99,255,0.3); }
      50%       { box-shadow: 0 0 22px rgba(108,99,255,0.65); }
    }

    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
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

    .section-tag .line { width: 40px; height: 1px; background: var(--primary); }

    .section-tag span {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 1.8px;
      text-transform: uppercase;
      color: var(--primary);
    }

    /* =============================================
       BUTTONS
    ============================================= */
    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.42px;
      padding: 10px 24px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s, transform 0.2s ease, box-shadow 0.2s ease;
      width: fit-content;
      white-space: nowrap;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(108,99,255,0.3);
    }

    .btn-primary:hover { 
      background: linear-gradient(135deg, var(--primary-dark), #4438d0);
      transform: translateY(-3px);
      box-shadow: 0 8px 22px rgba(108,99,255,0.45);
    }

    .btn-primary:active {
      transform: translateY(-1px);
    }

    .btn-primary svg { width: 16px; height: 16px; stroke: #fff; fill: none; stroke-width: 2; }

    .btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      background: transparent;
      color: var(--primary);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.42px;
      padding: 14px 32px;
      border-radius: 6px;
      border: 1.5px solid var(--primary);
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s, transform 0.2s ease, box-shadow 0.2s ease;
    }

    .btn-secondary:hover { 
      background: var(--primary-light);
      transform: translateY(-3px);
      box-shadow: 0 4px 14px rgba(108,99,255,0.15);
    }

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
      border: 1px solid rgba(255,255,255,0.3);
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s, transform 0.2s ease, box-shadow 0.2s ease;
    }

    .btn-secondary-dark:hover {
      background: rgba(255,255,255,0.1);
      transform: translateY(-3px);
      border-color: rgba(255,255,255,0.5);
    }

    /* =============================================
       NAVBAR
    ============================================= */
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 32px;
      background-color: rgba(255, 255, 255, 0.7); /* semi-transparent white */
      backdrop-filter: blur(10px); /* glassy blur effect */
      border-radius: 50px;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
      width: 95%;
      margin: 20px auto;
      position: fixed; /* key part */
      top: 2px;        /* sticks when scrolling */
      z-index: 1000;

    }
    .nav-menu {
    display: flex;
    gap: 20px; /* space between links */
    align-items: center;
    }

    .nav-menu .nav-link {
    text-decoration: none;
    color: #333;
    font-family: sans-serif;
    padding: 8px 12px;
    transition: color 0.3s ease;
    }

    .nav-menu .nav-link:hover {
    color: #6c63ff;
    }

    .navbar > .btn-primary { width: auto; flex-shrink: 0; }

    .logo { display: flex; align-items: center; }

    .logo-link {
      display: flex;
      align-items: center;
      text-decoration: none; }

    .logo-mark { width: 40px;
      height: 40px;
      background: linear-gradient(100deg, #6c63ff, #a78bfa);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      margin-right: 8px;}

    .logo-mark i {
      color: #ffffff;
      font-size: 20px; }

    .logo-text { 
      font-size: 20px;
      font-weight: 600;
      color: var(--dark); }

    .nav-links { display: flex; align-items: center; gap: 32px; }

    .nav-links a {
      color: var(--mid);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.7px;
      text-decoration: none;
      transition: color 0.2s;
      
    }

    .nav-links a:hover { color: #6c63ff; }

    /* =============================================
       HERO
    ============================================= */
    .hero {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 128px 64px 144px;
      
    }

    .hero-bg {
      position: absolute;
      inset: 0;
      background: url('https://cdn.wonder.so/images/019d44da-e731-707b-938e-e22b33072424/60e721895e12f8c274dc4bfb1ba1f8d289a8a66860aa9625aa60deffa4cf0c4b.jpg') center/cover no-repeat;
      opacity: 0.35;
      z-index: -1;
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

    .hero h1 em { color: var(--primary); font-style: italic; }

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
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      cursor: pointer;
      position: relative;
      overflow: hidden;
      will-change: transform, box-shadow;
    }

    .feature-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(108, 99, 255, 0.08), transparent);
      transition: left 0.5s ease;
      pointer-events: none;
    }

    .feature-card:hover,
    .step-card:hover,
    .value-card:hover {
      transform: translateY(-6px);
      box-shadow: 0 16px 32px rgba(108,99,255,0.18);
      border-color: rgba(108,99,255,0.35);
    }

    .testimonial-card:hover {
      transform: translateY(-6px);
      box-shadow: 0 16px 32px rgba(108,99,255,0.18);
      border-color: rgba(108,99,255,0.35);
    }

    

    .feature-icon {
      width: 48px; 
      height: 48px;
      display: flex;
      justify-content: center;
      align-items: center;
      background: var(--off-white);
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 32px;
    }

    .feature-icon svg {
      width: 20px; 
      height: 20px;
      stroke: var(--primary);
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
      transition: color 0.3s ease;
    }

    .feature-card p { 
      color: var(--mid); 
      font-size: 14px; 
      line-height: 1.75; 
    }

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
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      cursor: pointer;
      position: relative;
      overflow: hidden;
      will-change: transform, box-shadow;
    }

    .step-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(108, 99, 255, 0.08), transparent);
      transition: left 0.5s ease;
      pointer-events: none;
    }

    .feature-card:hover::before,
    .step-card:hover::before { left: 100%; }

    .step-number {
      font-family: 'Playfair Display', serif;
      font-size: 24px;
      color: var(--primary);
      margin-bottom: 32px;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .step-card h3 {
      font-family: 'Playfair Display', serif;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--dark);
      transition: color 0.3s ease;
    }

    .step-card p { 
      color: var(--mid); 
      font-size: 14px; 
      line-height: 1.75;
    }

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
      stroke: var(--primary);
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
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      cursor: pointer;
      position: relative;
      overflow: hidden;
      will-change: transform, box-shadow;
    }

    .testimonial-card::after {
      content: '';
      position: absolute;
      top: -50%;
      right: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(108, 99, 255, 0.08) 0%, transparent 70%);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }

    .testimonial-card:hover::after {
      opacity: 1;
    }

    .stars { 
      display: flex; 
      gap: 4px; 
      margin-bottom: 24px;
      justify-content: center;
    }
    .stars svg { width: 16px; height: 16px; }
    .stars svg { stroke: var(--primary); fill: var(--primary); }

    .testimonial-card blockquote {
      font-family: 'Playfair Display', serif;
      font-size: 16px;
      font-style: italic;
      line-height: 1.75;
      color: var(--dark);
      margin-bottom: 40px;
      flex: 1;
      transition: all 0.3s ease;
    }

    .author-name { 
      font-size: 14px; 
      font-weight: 600; 
      color: var(--dark); 
      margin-bottom: 4px;
      transition: all 0.3s ease;
    }
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

    .about-title h2 em { color: var(--primary); font-style: italic; }

    .about-title .accent {
      display: block;
      color: var(--primary);
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

    .value-card svg {
      width: 20px; height: 20px;
      stroke: var(--primary);
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

    .cta-section .section-tag .line { background: rgba(255,255,255,0.2); }

    .cta-section h2 {
      font-family: 'Playfair Display', serif;
      font-size: 56px;
      line-height: 1.15;
      letter-spacing: -1.12px;
      text-align: center;
      color: var(--off-white);
    }

    .cta-section h2 em { color: var(--primary); font-style: italic; display: block; margin-bottom: 32px; }

    .cta-section .cta-desc {
      max-width: 520px;
      margin-bottom: 48px;
      color: rgba(255,255,255,0.5);
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
      stroke: var(--primary);
      fill: none;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .contact-label { font-size: 14px; font-weight: 600; color: var(--dark); margin-bottom: 4px; }
    .contact-value { font-size: 14px; color: var(--primary); }

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
    .form-field textarea:focus { border-bottom-color: #6c63ff; }

    .form-field textarea { height: 128px; resize: none; }
    .form-field select { color: rgba(107, 107, 107, 0.5); appearance: none; }
    .form-field:last-of-type { margin-bottom: 32px; }

    .submit-btn {
      display: flex;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      color: #fff;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.42px;
      padding: 14px 0;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 14px rgba(108,99,255,0.3);
    }

    .submit-btn:hover {
      background: linear-gradient(135deg, var(--primary-dark), #4438d0);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(108,99,255,0.4);
    }

    /* =============================================
       FOOTER
    ============================================= */
    .footer { background: var(--dark); border-top: 1px solid rgba(255,255,255,0.1); }

    .footer-content { display: flex; padding: 64px; gap: 80px; }

    .footer-brand { display: flex; flex-direction: column; }

    .footer-logo { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; }

    .footer-logo .logo-mark { width: 20px; height: 20px; background: var(--primary); border-radius: 4px; }

    .footer-logo .logo-text { font-family: 'Playfair Display', serif; font-size: 18px; color: var(--off-white); }

    .footer-tagline { max-width: 300px; color: rgba(255,255,255,0.4); font-size: 14px; line-height: 1.75; }

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

    .footer-links-col a { color: #8b8fa8; font-size: 14px; text-decoration: none; margin-bottom: 12px; transition: color 0.2s; }
    .footer-links-col a:last-child { margin-bottom: 0; }
    .footer-links-col a:hover { color: var(--accent); }

    .footer-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 64px;
      border-top: 1px solid rgba(255,255,255,0.1);
    }

    .footer-bottom span { color: rgba(255,255,255,0.3); font-size: 12px; }

    /* =============================================
       INTERACTIVE ELEMENTS - PERFORMANCE
    ============================================= */
    button, .btn-primary, .btn-secondary, .btn-secondary-dark,
    .feature-card, .testimonial-card, .value-card, .step-card {
      will-change: transform;
    }

    a {
      transition: color 0.2s ease;
    }

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
       RESPONSIVE ANIMATIONS
    ============================================= */
    @media (max-width: 768px) {
      .step-card {
        transition: all 0.2s ease;
      }

      .feature-card:hover,
      .testimonial-card:hover,
      .value-card:hover,
      .step-card:hover {
        transform: translateY(-8px);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
      }

      .feature-icon,
      .step-number {
        transition: all 0.2s ease;
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

  <!-- ===== MAIN CONTENT ===== -->
  <main id="main-content">

    <!-- ===== HERO ===== -->
    <section class="hero">
      <div class="hero-bg"></div>

      <!-- ===== NAVBAR ===== -->
  <nav class="navbar">
    <div class="logo">
      <a href="#main-content" class="logo-link">
      <div class="logo-mark">
        <i class="fa-solid fa-graduation-cap"></i>
      </div>
      <span class="logo-text font-serif">ClassInstruct</span>
      </a>
    </div>
    <div class="nav-menu">
      <a href="#features" class="nav-link font-sans">Features</a>
      <a href="#how-it-works" class="nav-link font-sans">Method</a>
      <a href="#about" class="nav-link font-sans">About</a>
      <a href="#contact" class="nav-link font-sans">Contact</a>
    </div>
    
    <a href="login.php" class="btn-primary font-sans">Sign In</a>
  </nav>

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
          <a href="login.php" class="btn-primary font-sans">Get Started — Free</a>
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
        <div class="feature-card">
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
          <div class="stars">
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

        <div class="testimonial-card">
          <div class="stars">
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
          <div class="stars">
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
        <div class="value-card">
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
        <a href="login.php" class="btn-primary font-sans">
          Get Started — Free
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
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
      <span class="font-sans">© 2026 ClassInstruct. All rights reserved.</span>
    </div>
  </footer>

  <script src="scripts.js"></script>

</body>
</html>