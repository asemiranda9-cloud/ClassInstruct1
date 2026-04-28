// ── Populate sidebar profile card from storage ──
function loadSidebarProfile() {
  const firstName = sessionStorage.getItem('ci_first_name') || '';
  const lastName  = sessionStorage.getItem('ci_last_name')  || '';
  const email     = sessionStorage.getItem('ci_email')      || '';

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Teacher';
  const initial  = (firstName[0] || email[0] || 'T').toUpperCase();

  document.getElementById('sbUserName').textContent = fullName;

  // Avatar: custom upload > Google/Gravatar photo > initial
  const customPhoto = localStorage.getItem('ci_custom_photo') || '';
  const googlePhoto = localStorage.getItem('ci_google_photo')
                      || sessionStorage.getItem('ci_picture') || '';
  const photo = customPhoto || googlePhoto;

  const img        = document.getElementById('sbAvatarImg');
  const initialEl  = document.getElementById('sbAvatarInitial');

  if (photo) {
    img.src                  = photo;
    img.style.display        = 'block';
    initialEl.style.display  = 'none';
  } else {
    initialEl.textContent    = initial;
    initialEl.style.display  = '';
    img.style.display        = 'none';
  }
}

loadSidebarProfile();

// Re-sync when profile page saves new data (postMessage from iframe)
window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'CI_PROFILE_UPDATED') {
    loadSidebarProfile();
  }
  // Relay activity updates from any iframe page → dashboard iframe
  if (e.data && e.data.type === 'CI_ACTIVITY_UPDATE') {
    const frame = document.getElementById('mainFrame');
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: 'CI_ACTIVITY_UPDATE' }, '*');
    }
  }
});

// ── Open profile in iframe (keeps sidebar visible) ──
function openProfile() {
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  const frame = document.getElementById('mainFrame');
  frame.src = 'Profile/profile.html';
  frame.onload = function () {
    const saved = localStorage.getItem('theme') || 'light';
    try { frame.contentWindow.document.documentElement.setAttribute('data-theme', saved); } catch(e) {}
    try { frame.contentWindow.postMessage({ type: 'CI_SET_THEME', theme: saved }, '*'); } catch(e) {}
  };
}

// ── Iframe nav ──
function navTo(el, url) {
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  const frame = document.getElementById('mainFrame');
  frame.src = url;
  frame.onload = function () {
    const saved = localStorage.getItem('theme') || 'light';
    try { frame.contentWindow.document.documentElement.setAttribute('data-theme', saved); } catch(e) {}
    try { frame.contentWindow.postMessage({ type: 'CI_SET_THEME', theme: saved }, '*'); } catch(e) {}
  };
}