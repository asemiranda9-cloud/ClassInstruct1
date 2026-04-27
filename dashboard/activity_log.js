// ── ClassInstruct · activity_log.js ──
(function (global) {
  'use strict';

  const STORAGE_KEY = 'ci_activity_log';
  const MAX_ENTRIES = 50;

  const ICONS = {
    ai_chat:          { emoji: '🤖', gradient: 'linear-gradient(135deg,#6c63ff,#a78bfa)' },
    lesson_plan:      { emoji: '📝', gradient: 'linear-gradient(135deg,#4f46e5,#818cf8)' },
    quiz_generated:   { emoji: '📋', gradient: 'linear-gradient(135deg,#0891b2,#22d3ee)' },
    student_added:    { emoji: '👤', gradient: 'linear-gradient(135deg,#6c63ff,#6366f1)' },
    student_updated:  { emoji: '✏️', gradient: 'linear-gradient(135deg,#6c63ff,#a78bfa)' },
    student_deleted:  { emoji: '🗑️', gradient: 'linear-gradient(135deg,#ef4444,#f87171)' },
    student_imported: { emoji: '📥', gradient: 'linear-gradient(135deg,#6c63ff,#818cf8)' },
    attendance_saved:        { emoji: '✓',  gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
    attendance_present:      { emoji: '✓',  gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
    attendance_late:         { emoji: '⏰', gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
    attendance_absent:       { emoji: '✕',  gradient: 'linear-gradient(135deg,#ef4444,#f87171)' },
    grades_saved:     { emoji: '📋', gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
    subject_added:    { emoji: '📚', gradient: 'linear-gradient(135deg,#3b82f6,#60a5fa)' },
    subject_deleted:  { emoji: '📚', gradient: 'linear-gradient(135deg,#ef4444,#f87171)' },
    calendar_entry:   { emoji: '📅', gradient: 'linear-gradient(135deg,#8b5cf6,#a78bfa)' },
    default:          { emoji: '🔔', gradient: 'linear-gradient(135deg,#6b7280,#9ca3af)' },
  };

  function _read() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }

  function _write(entries) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch {}
  }

  function _relTime(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff <  60)   return 'just now';
    if (diff < 3600)  return Math.floor(diff / 60)   + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600)  + 'h ago';
    const d = Math.floor(diff / 86400);
    return d === 1 ? 'Yesterday' : d + 'd ago';
  }

  const CILog = {

    push(type, title, detail) {
      const entries = _read();
      entries.unshift({
        id:     Date.now() + Math.random(),
        type:   type   || 'default',
        title:  title  || '',
        detail: detail || '',
        ts:     Date.now(),
      });
      _write(entries.slice(0, MAX_ENTRIES));

      // ── Notify the sidebar's mainFrame iframe (dashboard.php) ──
      // Structure: sidebar.html > iframe#mainFrame > [dashboard / attendance / etc.]
      // When attendance.html is in the iframe, window.parent = sidebar.
      // We tell sidebar to forward the message into its mainFrame.
      try {
        const msg = { type: 'CI_ACTIVITY_UPDATE' };
        // If we ARE the iframe page, tell the parent (sidebar) which will relay
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(msg, '*');
        }
        // If we ARE the sidebar (have mainFrame), push directly
        const frame = document.getElementById('mainFrame');
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage(msg, '*');
        }
      } catch { /* cross-origin — ignore */ }
    },

    get(limit = 10) {
      return _read().slice(0, limit).map(e => ({
        ...e,
        icon:     (ICONS[e.type] || ICONS.default).emoji,
        gradient: (ICONS[e.type] || ICONS.default).gradient,
        relTime:  _relTime(e.ts),
      }));
    },

    clear() { _write([]); },
  };

  global.CILog = CILog;
})(window);