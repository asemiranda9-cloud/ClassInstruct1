'use strict';

const API = 'attedance_db.php';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const SHORT_MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'
];

// ════════════════════════════════════════════════════
//  DATE HELPERS
// ════════════════════════════════════════════════════
function weekStart(date) {
  const d   = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function weekDates(startMonday) {
  return Array.from({ length: 7 }, function(_, i) { return addDays(startMonday, i); });
}

function fmtWeekLabel(startMonday) {
  const end = addDays(startMonday, 6);
  const sm  = SHORT_MONTHS[startMonday.getMonth()];
  const em  = SHORT_MONTHS[end.getMonth()];
  if (startMonday.getMonth() === end.getMonth()) {
    return sm + ' ' + startMonday.getDate() + '\u2013' + end.getDate() + ', ' + startMonday.getFullYear();
  }
  return sm + ' ' + startMonday.getDate() + ' \u2013 ' + em + ' ' + end.getDate() + ', ' + end.getFullYear();
}

// ════════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════════
const state = {
  sections:      [],
  sectionId:     1,
  sectionName:   '',
  grade:         '',
  section:       '',
  weekStartDate: weekStart(new Date()),
};

// ════════════════════════════════════════════════════
//  API
// ════════════════════════════════════════════════════
async function apiFetch(params) {
  const res = await fetch(API + '?' + new URLSearchParams(params));
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════
async function init() {
  try {
    state.sections = await apiFetch({ action: 'sections' });
    // Default to "All Sections" — grade/section stay empty
    state.sectionId   = 'all';
    state.sectionName = 'All Sections';
    state.grade       = '';
    state.section     = '';
    buildSectionDropdown();
    buildWeekDropdown();
    await Promise.all([loadSummary(), loadAttendance()]);
  } catch (e) {
    showError('Could not connect to the database. Is XAMPP running?\n' + e.message);
  }
}

// ════════════════════════════════════════════════════
//  DROPDOWNS
// ════════════════════════════════════════════════════
function toggleDropdown(id) {
  const el     = document.getElementById(id);
  const isOpen = el.style.display !== 'none';
  document.querySelectorAll('.dropdown-menu').forEach(function(d) { d.style.display = 'none'; });
  if (!isOpen) el.style.display = 'block';
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.toolbar-group') && !e.target.closest('.dropdown-menu')) {
    document.querySelectorAll('.dropdown-menu').forEach(function(d) { d.style.display = 'none'; });
  }
});

function buildSectionDropdown() {
  const dd = document.getElementById('sectionDropdown');
  dd.innerHTML =
    '<button class="' + (state.sectionId === 'all' ? 'selected' : '') + '" onclick="selectAllSections()">All Sections</button>' +
    state.sections.map(function(s) {
      return '<button class="' + (s.id == state.sectionId ? 'selected' : '') + '"' +
        ' onclick="selectSection(' + s.id + ',\'' + esc(s.name) + '\',\'' + esc(s.grade) + '\',\'' + esc(s.section) + '\')">' +
        esc(s.name) + '</button>';
    }).join('');
  const lbl = document.getElementById('sectionLabel');
  if (lbl) lbl.textContent = state.sectionName || 'All Sections';
}

async function selectAllSections() {
  state.sectionId   = 'all';
  state.sectionName = 'All Sections';
  state.grade       = '';
  state.section     = '';
  document.getElementById('sectionLabel').textContent = 'All Sections';
  document.getElementById('sectionDropdown').style.display = 'none';
  buildSectionDropdown();
  await Promise.all([loadSummary(), loadAttendance()]);
}

async function selectSection(id, name, grade, section) {
  state.sectionId   = id;
  state.sectionName = name;
  state.grade       = grade;
  state.section     = section;
  document.getElementById('sectionLabel').textContent = name;
  document.getElementById('sectionDropdown').style.display = 'none';
  buildSectionDropdown();
  await Promise.all([loadSummary(), loadAttendance()]);
}

// ════════════════════════════════════════════════════
//  WEEK CALENDAR PICKER
// ════════════════════════════════════════════════════
let calViewYear  = state.weekStartDate.getFullYear();
let calViewMonth = state.weekStartDate.getMonth();

function buildWeekDropdown() {
  updateWeekLabel();
  calViewYear  = state.weekStartDate.getFullYear();
  calViewMonth = state.weekStartDate.getMonth();
  renderWeekCalendar();
}

function updateWeekLabel() {
  const lbl = document.getElementById('weekLabel');
  if (lbl) lbl.textContent = fmtWeekLabel(state.weekStartDate);
}

