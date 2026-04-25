/**
 * register_modal.js
 * ClassInstruct — Registration Modal Handler
 *
 * Flow:
 *   1. User fills out form (name, email, password, confirm)
 *   2. On submit → POST /homepage/register_otp.php (sends OTP + temporarily stores user data)
 *   3. User enters 6-digit OTP
 *   4. POST /homepage/register_verify.php → creates account, starts session
 *   5. Redirect to dashboard
 */

(function () {
  /* ── Modal Elements ── */
  const regModal       = document.getElementById('registerModal');
  const regBackdrop    = document.getElementById('regModalBackdrop');
  const closeRegBtn    = document.getElementById('closeRegModal');

  /* ── Step panels ── */
  const regStepForm    = document.getElementById('regStepForm');
  const regStepOtp     = document.getElementById('regStepOtp');
  const regStepSuccess = document.getElementById('regStepSuccess');

  /* ── Form inputs ── */
  const regFirstName   = document.getElementById('regFirstName');
  const regLastName    = document.getElementById('regLastName');
  const regEmail       = document.getElementById('regEmail');
  const regPassword    = document.getElementById('regPassword');
  const regPasswordConfirm = document.getElementById('regPasswordConfirm');
  const btnRegisterSubmit  = document.getElementById('btnRegisterSubmit');

  /* ── Field errors ── */
  const regFirstNameError      = document.getElementById('regFirstNameError');
  const regLastNameError       = document.getElementById('regLastNameError');
  const regEmailError          = document.getElementById('regEmailError');
  const regPasswordError       = document.getElementById('regPasswordError');
  const regPasswordConfirmError = document.getElementById('regPasswordConfirmError');

  /* ── Password strength ── */
  const regStrengthBar   = document.getElementById('regStrengthBar');
  const regStrengthLabel = document.getElementById('regStrengthLabel');

  /* ── OTP step ── */
  const regOtpEmailDisp = document.getElementById('regOtpEmailDisplay');
  const regOtpDigits    = document.querySelectorAll('#regOtpInputs .otp-digit');
  const regOtpError     = document.getElementById('regOtpError');
  const regBtnVerify    = document.getElementById('regBtnVerifyOtp');
  const regBtnBack      = document.getElementById('regBtnBack');
  const regBtnResend    = document.getElementById('regBtnResend');
  const regTimerEl      = document.getElementById('regTimerCount');
  const regLinkResend2  = document.getElementById('regLinkResend2');

  /* ── Success step ── */
  const regBtnDash = document.getElementById('regBtnGoToDashboard');

  /* ── Sign-in link ── */
  const linkBackToSignIn = document.getElementById('linkBackToSignIn');

  let regTimerInterval = null;
  let regTimerSeconds  = 120;
  let currentEmail     = '';

  /* ════════════════════════════════════════
     OPEN / CLOSE
  ════════════════════════════════════════ */
  function openRegModal() {
    regModal.classList.add('active');
    regFirstName.focus();
  }

  function closeRegModal() {
    regModal.classList.remove('active');
    setTimeout(resetAll, 350);
  }

  function resetAll() {
    showStep(regStepForm);
    [regFirstName, regLastName, regEmail, regPassword, regPasswordConfirm].forEach(el => el.value = '');
    [regFirstNameError, regLastNameError, regEmailError, regPasswordError, regPasswordConfirmError]
      .forEach(el => { el.classList.remove('show'); });
    [regFirstName, regLastName, regEmail, regPassword, regPasswordConfirm]
      .forEach(el => el.classList.remove('error'));
    regStrengthBar.style.width = '0%';
    regStrengthBar.style.background = 'transparent';
    regStrengthLabel.textContent = '';
    regStrengthLabel.style.color = '';
    clearOtpDigits();
    regOtpError.textContent = '';
    clearInterval(regTimerInterval);
  }

  // The Register button in the sign-in modal opens the register modal
  document.getElementById('btnRegister').addEventListener('click', () => {
    document.getElementById('signInModal').classList.remove('active');
    setTimeout(openRegModal, 200);
  });

  closeRegBtn.addEventListener('click', closeRegModal);
  regBackdrop.addEventListener('click', closeRegModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && regModal.classList.contains('active')) closeRegModal();
  });

  // "Sign in" link in register modal → go back to sign-in modal
  linkBackToSignIn.addEventListener('click', () => {
    closeRegModal();
    setTimeout(() => document.getElementById('signInModal').classList.add('active'), 200);
  });

  /* ════════════════════════════════════════
     STEP SWITCHER
  ════════════════════════════════════════ */
  function showStep(step) {
    [regStepForm, regStepOtp, regStepSuccess].forEach(s => s.classList.remove('active'));
    step.classList.add('active');
  }

  /* ════════════════════════════════════════
     PASSWORD SHOW/HIDE
  ════════════════════════════════════════ */
  const toggleRegPassword = document.getElementById('toggleRegPassword');
  if (toggleRegPassword) {
    toggleRegPassword.addEventListener('click', function () {
      const isHidden = regPassword.type === 'password';
      regPassword.type = isHidden ? 'text' : 'password';
      this.textContent = isHidden ? 'Hide' : 'Show';
    });
  }

  const toggleRegPasswordConfirm = document.getElementById('toggleRegPasswordConfirm');
  if (toggleRegPasswordConfirm) {
    toggleRegPasswordConfirm.addEventListener('click', function () {
      const isHidden = regPasswordConfirm.type === 'password';
      regPasswordConfirm.type = isHidden ? 'text' : 'password';
      this.textContent = isHidden ? 'Hide' : 'Show';
    });
  }

  /* ════════════════════════════════════════
     PASSWORD STRENGTH
  ════════════════════════════════════════ */
  regPassword.addEventListener('input', () => {
    const val = regPassword.value;
    let score = 0;
    if (val.length >= 8)           score++;
    if (/[A-Z]/.test(val))         score++;
    if (/[0-9]/.test(val))         score++;
    if (/[^A-Za-z0-9]/.test(val))  score++;

    const levels = [
      { pct: '0%',   color: 'transparent', label: '' },
      { pct: '25%',  color: '#ef4444',     label: 'Weak' },
      { pct: '50%',  color: '#f59e0b',     label: 'Fair' },
      { pct: '75%',  color: '#3b82f6',     label: 'Good' },
      { pct: '100%', color: '#10b981',     label: 'Strong' },
    ];
    const lvl = levels[score] ?? levels[0];
    regStrengthBar.style.width      = lvl.pct;
    regStrengthBar.style.background = lvl.color;
    regStrengthLabel.textContent    = lvl.label;
    regStrengthLabel.style.color    = lvl.color;
  });

  /* ════════════════════════════════════════
     VALIDATION HELPERS
  ════════════════════════════════════════ */
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }

  function setFieldError(input, errorEl, show, msg) {
    input.classList.toggle('error', show);
    errorEl.classList.toggle('show', show);
    if (msg) errorEl.textContent = msg;
  }

  // Clear errors on input
  regFirstName.addEventListener('input',        () => setFieldError(regFirstName, regFirstNameError, false));
  regLastName.addEventListener('input',         () => setFieldError(regLastName,  regLastNameError,  false));
  regEmail.addEventListener('input',            () => setFieldError(regEmail,     regEmailError,     false));
  regPassword.addEventListener('input',         () => setFieldError(regPassword,  regPasswordError,  false));
  regPasswordConfirm.addEventListener('input',  () => setFieldError(regPasswordConfirm, regPasswordConfirmError, false));

  /* ════════════════════════════════════════
     SUBMIT REGISTRATION FORM → send OTP
  ════════════════════════════════════════ */
  btnRegisterSubmit.addEventListener('click', () => submitRegistration());
  [regFirstName, regLastName, regEmail, regPasswordConfirm].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') submitRegistration(); });
  });

  async function submitRegistration() {
    const firstName = regFirstName.value.trim();
    const lastName  = regLastName.value.trim();
    const email     = regEmail.value.trim();
    const password  = regPassword.value;
    const confirm   = regPasswordConfirm.value;

    let hasError = false;

    if (!firstName) {
      setFieldError(regFirstName, regFirstNameError, true, 'Please enter your first name.');
      hasError = true;
    }
    if (!lastName) {
      setFieldError(regLastName, regLastNameError, true, 'Please enter your last name.');
      hasError = true;
    }
    if (!isValidEmail(email)) {
      setFieldError(regEmail, regEmailError, true, 'Please enter a valid email address.');
      hasError = true;
    }
    if (password.length < 8) {
      setFieldError(regPassword, regPasswordError, true, 'Password must be at least 8 characters.');
      hasError = true;
    }
    if (password !== confirm) {
      setFieldError(regPasswordConfirm, regPasswordConfirmError, true, 'Passwords do not match.');
      hasError = true;
    }

    if (hasError) return;

    setLoading(btnRegisterSubmit, true);

    try {
      const res = await fetch('/homepage/register_otp.php', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ firstName, lastName, email, password }),
        credentials: 'include',
      });
      const data = await res.json();

      if (!data.success) {
        setFieldError(regEmail, regEmailError, true, data.error || 'Failed to send code. Please try again.');
        return;
      }

      currentEmail = email;
      regOtpEmailDisp.textContent = `✉ ${email}`;
      showStep(regStepOtp);
      clearOtpDigits();
      regOtpError.textContent = '';
      startTimer();
      regOtpDigits[0].focus();

    } catch (err) {
      setFieldError(regEmail, regEmailError, true, 'Network error. Please check your connection.');
    } finally {
      setLoading(btnRegisterSubmit, false);
    }
  }

  /* ════════════════════════════════════════
     OTP DIGIT INPUT HANDLING
  ════════════════════════════════════════ */
  regOtpDigits.forEach((input, i) => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace') {
        if (!input.value && i > 0) {
          regOtpDigits[i-1].value = '';
          regOtpDigits[i-1].classList.remove('filled');
          regOtpDigits[i-1].focus();
        } else {
          input.value = '';
          input.classList.remove('filled');
        }
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowLeft'  && i > 0) { regOtpDigits[i-1].focus(); return; }
      if (e.key === 'ArrowRight' && i < 5) { regOtpDigits[i+1].focus(); return; }
    });

    input.addEventListener('input', () => {
      const val = input.value.replace(/\D/g, '');
      if (!val) { input.value = ''; input.classList.remove('filled'); return; }

      if (val.length > 1) {
        const digits = val.slice(0, 6).split('');
        digits.forEach((d, j) => {
          if (regOtpDigits[i + j]) {
            regOtpDigits[i+j].value = d;
            regOtpDigits[i+j].classList.add('filled');
          }
        });
        regOtpDigits[Math.min(i + digits.length, 5)].focus();
        return;
      }

      input.value = val[0];
      input.classList.add('filled');
      if (i < 5) regOtpDigits[i+1].focus();

      if (getOtpValue().length === 6) verifyOtp();
    });

    input.addEventListener('focus', () => input.select());
  });

  function getOtpValue() {
    return Array.from(regOtpDigits).map(d => d.value).join('');
  }

  function clearOtpDigits() {
    regOtpDigits.forEach(d => { d.value = ''; d.classList.remove('filled', 'error-shake'); });
  }

  /* ════════════════════════════════════════
     VERIFY OTP → complete registration
  ════════════════════════════════════════ */
  regBtnVerify.addEventListener('click', verifyOtp);

  async function verifyOtp() {
    const entered = getOtpValue();
    if (entered.length < 6) {
      regOtpError.textContent = 'Please enter all 6 digits.';
      return;
    }

    regOtpError.textContent = '';
    setLoading(regBtnVerify, true);

    try {
      const res = await fetch('/homepage/register_verify.php', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ otp: entered }),
        credentials: 'include',
      });
      const data = await res.json();

      if (data.success) {
        clearInterval(regTimerInterval);
        showStep(regStepSuccess);
        setTimeout(() => {
          closeRegModal();
          setTimeout(() => {
            document.getElementById('signInModal').classList.add('active');
            document.getElementById('emailInput').focus();
          }, 350);
        }, 2000);
      } else {
        regOtpError.textContent = data.error || 'Incorrect code. Please try again.';
        regOtpDigits.forEach(d => d.classList.add('error-shake'));
        setTimeout(() => regOtpDigits.forEach(d => d.classList.remove('error-shake')), 500);
        clearOtpDigits();
        regOtpDigits[0].focus();
      }

    } catch (err) {
      regOtpError.textContent = 'Network error. Please try again.';
    } finally {
      setLoading(regBtnVerify, false);
    }
  }

  /* ════════════════════════════════════════
     TIMER
  ════════════════════════════════════════ */
  // startTimer: 120s countdown used when OTP is first sent
  function startTimer() {
    runTimer(120);
  }

  // startResendTimer: 30s cooldown after a resend (matches server-side 30s rate limit)
  function startResendTimer() {
    runTimer(30);
  }

  function runTimer(seconds) {
    clearInterval(regTimerInterval);
    regTimerSeconds = seconds;
    regBtnResend.disabled = true;
    updateTimerDisplay();
    regTimerInterval = setInterval(() => {
      regTimerSeconds--;
      updateTimerDisplay();
      if (regTimerSeconds <= 0) {
        clearInterval(regTimerInterval);
        regTimerEl.textContent = '0:00';
        regBtnResend.disabled = false;
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const m = Math.floor(regTimerSeconds / 60);
    const s = regTimerSeconds % 60;
    regTimerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  /* ════════════════════════════════════════
     RESEND
  ════════════════════════════════════════ */
  async function resendOtp() {
    regBtnResend.disabled = true;
    regOtpError.textContent = '';
    clearOtpDigits();

    try {
      const res = await fetch('/homepage/register_otp.php', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ resend: true }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) {
        if (data.error && data.error.includes('No pending registration')) {
          regOtpError.textContent = 'Your session expired — please go back and fill in the form again.';
        } else {
          regOtpError.textContent = data.error || 'Could not resend. Please try again.';
        }
        regBtnResend.disabled = false;
        return;
      }
      startResendTimer();
      regOtpDigits[0].focus();
    } catch {
      regOtpError.textContent = 'Network error. Please try again.';
      regBtnResend.disabled = false;
    }
  }

  regBtnResend.addEventListener('click', resendOtp);
  regLinkResend2.addEventListener('click', resendOtp);

  /* ── Back ── */
  regBtnBack.addEventListener('click', () => {
    clearInterval(regTimerInterval);
    showStep(regStepForm);
  });

  /* ── Go to Sign In ── */
  regBtnDash.addEventListener('click', () => {
    closeRegModal();
    setTimeout(() => {
      document.getElementById('signInModal').classList.add('active');
      document.getElementById('emailInput').focus();
    }, 350);
  });

  if (regBtnDash) {
    const label = regBtnDash.querySelector('.btn-label');
    if (label) label.textContent = 'Sign In →';
  }

  /* ════════════════════════════════════════
     LOADING HELPER
  ════════════════════════════════════════ */
  function setLoading(btn, loading) {
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  }

})();