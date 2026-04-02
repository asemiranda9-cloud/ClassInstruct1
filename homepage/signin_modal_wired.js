const BASE = '/ClassInstruct1/homepage';

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
  const btnGoogle    = document.getElementById('btnGoogle');

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
    // Show auth_error from Google OAuth redirect if present
    const params = new URLSearchParams(window.location.search);
    if (params.has('auth_error')) {
      emailError.textContent = params.get('auth_error');
      emailError.classList.add('show');
      // Clean URL without reload
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
    setEmailError(false);
    clearOtpDigits();
    otpError.textContent = '';
    clearInterval(timerInterval);
  }

  openBtns.forEach(btn => {
  btn.addEventListener('click', openModal);
});

// Close logic
closeBtn.addEventListener('click', closeModal);
backdrop.addEventListener('click', closeModal);

// Escape key closes modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal.classList.contains('active')) {
    closeModal();
  }
});

  // Auto-open if Google redirected back with error
  window.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(window.location.search).has('auth_error')) openModal();
  });

  /* ── Step switcher ── */
  function showStep(step) {
    [stepEmail, stepOtp, stepSuccess].forEach(s => s.classList.remove('active'));
    step.classList.add('active');
  }

  /* ── Email validation (any valid email, not just Gmail) ── */
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }

  function setEmailError(show, msg) {
    emailInput.classList.toggle('error', show);
    emailError.classList.toggle('show', show);
    if (msg) emailError.textContent = msg;
  }

  emailInput.addEventListener('input', () => {
    if (emailInput.value.trim()) setEmailError(false);
  });

  /* ── Send OTP (real API call) ── */
  btnSendOtp.addEventListener('click', () => sendOtp());
  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendOtp(); });

  async function sendOtp() {
    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      setEmailError(true, 'Please enter a valid email address.');
      emailInput.focus();
      return;
    }

    setEmailError(false);
    setLoading(btnSendOtp, true);

    try {
      const res = await fetch('/ClassInstruct1/homepage/send_otp.php', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!data.success) {
        setEmailError(true, data.error || 'Failed to send code. Please try again.');
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
      setEmailError(true, 'Network error. Please check your connection.');
    } finally {
      setLoading(btnSendOtp, false);
    }
  }

  /* ── Google OAuth — real redirect ── */
  btnGoogle.addEventListener('click', () => {
    window.location.href = '/ClassInstruct1/homepage/google_oauth.php?action=redirect';
  });

  /* ── OTP digit input handling (unchanged from original) ── */
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

  /* ── Verify OTP (real API call) ── */
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
      const res = await fetch('/ClassInstruct1/homepage/verify_otp.php', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ otp: entered }),
      });
      const data = await res.json();

      if (data.success) {
        clearInterval(timerInterval);
        // Optionally store token for SPA use:
        if (data.token) sessionStorage.setItem('ci_token', data.token);
        showStep(stepSuccess);
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
      const res = await fetch('/ClassInstruct1/homepage/send_otp.php', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ email: currentEmail }),
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
    window.location.href = '/ClassInstruct1/dashboard/sidebar.html';
  });

  /* ── Sign Up link ── */
  document.getElementById('linkSignUp').addEventListener('click', () => {
    window.location.href = '/ClassInstruct1/homepage/homepage.php';
  });

  /* ── Loading helper ── */
  function setLoading(btn, loading) {
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  }

})();
