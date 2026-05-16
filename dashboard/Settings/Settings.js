// ── Settings Page ──

document.addEventListener('DOMContentLoaded', function () {
  loadSettingsData();
  syncDarkToggle();
  initPinState();
});

// ── Load user data ────────────────────────────────────────────────────────────
async function loadSettingsData() {
  const email = sessionStorage.getItem('ci_email') || '';
  let firstName = '';
  let lastName  = '';
  let gender    = '';

  // Try to fetch from database first
  try {
    const res = await fetch('../Profile/profile_api.php?email=' + encodeURIComponent(email));
    const data = await res.json();
    if (data.success) {
      firstName = data.first_name || '';
      lastName  = data.last_name  || '';
      gender    = data.gender     || '';
    }
  } catch (e) {
    console.error('Failed to fetch user from DB:', e);
  }

  // Fallback to sessionStorage
  if (!firstName && !lastName) {
    firstName = sessionStorage.getItem('ci_first_name') || '';
    lastName  = sessionStorage.getItem('ci_last_name')  || '';
    gender    = sessionStorage.getItem('ci_gender')     || '';
  }

  setVal('settFirstName', firstName);
  setVal('settLastName',  lastName);
  setVal('settEmail',     email);

  const genderSel = document.getElementById('settGender');
  if (genderSel && gender) {
    [...genderSel.options].forEach(o => { o.selected = o.value === gender; });
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// ── Dark toggle ───────────────────────────────────────────────────────────────
function syncDarkToggle() {
  const t = document.getElementById('settingsDarkToggle');
  if (t) t.classList.toggle('on', (localStorage.getItem('theme') || 'light') === 'dark');
}
(function () {
  const _orig = window.toggleTheme;
  window.toggleTheme = function () {
    if (_orig) _orig();
    const t = document.getElementById('settingsDarkToggle');
    if (t) t.classList.toggle('on', document.documentElement.getAttribute('data-theme') === 'dark');
  };
})();

// ── Account ───────────────────────────────────────────────────────────────────
async function saveAccount() {
  const firstName = document.getElementById('settFirstName').value.trim();
  const lastName  = document.getElementById('settLastName').value.trim();
  const email     = document.getElementById('settEmail').value.trim();
  const gender    = document.getElementById('settGender').value;

  if (!firstName || !lastName) { showToast('Please enter your first and last name.', 'error'); return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Please enter a valid email address.', 'error'); return; }

  // Save to database
  try {
    const res = await fetch('../Profile/profile_api.php', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, gender: gender })
    });
    const data = await res.json();
    if (!data.success) {
      showToast('Failed to save to database: ' + (data.error || 'Unknown error'), 'error');
      return;
    }
  } catch (e) {
    console.error('Failed to save to DB:', e);
  }

  // Also save to sessionStorage for immediate UI update
  sessionStorage.setItem('ci_first_name', firstName);
  sessionStorage.setItem('ci_last_name',  lastName);
  sessionStorage.setItem('ci_email',      email);
  sessionStorage.setItem('ci_gender',     gender);
  showToast('Account changes saved.');
}

function discardAccount() { loadSettingsData(); showToast('Changes discarded.'); }

// ── Password ──────────────────────────────────────────────────────────────────
function updatePassword() {
  const cur = document.getElementById('currentPassword').value;
  const np  = document.getElementById('newPassword').value;
  const cp  = document.getElementById('confirmPassword').value;

  if (!cur) { showToast('Please enter your current password.', 'error'); return; }
  if (!np)  { showToast('Please enter a new password.', 'error'); return; }
  if (np.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return; }
  if (np !== cp) { showToast('New passwords do not match.', 'error'); return; }

  ['currentPassword','newPassword','confirmPassword'].forEach(id => { document.getElementById(id).value = ''; });
  showToast('Password updated successfully.');
}

// ── Delete account ────────────────────────────────────────────────────────────
function deleteAccount() {
  if (confirm('Are you sure? This will permanently delete your account and all data. This cannot be undone.')) {
    sessionStorage.clear();
    localStorage.clear();
    window.top.location.href = '/ClassInstruct1/index.php';
  }
}