function renderWeekCalendar() {
  const dd        = document.getElementById('weekDropdown');
  const today = new Date();
  const todayYMD  = toYMD(today);
  const wsYMD     = toYMD(state.weekStartDate);
  const weYMD     = toYMD(addDays(state.weekStartDate, 6));

  const firstDay    = new Date(calViewYear, calViewMonth, 1);
  const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
  let startOffset   = firstDay.getDay();
  startOffset       = startOffset === 0 ? 6 : startOffset - 1; // Mon-based

  const title     = MONTHS[calViewMonth] + ' ' + calViewYear;
  const dayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  let cells = '';

  // Prev-month overflow
  for (let i = 0; i < startOffset; i++) {
    const prevDate = new Date(calViewYear, calViewMonth, 1 - (startOffset - i));
    const wStart   = toYMD(weekStart(prevDate));
    cells += '<button class="cal-day cal-day-other-month" onclick="selectWeek(\'' + wStart + '\');event.stopPropagation()">' + prevDate.getDate() + '</button>';
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const date    = new Date(calViewYear, calViewMonth, d);
    const ymd     = toYMD(date);
    const wYMD    = toYMD(weekStart(date));
    const inWeek  = ymd >= wsYMD && ymd <= weYMD;
    const isToday = ymd === todayYMD;
    const isWkSt  = ymd === wsYMD;
    const isWkEnd = ymd === weYMD;

    let cls = 'cal-day';
    if (inWeek)  cls += ' cal-day-in-week';
    if (isToday) cls += ' cal-day-today';
    if (isWkSt)  cls += ' cal-day-week-start';
    if (isWkEnd) cls += ' cal-day-week-end';

    cells += '<button class="' + cls + '" onclick="selectWeek(\'' + wYMD + '\');event.stopPropagation()">' + d + '</button>';
  }

  // Next-month overflow
  const rem = (startOffset + daysInMonth) % 7;
  if (rem > 0) {
    for (let d = 1; d <= 7 - rem; d++) {
      const nextDate = new Date(calViewYear, calViewMonth + 1, d);
      const wStart   = toYMD(weekStart(nextDate));
      cells += '<button class="cal-day cal-day-other-month" onclick="selectWeek(\'' + wStart + '\');event.stopPropagation()">' + d + '</button>';
    }
  }

  dd.innerHTML =
    '<div class="cal-header">' +
      '<span class="cal-header-title">' + title + '</span>' +
    '</div>' +
    '<div class="cal-weekdays">' + dayLabels.map(function(l) { return '<div class="cal-weekday">' + l + '</div>'; }).join('') + '</div>' +
    '<div class="cal-grid">' + cells + '</div>' +
    '<div class="cal-footer">' +
      '<button class="cal-footer-btn" onclick="calShiftMonth(-1);event.stopPropagation()">&#8249; Prev</button>' +
      '<button class="cal-today-btn" onclick="calGoToday();event.stopPropagation()">Today</button>' +
      '<button class="cal-footer-btn" onclick="calShiftMonth(1);event.stopPropagation()">Next &#8250;</button>' +
    '</div>';
}

function calShiftMonth(delta) {
  calViewMonth += delta;
  if (calViewMonth > 11) { calViewMonth = 0;  calViewYear++; }
  if (calViewMonth < 0)  { calViewMonth = 11; calViewYear--; }
  renderWeekCalendar();
}

async function navigateWeek(delta) {
  state.weekStartDate = addDays(state.weekStartDate, delta * 7);
  document.getElementById('weekDropdown').style.display = 'none';
  updateWeekLabel();
  await Promise.all([loadSummary(), loadAttendance()]);
}

async function calGoToday() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  state.weekStartDate = weekStart(today);
  document.getElementById('weekDropdown').style.display = 'none';
  buildWeekDropdown();
  await Promise.all([loadSummary(), loadAttendance()]);
}

async function selectWeek(ymd) {
  state.weekStartDate = new Date(ymd + 'T00:00:00');
  document.getElementById('weekDropdown').style.display = 'none';
  buildWeekDropdown();
  await Promise.all([loadSummary(), loadAttendance()]);
}

// ════════════════════════════════════════════════════
//  QUARTER HELPER
//  DepEd quarters: Q1=Jun-Aug, Q2=Sep-Oct, Q3=Nov-Jan, Q4=Feb-May
// ════════════════════════════════════════════════════
function getQuarter(dateStr) {
  const month = parseInt(dateStr.slice(5, 7), 10); // 1-12
  if (month >= 6 && month <= 8)  return 'Q1';
  if (month >= 9 && month <= 10) return 'Q2';
  if (month === 11 || month === 12 || month === 1) return 'Q3';
  return 'Q4'; // Feb-May
}

// ════════════════════════════════════════════════════
//  SUMMARY CARD — Today's Attendance only
// ════════════════════════════════════════════════════
function buildSummaryCard(sectionTitle, counts) {
  const total = counts.present + counts.late + counts.absent;
  const pPct  = total ? Math.round(counts.present / total * 100) : 0;
  const lPct  = total ? Math.round(counts.late    / total * 100) : 0;
  const aPct  = total ? Math.round(counts.absent  / total * 100) : 0;

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  return '<div class="summary-bar-section">' +
    '<div class="summary-bar-title">Today\u2019s Attendance' +
      '<span class="summary-bar-sub"> \u2014 ' + esc(sectionTitle) + '</span>' +
    '</div>' +
    '<div class="summary-bar-date">' + esc(dateLabel) + '</div>' +
    '<div class="summary-bar-count">' + counts.present + '</div>' +
    '<div class="summary-bar-stats">' +
      '<span class="sbs-item" style="color:var(--present)"><span class="sbs-dot"></span>Present: ' + counts.present + ' (' + pPct + '%)</span>' +
      '<span class="sbs-sep">|</span>' +
      '<span class="sbs-item" style="color:var(--late)">Late: ' + counts.late + ' (' + lPct + '%)</span>' +
      '<span class="sbs-sep">|</span>' +
      '<span class="sbs-item" style="color:var(--absent)">Absent: ' + counts.absent + ' (' + aPct + '%)</span>' +
    '</div>' +
  '</div>';
}

// Keep old name as alias so loadSummary still works
function buildSummaryBar(title, d) { return buildSummaryCard(title, d); }

/**
 * Recompute the summary card using TODAY's date only.
 * Per-row student summary (P/L/A + quarters) is handled separately.
 */
function refreshSummaryFromTable() {
  if (!tableData.students.length) return;

  const todayYMD = toYMD(new Date());
  const counts   = { present: 0, late: 0, absent: 0 };

  tableData.students.forEach(function(s) {
    const status = (s.statuses || {})[todayYMD];
    if      (status === 'present') counts.present++;
    else if (status === 'late')    counts.late++;
    else if (status === 'absent')  counts.absent++;
  });

  const sectionTitle = state.sectionId === 'all' ? 'All Sections' : state.sectionName;
  document.getElementById('summaryCards').innerHTML = buildSummaryCard(sectionTitle, counts);
}

