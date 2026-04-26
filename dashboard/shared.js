// ── Theme ──
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const lbl = document.getElementById('themeLabel');
  if (lbl) lbl.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
  localStorage.setItem('theme', theme);
  // If inside iframe, also update parent sidebar's data-theme and label
  if (window.parent && window.parent !== window) {
    try {
      const parentDoc = window.parent.document;
      parentDoc.documentElement.setAttribute('data-theme', theme);
      const parentLbl = parentDoc.getElementById('themeLabel');
      if (parentLbl) parentLbl.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
    } catch (e) {}
  }
  // Apply theme to iframe content
  const iframe = document.getElementById('mainFrame');
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.document.documentElement.setAttribute('data-theme', theme);
      const iframeLbl = iframe.contentWindow.document.getElementById('themeLabel');
      if (iframeLbl) iframeLbl.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
    } catch (e) {}
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  // If inside iframe, notify parent to also apply theme
  if (window.parent && window.parent !== window) {
    try { window.parent.applyTheme(newTheme); } catch (e) {}
  }
}

// Apply saved theme on load
(function () {
  applyTheme(localStorage.getItem('theme') || 'light');
})();