// ══════════════════════════════════════════════════════════════
//  WEBSITE PIN  (keyboard input, no numpad)
// ══════════════════════════════════════════════════════════════

let pinMode = ''; // 'set' | 'change' | 'remove' | 'verify'

function initPinState() {
  const has = !!localStorage.getItem('ci_pin');
  document.getElementById('pinStateNone').style.display = has ? 'none'  : 'block';
  document.getElementById('pinStateHas').style.display  = has ? 'block' : 'none';
  document.getElementById('pinForm').style.display = 'none';
}

// Generate 4 individual input boxes
function pinBoxes(prefix) {
  return [0,1,2,3].map(i =>
    `<input class="pin-box" id="${prefix}_${i}" type="text" inputmode="numeric"
      maxlength="1" pattern="[0-9]" autocomplete="off" autocorrect="off"
      spellcheck="false" style="-webkit-text-security:disc;font-size:22px;"
      oninput="pinBoxInput(this,'${prefix}',${i})"
      onkeydown="pinBoxKey(event,this,'${prefix}',${i})" />`
  ).join('');
}

function wirePinBoxes() {
  // nothing extra needed — handled by oninput / onkeydown
}

function pinBoxInput(el, prefix, idx) {
  // Allow only digits
  el.value = el.value.replace(/\D/g, '').slice(-1);
  if (el.value && idx < 3) {
    const next = document.getElementById(`${prefix}_${idx + 1}`);
    if (next) next.focus();
  }
}

function pinBoxKey(e, el, prefix, idx) {
  if (e.key === 'Backspace' && !el.value && idx > 0) {
    const prev = document.getElementById(`${prefix}_${idx - 1}`);
    if (prev) { prev.value = ''; prev.focus(); }
  }
  // Allow Tab to move naturally
}

function getPinValue(prefix) {
  return [0,1,2,3].map(i => {
    const el = document.getElementById(`${prefix}_${i}`);
    return el ? el.value : '';
  }).join('');
}

function setPinError(prefix) {
  [0,1,2,3].forEach(i => {
    const el = document.getElementById(`${prefix}_${i}`);
    if (el) {
      el.classList.add('error');
      el.value = '';
      setTimeout(() => el.classList.remove('error'), 600);
    }
  });
  const first = document.getElementById(`${prefix}_0`);
  if (first) first.focus();
}

// Build the right set of fields based on mode (set|change|remove|verify)
function openPinForm(mode) {
  pinMode = mode;
  const inner = document.getElementById('pinFormInner');

  if (mode === 'set') {
    inner.innerHTML = `
      <div class="field" style="margin-bottom:14px;">
        <label>New PIN</label>
        <div class="pin-input-row">${pinBoxes('pinNew')}</div>
      </div>
      <div class="field" style="margin-bottom:14px;">
        <label>Confirm PIN</label>
        <div class="pin-input-row">${pinBoxes('pinConfirm')}</div>
      </div>`;
  } else if (mode === 'change') {
    inner.innerHTML = `
      <div class="field" style="margin-bottom:14px;">
        <label>Current PIN</label>
        <div class="pin-input-row">${pinBoxes('pinCurrent')}</div>
      </div>
      <div class="field" style="margin-bottom:14px;">
        <label>New PIN</label>
        <div class="pin-input-row">${pinBoxes('pinNew')}</div>
      </div>
      <div class="field" style="margin-bottom:14px;">
        <label>Confirm PIN</label>
        <div class="pin-input-row">${pinBoxes('pinConfirm')}</div>
      </div>`;
  } else if (mode === 'remove') {
    inner.innerHTML = `
      <div class="field" style="margin-bottom:14px;">
        <label>Enter current PIN to remove it</label>
        <div class="pin-input-row">${pinBoxes('pinCurrent')}</div>
      </div>`;
  } else if (mode === 'verify') {
    inner.innerHTML = `
      <div class="field" style="margin-bottom:14px;">
        <label>Enter PIN to confirm</label>
        <div class="pin-input-row">${pinBoxes('pinCurrent')}</div>
      </div>
      <button class="pin-submit-btn" onclick="submitPinVerify()" style="margin-top:8px;padding:10px 20px;background:#1e1a4a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">Confirm</button>
      <button class="pin-cancel-btn" onclick="cancelPinVerify()" style="margin-top:8px;margin-left:8px;padding:10px 20px;background:#e5e7eb;color:#333;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Cancel</button>`;
  }

  document.getElementById('pinForm').style.display = 'block';
  document.getElementById('pinStateNone').style.display = 'none';
  document.getElementById('pinStateHas').style.display  = 'none';

  wirePinBoxes();

  const first = document.querySelector('.pin-box');
  if (first) first.focus();
}