async function loadSummary() {
  // Skeleton while attendance loads; real render happens in renderTable → refreshSummaryFromTable
  document.getElementById('summaryCards').innerHTML =
    '<div class="summary-skeleton"><div class="skeleton-shimmer"></div></div>';
}


// ════════════════════════════════════════════════════
//  ATTENDANCE TABLE
// ════════════════════════════════════════════════════
let tableData = { dates: [], students: [] };

async function loadAttendance() {
  const ws = state.weekStartDate;
  const we = addDays(ws, 6);
  let data;

  if (state.sectionId === 'all') {
    data = await apiFetch({ action: 'attendance', year: ws.getFullYear(), month: ws.getMonth() + 1 });
  } else {
    data = await apiFetch({
      action: 'attendance', grade: state.grade, section: state.section,
      year: ws.getFullYear(), month: ws.getMonth() + 1,
    });
  }

  // Merge second month if week spans boundary
  if (we.getMonth() !== ws.getMonth() || we.getFullYear() !== ws.getFullYear()) {
    let m2;
    if (state.sectionId === 'all') {
      m2 = await apiFetch({ action: 'attendance', year: we.getFullYear(), month: we.getMonth() + 1 });
    } else {
      m2 = await apiFetch({
        action: 'attendance', grade: state.grade, section: state.section,
        year: we.getFullYear(), month: we.getMonth() + 1,
      });
    }
    data.dates = Array.from(new Set(data.dates.concat(m2.dates)));
    m2.students.forEach(function(s2) {
      const ex = data.students.find(function(s) { return s.id === s2.id; });
      if (ex) Object.assign(ex.statuses, s2.statuses);
    });
  }

  const weekYMDs = weekDates(ws).map(toYMD);
  tableData = {
    dates:    data.dates.filter(function(d) { return weekYMDs.includes(d); }),
    students: data.students,
  };
  renderTable();
}

