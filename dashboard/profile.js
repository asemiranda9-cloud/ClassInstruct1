// ── Profile Page — loads real user data from sessionStorage ──

document.addEventListener('DOMContentLoaded', function () {
  loadUserData();
});

function loadUserData() {
  const firstName = sessionStorage.getItem('ci_first_name') || '';
  const lastName  = sessionStorage.getItem('ci_last_name')  || '';
  const email     = sessionStorage.getItem('ci_email')      || '';
  const gender    = sessionStorage.getItem('ci_gender')     || '';

  // If Google picture just arrived in sessionStorage, persist it to localStorage
  const freshGooglePhoto = sessionStorage.getItem('ci_picture') || '';
  if (freshGooglePhoto) localStorage.setItem('ci_google_photo', freshGooglePhoto);

  // Priority: 1) custom uploaded photo, 2) server-supplied Gravatar/Google photo, 3) initials
  const customPhoto   = localStorage.getItem('ci_custom_photo') || '';
  const savedPhoto    = localStorage.getItem('ci_google_photo') || freshGooglePhoto;
  const activePicture = customPhoto || savedPhoto;

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown User';
  const initial  = (firstName[0] || email[0] || '?').toUpperCase();

  // Hero text
  document.getElementById('profileFullName').textContent = fullName;
  document.getElementById('profileEmail').textContent    = email || '—';

  // Avatar
  const avatarImg     = document.getElementById('profileAvatarImg');
  const avatarInitial = document.getElementById('profileAvatarInitial');

  if (activePicture) {
    avatarImg.src           = activePicture;
    avatarImg.style.display = 'block';
    avatarInitial.style.display = 'none';
  } else {
    avatarInitial.textContent   = initial;
    avatarInitial.style.display = '';
    avatarImg.style.display     = 'none';
  }

  // Form fields
  setVal('profileFirstName',  firstName);
  setVal('profileLastName',   lastName);
  setVal('profileEmailInput', email);
  setVal('profilePhone',  localStorage.getItem('ci_phone') || '');
  setVal('profileDept',   localStorage.getItem('ci_dept')  || '');
  setVal('profileBio',    localStorage.getItem('ci_bio')   || '');

  // Gender select
  const genderSel = document.getElementById('profileGender');
  if (genderSel && gender) {
    [...genderSel.options].forEach(o => { o.selected = o.value === gender; });
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// ── Notify parent sidebar to refresh ─────────────────────────────────────────
function notifySidebar() {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'CI_PROFILE_UPDATED' }, '*');
    }
  } catch(e) {}
}

// ── Avatar upload ─────────────────────────────────────────────────────────────

function triggerAvatarPick() {
  document.getElementById('avatarFileInput').click();
}

function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file.', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image must be under 5 MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;

    try {
      localStorage.setItem('ci_custom_photo', dataUrl);
    } catch {
      showToast('Photo shown but could not be saved (storage full).', 'error');
    }

    // Update avatar immediately
    const avatarImg     = document.getElementById('profileAvatarImg');
    const avatarInitial = document.getElementById('profileAvatarInitial');
    avatarImg.src           = dataUrl;
    avatarImg.style.display = 'block';
    avatarInitial.style.display = 'none';

    notifySidebar(); // ← tell sidebar to update its avatar too
    showToast('Profile photo updated!');
  };
  reader.readAsDataURL(file);

  event.target.value = '';
}

// ── Save profile ──────────────────────────────────────────────────────────────

function saveProfile() {
  const firstName = document.getElementById('profileFirstName').value.trim();
  const lastName  = document.getElementById('profileLastName').value.trim();
  const email     = document.getElementById('profileEmailInput').value.trim();
  const gender    = document.getElementById('profileGender').value;
  const phone     = document.getElementById('profilePhone').value.trim();
  const dept      = document.getElementById('profileDept').value.trim();
  const bio       = document.getElementById('profileBio').value.trim();

  sessionStorage.setItem('ci_first_name', firstName);
  sessionStorage.setItem('ci_last_name',  lastName);
  sessionStorage.setItem('ci_email',      email);
  sessionStorage.setItem('ci_gender',     gender);

  localStorage.setItem('ci_phone', phone);
  localStorage.setItem('ci_dept',  dept);
  localStorage.setItem('ci_bio',   bio);

  loadUserData();
  notifySidebar(); // ← tell sidebar to update name/avatar
  showToast('Profile saved successfully.');
}

function discardChanges() {
  if (confirm('Discard all unsaved changes?')) location.reload();
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg, type) {
  let toast = document.getElementById('ciToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ciToast';
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
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2800);
}