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
  const today     = new Date(); today.setHours(0, 0, 0, 0);
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
//  SUMMARY CARDS
// ════════════════════════════════════════════════════
function buildSummaryBar(title, d) {
  const total = (d.present || 0) + (d.late || 0) + (d.absent || 0);
  const pPct = total ? Math.round((d.present || 0) / total * 100) : 0;
  const lPct = total ? Math.round((d.late || 0) / total * 100) : 0;
  const aPct = total ? Math.round((d.absent || 0) / total * 100) : 0;
  return '<div class="summary-bar-section">' +
    '<div class="summary-bar-title">' + esc(title) + '</div>' +
    '<div class="summary-bar-count">' + d.present + '</div>' +
    '<div class="summary-bar-stats">' +
      '<span class="sbs-item" style="color:var(--present)"><span class="sbs-dot"></span>Present: ' + (d.present || 0) + ' (' + pPct + '%)</span>' +
      '<span class="sbs-sep">|</span>' +
      '<span class="sbs-item" style="color:var(--late)">Late: ' + (d.late || 0) + ' (' + lPct + '%)</span>' +
      '<span class="sbs-sep">|</span>' +
      '<span class="sbs-item" style="color:var(--absent)">Absent: ' + (d.absent || 0) + ' (' + aPct + '%)</span>' +
    '</div>' +
  '</div>';
}