function renderTable() {
  const dates    = tableData.dates;
  const students = tableData.students;
  const todayYMD = toYMD(new Date());

  // Compute per-date counts for the count row
  function getDateCounts(dateList, studentList) {
    var counts = {};
    dateList.forEach(function(d) {
      counts[d] = { present: 0, late: 0, absent: 0, total: studentList.length };
    });
    studentList.forEach(function(s) {
      dateList.forEach(function(d) {
        var st = (s.statuses || {})[d];
        if      (st === 'present') counts[d].present++;
        else if (st === 'late')    counts[d].late++;
        else if (st === 'absent')  counts[d].absent++;
      });
    });
    return counts;
  }
  var dateCounts = getDateCounts(dates, students);

  // Head — row 1: date labels + mark-all button
  document.getElementById('tableHead').innerHTML =
    '<tr>' +
      '<th rowspan="2" style="vertical-align:bottom;padding-bottom:10px">Student</th>' +
      dates.map(function(d) {
        const dt      = new Date(d + 'T00:00:00');
        const isToday = d === todayYMD;
        const inner   = '<div class="th-day' + (isToday ? ' th-today' : '') + '">' +
          '<span class="th-day-name">' + dt.toLocaleDateString('en-US', { weekday: 'short' }) + '</span>' +
          '<span class="th-day-num">' + dt.getDate() + '</span>' +
          '<span class="th-day-mon">' + SHORT_MONTHS[dt.getMonth()] + '</span>' +
          '</div>';
        // Mark-all button
        const markBtn =
          '<button class="mark-all-th-btn" title="Mark all for ' + d + '"' +
          ' onclick="openMarkAllMenu(event,\'' + d + '\')"' +
          ' aria-label="Mark all students for ' + d + '">' +
          '<svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>' +
          '</svg> All' +
          '</button>';
        return '<th data-date="' + d + '" style="text-align:center">' + inner + markBtn + '</th>';
      }).join('') +
      '<th rowspan="2" style="vertical-align:bottom;padding-bottom:10px">Summary</th>' +
    '</tr>' +
    // Row 2: per-date count chips
    '<tr class="th-count-row">' +
      dates.map(function(d) {
        var c = dateCounts[d];
        return '<td class="th-count-cell" data-count-date="' + d + '">' +
          '<span class="th-cnt th-cnt-p" title="Present">' + c.present + '</span>' +
          '<span class="th-cnt th-cnt-l" title="Late">' + c.late + '</span>' +
          '<span class="th-cnt th-cnt-a" title="Absent">' + c.absent + '</span>' +
        '</td>';
      }).join('') +
    '</tr>';

  // Body
  const tbody = document.getElementById('tableBody');
  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="' + (dates.length + 2) + '" class="table-loading">No students found for this section.</td></tr>';
    return;
  }

  tbody.innerHTML = students.map(function(s) {
    let p = 0, l = 0, a = 0;
    // Quarter counts — across ALL stored statuses (not just this week)
    var qCounts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    Object.entries(s.statuses || {}).forEach(function(entry) {
      var dateKey = entry[0], st = entry[1];
      if (st === 'present' || st === 'late') {
        qCounts[getQuarter(dateKey)]++;
      }
    });

    const cells = dates.map(function(d) {
      const status = s.statuses[d] || 'none';
      if (status === 'present') p++;
      else if (status === 'late') l++;
      else if (status === 'absent') a++;
      const label = status === 'none' ? '\u2014' : cap(status);
      return '<td><button class="status-badge badge-' + status + '"' +
        ' aria-label="' + (status === 'none' ? 'No record' : cap(status)) + ' \u2014 ' + d + '"' +
        ' onclick="cycleStatus(' + s.id + ',\'' + d + '\',this)"' +
        ' oncontextmenu="openCtxMenu(event,' + s.id + ',\'' + d + '\',this)">' +
        label + '</button></td>';
    }).join('');

    const initials = s.full_name.split(' ').map(function(w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    const avatar   = '<div class="student-ava-fb">' + initials + '</div>';

    return '<tr data-id="' + s.id + '" data-name="' + esc(s.full_name.toLowerCase()) + '">' +
      '<td><div class="student-cell">' + avatar +
        '<span class="student-fullname">' + esc(s.full_name) + '</span>' +
      '</div></td>' +
      cells +
      '<td><div class="summary-cell">' +
        '<div class="summary-week">' +
          '<span class="sum-badge sum-p">P <strong>' + p + '</strong></span>' +
          '<span class="sum-badge sum-l">L <strong>' + l + '</strong></span>' +
          '<span class="sum-badge sum-a">A <strong>' + a + '</strong></span>' +
        '</div>' +
        '<div class="summary-quarters">' +
          '<span class="q-pill q1">Q1 ' + qCounts.Q1 + '</span>' +
          '<span class="q-pill q2">Q2 ' + qCounts.Q2 + '</span>' +
          '<span class="q-pill q3">Q3 ' + qCounts.Q3 + '</span>' +
          '<span class="q-pill q4">Q4 ' + qCounts.Q4 + '</span>' +
        '</div>' +
      '</div></td>' +
    '</tr>';
  }).join('');

  // Always sync the summary card with exactly what's displayed
  refreshSummaryFromTable();
}

// ════════════════════════════════════════════════════
//  STATUS CYCLING & CONTEXT MENU
// ════════════════════════════════════════════════════
const CYCLE = { none: 'present', present: 'late', late: 'absent', absent: 'present' };

async function cycleStatus(studentId, date, badge) {
  const cur  = ([].slice.call(badge.classList).find(function(c) { return c.startsWith('badge-'); }) || 'badge-none').replace('badge-', '');
  const next = CYCLE[cur] || 'present';

  // Update UI immediately
  badge.className = 'status-badge badge-' + next;
  badge.textContent = next === 'none' ? '\u2014' : cap(next);
  badge.setAttribute('aria-label', (next === 'none' ? 'No record' : cap(next)) + ' \u2014 ' + date);

  const student = tableData.students.find(function(s) { return s.id == studentId; });
  if (student) student.statuses[date] = next;

  updateRowSummary(studentId);
  refreshSummaryFromTable();
  refreshDateCounts();
  refreshDayViewChips();

  try {
    await apiPost({ student_id: studentId, date: date, status: next });
  } catch (e) { console.error('Save failed:', e); }
}

let ctxTarget = null;

function openCtxMenu(e, studentId, date, dot) {
  e.preventDefault();
  closeCtxMenu();
  ctxTarget = { studentId: studentId, date: date, dot: dot };

  const cur = ([].slice.call(dot.classList).find(function(c) { return c.startsWith('badge-'); }) || 'badge-none').replace('badge-', '');
  function chk(s) { return s === cur ? ' \u2713' : ''; }

  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.id = 'ctxMenu';
  menu.innerHTML =
    '<div class="ctx-menu-header">' + esc(date) + '</div>' +
    '<button onclick="setStatus(\'present\')"><span class="ctx-dot" style="background:var(--present)"></span>Present' + chk('present') + '</button>' +
    '<button onclick="setStatus(\'late\')"><span class="ctx-dot" style="background:var(--late)"></span>Late' + chk('late') + '</button>' +
    '<button onclick="setStatus(\'absent\')"><span class="ctx-dot" style="background:var(--absent)"></span>Absent' + chk('absent') + '</button>' +
    '<div class="ctx-divider"></div>' +
    '<button class="ctx-delete" onclick="clearStatus()"><span class="ctx-dot" style="background:#e2e8f0"></span>Clear record</button>';

  menu.style.left = Math.min(e.clientX, window.innerWidth  - 170) + 'px';
  menu.style.top  = Math.min(e.clientY, window.innerHeight - 200) + 'px';
  document.body.appendChild(menu);
}

function closeCtxMenu() {
  const m = document.getElementById('ctxMenu');
  if (m) m.remove();
  ctxTarget = null;
}

document.addEventListener('click',   closeCtxMenu);
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeCtxMenu(); });

async function setStatus(status) {
  if (!ctxTarget) return;
  const studentId = ctxTarget.studentId;
  const date      = ctxTarget.date;
  const dot       = ctxTarget.dot;
  closeCtxMenu();

  dot.className   = 'status-badge badge-' + status;
  dot.textContent = status === 'none' ? '\u2014' : cap(status);
  dot.setAttribute('aria-label', (status === 'none' ? 'No record' : cap(status)) + ' \u2014 ' + date);

  const student = tableData.students.find(function(s) { return s.id == studentId; });
  if (student) student.statuses[date] = status;

  updateRowSummary(studentId);
  refreshSummaryFromTable();
  refreshDateCounts();
  refreshDayViewChips();

  try {
    await apiPost({ student_id: studentId, date: date, status: status });
  } catch (e) { console.error('Save failed:', e); }
}

async function clearStatus() {
  if (!ctxTarget) return;
  const studentId = ctxTarget.studentId;
  const date      = ctxTarget.date;
  const dot       = ctxTarget.dot;
  closeCtxMenu();

  dot.className   = 'status-badge badge-none';
  dot.textContent = '\u2014';
  dot.setAttribute('aria-label', 'No record \u2014 ' + date);

  const student = tableData.students.find(function(s) { return s.id == studentId; });
  if (student) delete student.statuses[date];

  updateRowSummary(studentId);
  refreshSummaryFromTable();
  refreshDateCounts();
  refreshDayViewChips();

  try {
    await fetch(API + '?student_id=' + studentId + '&date=' + date, { method: 'DELETE' });
  } catch (e) { console.error('Delete failed:', e); }
}

