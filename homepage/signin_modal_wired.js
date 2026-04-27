// Derive base path dynamically from current URL — works on any hostname
const BASE = window.location.pathname.replace(/\/[^\/]+$/, '');

(function () {
  /* ── Elements ── */
  const modal        = document.getElementById('signInModal');
  const openBtns     = document.querySelectorAll('.open-signin');
  const closeBtn     = document.getElementById('closeModal');
  const backdrop     = document.getElementById('modalBackdrop');

  const stepEmail    = document.getElementById('stepEmail');
  const stepOtp      = document.getElementById('stepOtp');
  const stepSuccess  = document.getElementById('stepSuccess');

  const emailInput   = document.getElementById('emailInput');
  const emailError   = document.getElementById('emailError');
  const btnSendOtp   = document.getElementById('btnSendOtp');
  const btnRegister  = document.getElementById('btnRegister');
  const passwordInput = document.getElementById('passwordInput');
  const passwordError = document.getElementById('passwordError');

  const otpDigits    = document.querySelectorAll('.otp-digit');
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

  /* ── Modal open/close ── */
  function openModal() {
    modal.classList.add('active');
    emailInput.focus();
    const params = new URLSearchParams(window.location.search);
    if (params.has('auth_error')) {
      showFieldError(emailError, emailInput, params.get('auth_error'));
      history.replaceState(null, '', window.location.pathname);
    }
  }

  function closeModal() {
    modal.classList.remove('active');
    setTimeout(resetAll, 350);
  }

  function resetAll() {
    showStep(stepEmail);
    emailInput.value = '';
    emailInput.disabled = false;
    if (passwordInput) { passwordInput.value = ''; passwordInput.disabled = false; }
    hideFieldError(emailError, emailInput);
    hideFieldError(passwordError, passwordInput);
    clearOtpDigits();
    otpError.textContent = '';
    clearInterval(timerInterval);

    // Clean up lockout UI — restore all hidden elements
    const tempBanner = document.getElementById('ciTempLockBanner');
    if (tempBanner) tempBanner.style.display = 'none';
    const lockedPanel = document.getElementById('ciLockedPanel');
    if (lockedPanel) lockedPanel.style.display = 'none';
    [
      btnSendOtp,
      stepEmail.querySelector('.divider'),
      document.getElementById('btnRegister'),
      stepEmail.querySelector('.modal-footer-note'),
    ].forEach(el => { if (el) el.style.display = ''; });
    // Restore forgot link, hide unlock link
    const forgotLink = document.getElementById('linkForgotPassword');
    const unlockLink = document.getElementById('linkUnlockAccount');
    if (forgotLink) forgotLink.style.display = '';
    if (unlockLink) unlockLink.style.display = 'none';
    btnSendOtp.disabled = false;
  }

  openBtns.forEach(btn => btn.addEventListener('click', openModal));
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });

  window.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(window.location.search).has('auth_error')) openModal();
  });

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

  /* ── Password show/hide toggle ── */
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }

  emailInput.addEventListener('input', () => hideFieldError(emailError, emailInput));
  if (passwordInput) {
    passwordInput.addEventListener('input', () => hideFieldError(passwordError, passwordInput));
  }

  /* ── Send OTP ── */
  btnSendOtp.addEventListener('click', () => sendOtp());
  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendOtp(); });
  if (passwordInput) {
    passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendOtp(); });
  }

  async function sendOtp() {
    const email    = emailInput.value.trim();
    const password = passwordInput ? passwordInput.value : '';

    hideFieldError(emailError, emailInput);
    hideFieldError(passwordError, passwordInput);

    if (!isValidEmail(email)) {
      showFieldError(emailError, emailInput, 'Please enter a valid email address.');
      emailInput.focus();
      return;
    }
    if (!password) {
      showFieldError(passwordError, passwordInput, 'Please enter your password.');
      if (passwordInput) passwordInput.focus();
      return;
    }

    setLoading(btnSendOtp, true);

    try {
      const res = await fetch(`${BASE}/send_otp.php`, {
        method     : 'POST',
        headers    : { 'Content-Type': 'application/json' },
        body       : JSON.stringify({ email, password }),
        credentials: 'include',
      });

      let data;
      try { data = await res.json(); }
      catch { showFieldError(emailError, emailInput, 'Server error. Please try again.'); return; }

      if (!data.success) {
        const msg = data.error || 'Failed to send code. Please try again.';

        // ── Permanent lock ────────────────────────────────────────────────────
        if (data.perm_locked) {
          showLockedState(msg);
          return;
        }

        // ── Soft lockout (30-min cooldown) ────────────────────────────────────
        if (data.temp_locked) {
          const wait = data.wait_seconds || 1800;
          showTempLocked(msg, wait);
          return;
        }

        // ── Wrong password (with remaining count) ─────────────────────────────
        const isPasswordError = msg.toLowerCase().includes('password') ||
                                msg.toLowerCase().includes('incorrect') ||
                                msg.toLowerCase().includes('attempt');
        if (isPasswordError && passwordError && passwordInput) {
          showFieldError(passwordError, passwordInput, msg);
          passwordInput.focus();
        } else {
          showFieldError(emailError, emailInput, msg);
          emailInput.focus();
        }
        return;
      }

      // ── Success: proceed to OTP step ─────────────────────────────────────────
      currentEmail = email;
      otpEmailDisp.textContent = `✉ ${email}`;
      showStep(stepOtp);
      clearOtpDigits();
      otpError.textContent = '';
      startTimer();
      otpDigits[0].focus();

    } catch (err) {
      console.error('[sendOtp]', err);
      showFieldError(emailError, emailInput, 'Network error — could not reach the server.');
    } finally {
      setLoading(btnSendOtp, false);
    }
  }
  /* ── Register button ── */
  btnRegister.addEventListener('click', () => {
    closeModal();
    setTimeout(() => {
      document.getElementById('registerModal').classList.add('active');
      document.getElementById('regFirstName').focus();
    }, 200);
  });

  /* ── OTP digit input handling ── */
  otpDigits.forEach((input, i) => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace') {
        if (!input.value && i > 0) {
          otpDigits[i-1].value = '';
          otpDigits[i-1].classList.remove('filled');
          otpDigits[i-1].focus();
        } else {
          input.value = '';
          input.classList.remove('filled');
        }
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowLeft'  && i > 0) { otpDigits[i-1].focus(); return; }
      if (e.key === 'ArrowRight' && i < 5) { otpDigits[i+1].focus(); return; }
    });

    input.addEventListener('input', e => {
      const val = input.value.replace(/\D/g, '');
      if (!val) { input.value = ''; input.classList.remove('filled'); return; }

      if (val.length > 1) {
        const digits = val.slice(0, 6).split('');
        digits.forEach((d, j) => {
          if (otpDigits[i + j]) {
            otpDigits[i+j].value = d;
            otpDigits[i+j].classList.add('filled');
          }
        });
        otpDigits[Math.min(i + digits.length, 5)].focus();
        return;
      }

      input.value = val[0];
      input.classList.add('filled');
      if (i < 5) otpDigits[i+1].focus();

      if (getOtpValue().length === 6) verifyOtp();
    });

    input.addEventListener('focus', () => input.select());
  });

  function getOtpValue() {
    return Array.from(otpDigits).map(d => d.value).join('');
  }

  function clearOtpDigits() {
    otpDigits.forEach(d => { d.value = ''; d.classList.remove('filled', 'error-shake'); });
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

    try {
      const res = await fetch(`${BASE}/verify_otp.php`, {
        method     : 'POST',
        headers    : { 'Content-Type': 'application/json' },
        body       : JSON.stringify({ otp: entered }),
        credentials: 'include',
      });
      const data = await res.json();

      if (data.success) {
        clearInterval(timerInterval);
        if (data.token) sessionStorage.setItem('ci_token', data.token);
        // Save user info for dashboard greeting + profile/settings pages
        sessionStorage.setItem('ci_first_name', data.first_name || '');
        sessionStorage.setItem('ci_last_name',  data.last_name  || '');
        sessionStorage.setItem('ci_gender',     data.gender     || '');
        sessionStorage.setItem('ci_email',      data.email      || '');
        sessionStorage.setItem('ci_picture',    data.picture    || '');
        // Persist Google picture to localStorage so profile always has it
        if (data.picture) localStorage.setItem('ci_google_photo', data.picture);
        showStep(stepSuccess);
        setTimeout(() => { window.location.href = '/dashboard/sidebar.html'; }, 1500);
      } else {
        otpError.textContent = data.error || 'Incorrect code. Please try again.';
        otpDigits.forEach(d => d.classList.add('error-shake'));
        setTimeout(() => otpDigits.forEach(d => d.classList.remove('error-shake')), 500);
        clearOtpDigits();
        otpDigits[0].focus();
      }

    } catch (err) {
      otpError.textContent = 'Network error. Please try again.';
    } finally {
      setLoading(btnVerify, false);
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
    clearOtpDigits();

    try {
      const res = await fetch(`${BASE}/send_otp.php`, {
        method     : 'POST',
        headers    : { 'Content-Type': 'application/json' },
        body       : JSON.stringify({ email: currentEmail }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) {
        otpError.textContent = data.error || 'Could not resend. Please go back and try again.';
        return;
      }
      startTimer();
      otpDigits[0].focus();
    } catch {
      otpError.textContent = 'Network error. Please try again.';
      btnResend.disabled = false;
    }
  }

  btnResend.addEventListener('click', resendOtp);
  document.getElementById('linkResend2').addEventListener('click', resendOtp);

  /* ── Back ── */
  btnBack.addEventListener('click', () => {
    clearInterval(timerInterval);
    showStep(stepEmail);
  });

  /* ── Go to Dashboard ── */
  btnDash.addEventListener('click', () => {
    window.location.href = '/dashboard/sidebar.html';
  });

  /* ── Sign Up link → open register modal ── */
  document.getElementById('linkSignUp').addEventListener('click', () => {
    closeModal();
    setTimeout(() => {
      const regModal = document.getElementById('registerModal');
      if (regModal) {
        regModal.classList.add('active');
        const firstInput = regModal.querySelector('input');
        if (firstInput) firstInput.focus();
      }
    }, 200);
  });

  /* ── Lockout helpers ── */

  // Temp lock: hide button + divider + register + footer, show countdown banner only
  function showTempLocked(msg, waitSeconds) {
    hideFieldError(emailError, emailInput);
    hideFieldError(passwordError, passwordInput);

    if (passwordInput) passwordInput.disabled = true;
    emailInput.disabled = true;

    // Hide send button and everything below it
    const toHide = [
      document.getElementById('btnSendOtp'),
      stepEmail.querySelector('.divider'),
      document.getElementById('btnRegister'),
      stepEmail.querySelector('.modal-footer-note'),
    ];
    toHide.forEach(el => { if (el) el.style.display = 'none'; });

    // Show or reuse banner (inserted before the button, so it sits in correct flow)
    let banner = document.getElementById('ciTempLockBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'ciTempLockBanner';
      banner.style.cssText = [
        'background:#fff7ed','border:1px solid #fed7aa','border-radius:10px',
        'padding:16px','font-size:14px','color:#92400e',
        'line-height:1.6','text-align:center'
      ].join(';');
      btnSendOtp.insertAdjacentElement('beforebegin', banner);
    }
    banner.style.display = 'block';

    let remaining = waitSeconds;
    function tick() {
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      banner.innerHTML =
        `\u23F3 <strong>Too many failed attempts.</strong><br>` +
        `Try again in <strong>${m}:${String(s).padStart(2,'0')}</strong>`;
      if (remaining <= 0) {
        clearInterval(lockTimer);
        banner.style.display = 'none';
        toHide.forEach(el => { if (el) el.style.display = ''; });
        btnSendOtp.disabled = false;
        if (passwordInput) passwordInput.disabled = false;
        emailInput.disabled = false;
        if (passwordInput) passwordInput.focus();
      }
      remaining--;
    }
    tick();
    const lockTimer = setInterval(tick, 1000);
  }

  // Permanent lock: swap the form body for a modern "account locked" panel
  function showLockedState(msg) {
    hideFieldError(emailError, emailInput);
    hideFieldError(passwordError, passwordInput);

    // In the top link row: hide "Forgot password?", show "Unlock account"
    const forgotLink = document.getElementById('linkForgotPassword');
    const unlockLink = document.getElementById('linkUnlockAccount');
    if (forgotLink) forgotLink.style.display = 'none';
    if (unlockLink) unlockLink.style.display = '';

    // Hide normal form elements
    stepEmail.querySelectorAll('.form-group, #btnSendOtp, .divider, #btnRegister, .modal-footer-note')
      .forEach(el => el.style.display = 'none');

    // Show or reuse locked panel
    let panel = document.getElementById('ciLockedPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'ciLockedPanel';
      panel.innerHTML = `
        <div style="text-align:center;padding:4px 0 8px;">

          <!-- Icon badge -->
          <div style="
            width:72px;height:72px;border-radius:50%;
            background:linear-gradient(135deg,#fef3c7,#fde68a);
            display:flex;align-items:center;justify-content:center;
            margin:0 auto 20px;
            box-shadow:0 0 0 8px rgba(184,134,11,0.08);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                 stroke="#b8860b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>

          <!-- Heading -->
          <h3 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 8px;letter-spacing:-0.3px;">
            Account Locked
          </h3>

          <!-- Body text -->
          <p style="font-size:13px;color:#6b7280;margin:0 0 24px;line-height:1.65;max-width:280px;margin-left:auto;margin-right:auto;">
            Too many failed sign-in attempts. Unlock your account or reset your password to continue.
          </p>

          <!-- Unlock button -->
          <button id="ciUnlockBtn" style="
            display:flex;align-items:center;justify-content:center;gap:8px;
            width:100%;padding:13px;margin-bottom:10px;
            background:linear-gradient(135deg,#b8860b,#a07609);
            color:#fff;border:none;border-radius:10px;
            font-size:14px;font-weight:600;cursor:pointer;
            box-shadow:0 4px 12px rgba(184,134,11,0.3);
            transition:opacity 0.2s,transform 0.2s;"
            onmouseover="this.style.opacity='0.9';this.style.transform='translateY(-1px)'"
            onmouseout="this.style.opacity='1';this.style.transform='translateY(0)'">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
            </svg>
            Unlock My Account
          </button>

          <!-- Help text -->
          <p style="margin-top:20px;font-size:12px;color:#9ca3af;line-height:1.5;">
            Need help?
            <a href="mailto:support@classinstruct.com"
               style="color:#b8860b;font-weight:500;text-decoration:none;"
               onmouseover="this.style.textDecoration='underline'"
               onmouseout="this.style.textDecoration='none'">
              support@classinstruct.com
            </a>
          </p>
        </div>`;
      stepEmail.appendChild(panel);

      document.getElementById('ciUnlockBtn').addEventListener('click', () => {
        window.location.href = `${BASE}/unlock_account.php?email=${encodeURIComponent(emailInput.value.trim())}`;
      });
    }
    panel.style.display = 'block';
  }

  // Clean up lockout UI when modal resets

  /* ── Loading helper ── */
  function setLoading(btn, loading) {
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  }

})();