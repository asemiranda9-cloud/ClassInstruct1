'use strict';

// ════════════════════════════════════════════════════════════════════════════
//  CONFIG
// ════════════════════════════════════════════════════════════════════════════
const API = 'attedance_db.php';

// ════════════════════════════════════════════════════════════════════════════
//  DATE SERVICE
//  Single source of truth for all date / quarter logic.
//  To change quarter boundaries → edit QUARTERS only, nothing else.
// ════════════════════════════════════════════════════════════════════════════
const DateService = (function () {

  const MONTHS       = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ── DepEd quarter config ──────────────────────────────────────────────────
  const QUARTERS = [
    { key: 'Q1', label: 'Q1', months: [6, 7, 8],       cssClass: 'q1' },
    { key: 'Q2', label: 'Q2', months: [9, 10],          cssClass: 'q2' },
    { key: 'Q3', label: 'Q3', months: [11, 12, 1],      cssClass: 'q3' },
    { key: 'Q4', label: 'Q4', months: [2, 3, 4, 5],     cssClass: 'q4' },
  ];

  function toYMD(date) {
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function fromYMD(ymd) {
    // Parse as local time by splitting — avoids UTC midnight rollover issues
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function weekStartOf(date) {
    const d   = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function weekEndOf(monday)  { return addDays(monday, 6); }
  function weekDates(monday)  { return Array.from({ length: 7 }, function (_, i) { return addDays(monday, i); }); }
  function todayYMD()         { return toYMD(new Date()); }
  function monthName(idx)     { return MONTHS[idx]; }
  function shortMonth(idx)    { return SHORT_MONTHS[idx]; }

  function formatWeekLabel(monday) {
    const end = weekEndOf(monday);
    const sm  = SHORT_MONTHS[monday.getMonth()];
    const em  = SHORT_MONTHS[end.getMonth()];
    if (monday.getMonth() === end.getMonth()) {
      return sm + ' ' + monday.getDate() + '\u2013' + end.getDate() + ', ' + monday.getFullYear();
    }
    return sm + ' ' + monday.getDate() + ' \u2013 ' + em + ' ' + end.getDate() + ', ' + end.getFullYear();
  }

  function quarterOf(ymd) {
    const month = parseInt(ymd.slice(5, 7), 10);
    return QUARTERS.find(function (q) { return q.months.includes(month); }) || QUARTERS[3];
  }

  function currentQuarter() { return quarterOf(todayYMD()); }

  function calcQCounts(statuses) {
    const counts = {};
    QUARTERS.forEach(function (q) { counts[q.key] = 0; });
    Object.entries(statuses || {}).forEach(function (entry) {
      const st = entry[1];
      if (st === 'present' || st === 'late') counts[quarterOf(entry[0]).key]++;
    });
    return counts;
  }

  function renderQPills(qCounts, schoolDays) {
    schoolDays = schoolDays || { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    const cur    = currentQuarter();
    const curIdx = QUARTERS.indexOf(cur);
    return QUARTERS.map(function (q, i) {
      if (i > curIdx) return '';
      const attended = qCounts[q.key] || 0;
      const total    = schoolDays[q.key] || 0;
      const label    = total > 0 ? attended + '/' + total + ' days' : attended;
      const active   = (q.key === cur.key);
      const cls      = 'q-pill ' + q.cssClass + (active ? ' q-pill--active' : ' q-pill--past');
      return '<span class="' + cls + '" title="' + q.label + ' attended: ' + label + '">' +
        '<span class="q-pill-label">' + q.label + '</span>' +
        '<span class="q-pill-count">' + label + '</span>' +
      '</span>';
    }).join('');
  }

  return {
    toYMD, fromYMD, addDays,
    weekStartOf, weekEndOf, weekDates,
    todayYMD, monthName, shortMonth, formatWeekLabel,
    quarterOf, currentQuarter, calcQCounts, renderQPills,
    QUARTERS,
  };
})();


// ════════════════════════════════════════════════════════════════════════════
//  API LAYER
//  All HTTP I/O lives here. Always returns { data } | { error }.
//  Never throws — callers get a predictable shape every time.
// ════════════════════════════════════════════════════════════════════════════
const Api = (function () {

  function _friendlyError(err) {
    if (!navigator.onLine) return 'No internet connection.';
    if (err && /NetworkError|Failed to fetch/i.test(err.message)) return 'Cannot reach server. Is XAMPP running?';
    return (err && err.message) || 'Unexpected error.';
  }

  async function _get(params) {
    let res;
    try { res = await fetch(API + '?' + new URLSearchParams(params)); }
    catch (e) { return { error: _friendlyError(e) }; }
    if (!res.ok) {
      let body = ''; try { body = await res.text(); } catch (_) {}
      return { error: 'Server ' + res.status + (body ? ': ' + body.slice(0, 120) : '') };
    }
    try { return { data: await res.json() }; }
    catch (_) { return { error: 'Invalid JSON from server.' }; }
  }

  async function _post(body) {
    let res;
    try {
      res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) { return { error: _friendlyError(e) }; }
    try {
      const data = await res.json();
      if (!res.ok || data.error) return { error: data.error || 'Save failed (' + res.status + ')' };
      return { data };
    } catch (_) { return { error: 'Invalid JSON from server.' }; }
  }

  async function _delete(params) {
    let res;
    try { res = await fetch(API + '?' + new URLSearchParams(params), { method: 'DELETE' }); }
    catch (e) { return { error: _friendlyError(e) }; }
    try {
      const data = await res.json();
      if (!res.ok || data.error) return { error: data.error || 'Delete failed (' + res.status + ')' };
      return { data };
    } catch (_) { return { error: 'Invalid JSON from server.' }; }
  }

  // Public API methods

  function getSections() {
    return _get({ action: 'sections' });
  }

  /**
   * Fetch attendance for a date range.
   * PHP endpoint now accepts: ?action=attendance&start=YYYY-MM-DD&end=YYYY-MM-DD
   * grade and section are optional filters.
   * Returns { dates, students, schoolDays }.
   */
  function getAttendance(start, end, grade, section) {
    const params = { action: 'attendance', start, end };
    if (grade)   params.grade   = grade;
    if (section) params.section = section;
    return _get(params);
  }

  /**
   * Bulk-save multiple attendance records in one PUT request.
   * @param {Array<{student_id, date, status}>} records
   */
  function saveRecords(records) {
    return fetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    }).then(function (res) {
      if (!res.ok) return { error: 'Server ' + res.status };
      return res.json().then(function (data) {
        if (data.error) return { error: data.error };
        return { data };
      }).catch(function () { return { error: 'Invalid JSON from server.' }; });
    }).catch(function (e) { return { error: _friendlyError(e) }; });
  }

  function saveRecord(studentId, date, status) {
    return _post({ student_id: studentId, date, status });
  }

  function deleteRecord(studentId, date) {
    return _delete({ student_id: studentId, date });
  }

  /**
   * Fetch DepEd SF2-style monthly report.
   * ?action=monthlyReport&year=YYYY&month=M[&grade=...&section=...]
   */
  function getMonthlyReport(year, month, grade, section) {
    var params = { action: 'monthlyReport', year: year, month: month };
    if (grade)   params.grade   = grade;
    if (section) params.section = section;
    return _get(params);
  }

  return { getSections, getAttendance, saveRecords, saveRecord, deleteRecord, getMonthlyReport };
})();


// ════════════════════════════════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════════════════════════════════
const state = {
  sections:    [],
  sectionId:   'all',
  sectionName: 'All Sections',
  grade:       '',
  section:     '',
  weekStart:   DateService.weekStartOf(new Date()),
  viewMode:    'week',   // 'week' | 'day'
  focusDate:   DateService.toYMD(new Date()),  // the single date shown in daily view
};

let tableData     = { dates: [], students: [], schoolDays: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 } };

// Pending changes queue — flushed to server after 2 s of inactivity or on Save
const pendingChanges = [];          // { studentId, date, next }
let   _debounceTimer = null;


// ════════════════════════════════════════════════════════════════════════════
//  RENDER
//  Every DOM write goes through here — no innerHTML scattered elsewhere.
// ════════════════════════════════════════════════════════════════════════════
const Render = (function () {

  // ── Utilities ─────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
  function getDotStatus(dot) {
    return (Array.from(dot.classList).find(function (c) { return c.startsWith('dot-'); }) || 'dot-none').replace('dot-', '');
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  let _toastTimer = null;
  function toast(msg, type, ms) {
    const el = document.getElementById('saveToast');
    if (!el) return;
    clearTimeout(_toastTimer);
    el.textContent = msg;
    el.className   = 'save-toast toast-' + type;
    if (ms > 0) _toastTimer = setTimeout(function () { el.className = 'save-toast'; }, ms);
  }

  // ── Error banner ──────────────────────────────────────────────────────────
  function errorBanner(msg) {
    const b = document.getElementById('errorBanner');
    const s = document.getElementById('errorMessage');
    if (b && s) { s.textContent = msg; b.style.display = 'flex'; }
  }

  // ── Summary card ──────────────────────────────────────────────────────────
  function summaryCard(sectionTitle, counts) {
    const total     = counts.present + counts.late + counts.absent;
    const rateNum   = total ? Math.round((counts.present + counts.late) / total * 100) : 0;
    const rateColor = rateNum >= 80 ? 'var(--present)' : rateNum >= 60 ? 'var(--late)' : 'var(--absent)';

    document.getElementById('summaryCards').innerHTML =
      '<div class="sc-mini">' +
        '<div class="sc-mini-left">' +
          '<div class="sc-mini-label">' + esc(sectionTitle) + '</div>' +
          '<div class="sc-mini-rate" style="color:' + rateColor + '">' + rateNum + '%</div>' +
          '<div class="sc-mini-caption">Attendance Rate</div>' +
        '</div>' +
        '<div class="sc-mini-pills">' +
          '<div class="sc-mini-pill sc-mini-pill--present">' +
            '<span class="sc-mini-pill-num">' + counts.present + '</span>' +
            '<span class="sc-mini-pill-lbl">Present</span>' +
          '</div>' +
          '<div class="sc-mini-pill sc-mini-pill--late">' +
            '<span class="sc-mini-pill-num">' + counts.late + '</span>' +
            '<span class="sc-mini-pill-lbl">Late</span>' +
          '</div>' +
          '<div class="sc-mini-pill sc-mini-pill--absent">' +
            '<span class="sc-mini-pill-num">' + counts.absent + '</span>' +
            '<span class="sc-mini-pill-lbl">Absent</span>' +
          '</div>' +
          '<div class="sc-mini-pill sc-mini-pill--total">' +
            '<span class="sc-mini-pill-num">' + total + '</span>' +
            '<span class="sc-mini-pill-lbl">Total</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function _tile(type, label, count, pct, svgPath) {
    return '<div class="sc-tile sc-tile--' + type + '">' +
      '<div class="sc-tile-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + svgPath + '</svg></div>' +
      '<div class="sc-tile-body"><div class="sc-tile-num">' + count + '</div><div class="sc-tile-lbl">' + label + '</div></div>' +
      '<div class="sc-tile-pct">' + pct + '%</div>' +
    '</div>';
  }

  function summarySkeleton() {
    document.getElementById('summaryCards').innerHTML =
      '<div class="summary-skeleton"><div class="skeleton-shimmer"></div></div>';
  }

  // ── Row summary cell ──────────────────────────────────────────────────────
  function _rowSummaryHTML(p, l, a, qCounts, schoolDays) {
    // Highlight row if absent count is high (>=3 days this week = flag)
    const weekTotal = p + l + a;
    const highAbsence = weekTotal > 0 && (a / weekTotal) >= 0.4;
    const rootCls = 'summary-cell' + (highAbsence ? ' summary-cell--alert' : '');

    return '<div class="' + rootCls + '">' +
      // Row 1: Weekly contextual P/L/A
      '<div class="sc-row-week">' +
        '<span class="sc-row-badge sc-row-badge--p" title="Present this week"><span class="badge-letter">P</span><b>' + p + '</b></span>' +
        '<span class="sc-row-badge sc-row-badge--l" title="Late this week"><span class="badge-letter">L</span><b>' + l + '</b></span>' +
        '<span class="sc-row-badge sc-row-badge--a' + (a >= 3 ? ' sc-row-badge--a-hi' : '') + '" title="Absent this week"><span class="badge-letter">A</span><b>' + a + '</b></span>' +
      '</div>' +
      // Row 2: Year-to-date Q1–Q4 attended / total school days
      '<div class="sc-row-qpills">' + DateService.renderQPills(qCounts, schoolDays) + '</div>' +
    '</div>';
  }

  /** Re-render only a single row's summary cell in-place */
  function rowSummary(studentId) {
    const student = tableData.students.find(function (s) { return s.id == studentId; });
    if (!student) return;
    const weekSet = new Set(tableData.dates);
    let p = 0, l = 0, a = 0;
    Object.entries(student.statuses || {}).forEach(function (entry) {
      const st = entry[1];
      if (weekSet.has(entry[0])) {
        if      (st === 'present') p++;
        else if (st === 'late')    l++;
        else if (st === 'absent')  a++;
      }
    });
    const qCounts = DateService.calcQCounts(student.statuses);
    const schoolDays = tableData.schoolDays || { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    const row = document.querySelector('#tableBody tr[data-id="' + studentId + '"]');
    if (row) {
      const last = row.querySelector('td:last-child');
      if (last) last.innerHTML = _rowSummaryHTML(p, l, a, qCounts, schoolDays);
    }
  }

  // ── Attendance table ──────────────────────────────────────────────────────
  function attendanceTable() {
    const dates    = tableData.dates;
    const students = tableData.students;
    const todayYMD = DateService.toYMD(new Date());

    document.getElementById('tableHead').innerHTML = '<tr>' +
      '<th scope="col">Student</th>' +
      dates.map(function (d, i) {
        const dt       = DateService.fromYMD(d);
        const isToday  = (d === todayYMD);
        return '<th scope="col" class="th-col" data-date="' + esc(d) + '">' +
          '<div class="th-row">' +
            '<div class="th-day' + (isToday ? ' th-today' : '') + '">' +
              '<span class="th-day-name">' + dt.toLocaleDateString('en-US', { weekday: 'short' }) + '</span>' +
              '<span class="th-day-num">'  + dt.getDate() + '</span>' +
              '<span class="th-day-mon">'  + DateService.shortMonth(dt.getMonth()) + '</span>' +
            '</div>' +
            '<div class="th-actions">' +
              '<button class="th-mark-btn" ' +
                'title="Mark all students for ' + d + '" ' +
                'aria-label="Bulk actions for ' + d + '" ' +
                'aria-haspopup="true" ' +
                'onclick="Actions.toggleMarkAll(event,' + i + ',\'' + esc(d) + '\')">' +
                // Checkmark icon (teacher marks whole column at once)
                '<svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
                  '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>' +
                '</svg>' +
              '</button>' +
              '<div class="dropdown-menu mark-all-menu" id="markAllMenu-' + i + '" style="display:none" role="menu">' +
                '<div class="mark-all-header">' + dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + '</div>' +
                '<button class="mark-all-opt mark-all-present" role="menuitem" onclick="Actions.markAll(\'' + esc(d) + '\',\'present\')">' +
                  '<span class="ctx-dot" style="background:var(--present)"></span>Mark All Present' +
                '</button>' +
                '<button class="mark-all-opt mark-all-late" role="menuitem" onclick="Actions.markAll(\'' + esc(d) + '\',\'late\')">' +
                  '<span class="ctx-dot" style="background:var(--late)"></span>Mark All Late' +
                '</button>' +
                '<button class="mark-all-opt mark-all-absent" role="menuitem" onclick="Actions.markAll(\'' + esc(d) + '\',\'absent\')">' +
                  '<span class="ctx-dot" style="background:var(--absent)"></span>Mark All Absent' +
                '</button>' +
                '<div class="ctx-divider"></div>' +
                '<button class="mark-all-opt mark-all-clear" role="menuitem" onclick="Actions.clearAll(\'' + esc(d) + '\')">' +
                  '<span class="ctx-dot" style="background:#dde1ed"></span>Clear All' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</th>';
      }).join('') +
      '<th scope="col">Summary</th>' +
    '</tr>';

    const tbody = document.getElementById('tableBody');
    const empty = document.getElementById('emptyState');

    if (!students.length) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = students.map(function (s) {
      let p = 0, l = 0, a = 0;
      const qCounts   = DateService.calcQCounts(s.statuses);
      const schoolDays = tableData.schoolDays || { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

      const cells = dates.map(function (d) {
        const status = (s.statuses || {})[d] || 'none';
        if      (status === 'present') p++;
        else if (status === 'late')    l++;
        else if (status === 'absent')  a++;
        const label = status === 'none' ? 'No record' : cap(status);
        return '<td><span class="status-dot dot-' + status + '"' +
          ' title="' + label + ' \u2014 ' + d + '"' +
          ' role="button" tabindex="0"' +
          ' aria-label="' + label + ' on ' + d + '"' +
          ' onclick="Actions.cycleStatus(' + s.id + ',\'' + d + '\',this)"' +
          ' onkeydown="if(event.key===\'Enter\'||event.key===\' \')Actions.cycleStatus(' + s.id + ',\'' + d + '\',this)"' +
          ' oncontextmenu="Actions.openCtxMenu(event,' + s.id + ',\'' + d + '\',this)"></span></td>';
      }).join('');

      const initials = s.full_name.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();

      return '<tr data-id="' + s.id + '" data-name="' + esc(s.full_name.toLowerCase()) + '">' +
        '<td><div class="student-cell">' +
          '<div class="student-ava-fb" aria-hidden="true">' + initials + '</div>' +
          '<span class="student-fullname">' + esc(s.full_name) + '</span>' +
        '</div></td>' +
        cells +
        '<td>' + _rowSummaryHTML(p, l, a, qCounts, schoolDays) + '</td>' +
      '</tr>';
    }).join('');
  }

  function tableLoading() {
    document.getElementById('tableBody').innerHTML =
      '<tr><td colspan="9" class="table-loading" aria-busy="true">' +
      '<span class="loading-spinner"></span>Loading attendance\u2026</td></tr>';
    document.getElementById('tableHead').innerHTML = '';
  }

  function dayViewSkeleton() {
    const dayView = document.getElementById('dayView');
    if (!dayView) return;
    dayView.innerHTML =
      '<div class="day-header">' +
        '<div class="day-header-left"><div class="skeleton-shimmer" style="width:120px;height:20px;border-radius:6px"></div></div>' +
      '</div>' +
      '<div class="day-stat-cards">' +
        [1,2,3,4].map(function () {
          return '<div class="dsc-card"><div class="skeleton-shimmer" style="width:100%;height:60px;border-radius:10px"></div></div>';
        }).join('') +
      '</div>' +
      '<div class="day-student-list">' +
        '<div class="day-list-header"><span>Student</span><span>Status</span></div>' +
        Array.from({ length: 8 }, function () {
          return '<div class="day-student-row">' +
            '<div class="day-student-info">' +
              '<div class="skeleton-shimmer" style="width:32px;height:32px;border-radius:50%;flex-shrink:0"></div>' +
              '<div class="skeleton-shimmer" style="width:140px;height:14px;border-radius:4px"></div>' +
            '</div>' +
            '<div class="skeleton-shimmer" style="width:60px;height:16px;border-radius:20px"></div>' +
          '</div>';
        }).join('') +
      '</div>';
  }

  function tableFatalError(msg) {
    document.getElementById('tableBody').innerHTML =
      '<tr><td colspan="9" class="table-loading" style="color:var(--error)">' + esc(msg) + '</td></tr>';
  }

  // ── Section dropdown ──────────────────────────────────────────────────────
  function sectionDropdown() {
    const dd = document.getElementById('sectionDropdown');
    dd.innerHTML =
      '<button class="' + (state.sectionId === 'all' ? 'selected' : '') + '" onclick="Actions.selectAllSections()">All Sections</button>' +
      state.sections.map(function (s) {
        return '<button class="' + (s.id == state.sectionId ? 'selected' : '') + '"' +
          ' onclick="Actions.selectSection(' + s.id + ',\'' + esc(s.name) + '\',\'' + esc(s.grade) + '\',\'' + esc(s.section) + '\')">' +
          esc(s.name) + '</button>';
      }).join('');
    const lbl = document.getElementById('sectionLabel');
    if (lbl) lbl.textContent = state.sectionName;
  }

  // ── Week calendar ─────────────────────────────────────────────────────────
  let _calYear = null, _calMonth = null;

  function weekLabel() {
    const lbl = document.getElementById('weekLabel');
    if (lbl) lbl.textContent = DateService.formatWeekLabel(state.weekStart);
  }

  function weekCalendar(year, month) {
    _calYear = year; _calMonth = month;
    _renderCalGrid();
  }

  function calShiftMonth(delta) {
    _calMonth += delta;
    if (_calMonth > 11) { _calMonth = 0; _calYear++; }
    if (_calMonth < 0)  { _calMonth = 11; _calYear--; }
    _renderCalGrid();
  }

  /** Update the day-label text shown in daily view header. */
  function dayLabel() {
    const lbl = document.getElementById('dayLabel');
    if (!lbl) return;
    const dt  = DateService.fromYMD(state.focusDate);
    const dow = dt.toLocaleDateString('en-US', { weekday: 'long' });
    const mon = DateService.shortMonth(dt.getMonth());
    lbl.textContent = dow + ' ' + dt.getDate() + ' ' + mon + ', ' + dt.getFullYear();
  }

  /**
   * Switch between week and day views.
   * Hides/shows the week-view section and the day-view section.
   */
  function toggleViewMode(mode) {
    const weekView = document.getElementById('weekView');
    const dayView  = document.getElementById('dayView');
    const tabBtns  = document.querySelectorAll('.view-tab-btn');

    tabBtns.forEach(function (b) {
      b.classList.toggle('view-tab-btn--active', b.dataset.view === mode);
    });

    if (mode === 'day') {
      if (weekView) weekView.style.display = 'none';
      if (dayView)  dayView.style.display  = '';
      dayLabel();
    } else {
      if (weekView) weekView.style.display = '';
      if (dayView)  dayView.style.display  = 'none';
    }
  }

  /** Render the daily view: stat cards + student list for state.focusDate. */
  function renderDayView() {
    const dayView = document.getElementById('dayView');
    if (!dayView) return;
    const students = tableData.students;
    const date     = state.focusDate;
    const todayYMD = DateService.todayYMD();
    const isToday  = date === todayYMD;

    // ── Aggregate stats ────────────────────────────────────────────────────────
    let totalPresent = 0, totalLate = 0, totalAbsent = 0, totalNoRecord = 0;
    const studentRows = students.map(function (s) {
      const status = (s.statuses || {})[date] || 'none';
      if      (status === 'present')  { totalPresent++;  }
      else if (status === 'late')     { totalLate++;     }
      else if (status === 'absent')   { totalAbsent++;   }
      else                             { totalNoRecord++; }

      const initials = s.full_name.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
      const label    = status === 'none' ? 'No record' : cap(status);
      const pct      = tableData.schoolDays
        ? Math.round((s.statuses ? Object.entries(s.statuses).filter(function (e) {
            return (e[1] === 'present' || e[1] === 'late') && DateService.quarterOf(e[0]).key === DateService.quarterOf(date).key;
          }).length : 0) / (tableData.schoolDays[DateService.quarterOf(date).key] || 1) * 100)
        : 0;

      return {
        id: s.id,
        fullName: s.full_name,
        initials: initials,
        status: status,
        label: label,
        pct: pct,
      };
    });

    const totalStudents = students.length;
    const totalRecorded = totalPresent + totalLate + totalAbsent;
    const attendPct = totalRecorded > 0
      ? Math.round((totalPresent + totalLate) / totalRecorded * 100)
      : 0;
    const absentColor = totalAbsent > 0 ? 'var(--absent)' : 'var(--present)';

    const dt  = DateService.fromYMD(date);
    const dow = dt.toLocaleDateString('en-US', { weekday: 'long' });
    const mon = DateService.shortMonth(dt.getMonth());

    dayView.innerHTML =
      // ── Day header ──────────────────────────────────────────────────────────
      '<div class="day-header">' +
        '<div class="day-header-left">' +
          '<div class="day-dow">' + dow + '</div>' +
          '<div class="day-date' + (isToday ? ' day-date--today' : '') + '">' +
            dt.getDate() + ' ' + mon + ' ' + dt.getFullYear() +
          '</div>' +
        '</div>' +
        '<div class="day-nav-btns">' +
          '<button class="day-nav-btn" onclick="Actions.navigateWeek(-1)" title="Previous day" aria-label="Previous day">' +
            '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>' +
          '</button>' +
          '<button class="day-today-btn" onclick="Actions.calGoToday()" aria-label="Go to today">Today</button>' +
          '<button class="day-nav-btn" onclick="Actions.navigateWeek(1)" title="Next day" aria-label="Next day">' +
            '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +

      // ── Stat cards ─────────────────────────────────────────────────────────
      '<div class="day-stat-cards">' +
        '<div class="dsc-card dsc-card--present">' +
          '<div class="dsc-card-icon">' +
            '<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' +
          '</div>' +
          '<div class="dsc-card-body">' +
            '<div class="dsc-card-num">' + totalPresent + '</div>' +
            '<div class="dsc-card-lbl">Present</div>' +
          '</div>' +
        '</div>' +
        '<div class="dsc-card dsc-card--late">' +
          '<div class="dsc-card-icon">' +
            '<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
          '</div>' +
          '<div class="dsc-card-body">' +
            '<div class="dsc-card-num">' + totalLate + '</div>' +
            '<div class="dsc-card-lbl">Late</div>' +
          '</div>' +
        '</div>' +
        '<div class="dsc-card dsc-card--absent">' +
          '<div class="dsc-card-icon">' +
            '<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' +
          '</div>' +
          '<div class="dsc-card-body">' +
            '<div class="dsc-card-num">' + totalAbsent + '</div>' +
            '<div class="dsc-card-lbl">Absent</div>' +
          '</div>' +
        '</div>' +
        '<div class="dsc-card dsc-card--pct">' +
          '<div class="dsc-card-icon">' +
            '<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' +
          '</div>' +
          '<div class="dsc-card-body">' +
            '<div class="dsc-card-num">' + attendPct + '%</div>' +
            '<div class="dsc-card-lbl">Attendance %</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // ── Student list ───────────────────────────────────────────────────────
      '<div class="day-student-list">' +
        '<div class="day-list-header">' +
          '<span>Student</span>' +
          '<span>Status</span>' +
        '</div>' +
        (students.length === 0
          ? '<div class="day-empty">No students found for this section.</div>'
          : studentRows.map(function (row) {
              return '<div class="day-student-row' + (row.status === 'absent' ? ' day-student-row--absent' : '') + '">' +
                '<div class="day-student-info">' +
                  '<div class="student-ava-fb" aria-hidden="true">' + row.initials + '</div>' +
                  '<span class="student-fullname">' + esc(row.fullName) + '</span>' +
                '</div>' +
                '<div class="day-status-cell">' +
                  '<span class="status-dot dot-' + row.status + '"' +
                    ' role="button" tabindex="0"' +
                    ' title="' + row.label + ' \u2014 ' + date + '"' +
                    ' aria-label="' + row.label + ' on ' + date + '"' +
                    ' onclick="Actions.cycleStatus(' + row.id + ',\'' + date + '\',this)"' +
                    ' onkeydown="if(event.key===\'Enter\'||event.key===\' \')Actions.cycleStatus(' + row.id + ',\'' + date + '\',this)"' +
                    ' oncontextmenu="Actions.openCtxMenu(event,' + row.id + ',\'' + date + '\',this)"></span>' +
                  '<span class="day-status-label">' + row.label + '</span>' +
                '</div>' +
              '</div>';
            }).join('')
        ) +
      '</div>';
  }

  function _renderCalGrid() {
    const dd          = document.getElementById('weekDropdown');
    const todayYMD    = DateService.todayYMD();
    const wsYMD       = DateService.toYMD(state.weekStart);
    const weYMD       = DateService.toYMD(DateService.weekEndOf(state.weekStart));
    const firstDay    = new Date(_calYear, _calMonth, 1);
    const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
    let   startOffset = firstDay.getDay();
    startOffset       = startOffset === 0 ? 6 : startOffset - 1;

    const title     = DateService.monthName(_calMonth) + ' ' + _calYear;
    const dayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    let cells = '';

    for (let i = 0; i < startOffset; i++) {
      const pd = new Date(_calYear, _calMonth, 1 - (startOffset - i));
      cells += _calBtn(DateService.toYMD(pd), pd.getDate(), wsYMD, weYMD, todayYMD, true);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(_calYear, _calMonth, d);
      cells += _calBtn(DateService.toYMD(dt), d, wsYMD, weYMD, todayYMD, false);
    }
    const rem = (startOffset + daysInMonth) % 7;
    if (rem > 0) {
      for (let d = 1; d <= 7 - rem; d++) {
        const nd = new Date(_calYear, _calMonth + 1, d);
        cells += _calBtn(DateService.toYMD(nd), d, wsYMD, weYMD, todayYMD, true);
      }
    }

    dd.innerHTML =
      '<div class="cal-header">' +
        '<button class="cal-nav-btn" onclick="Render.calShiftMonth(-1);event.stopPropagation()" title="Previous month">' +
          '<svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>' +
        '</button>' +
        '<span class="cal-header-title">' + title + '</span>' +
        '<button class="cal-nav-btn" onclick="Render.calShiftMonth(1);event.stopPropagation()" title="Next month">' +
          '<svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="cal-weekdays">' + dayLabels.map(function (l) { return '<div class="cal-weekday">' + l + '</div>'; }).join('') + '</div>' +
      '<div class="cal-grid">' + cells + '</div>' +
      '<div class="cal-footer">' +
        '<button class="cal-footer-btn" onclick="Actions.navigateWeek(-1);event.stopPropagation()">‹ Prev Week</button>' +
        '<button class="cal-today-btn"  onclick="Actions.calGoToday();event.stopPropagation()">Today</button>' +
        '<button class="cal-footer-btn" onclick="Actions.navigateWeek(1);event.stopPropagation()">Next Week ›</button>' +
      '</div>';
  }

  function _calBtn(ymd, dayNum, wsYMD, weYMD, todayYMD, otherMonth) {
    const wStart = DateService.toYMD(DateService.weekStartOf(DateService.fromYMD(ymd)));
    const inWeek = ymd >= wsYMD && ymd <= weYMD;
    let cls = 'cal-day';
    if (otherMonth)       cls += ' cal-day-other-month';
    if (inWeek)           cls += ' cal-day-in-week';
    if (ymd === todayYMD) cls += ' cal-day-today';
    if (ymd === wsYMD)    cls += ' cal-day-week-start';
    if (ymd === weYMD)    cls += ' cal-day-week-end';
    return '<button class="' + cls + '" onclick="Actions.selectWeek(\'' + wStart + '\');event.stopPropagation()">' + dayNum + '</button>';
  }

  // ── Dot helpers ───────────────────────────────────────────────────────────
  function dotSaving(dot)    { dot.classList.add('dot-saving'); }
  function dotClear(dot)     { dot.classList.remove('dot-saving'); }
  function dotFlashError(dot) {
    dot.classList.remove('dot-saving');
    dot.classList.add('dot-save-error');
    setTimeout(function () { dot.classList.remove('dot-save-error'); }, 800);
  }

  // ── Monthly Report Modal ─────────────────────────────────────────────────
  var _prevModal = null;

  function reportModal(opts) {
    // Remove existing modal
    var existing = document.getElementById('reportModal');
    if (existing) existing.remove();

    if (!opts) return;

    var overlay = document.createElement('div');
    overlay.id = 'reportModal';
    overlay.className = 'report-modal-card';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Monthly Attendance Report');

    var html = '';

    if (opts.loading) {
      html =
        '<div class="modal-header">' +
          '<h2 class="modal-title">Monthly Attendance Report</h2>' +
          '<p class="modal-subtitle">' + (opts.month ? DateService.monthName(opts.month - 1) + ' ' + opts.year : '') + '</p>' +
          '<button class="modal-close" onclick="Actions.closeReportModal()" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="modal-loading"><span class="loading-spinner"></span>Generating report\u2026</div>' +
        '</div>';
    } else if (opts.error) {
      html =
        '<div class="modal-header">' +
          '<h2 class="modal-title">Monthly Attendance Report</h2>' +
          '<button class="modal-close" onclick="Actions.closeReportModal()" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<p class="modal-error">' + esc(opts.error) + '</p>' +
        '</div>';
    } else {
      var d   = opts.data;
      var pctColor = d.monthlyAttendPct >= 80 ? 'var(--present)' : d.monthlyAttendPct >= 60 ? 'var(--late)' : 'var(--absent)';

      html =
        // Header
        '<div class="modal-header">' +
          '<div>' +
            '<h2 class="modal-title">Monthly Attendance Report</h2>' +
            '<p class="modal-subtitle">' + d.monthName + ' ' + d.year + (d.sections[0] ? ' \u2014 ' + d.sections[0].name : '') + '</p>' +
          '</div>' +
          '<div class="modal-header-actions">' +
            '<button class="toolbar-btn modal-print-btn" onclick="window.print()">' +
              '<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>' +
              '</svg> Print / Save PDF' +
            '</button>' +
            '<button class="modal-close" onclick="Actions.closeReportModal()" aria-label="Close">&times;</button>' +
          '</div>' +
        '</div>' +

        // Summary strip
        '<div class="modal-summary-strip">' +
          '<div class="mss-item">' +
            '<div class="mss-num">' + d.schoolDaysInMonth + '</div>' +
            '<div class="mss-lbl">School Days</div>' +
          '</div>' +
          '<div class="mss-item">' +
            '<div class="mss-num">' + d.totalStudents + '</div>' +
            '<div class="mss-lbl">Enrollees</div>' +
          '</div>' +
          '<div class="mss-item">' +
            '<div class="mss-num">' + d.ada + '</div>' +
            '<div class="mss-lbl">Avg Daily Attendance</div>' +
          '</div>' +
          '<div class="mss-item">' +
            '<div class="mss-num" style="color:' + pctColor + '">' + d.monthlyAttendPct + '%</div>' +
            '<div class="mss-lbl">% Attendance</div>' +
          '</div>' +
        '</div>' +

        // Detailed breakdown
        '<div class="modal-body">' +
          '<table class="modal-table">' +
            '<thead>' +
              '<tr>' +
                '<th>Section</th>' +
                '<th class="num-col">P</th>' +
                '<th class="num-col">L</th>' +
                '<th class="num-col">A</th>' +
                '<th class="num-col">ADA</th>' +
                '<th class="num-col">%</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>';

      d.sections.forEach(function (s) {
        var rowPctColor = s.attendPct >= 80 ? 'var(--present)' : s.attendPct >= 60 ? 'var(--late)' : 'var(--absent)';
        html +=
              '<tr>' +
                '<td class="sec-name">' + esc(s.name) + '</td>' +
                '<td class="num-col p-cell">' + s.present + '</td>' +
                '<td class="num-col l-cell">' + s.late + '</td>' +
                '<td class="num-col a-cell">' + s.absent + '</td>' +
                '<td class="num-col ada-cell">' + s.ada + '</td>' +
                '<td class="num-col pct-cell" style="color:' + rowPctColor + ';font-weight:700">' + s.attendPct + '%</td>' +
              '</tr>';
      });

      html +=
            '</tbody>' +
            '<tfoot>' +
              '<tr class="modal-total-row">' +
                '<td>TOTAL / AVERAGE</td>' +
                '<td class="num-col p-cell"><b>' + d.present + '</b></td>' +
                '<td class="num-col l-cell"><b>' + d.late + '</b></td>' +
                '<td class="num-col a-cell"><b>' + d.absent + '</b></td>' +
                '<td class="num-col ada-cell"><b>' + d.ada + '</b></td>' +
                '<td class="num-col pct-cell" style="color:' + pctColor + ';font-weight:800">' + d.monthlyAttendPct + '%</td>' +
              '</tr>' +
            '</tfoot>' +
          '</table>' +
          '<p class="modal-footnote">' +
            '* ADA = Average Daily Attendance  \u00b7  % = (Present + Late) / Total Records \u00d7 100' +
          '</p>' +
        '</div>';
    }

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) Actions.closeReportModal();
    });
    // Close on Escape
    document.addEventListener('keydown', function _escHandler(e) {
      if (e.key === 'Escape') { Actions.closeReportModal(); document.removeEventListener('keydown', _escHandler); }
    });
  }

  return {
    esc, cap, getDotStatus,
    toast, errorBanner,
    summaryCard, summarySkeleton,
    rowSummary,
    attendanceTable, tableLoading, tableFatalError,
    sectionDropdown,
    weekLabel, weekCalendar, calShiftMonth,
    dotSaving, dotClear, dotFlashError,

    reportModal,
    toggleViewMode, dayLabel, renderDayView, dayViewSkeleton,
  };
})();


// ════════════════════════════════════════════════════════════════════════════
//  ACTIONS
//  Every user interaction and async flow lives here.
//  Pattern: optimistic UI update → API call → rollback on error.
// ════════════════════════════════════════════════════════════════════════════
const Actions = (function () {

  // ── Data loading ──────────────────────────────────────────────────────────

  async function loadAll() {
    if (state.viewMode === 'day') {
      Render.dayViewSkeleton();
    } else {
      Render.summarySkeleton();
      Render.tableLoading();
    }

    // In day mode, fetch a 14-day window centred on focusDate so ±1 week navigation
    // always has data. In week mode, fetch the full 7-day week as before.
    let start, end;
    if (state.viewMode === 'day') {
      const focus = DateService.fromYMD(state.focusDate);
      start = DateService.toYMD(DateService.addDays(focus, -7));
      end   = DateService.toYMD(DateService.addDays(focus,  7));
    } else {
      start = DateService.toYMD(state.weekStart);
      end   = DateService.toYMD(DateService.weekEndOf(state.weekStart));
    }

    const result = await Api.getAttendance(
      start, end,
      state.sectionId === 'all' ? '' : state.grade,
      state.sectionId === 'all' ? '' : state.section
    );

    if (result.error) {
      Render.errorBanner('Could not load attendance: ' + result.error);
      Render.tableFatalError(result.error);
      return;
    }

    tableData = {
      dates:      result.data.dates,
      students:   result.data.students,
      schoolDays: (result.data.schoolDays || { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }),
    };

    if (state.viewMode === 'day') {
      Render.renderDayView();
    } else {
      Render.attendanceTable();
      _refreshSummary();
    }
  }

  function _refreshSummary() {
    if (!tableData.students.length) return;
    const todayYMD = DateService.todayYMD();
    const counts   = { present: 0, late: 0, absent: 0 };
    tableData.students.forEach(function (s) {
      const st = (s.statuses || {})[todayYMD];
      if      (st === 'present') counts.present++;
      else if (st === 'late')    counts.late++;
      else if (st === 'absent')  counts.absent++;
    });
    Render.summaryCard(state.sectionId === 'all' ? 'All Sections' : state.sectionName, counts);
  }

  // ── Section ───────────────────────────────────────────────────────────────

  async function selectAllSections() {
    state.sectionId = 'all'; state.sectionName = 'All Sections';
    state.grade = ''; state.section = '';
    _closeDropdown('sectionDropdown');
    Render.sectionDropdown();
    await loadAll();
  }

  async function selectSection(id, name, grade, section) {
    state.sectionId = id; state.sectionName = name;
    state.grade = grade; state.section = section;
    _closeDropdown('sectionDropdown');
    Render.sectionDropdown();
    await loadAll();
  }

  // ── View mode ─────────────────────────────────────────────────────────────

  function toggleViewMode(mode) {
    if (state.viewMode === mode) return;
    state.viewMode = mode;
    if (mode === 'day') {
      state.focusDate = DateService.toYMD(state.weekStart);
    }
    Render.toggleViewMode(mode);
    loadAll();
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  /** Unified nav: jumps by 1 day in day mode, 7 days in week mode. */
  async function navigateWeek(delta) {
    if (state.viewMode === 'day') {
      state.focusDate = DateService.toYMD(DateService.addDays(DateService.fromYMD(state.focusDate), delta));
      Render.dayLabel();
      await loadAll();
    } else {
      state.weekStart = DateService.addDays(state.weekStart, delta * 7);
      Render.weekLabel();
      Render.weekCalendar(state.weekStart.getFullYear(), state.weekStart.getMonth());
      await loadAll();
    }
  }

  async function selectWeek(ymd) {
    // Normalise to Monday
    state.weekStart = DateService.weekStartOf(DateService.fromYMD(ymd));
    _closeDropdown('weekDropdown');
    if (state.viewMode === 'day') {
      state.focusDate = ymd;
      Render.dayLabel();
    }
    Render.weekLabel();
    await loadAll();
  }

  async function calGoToday() {
    state.weekStart = DateService.weekStartOf(new Date());
    state.focusDate = DateService.toYMD(new Date());
    _closeDropdown('weekDropdown');
    Render.weekLabel();
    Render.weekCalendar(state.weekStart.getFullYear(), state.weekStart.getMonth());
    if (state.viewMode === 'day') Render.dayLabel();
    await loadAll();
  }

  // ── Batch-persist queue ───────────────────────────────────────────────────

  const DEBOUNCE_MS = 2000;

  /** Add a change to the queue and schedule a flush. */
  function _enqueueChange(studentId, date, next) {
    // Deduplicate: keep only the latest change per (studentId, date)
    const idx = pendingChanges.findIndex(function (c) {
      return c.studentId === studentId && c.date === date;
    });
    if (idx >= 0) pendingChanges.splice(idx, 1);
    pendingChanges.push({ studentId, date, next });
    _scheduleFlush();
    _renderSaveBtn();
  }

  /** Schedule a debounced flush; cancels any pending timer. */
  function _scheduleFlush() {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(_flushPendingChanges, DEBOUNCE_MS);
  }

  /** Cancel any pending debounced flush (e.g., user clicks Save manually). */
  function _cancelFlush() {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }

  /** Persist all queued changes in a single PUT, then clear the queue. */
  async function _flushPendingChanges() {
    _debounceTimer = null;
    if (!pendingChanges.length) return;

    // Split into upserts (present/late/absent) and deletes (none)
    var upserts = [];
    var deletes = [];
    pendingChanges.forEach(function (c) {
      if (c.next === 'none') deletes.push(c);
      else upserts.push({ student_id: c.studentId, date: c.date, status: c.next });
    });

    var total = pendingChanges.length;
    pendingChanges.length = 0;
    _renderSaveBtn();
    Render.toast('Saving ' + total + '\u2026', 'saving', 0);

    var hasError = false;

    if (upserts.length) {
      var ures = await Api.saveRecords(upserts);
      if (ures.error) {
        hasError = true;
        Render.toast('Save failed: ' + ures.error, 'error', 4000);
      } else {
        Render.toast('Saved ' + upserts.length + ' record' + (upserts.length > 1 ? 's' : '') + ' \u2713', 'success', 2000);
      }
    }

    if (deletes.length) {
      for (var di = 0; di < deletes.length; di++) {
        var dres = await Api.deleteRecord(deletes[di].studentId, deletes[di].date);
        if (dres.error) { hasError = true; }
      }
      if (!hasError) {
        Render.toast('Cleared ' + deletes.length + ' record' + (deletes.length > 1 ? 's' : '') + ' \u2713', 'success', 2000);
      }
    }

    if (!hasError) _refreshSummary();
  }

  /**
   * Force an immediate flush — called by the Save button.
   * Cancels the debounce timer so we don't wait.
   */
  async function saveAllPending() {
    _cancelFlush();
    await _flushPendingChanges();
  }

  // ── Bulk mark per column ───────────────────────────────────────────────────

  /** Toggle the mark-all dropdown for column index i (closes others). */
  function toggleMarkAll(e, i, date) {
    e.stopPropagation();
    document.querySelectorAll('.mark-all-menu').forEach(function (m) { m.style.display = 'none'; });
    var menu = document.getElementById('markAllMenu-' + i);
    if (!menu) return;
    var isOpen = menu.style.display !== 'none';
    menu.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      var btn = menu.previousElementSibling;
      if (btn) {
        var btnRect = btn.getBoundingClientRect();
        menu.style.left = '0';
        menu.style.top  = (btnRect.bottom + 4) + 'px';
      }
    }
  }

  /** Apply a status to ALL students for a given date. */
  function markAll(date, status) {
    document.querySelectorAll('.mark-all-menu').forEach(function (m) { m.style.display = 'none'; });
    var changed = 0;
    tableData.students.forEach(function (student) {
      var colIdx = tableData.dates.indexOf(date) + 2; // +2: col1=Student + 1-based nth-child
      var dot    = document.querySelector(
        '#tableBody tr[data-id="' + student.id + '"] td:nth-child(' + colIdx + ') .status-dot'
      );
      if (!dot) return;
      var prev = Render.getDotStatus(dot);
      if (prev === status) return;
      _applyStatus(student.id, date, dot, status);
      _enqueueChange(student.id, date, status);
      changed++;
    });
    if (changed > 0) {
      Render.toast('Marked ' + changed + ' student' + (changed > 1 ? 's' : '') + ' as ' + status, 'success', 2000);
    }
  }

  /** Clear the status for ALL students on a given date. */
  function clearAll(date) {
    document.querySelectorAll('.mark-all-menu').forEach(function (m) { m.style.display = 'none'; });
    var cleared = 0;
    tableData.students.forEach(function (student) {
      var colIdx = tableData.dates.indexOf(date) + 2;
      var dot    = document.querySelector(
        '#tableBody tr[data-id="' + student.id + '"] td:nth-child(' + colIdx + ') .status-dot'
      );
      if (!dot) return;
      var prev = Render.getDotStatus(dot);
      if (prev === 'none') return;
      _applyStatus(student.id, date, dot, 'none');
      _enqueueChange(student.id, date, 'none');
      cleared++;
    });
    if (cleared > 0) {
      Render.toast('Cleared ' + cleared + ' record' + (cleared > 1 ? 's' : ''), 'success', 2000);
    }
  }

  function pendingCount() { return pendingChanges.length; }

  // ── Monthly Report Modal ─────────────────────────────────────────────────

  /** Open the DepEd Monthly Report modal for the currently selected year/month/section. */
  async function openMonthlyReport() {
    var year   = state.weekStart.getFullYear();
    var month  = state.weekStart.getMonth() + 1;
    var grade  = state.sectionId === 'all' ? '' : state.grade;
    var sect   = state.sectionId === 'all' ? '' : state.section;

    Render.reportModal({ loading: true, year: year, month: month });

    var result = await Api.getMonthlyReport(year, month, grade, sect);
    if (result.error) {
      Render.reportModal({ error: result.error });
    } else {
      Render.reportModal({ data: result.data });
    }
  }

  /** Dismiss the report modal. */
  function closeReportModal() {
    var m = document.getElementById('reportModal');
    if (m) m.remove();
  }

  /** Show / hide the Save button based on queue depth. */
  function _renderSaveBtn() {
    const btn = document.getElementById('saveChangesBtn');
    if (!btn) return;
    const n = pendingChanges.length;
    if (n === 0) {
      btn.style.display = 'none';
    } else {
      btn.style.display = '';
      btn.textContent = 'Save Changes' + (n > 1 ? ' (' + n + ')' : '');
    }
  }

  // ── Status mutation — optimistic UI, queued for batch persist ─────────────

  const STATUS_CYCLE = { none: 'present', present: 'late', late: 'absent', absent: 'present' };

  function cycleStatus(studentId, date, dot) {
    const prev = Render.getDotStatus(dot);
    const next = STATUS_CYCLE[prev] || 'present';
    _applyStatus(studentId, date, dot, next);
    _enqueueChange(studentId, date, next);
  }

  async function setStatus(status) {
    if (!_ctx) return;
    const { studentId, date, dot } = _ctx;
    const prev = Render.getDotStatus(dot);
    closeCtxMenu();
    _applyStatus(studentId, date, dot, status);
    _enqueueChange(studentId, date, status);
  }

  async function clearStatus() {
    if (!_ctx) return;
    const { studentId, date, dot } = _ctx;
    const prev = Render.getDotStatus(dot);
    closeCtxMenu();
    _applyStatus(studentId, date, dot, 'none');
    Render.dotSaving(dot);
    Render.toast('Clearing\u2026', 'saving', 0);

    const result = await Api.deleteRecord(studentId, date);
    Render.dotClear(dot);

    if (result.error) {
      Render.dotFlashError(dot);
      _applyStatus(studentId, date, dot, prev);   // rollback
      Render.toast('Delete failed: ' + result.error, 'error', 4000);
    } else {
      Render.toast('Cleared \u2713', 'success', 2000);
      _refreshSummary();
    }
  }

  /** Write a status change into both the DOM and tableData (optimistic, no server call). */
  function _applyStatus(studentId, date, dot, status) {
    dot.className = 'status-dot dot-' + status;
    dot.title     = (status === 'none' ? 'No record' : Render.cap(status)) + ' \u2014 ' + date;
    dot.setAttribute('aria-label', (status === 'none' ? 'No record' : Render.cap(status)) + ' on ' + date);

    const student = tableData.students.find(function (s) { return s.id == studentId; });
    if (student) {
      if (status === 'none') delete student.statuses[date];
      else student.statuses[date] = status;
    }
    Render.rowSummary(studentId);
    _refreshSummary();
    if (state.viewMode === 'day') Render.renderDayView();
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  let _ctx = null;

  function openCtxMenu(e, studentId, date, dot) {
    e.preventDefault();
    closeCtxMenu();
    _ctx = { studentId, date, dot };
    const cur = Render.getDotStatus(dot);
    function chk(s) { return s === cur ? ' \u2713' : ''; }

    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.id        = 'ctxMenu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML =
      '<div class="ctx-menu-header">' + Render.esc(date) + '</div>' +
      '<button role="menuitem" onclick="Actions.setStatus(\'present\')"><span class="ctx-dot" style="background:var(--present)"></span>Present' + chk('present') + '</button>' +
      '<button role="menuitem" onclick="Actions.setStatus(\'late\')"   ><span class="ctx-dot" style="background:var(--late)"></span>Late'       + chk('late')    + '</button>' +
      '<button role="menuitem" onclick="Actions.setStatus(\'absent\')" ><span class="ctx-dot" style="background:var(--absent)"></span>Absent'   + chk('absent')  + '</button>' +
      '<div class="ctx-divider"></div>' +
      '<button role="menuitem" class="ctx-delete" onclick="Actions.clearStatus()"><span class="ctx-dot" style="background:#e2e8f0"></span>Clear record</button>';

    menu.style.left = Math.min(e.clientX, window.innerWidth  - 170) + 'px';
    menu.style.top  = Math.min(e.clientY, window.innerHeight - 200) + 'px';
    document.body.appendChild(menu);
  }

  function closeCtxMenu() {
    const m = document.getElementById('ctxMenu');
    if (m) m.remove();
    _ctx = null;
  }

  // ── Misc ──────────────────────────────────────────────────────────────────

  function filterStudents(q) {
    const lower = (q || '').toLowerCase();
    document.querySelectorAll('#tableBody tr[data-name]').forEach(function (row) {
      row.style.display = row.dataset.name.includes(lower) ? '' : 'none';
    });
  }

  function dismissError() {
    const b = document.getElementById('errorBanner');
    if (b) b.style.display = 'none';
  }

  function _closeDropdown(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  return {
    loadAll,
    selectAllSections, selectSection,
    navigateWeek, selectWeek, calGoToday,
    cycleStatus, setStatus, clearStatus,
    openCtxMenu, closeCtxMenu,
    filterStudents, dismissError,
    saveAllPending, pendingCount,
    markAll, clearAll, toggleMarkAll,
    toggleViewMode,
    openMonthlyReport, closeReportModal,
  };
})();


// ════════════════════════════════════════════════════════════════════════════
//  GLOBAL EVENT LISTENERS
// ════════════════════════════════════════════════════════════════════════════
function toggleDropdown(id) {
  const el     = document.getElementById(id);
  const isOpen = el.style.display !== 'none';
  document.querySelectorAll('.dropdown-menu').forEach(function (d) { d.style.display = 'none'; });
  if (!isOpen) el.style.display = 'block';
}

document.addEventListener('click', function (e) {
  if (!e.target.closest('.toolbar-group') && !e.target.closest('.dropdown-menu')) {
    document.querySelectorAll('.dropdown-menu').forEach(function (d) { d.style.display = 'none'; });
  }
});
document.addEventListener('click',   Actions.closeCtxMenu);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') Actions.closeCtxMenu(); });


// ════════════════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════════════════
async function init() {
  try {
  const result = await Api.getSections();

  if (result.error) {
    Render.errorBanner('Could not load sections. ' + result.error);
    Render.tableFatalError('Could not load sections: ' + result.error);
    return;
  }

  state.sections = result.data;

  if (!state.sections.length) {
    Render.errorBanner('No sections found. Add students to the database first.');
    Render.tableFatalError('No sections found.');
    return;
  }

  Render.sectionDropdown();
  Render.weekLabel();
  Render.weekCalendar(state.weekStart.getFullYear(), state.weekStart.getMonth());
  await Actions.loadAll();
  } catch (err) {
    console.error('Init error:', err);
    Render.errorBanner('An unexpected error occurred. Check the browser console.');
    Render.tableFatalError(String(err));
  }
}

init();