// ════════════════════════════════════════════════════
//  PER-DATE COUNT ROW — live refresh
// ════════════════════════════════════════════════════
function refreshDateCounts() {
  tableData.dates.forEach(function(d) {
    var p = 0, l = 0, a = 0;
    tableData.students.forEach(function(s) {
      var st = (s.statuses || {})[d];
      if      (st === 'present') p++;
      else if (st === 'late')    l++;
      else if (st === 'absent')  a++;
    });
    var cell = document.querySelector('.th-count-cell[data-count-date="' + d + '"]');
    if (cell) {
      cell.innerHTML =
        '<span class="th-cnt th-cnt-p" title="Present">' + p + '</span>' +
        '<span class="th-cnt th-cnt-l" title="Late">'    + l + '</span>' +
        '<span class="th-cnt th-cnt-a" title="Absent">'  + a + '</span>';
    }
  });
}

// Refresh the stat chips inside the day view header
function refreshDayViewChips() {
  if (currentView !== 'day') return;
  var p = 0, l = 0, a = 0, n = 0;
  (tableData.students || []).forEach(function(s) {
    var st = (s.statuses || {})[dayViewDate] || 'none';
    if      (st === 'present') p++;
    else if (st === 'late')    l++;
    else if (st === 'absent')  a++;
    else                       n++;
  });
  var chips = document.querySelector('#dayView .day-stat-chips');
  if (chips) {
    chips.innerHTML =
      '<span class="day-stat-chip chip-p">Present <strong>' + p + '</strong></span>' +
      '<span class="day-stat-chip chip-l">Late <strong>'    + l + '</strong></span>' +
      '<span class="day-stat-chip chip-a">Absent <strong>' + a + '</strong></span>' +
      (n ? '<span class="day-stat-chip chip-n">No record <strong>' + n + '</strong></span>' : '');
  }
}

// ════════════════════════════════════════════════════
//  MARK ALL FOR DATE
// ════════════════════════════════════════════════════
let _markAllMenu = null;

function openMarkAllMenu(e, date) {
  e.stopPropagation();
  closeMarkAllMenu();

  const menu = document.createElement('div');
  menu.className = 'ctx-menu mark-all-menu';
  menu.id = 'markAllMenu';
  menu.innerHTML =
    '<div class="ctx-menu-header">Mark all \u2014 ' + date + '</div>' +
    '<button onclick="markAllForDate(\'' + date + '\',\'present\');closeMarkAllMenu()">' +
      '<span class="ctx-dot" style="background:var(--present)"></span>' +
      '<span style="color:#065f46;font-weight:600">All Present</span>' +
    '</button>' +
    '<button onclick="markAllForDate(\'' + date + '\',\'late\');closeMarkAllMenu()">' +
      '<span class="ctx-dot" style="background:var(--late)"></span>' +
      '<span style="color:#7c3a02;font-weight:600">All Late</span>' +
    '</button>' +
    '<button onclick="markAllForDate(\'' + date + '\',\'absent\');closeMarkAllMenu()">' +
      '<span class="ctx-dot" style="background:var(--absent)"></span>' +
      '<span style="color:#8b1a1a;font-weight:600">All Absent</span>' +
    '</button>' +
    '<div class="ctx-divider"></div>' +
    '<button class="ctx-delete" onclick="markAllForDate(\'' + date + '\',\'none\');closeMarkAllMenu()">' +
      '<span class="ctx-dot" style="background:#e2e8f0"></span>Clear All' +
    '</button>';

  const rect = e.currentTarget.getBoundingClientRect();
  menu.style.left = Math.min(rect.left, window.innerWidth  - 175) + 'px';
  menu.style.top  = (rect.bottom + 4) + 'px';
  document.body.appendChild(menu);
  _markAllMenu = menu;
}

function closeMarkAllMenu() {
  if (_markAllMenu) { _markAllMenu.remove(); _markAllMenu = null; }
}

document.addEventListener('click', function(e) {
  if (_markAllMenu && !_markAllMenu.contains(e.target)) closeMarkAllMenu();
});

async function markAllForDate(date, status) {
  const students = tableData.students;
  if (!students.length) return;

  const dateIdx = tableData.dates.indexOf(date);
  students.forEach(function(s) {
    if (status === 'none') delete s.statuses[date];
    else s.statuses[date] = status;

    // ── Update weekly table badge ──
    const row = document.querySelector('#tableBody tr[data-id="' + s.id + '"]');
    if (row) {
      const tds = row.querySelectorAll('td');
      const td = tds[dateIdx + 1];
      if (td) {
        const badge = td.querySelector('.status-badge');
        if (badge) {
          badge.className = 'status-badge badge-' + status;
          badge.textContent = status === 'none' ? '\u2014' : cap(status);
          badge.setAttribute('aria-label', (status === 'none' ? 'No record' : cap(status)) + ' \u2014 ' + date);
        }
      }
      updateRowSummary(s.id);
    }

    // ── Update day view badge (if day view is showing this date) ──
    if (currentView === 'day' && dayViewDate === date) {
      const dayRow = document.querySelector('#dayView .day-student-row[data-name="' + esc(s.full_name.toLowerCase()) + '"]');
      if (dayRow) {
        const badge = dayRow.querySelector('.status-badge');
        if (badge) {
          badge.className = 'status-badge badge-' + status;
          badge.textContent = status === 'none' ? '\u2014' : cap(status);
          badge.setAttribute('aria-label', (status === 'none' ? 'No record' : cap(status)) + ' \u2014 ' + date);
        }
      }
    }
  });

  // Refresh day view stat chips if active
  if (currentView === 'day' && dayViewDate === date) {
    refreshDayViewChips();
  }

  refreshDateCounts();
  refreshSummaryFromTable();

  showToast('Saving\u2026', 'saving');
  let ok = 0, fail = 0;
  for (const s of students) {
    try {
      if (status === 'none') {
        await fetch(API + '?student_id=' + s.id + '&date=' + date, { method: 'DELETE' });
      } else {
        await apiPost({ student_id: s.id, date: date, status: status });
      }
      ok++;
    } catch (err) { fail++; }
  }
  showToast(fail ? ok + ' saved, ' + fail + ' failed' : 'All marked!', fail ? 'error' : 'success');
}

