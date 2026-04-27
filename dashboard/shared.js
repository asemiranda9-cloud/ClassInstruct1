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

// ── PIN Verification (shared across modules) ─────────────────────────────────
function verifyPin(callback) {
  const storedPin = localStorage.getItem('ci_pin');
  if (!storedPin) {
    // Show warning to set up PIN first
    const warn = document.createElement('div');
    warn.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
    warn.innerHTML = `
      <div style="background:#1e1a4a;border-radius:16px;padding:32px;width:340px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);border:1px solid #2d2a5a;">
        <div style="width:48px;height:48px;background:#3d2e00;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <svg width="24" height="24" fill="none" stroke="#f59e0b" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <h3 style="margin:0 0 8px;font-size:17px;color:#fff;">PIN Not Set</h3>
        <p style="margin:0 0 20px;font-size:13px;color:#a5a0c0;line-height:1.5;">Please set up a PIN in <strong>Settings → Security</strong> before making any changes.</p>
        <button id="ciWarnGo" style="width:100%;padding:11px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">Go to Settings</button>
        <button id="ciWarnClose" style="width:100%;margin-top:8px;padding:11px;background:#3d3a6a;color:#ccc;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">Cancel</button>
      </div>`;
    document.body.appendChild(warn);
    document.getElementById('ciWarnGo').onclick = function() {
      document.body.removeChild(warn);
      // Navigate in the same frame (not top) so it works inside iframe
      window.location.href = '../Settings.html';
    };
    document.getElementById('ciWarnClose').onclick = function() {
      document.body.removeChild(warn);
      callback(false);
    };
    return;
  }

  // Build PIN entry form
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
  overlay.id = 'ciPinOverlay';
  overlay.innerHTML = `
    <div style="background:#1e1a4a;border-radius:16px;padding:32px;width:320px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);border:1px solid #2d2a5a;">
      <h3 style="margin:0 0 20px;font-size:18px;color:#fff;">Enter PIN to Continue</h3>
      <div class="pin-input-row" style="display:flex;gap:10px;justify-content:center;margin-bottom:20px;">
        ${[0,1,2,3].map(i => `<input class="pin-box" id="ciPinVerify_${i}" type="password" inputmode="numeric" maxlength="1" pattern="[0-9]" autocomplete="off" autocorrect="off" spellcheck="false" style="width:52px;height:52px;font-size:24px;text-align:center;border:2px solid #3d3a6a;border-radius:10px;outline:none;background:#2a2760;color:#fff;" oninput="this.value=this.value.replace(/\\D/g,'').slice(-1);if(this.value&&${i}<3)document.getElementById('ciPinVerify_'+(${i}+1)).focus();" onkeydown="if(event.key==='Backspace'&&!this.value&&${i}>0){const p=document.getElementById('ciPinVerify_'+(${i}-1));p.value='';p.focus();}" />`).join('')}
      </div>
      <div id="ciPinError" style="color:#ef4444;font-size:13px;margin-bottom:12px;display:none;">Incorrect PIN. Try again.</div>
      <button id="ciPinConfirm" style="width:100%;padding:12px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Confirm</button>
      <button id="ciPinCancel" style="width:100%;margin-top:8px;padding:12px;background:#3d3a6a;color:#ccc;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Cancel</button>
    </div>`;

  document.body.appendChild(overlay);

  const pinBoxes = [0,1,2,3].map(i => document.getElementById('ciPinVerify_' + i));
  const errorEl = document.getElementById('ciPinError');
  const confirmBtn = document.getElementById('ciPinConfirm');
  const cancelBtn = document.getElementById('ciPinCancel');

  confirmBtn.onclick = function() {
    const entered = pinBoxes.map(b => b.value).join('');
    if (entered.length < 4) { errorEl.style.display = 'block'; return; }
    if (entered !== atob(storedPin)) {
      errorEl.style.display = 'block';
      pinBoxes.forEach(b => { b.value = ''; b.style.borderColor = '#ef4444'; });
      pinBoxes[0].focus();
      setTimeout(() => pinBoxes.forEach(b => b.style.borderColor = '#e5e7eb'), 600);
      return;
    }
    document.body.removeChild(overlay);
    callback(true);
  };

  cancelBtn.onclick = function() {
    document.body.removeChild(overlay);
    callback(false);
  };

  pinBoxes[0].focus();
}

// ── Apply saved theme IMMEDIATELY (prevents light flash on dark mode) ──
(function() {
  var saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  var lbl = document.getElementById('themeLabel');
  if (lbl) lbl.textContent = saved === 'dark' ? 'Dark Mode' : 'Light Mode';
})();