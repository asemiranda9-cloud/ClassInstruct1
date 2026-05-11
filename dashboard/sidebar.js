// ── Active nav persistence (survives reload) ──
function getStoredNav() {
  return sessionStorage.getItem('ci_active_nav') || 'dashboard.php';
}

function setStoredNav(url) {
  sessionStorage.setItem('ci_active_nav', url);
}

function restoreActiveNav() {
  const stored = getStoredNav();
  document.querySelectorAll('.ni[data-url]').forEach(n => {
    n.classList.toggle('active', n.dataset.url === stored);
  });
}

// ── Populate sidebar profile card from storage ──
function loadSidebarProfile() {
  const firstName = sessionStorage.getItem('ci_first_name') || '';
  const lastName  = sessionStorage.getItem('ci_last_name')  || '';
  const email     = sessionStorage.getItem('ci_email')      || '';

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Teacher';
  const initial  = (firstName[0] || email[0] || 'T').toUpperCase();

  document.getElementById('sbUserName').textContent = fullName;

  const customPhoto = localStorage.getItem('ci_custom_photo') || '';
  const googlePhoto = localStorage.getItem('ci_google_photo')
                      || sessionStorage.getItem('ci_picture') || '';
  const photo = customPhoto || googlePhoto;

  const img       = document.getElementById('sbAvatarImg');
  const initialEl = document.getElementById('sbAvatarInitial');

  if (photo) {
    img.src                 = photo;
    img.style.display       = 'block';
    initialEl.style.display = 'none';
  } else {
    initialEl.textContent   = initial;
    initialEl.style.display = '';
    img.style.display       = 'none';
  }
}

loadSidebarProfile();
restoreActiveNav();

// Load stored page into iframe on startup
(function initFrame() {
  const stored = getStoredNav();
  const frame  = document.getElementById('mainFrame');
  if (frame && frame.src && !frame.src.endsWith(stored)) {
    frame.src = stored;
    frame.onload = () => applyThemeToFrame(frame);
  }
})();

// Re-sync when profile page saves new data
window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'CI_PROFILE_UPDATED') {
    loadSidebarProfile();
  }
  if (e.data && e.data.type === 'CI_ACTIVITY_UPDATE') {
    const frame = document.getElementById('mainFrame');
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: 'CI_ACTIVITY_UPDATE' }, '*');
    }
  }
  // Dashboard links (View full, View all, Manage Class) ask the sidebar to navigate
  if (e.data && e.data.type === 'CI_NAV' && e.data.url) {
    const url = e.data.url;
    // Find and activate the matching nav item (if any)
    let matched = false;
    document.querySelectorAll('.ni[data-url]').forEach(n => {
      const match = n.dataset.url === url || n.dataset.url.toLowerCase() === url.toLowerCase();
      n.classList.toggle('active', match);
      if (match) matched = true;
    });
    setStoredNav(url);
    const frame = document.getElementById('mainFrame');
    if (frame) {
      frame.src = url;
      frame.onload = () => applyThemeToFrame(frame);
    }
  }
});

function applyThemeToFrame(frame) {
  const saved = localStorage.getItem('theme') || 'light';
  try { frame.contentWindow.document.documentElement.setAttribute('data-theme', saved); } catch(e) {}
  try { frame.contentWindow.postMessage({ type: 'CI_SET_THEME', theme: saved }, '*'); } catch(e) {}
}

// ── Open profile in iframe ──
function openProfile() {
  document.querySelectorAll('.ni[data-url]').forEach(n => n.classList.remove('active'));
  const frame = document.getElementById('mainFrame');
  frame.src   = 'Profile/profile.html';
  frame.onload = () => applyThemeToFrame(frame);
}

// ── Iframe nav (persists across reload) ──
function navTo(el, url) {
  document.querySelectorAll('.ni[data-url]').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  setStoredNav(url);
  const frame = document.getElementById('mainFrame');
  frame.src   = url;
  frame.onload = () => applyThemeToFrame(frame);
}

// ── Sidebar collapse ──
(function initCollapse() {
  const sb      = document.querySelector('.sb');
  const btn     = document.getElementById('sbCollapseBtn');
  const COLLAPSED = 'sb-collapsed';

  const stored = localStorage.getItem('ci_sb_collapsed') === 'true';
  if (stored) sb.classList.add(COLLAPSED);

  btn.addEventListener('click', function () {
    const isNowCollapsed = sb.classList.toggle(COLLAPSED);
    localStorage.setItem('ci_sb_collapsed', isNowCollapsed);
  });
})();