function updateRowSummary(studentId) {
  const student = tableData.students.find(function(s) { return s.id == studentId; });
  if (!student) return;

  // Week P/L/A (only dates in the current table view)
  const weekSet = new Set(tableData.dates);
  let p = 0, l = 0, a = 0;
  var qCounts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

  Object.entries(student.statuses || {}).forEach(function(entry) {
    var dateKey = entry[0], st = entry[1];
    if (weekSet.has(dateKey)) {
      if (st === 'present') p++;
      else if (st === 'late') l++;
      else if (st === 'absent') a++;
    }
    if (st === 'present' || st === 'late') {
      qCounts[getQuarter(dateKey)]++;
    }
  });

  const row = document.querySelector('#tableBody tr[data-id="' + studentId + '"]');
  if (row) {
    const last = row.querySelector('td:last-child');
    if (last) last.innerHTML =
      '<div class="summary-cell">' +
        '<div class="summary-week">' +
          '<span class="sum-badge sum-p">P <strong>' + p + '</strong></span>' +
          '<span class="sum-badge sum-l">L <strong>' + l + '</strong></span>' +
          '<span class="sum-badge sum-a">A <strong>' + a + '</strong></span>' +
        '</div>' +
        '<div class="summary-quarters">' +
          '<span class="q-pill q1">Q1 ' + qCounts.Q1 + '</span>' +
          '<span class="q-pill q2">Q2 ' + qCounts.Q2 + '</span>' +
          '<span class="q-pill q3">Q3 ' + qCounts.Q3 + '</span>' +
          '<span class="q-pill q4">Q4 ' + qCounts.Q4 + '</span>' +
        '</div>' +
      '</div>';
  }
}