async function loadSummary() {
  const ws = state.weekStartDate;
  const we = addDays(ws, 6);

  let m1 = await apiFetch({ action: 'summary', year: ws.getFullYear(), month: ws.getMonth() + 1 });

  if (we.getMonth() !== ws.getMonth() || we.getFullYear() !== ws.getFullYear()) {
    const m2 = await apiFetch({ action: 'summary', year: we.getFullYear(), month: we.getMonth() + 1 });
    // Merge overall totals
    m1.overall.present += m2.overall.present;
    m1.overall.late    += m2.overall.late;
    m1.overall.absent  += m2.overall.absent;
    m1.overall.total   += m2.overall.total;
    const t = m1.overall.total;
    m1.overall.present_pct = t ? Math.round(m1.overall.present / t * 100) : 0;
    m1.overall.late_pct    = t ? Math.round(m1.overall.late    / t * 100) : 0;
    m1.overall.absent_pct = t ? Math.round(m1.overall.absent  / t * 100) : 0;
    // Merge section totals
    m2.sections.forEach(function(s2) {
      const ex = m1.sections.find(function(s) { return s.grade === s2.grade && s.section === s2.section; });
      if (ex) {
        ex.present += s2.present; ex.late += s2.late; ex.absent += s2.absent; ex.total += s2.total;
        ex.present_pct = ex.total ? Math.round(ex.present / ex.total * 100) : 0;
        ex.late_pct    = ex.total ? Math.round(ex.late    / ex.total * 100) : 0;
        ex.absent_pct  = ex.total ? Math.round(ex.absent  / ex.total * 100) : 0;
      } else {
        m1.sections.push(s2);
      }
    });
  }

  let html = buildSummaryBar('All Students', m1.overall);
  if (state.sectionId !== 'all') {
    const sec = m1.sections.find(function(s) { return s.grade === state.grade && s.section === state.section; });
    if (sec) html += buildSummaryBar(sec.name, sec);
  }
  document.getElementById('summaryCards').innerHTML = html;
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

  // Head
  document.getElementById('tableHead').innerHTML = '<tr>' +
    '<th>Student</th>' +
    dates.map(function(d) {
      const dt      = new Date(d + 'T00:00:00');
      const isToday = d === todayYMD;
      const inner   = '<div class="th-day' + (isToday ? ' th-today' : '') + '">' +
        '<span class="th-day-name">' + dt.toLocaleDateString('en-US', { weekday: 'short' }) + '</span>' +
        '<span class="th-day-num">' + dt.getDate() + '</span>' +
        '<span class="th-day-mon">' + SHORT_MONTHS[dt.getMonth()] + '</span>' +
        '</div>';
      return '<th>' + inner + '</th>';
    }).join('') +
    '<th>Summary</th>' +
  '</tr>';

  // Body
  const tbody = document.getElementById('tableBody');
  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="' + (dates.length + 2) + '" class="table-loading">No students found for this section.</td></tr>';
    return;
  }

  tbody.innerHTML = students.map(function(s) {
    let p = 0, l = 0, a = 0;
    const cells = dates.map(function(d) {
      const status = s.statuses[d] || 'none';
      if (status === 'present') p++;
      else if (status === 'late') l++;
      else if (status === 'absent') a++;
      const label = status === 'none' ? 'No record' : cap(status);
      return '<td><span class="status-dot dot-' + status + '"' +
        ' title="' + label + ' \u2014 ' + d + '"' +
        ' onclick="cycleStatus(' + s.id + ',\'' + d + '\',this)"' +
        ' oncontextmenu="openCtxMenu(event,' + s.id + ',\'' + d + '\',this)"></span></td>';
    }).join('');

    const initials = s.full_name.split(' ').map(function(w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    const avatar   = '<div class="student-ava-fb">' + initials + '</div>';

    return '<tr data-name="' + esc(s.full_name.toLowerCase()) + '">' +
      '<td><div class="student-cell">' + avatar +
        '<span class="student-fullname">' + esc(s.full_name) + '</span>' +
      '</div></td>' +
      cells +
      '<td><div class="summary-cell">' +
        '<span class="sbs-item" style="color:var(--present)"><span class="sbs-dot"></span>P: ' + p + '</span>' +
        '<span class="sbs-item" style="color:var(--late)"><span class="sbs-dot"></span>L: ' + l + '</span>' +
        '<span class="sbs-item" style="color:var(--absent)"><span class="sbs-dot"></span>A: ' + a + '</span>' +
      '</div></td>' +
    '</tr>';
  }).join('');
}

// ════════════════════════════════════════════════════
//  STATUS CYCLING & CONTEXT MENU
// ════════════════════════════════════════════════════
const CYCLE = { none: 'present', present: 'late', late: 'absent', absent: 'present' };

async function cycleStatus(studentId, date, dot) {
  const cur  = ([].slice.call(dot.classList).find(function(c) { return c.startsWith('dot-'); }) || 'dot-none').replace('dot-', '');
  const next = CYCLE[cur] || 'present';

  dot.className = 'status-dot dot-' + next;
  dot.title     = cap(next) + ' \u2014 ' + date;

  const student = tableData.students.find(function(s) { return s.id == studentId; });
  if (student) student.statuses[date] = next;
  updateRowSummary(studentId);

  try {
    await apiPost({ student_id: studentId, date: date, status: next });
    await Promise.all([loadSummary(), loadAttendance()]);
  } catch (e) { console.error('Save failed:', e); }
}

let ctxTarget = null;

function openCtxMenu(e, studentId, date, dot) {
  e.preventDefault();
  closeCtxMenu();
  ctxTarget = { studentId: studentId, date: date, dot: dot };

  const cur = ([].slice.call(dot.classList).find(function(c) { return c.startsWith('dot-'); }) || 'dot-none').replace('dot-', '');
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

  dot.className = 'status-dot dot-' + status;
  dot.title     = cap(status) + ' \u2014 ' + date;

  const student = tableData.students.find(function(s) { return s.id == studentId; });
  if (student) student.statuses[date] = status;
  updateRowSummary(studentId);

  try {
    await apiPost({ student_id: studentId, date: date, status: status });
    await Promise.all([loadSummary(), loadAttendance()]);
  } catch (e) { console.error('Save failed:', e); }
}

async function clearStatus() {
  if (!ctxTarget) return;
  const studentId = ctxTarget.studentId;
  const date      = ctxTarget.date;
  const dot       = ctxTarget.dot;
  closeCtxMenu();

  dot.className = 'status-dot dot-none';
  dot.title     = 'No record \u2014 ' + date;

  const student = tableData.students.find(function(s) { return s.id == studentId; });
  if (student) delete student.statuses[date];
  updateRowSummary(studentId);

  try {
    await fetch(API + '?student_id=' + studentId + '&date=' + date, { method: 'DELETE' });
    await Promise.all([loadSummary(), loadAttendance()]);
  } catch (e) { console.error('Delete failed:', e); }
}

function updateRowSummary(studentId) {
  const student = tableData.students.find(function(s) { return s.id == studentId; });
  if (!student) return;
  let p = 0, l = 0, a = 0;
  Object.values(student.statuses).forEach(function(st) {
    if (st === 'present') p++;
    else if (st === 'late') l++;
    else if (st === 'absent') a++;
  });
  const row = document.querySelector('#tableBody tr[data-name="' + esc(student.full_name.toLowerCase()) + '"]');
  if (row) {
    const last = row.querySelector('td:last-child');
    if (last) last.innerHTML =
      '<div class="summary-cell">' +
        '<span class="sbs-item" style="color:var(--present)"><span class="sbs-dot"></span>P: ' + p + '</span>' +
        '<span class="sbs-item" style="color:var(--late)"><span class="sbs-dot"></span>L: ' + l + '</span>' +
        '<span class="sbs-item" style="color:var(--absent)"><span class="sbs-dot"></span>A: ' + a + '</span>' +
      '</div>';
  }
}

// ════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════
function showError(msg) {
  document.getElementById('summaryCards').innerHTML =
    '<div class="summary-skeleton" style="color:var(--absent)">' + esc(msg) + '</div>';
  document.getElementById('tableBody').innerHTML =
    '<tr><td colspan="9" class="table-loading" style="color:var(--absent)">' + esc(msg) + '</td></tr>';
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// Boot
init();