function submitPin() {
  if (pinMode === 'verify') return; // handled by submitPinVerify()
  if (pinMode === 'set') {
    const np = getPinValue('pinNew');
    const cp = getPinValue('pinConfirm');
    if (np.length < 4) { showToast('Please enter a full 4-digit PIN.', 'error'); setPinError('pinNew'); return; }
    if (np !== cp)     { showToast("PINs don't match.", 'error'); setPinError('pinConfirm'); return; }
    localStorage.setItem('ci_pin', btoa(np));
    closePinForm();
    showToast('PIN set successfully! 🔒');
  } else if (pinMode === 'change') {
    const cur = getPinValue('pinCurrent');
    const np  = getPinValue('pinNew');
    const cp  = getPinValue('pinConfirm');
    const stored = atob(localStorage.getItem('ci_pin') || '');
    if (cur !== stored) { showToast('Incorrect current PIN.', 'error'); setPinError('pinCurrent'); return; }
    if (np.length < 4)  { showToast('Please enter a full 4-digit new PIN.', 'error'); setPinError('pinNew'); return; }
    if (np !== cp)      { showToast("New PINs don't match.", 'error'); setPinError('pinConfirm'); return; }
    localStorage.setItem('ci_pin', btoa(np));
    closePinForm();
    showToast('PIN changed successfully! 🔒');
  } else if (pinMode === 'remove') {
    const cur = getPinValue('pinCurrent');
    const stored = atob(localStorage.getItem('ci_pin') || '');
    if (cur !== stored) { showToast('Incorrect PIN.', 'error'); setPinError('pinCurrent'); return; }
    localStorage.removeItem('ci_pin');
    closePinForm();
    showToast('PIN removed.');
  }
}

function closePinForm() {
  document.getElementById('pinForm').style.display = 'none';
  document.getElementById('pinFormInner').innerHTML = '';
  pinMode = '';
  initPinState();
}

// ── Reusable PIN Verification (for other modules) ─────────────────────────────
let _pinVerifyCallback = null;

function verifyPin(callback) {
  if (!localStorage.getItem('ci_pin')) {
    callback(true);
    return;
  }
  _pinVerifyCallback = callback;
  openPinForm('verify');
}

function submitPinVerify() {
  const cur = getPinValue('pinCurrent');
  const stored = atob(localStorage.getItem('ci_pin') || '');
  if (cur !== stored) {
    showToast('Incorrect PIN.', 'error');
    setPinError('pinCurrent');
    return;
  }
  const cb = _pinVerifyCallback;
  closePinForm();
  _pinVerifyCallback = null;
  if (cb) cb(true);
}

function cancelPinVerify() {
  const cb = _pinVerifyCallback;
  closePinForm();
  _pinVerifyCallback = null;
  if (cb) cb(false);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type) {
  let toast = document.getElementById('ciSettingsToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ciSettingsToast';
    toast.style.cssText = [
      'position:fixed','bottom:28px','left:50%','transform:translateX(-50%) translateY(20px)',
      'padding:11px 22px','border-radius:10px',
      'font-size:13.5px','font-weight:600','box-shadow:0 4px 20px rgba(0,0,0,0.25)',
      'opacity:0','transition:all 0.25s','z-index:9999','pointer-events:none'
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.style.background = type === 'error' ? '#ef4444' : '#1e1a4a';
  toast.style.color = '#fff';
  toast.textContent = msg;
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2800);
}