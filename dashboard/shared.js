// ── ClassInstruct shared.js ──

// Apply theme to THIS document
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  var lbl = document.getElementById('themeLabel');
  if (lbl) lbl.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
}

// Toggle and broadcast
function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'light';
  var next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);

  // Push into iframe if we are the sidebar/parent
  var iframe = document.getElementById('mainFrame');
  if (iframe && iframe.contentWindow) {
    try { iframe.contentWindow.postMessage({ type: 'CI_THEME', theme: next }, '*'); } catch(e) {}
    try { iframe.contentWindow.document.documentElement.setAttribute('data-theme', next); } catch(e) {}
  }

  // Push to parent if we are inside an iframe
  if (window.parent && window.parent !== window) {
    try { window.parent.postMessage({ type: 'CI_THEME', theme: next }, '*'); } catch(e) {}
  }
}

// Listen for theme messages (iframe receives from sidebar, sidebar receives from iframe)
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'CI_THEME') {
    applyTheme(e.data.theme);
  }
});

// When sidebar loads a new page into the iframe, push theme immediately on load
document.addEventListener('DOMContentLoaded', function() {
  var iframe = document.getElementById('mainFrame');
  if (iframe) {
    function pushThemeToFrame() {
      var saved = localStorage.getItem('theme') || 'light';
      try { iframe.contentWindow.document.documentElement.setAttribute('data-theme', saved); } catch(e) {}
      try { iframe.contentWindow.postMessage({ type: 'CI_THEME', theme: saved }, '*'); } catch(e) {}
    }
    iframe.addEventListener('load', pushThemeToFrame);
  }
});

// ── Apply saved theme IMMEDIATELY (prevents light flash on dark mode) ──
(function() {
  var saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  var lbl = document.getElementById('themeLabel');
  if (lbl) lbl.textContent = saved === 'dark' ? 'Dark Mode' : 'Light Mode';
})();