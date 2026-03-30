<?php session_start(); ?>
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
          <div class="otp-email-display" id="otpEmailDisplay">✉ <a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="7900160c391e14181015571a1614">[email&#160;protected]</a></div>

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
                                    <a href="/cdn-cgi/l/email-protection#365e535a5a5976555a5745455f584542444355421855595b"><span class="__cf_email__" data-cfemail="335b565f5f5c73505f5240405a5d4047414650471d505c5e">[email&#160;protected]</span></a>
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

    <script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script>
    <script src="script.js"></script>
    <script src="signin_modal_wired.js"></script>


</body>
</html>