// ════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════
function showError(msg) {
  const banner = document.getElementById('errorBanner');
  const msgEl  = document.getElementById('errorMessage');
  if (banner && msgEl) {
    msgEl.textContent    = msg;
    banner.style.display = 'flex';
  }
  const tb = document.getElementById('tableBody');
  if (tb) tb.innerHTML = '<tr><td colspan="9" class="table-loading" style="color:var(--absent)">' + esc(msg) + '</td></tr>';
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function filterStudents(q) {
  const lower = (q || '').toLowerCase();
  document.querySelectorAll('#tableBody tr[data-name]').forEach(function(row) {
    row.style.display = row.dataset.name.includes(lower) ? '' : 'none';
  });
}

function dismissError() {
  const b = document.getElementById('errorBanner');
  if (b) b.style.display = 'none';
}

// ════════════════════════════════════════════════════
//  PENDING CHANGES QUEUE (Save Changes button)
// ════════════════════════════════════════════════════
const pendingChanges = new Map(); // key: "studentId|date" → { studentId, date, status }

function queueChange(studentId, date, status) {
  const key = studentId + '|' + date;
  pendingChanges.set(key, { studentId: studentId, date: date, status: status });
  updateSaveButton();
}

function updateSaveButton() {
  const btn   = document.getElementById('saveChangesBtn');
  const label = document.getElementById('saveChangesLabel');
  if (!btn) return;
  if (pendingChanges.size > 0) {
    btn.style.display = '';
    label.textContent = 'Save Changes (' + pendingChanges.size + ')';
  } else {
    btn.style.display = 'none';
  }
}

// ════════════════════════════════════════════════════
//  VIEW MODE (Weekly / Daily)
// ════════════════════════════════════════════════════
let currentView = 'week';

// ════════════════════════════════════════════════════
//  ACTIONS NAMESPACE — bound to HTML onclick attributes
// ════════════════════════════════════════════════════
const Actions = {

  toggleViewMode: function(mode) {
    currentView = mode;
    document.querySelectorAll('.view-tab-btn').forEach(function(btn) {
      const isActive = btn.dataset.view === mode;
      btn.classList.toggle('view-tab-btn--active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    document.getElementById('weekView').style.display = mode === 'week' ? '' : 'none';
    document.getElementById('dayView').style.display  = mode === 'day'  ? '' : 'none';
    document.getElementById('weekNav').style.display  = mode === 'week' ? '' : 'none';
    if (mode === 'day') {
      dayViewDate = toYMD(new Date()); // always reset to today when switching to daily
      Render.renderDayView();
    }
  },

  saveAllPending: async function() {
    if (!pendingChanges.size) return;
    const btn = document.getElementById('saveChangesBtn');
    if (btn) btn.disabled = true;
    showToast('Saving…', 'saving');
    let saved = 0, failed = 0;
    for (const item of pendingChanges.values()) {
      try {
        await apiPost({ student_id: item.studentId, date: item.date, status: item.status });
        pendingChanges.delete(item.studentId + '|' + item.date);
        saved++;
      } catch (e) {
        failed++;
        console.error('Save failed for', item, e);
      }
    }
    if (btn) btn.disabled = false;
    updateSaveButton();
    if (failed === 0) {
      showToast('All changes saved!', 'success');
    } else {
      showToast(saved + ' saved, ' + failed + ' failed', 'error');
    }
  },

  openMonthlyReport: function() {
    // Initialize modal with the current month
    const now = new Date();
    openMonthlyReportModal(now.getFullYear(), now.getMonth() + 1);
  },
};

// ════════════════════════════════════════════════════
//  DAY VIEW STATE
// ════════════════════════════════════════════════════
let dayViewDate = toYMD(new Date()); // always starts on today

function shiftDayView(delta) {
  const d = new Date(dayViewDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  dayViewDate = toYMD(d);
  Render.renderDayView();
}

function goTodayDayView() {
  dayViewDate = toYMD(new Date());
  Render.renderDayView();
}

// ════════════════════════════════════════════════════
//  RENDER NAMESPACE
// ════════════════════════════════════════════════════
const Render = {

  renderDayView: function() {
    const todayYMD  = toYMD(new Date());
    const d         = dayViewDate;
    const isToday   = d === todayYMD;
    const dt        = new Date(d + 'T00:00:00');
    const dayName   = dt.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr   = dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const container = document.getElementById('dayView');
    if (!container) return;

    // ── tally stats for this day ──
    let p = 0, l = 0, a = 0, n = 0;
    const rows = (tableData.students || []).map(function(s) {
      const status = (s.statuses || {})[d] || 'none';
      if      (status === 'present') p++;
      else if (status === 'late')    l++;
      else if (status === 'absent')  a++;
      else                           n++;

      const initials = s.full_name.split(' ').map(function(w) { return w[0]; }).slice(0, 2).join('').toUpperCase();

      return '<div class="day-student-row" data-name="' + esc(s.full_name.toLowerCase()) + '">' +
        '<div class="student-cell">' +
          '<div class="student-ava-fb">' + initials + '</div>' +
          '<span class="student-fullname">' + esc(s.full_name) + '</span>' +
        '</div>' +
        '<button class="status-badge badge-' + status + '"' +
        ' aria-label="' + (status === 'none' ? 'No record' : cap(status)) + ' \u2014 ' + d + '"' +
        ' onclick="cycleStatus(' + s.id + ',\'' + d + '\',this)"' +
        ' oncontextmenu="openCtxMenu(event,' + s.id + ',\'' + d + '\',this)">' +
        (status === 'none' ? '\u2014' : cap(status)) + '</button>' +
      '</div>';
    }).join('');

    // ── stat tally chips ──
    const statChips =
      '<span class="day-stat-chip chip-p">Present <strong>' + p + '</strong></span>' +
      '<span class="day-stat-chip chip-l">Late <strong>' + l + '</strong></span>' +
      '<span class="day-stat-chip chip-a">Absent <strong>' + a + '</strong></span>' +
      (n ? '<span class="day-stat-chip chip-n">No record <strong>' + n + '</strong></span>' : '');

    // ── empty state ──
    const body = tableData.students.length
      ? '<div class="day-student-list">' + rows + '</div>'
      : '<div class="empty-state"><svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg><p>No students found.</p></div>';

    container.innerHTML =
      '<div class="day-card table-card">' +
        '<div class="day-header">' +

          // ── left: day label + date ──
          '<div class="day-header-left">' +
            '<div class="day-dow' + (isToday ? ' day-today-label' : '') + '">' +
              dayName + (isToday ? '<span class="day-today-badge">Today</span>' : '') +
            '</div>' +
            '<div class="day-date">' + dateStr + '</div>' +
          '</div>' +

          // ── right: stats + nav ──
          '<div class="day-header-right">' +
            '<div class="day-stat-chips">' + statChips + '</div>' +
            '<div class="day-nav">' +
              '<button class="day-nav-btn" onclick="shiftDayView(-1)" aria-label="Previous day">' +
                '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>' +
              '</button>' +
              (isToday ? '' :
                '<button class="day-nav-btn day-nav-today" onclick="goTodayDayView()" aria-label="Go to today">Today</button>'
              ) +
              '<button class="day-nav-btn" onclick="shiftDayView(1)" aria-label="Next day">' +
                '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +

        '</div>' +
        body +
      '</div>';
  },
};

// ════════════════════════════════════════════════════
//  MONTHLY REPORT MODAL
// ════════════════════════════════════════════════════
let reportYear  = new Date().getFullYear();
let reportMonth = new Date().getMonth() + 1; // 1-based, always initialized to current month

async function openMonthlyReportModal(year, month) {
  reportYear  = year  || new Date().getFullYear();
  reportMonth = month || (new Date().getMonth() + 1);

  // Build or show modal
  let modal = document.getElementById('reportModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reportModal';
    modal.className = 'modal-overlay';
    modal.innerHTML =
      '<div class="modal-box">' +
        '<div class="modal-header">' +
          '<div>' +
            '<div class="modal-title">Monthly Attendance Report</div>' +
            '<div class="modal-sub" id="reportSub"></div>' +
          '</div>' +
          '<div class="modal-header-actions">' +
            '<div class="report-month-nav">' +
              '<button class="toolbar-btn" onclick="shiftReportMonth(-1)" aria-label="Previous month">&#8249;</button>' +
              '<span id="reportMonthLabel" style="font-size:.82rem;font-weight:600;min-width:110px;text-align:center"></span>' +
              '<button class="toolbar-btn" onclick="shiftReportMonth(1)" aria-label="Next month">&#8250;</button>' +
            '</div>' +
            '<button class="toolbar-btn" onclick="printMonthlyReport()" aria-label="Print report">' +
              '<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>' +
              'Print' +
            '</button>' +
            '<button class="toolbar-btn" onclick="closeMonthlyReport()" aria-label="Close report">✕ Close</button>' +
          '</div>' +
        '</div>' +
        '<div class="modal-body" id="reportBody">' +
          '<div class="table-loading"><span class="loading-spinner"></span>Loading report…</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    // Close on backdrop click
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeMonthlyReport();
    });
  }

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  await loadReportData();
}

async function loadReportData() {
  const body  = document.getElementById('reportBody');
  const label = document.getElementById('reportMonthLabel');
  const sub   = document.getElementById('reportSub');
  if (label) label.textContent = MONTHS[reportMonth - 1] + ' ' + reportYear;
  if (sub)   sub.textContent   = (state.sectionId === 'all' ? 'All Sections' : state.sectionName) + ' — ' + MONTHS[reportMonth - 1] + ' ' + reportYear;
  if (body)  body.innerHTML    = '<div class="table-loading"><span class="loading-spinner"></span>Loading report…</div>';

  try {
    const params = { action: 'monthlyReport', year: reportYear, month: reportMonth };
    if (state.sectionId !== 'all') {
      params.grade   = state.grade;
      params.section = state.section;
    }
    const data = await apiFetch(params);
    renderReportBody(data);
  } catch (e) {
    if (body) body.innerHTML = '<div class="table-loading" style="color:var(--absent)">Failed to load report: ' + esc(e.message) + '</div>';
  }
}

function renderReportBody(data) {
  const body = document.getElementById('reportBody');
  if (!body) return;

  const sectionTitle = state.sectionId === 'all' ? 'All Sections' : state.sectionName;

  let html =
    '<div class="report-summary-row">' +
      '<div class="report-stat-card">' +
        '<div class="report-stat-label">School Days</div>' +
        '<div class="report-stat-val">' + (data.schoolDaysInMonth || 0) + '</div>' +
      '</div>' +
      '<div class="report-stat-card">' +
        '<div class="report-stat-label">Total Students</div>' +
        '<div class="report-stat-val">' + (data.totalStudents || 0) + '</div>' +
      '</div>' +
      '<div class="report-stat-card" style="border-top:3px solid var(--present)">' +
        '<div class="report-stat-label">Present Records</div>' +
        '<div class="report-stat-val" style="color:var(--present)">' + (data.present || 0) + '</div>' +
      '</div>' +
      '<div class="report-stat-card" style="border-top:3px solid var(--late)">' +
        '<div class="report-stat-label">Late Records</div>' +
        '<div class="report-stat-val" style="color:var(--late)">' + (data.late || 0) + '</div>' +
      '</div>' +
      '<div class="report-stat-card" style="border-top:3px solid var(--absent)">' +
        '<div class="report-stat-label">Absent Records</div>' +
        '<div class="report-stat-val" style="color:var(--absent)">' + (data.absent || 0) + '</div>' +
      '</div>' +
      '<div class="report-stat-card" style="border-top:3px solid var(--primary)">' +
        '<div class="report-stat-label">Monthly Attendance %</div>' +
        '<div class="report-stat-val" style="color:var(--primary)">' + (data.monthlyAttendPct || 0) + '%</div>' +
      '</div>' +
    '</div>';

  // Per-section breakdown table
  if (data.sections && data.sections.length) {
    html += '<div class="report-section-title">Section Breakdown</div>';
    html += '<div style="overflow-x:auto"><table class="att-table report-table"><thead><tr>' +
      '<th style="text-align:left">Section</th>' +
      '<th>Present</th><th>Late</th><th>Absent</th>' +
      '<th>ADA</th><th>Attend %</th>' +
      '</tr></thead><tbody>';

    data.sections.forEach(function(s) {
      html += '<tr>' +
        '<td style="text-align:left;font-weight:600">' + esc(s.name) + '</td>' +
        '<td style="color:var(--present)">' + s.present + '</td>' +
        '<td style="color:var(--late)">'    + s.late    + '</td>' +
        '<td style="color:var(--absent)">'  + s.absent  + '</td>' +
        '<td>' + (s.ada || 0) + '</td>' +
        '<td><strong>' + (s.attendPct || 0) + '%</strong></td>' +
        '</tr>';

      // Per-student rows if available
      if (s.students && s.students.length) {
        s.students.forEach(function(st) {
          html += '<tr style="background:var(--bg-hover)">' +
            '<td style="text-align:left;padding-left:36px;color:var(--text-2);font-size:.78rem">' + esc(st.fullName || st.full_name || '') + '</td>' +
            '<td style="color:var(--present);font-size:.78rem">' + (st.present || 0) + '</td>' +
            '<td style="color:var(--late);font-size:.78rem">'    + (st.late    || 0) + '</td>' +
            '<td style="color:var(--absent);font-size:.78rem">'  + (st.absent  || 0) + '</td>' +
            '<td colspan="2" style="font-size:.78rem;color:var(--primary)">' + (st.attendPct || 0) + '%</td>' +
            '</tr>';
        });
      }
    });

    html += '</tbody></table></div>';
  }

  body.innerHTML = html;
}

function shiftReportMonth(delta) {
  reportMonth += delta;
  if (reportMonth > 12) { reportMonth = 1;  reportYear++; }
  if (reportMonth < 1)  { reportMonth = 12; reportYear--; }
  loadReportData();
}

function closeMonthlyReport() {
  const modal = document.getElementById('reportModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

function printMonthlyReport() {
  const modal = document.getElementById('reportModal');
  if (!modal) return;
  // Temporarily hide everything else, print, then restore
  const appEl = document.querySelector('.app');
  if (appEl) appEl.style.display = 'none';
  modal.style.position = 'static';
  modal.style.background = 'none';
  modal.style.padding = '0';
  window.print();
  modal.style.position = '';
  modal.style.background = '';
  modal.style.padding = '';
  if (appEl) appEl.style.display = '';
}

// ════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════
let _toastTimer = null;
function showToast(msg, type) {
  const t = document.getElementById('saveToast');
  if (!t) return;
  t.textContent = msg;
  t.className   = 'save-toast toast-' + (type || 'success');
  clearTimeout(_toastTimer);
  if (type !== 'saving') {
    _toastTimer = setTimeout(function() {
      t.className = 'save-toast';
    }, 2500);
  }
}

// Boot
init();