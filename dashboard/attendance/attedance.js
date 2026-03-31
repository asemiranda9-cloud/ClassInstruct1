// ============================================
//  attendance.js — ClassInstruct Attendance Logic
//  Wired to MySQL via attendance_db.php
// ============================================

const API = 'attedance_db.php';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const SHORT_MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'
];

// ── Week Helpers ──────────────────────────────────────────

/** Returns the Monday (start) of the week containing `date` */
function weekStart(date) {
  const d   = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
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
  return `${y}-${m}-${d}`;
}

function weekDates(startMonday) {
  return Array.from({ length: 7 }, (_, i) => addDays(startMonday, i));
}

function fmtWeekLabel(startMonday) {
  const end = addDays(startMonday, 6);
  const sm  = SHORT_MONTHS[startMonday.getMonth()];
  const em  = SHORT_MONTHS[end.getMonth()];
  if (startMonday.getMonth() === end.getMonth()) {
    return `${sm} ${startMonday.getDate()}–${end.getDate()}, ${startMonday.getFullYear()}`;
  }
  return `${sm} ${startMonday.getDate()} – ${em} ${end.getDate()}, ${end.getFullYear()}`;
}

// ── State ─────────────────────────────────────────────────

let state = {
  sections:      [],
  sectionId:     1,
  sectionName:   '',
  grade:         '',
  section:       '',
  weekStartDate: weekStart(new Date()),
};

// ── Fetch Helpers ─────────────────────────────────────────

async function apiFetch(params) {
  const qs  = new URLSearchParams(params).toString();
  const res = await fetch(`${API}?${qs}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(API, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  return res.json();
}

// ── Init ──────────────────────────────────────────────────

async function init() {
  try {
    state.sections = await apiFetch({ action: 'sections' });
    if (state.sections.length) {
      const first       = state.sections[0];
      state.sectionId   = first.id;
      state.sectionName = first.name;
      state.grade       = first.grade;
      state.section     = first.section;
    }
    buildSectionDropdown();
    buildWeekDropdown();
    await Promise.all([loadSummary(), loadAttendance()]);
  } catch (e) {
    showError('Could not connect to database. Is XAMPP running? — ' + e.message);
  }
}

// ── Dropdowns ─────────────────────────────────────────────

function toggleDropdown(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.table-controls')) {
    document.querySelectorAll('.dropdown-menu').forEach(d => d.style.display = 'none');
  }
});

function buildSectionDropdown() {
  const dd = document.getElementById('sectionDropdown');
  dd.innerHTML = state.sections.map(s =>
    `<button class="${s.id == state.sectionId ? 'selected' : ''}"
      onclick="selectSection(${s.id},'${escHtml(s.name)}','${escHtml(s.grade)}','${escHtml(s.section)}')"
     >${escHtml(s.name)}</button>`
  ).join('');
  document.getElementById('sectionLabel').textContent = state.sectionName || 'Select Section';
}

function selectSection(id, name, grade, section) {
  state.sectionId   = id;
  state.sectionName = name;
  state.grade       = grade;
  state.section     = section;
  document.getElementById('sectionLabel').textContent = name;
  document.getElementById('sectionDropdown').style.display = 'none';
  buildSectionDropdown();
  Promise.all([loadSummary(), loadAttendance()]);
}

// ── Calendar Week Picker ──────────────────────────────────

let calViewYear  = state.weekStartDate.getFullYear();
let calViewMonth = state.weekStartDate.getMonth(); // 0-indexed

function buildWeekDropdown() {
  updateWeekLabel();
  calViewYear  = state.weekStartDate.getFullYear();
  calViewMonth = state.weekStartDate.getMonth();
  renderCalendar();
}

function renderCalendar() {
  const dd       = document.getElementById('weekDropdown');
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const todayYMD = toYMD(today);
  const wsYMD    = toYMD(state.weekStartDate);
  const weYMD    = toYMD(addDays(state.weekStartDate, 6));
  const title    = `${MONTHS[calViewMonth]} ${calViewYear}`;

  const firstDay    = new Date(calViewYear, calViewMonth, 1);
  const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
  let startOffset   = firstDay.getDay();
  startOffset       = startOffset === 0 ? 6 : startOffset - 1; // Mon-based

  const dayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  let cells = '';

  // Prev-month overflow days
  for (let i = 0; i < startOffset; i++) {
    const prevDate = new Date(calViewYear, calViewMonth, 1 - (startOffset - i));
    const wStart   = toYMD(weekStart(prevDate));
    cells += `<button class="cal-day cal-day-empty cal-day-other-month" onclick="selectWeek('${wStart}')">${prevDate.getDate()}</button>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const date   = new Date(calViewYear, calViewMonth, d);
    const ymd    = toYMD(date);
    const wMon   = weekStart(date);
    const wYMD   = toYMD(wMon);
    const inWeek = ymd >= wsYMD && ymd <= weYMD;
    const isToday = ymd === todayYMD;
    const isWkSt  = ymd === wsYMD;
    const isWkEnd = ymd === weYMD;

    let cls = 'cal-day';
    if (inWeek)  cls += ' cal-day-in-week';
    if (isToday) cls += ' cal-day-today';
    if (isWkSt)  cls += ' cal-day-week-start';
    if (isWkEnd) cls += ' cal-day-week-end';

    cells += `<button class="${cls}" onclick="selectWeek('${wYMD}')">${d}</button>`;
  }

  // Next-month overflow days
  const totalCells = startOffset + daysInMonth;
  const remainder  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let d = 1; d <= remainder; d++) {
    const nextDate = new Date(calViewYear, calViewMonth + 1, d);
    const wStart   = toYMD(weekStart(nextDate));
    cells += `<button class="cal-day cal-day-empty cal-day-other-month" onclick="selectWeek('${wStart}')">${d}</button>`;
  }

  dd.innerHTML = `
    <div class="cal-header">
      <button class="cal-nav-btn" onclick="calShiftMonth(-1);event.stopPropagation()">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <span class="cal-header-title" onclick="event.stopPropagation()">${title}</span>
    </div>
    <div class="cal-weekdays">${dayLabels.map(l => `<div class="cal-weekday">${l}</div>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    <div class="cal-footer">
      <button class="cal-today-btn" onclick="calGoToday();event.stopPropagation()">Today</button>
    </div>`;
}

function calShiftMonth(delta) {
  calViewMonth += delta;
  if (calViewMonth > 11) { calViewMonth = 0;  calViewYear++; }
  if (calViewMonth < 0)  { calViewMonth = 11; calViewYear--; }
  renderCalendar();
}

function calGoToday() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  state.weekStartDate = weekStart(today);
  document.getElementById('weekDropdown').style.display = 'none';
  buildWeekDropdown();
  Promise.all([loadSummary(), loadAttendance()]);
}

function selectWeek(ymd) {
  state.weekStartDate = new Date(ymd + 'T00:00:00');
  document.getElementById('weekDropdown').style.display = 'none';
  buildWeekDropdown();
  Promise.all([loadSummary(), loadAttendance()]);
}

function shiftWeek(delta) {
  state.weekStartDate = addDays(state.weekStartDate, delta * 7);
  buildWeekDropdown();
  Promise.all([loadSummary(), loadAttendance()]);
}

function updateWeekLabel() {
  document.getElementById('weekLabel').textContent = fmtWeekLabel(state.weekStartDate);
}

// ── Summary Cards ─────────────────────────────────────────

async function loadSummary() {
  const ws   = state.weekStartDate;
  const data = await apiFetch({
    action: 'summary',
    year:   ws.getFullYear(),
    month:  ws.getMonth() + 1,
  });
  const cards = document.getElementById('summaryCards');

  const mkCard = (title, d) => `
    <article class="summary-card">
      <div class="card-header">
        <h3>${escHtml(title)}</h3>
        <span class="badge present">Present</span>
      </div>
      <div class="card-value">${d.present}</div>
      <div class="breakdown">
        <div class="breakdown-item">
          <span class="breakdown-label">On-Time</span>
          <span class="breakdown-value">${d.present}</span>
          <span class="breakdown-percent">${d.present_pct}%</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-label">Late</span>
          <span class="breakdown-value">${d.late}</span>
          <span class="breakdown-percent">${d.late_pct}%</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-label">Absent</span>
          <span class="breakdown-value">${d.absent}</span>
          <span class="breakdown-percent absent">${d.absent_pct}%</span>
        </div>
      </div>
    </article>`;

  let html = mkCard('All Students', data.overall);
  const sec = data.sections.find(s => s.grade === state.grade && s.section === state.section);
  if (sec) html += mkCard(sec.name, sec);
  cards.innerHTML = html;
}

// ── Attendance Table ──────────────────────────────────────

let tableData = { dates: [], students: [] };

async function loadAttendance() {
  const ws = state.weekStartDate;
  const we = addDays(ws, 6);

  let monthData = await apiFetch({
    action:  'attendance',
    grade:   state.grade,
    section: state.section,
    year:    ws.getFullYear(),
    month:   ws.getMonth() + 1,
  });

  // If week spans two months, fetch and merge the second month
  if (we.getMonth() !== ws.getMonth() || we.getFullYear() !== ws.getFullYear()) {
    const m2 = await apiFetch({
      action:  'attendance',
      grade:   state.grade,
      section: state.section,
      year:    we.getFullYear(),
      month:   we.getMonth() + 1,
    });
    monthData.dates = [...monthData.dates, ...m2.dates];
    m2.students.forEach(s2 => {
      const existing = monthData.students.find(s => s.id === s2.id);
      if (existing) Object.assign(existing.statuses, s2.statuses);
    });
  }

  // Filter to just this week's 7 days
  const weekYMDs = weekDates(ws).map(d => toYMD(d));
  tableData = {
    dates:    monthData.dates.filter(d => weekYMDs.includes(d)),
    students: monthData.students,
  };
  renderTable();
}

function renderTable() {
  const { dates, students } = tableData;
  const todayYMD = toYMD(new Date());

  // Head
  const thead = document.getElementById('tableHead');
  thead.innerHTML = `<tr>
    <th class="student-col">Student</th>
    ${dates.map(d => {
      const dt       = new Date(d + 'T00:00:00');
      const dayFull  = dt.toLocaleDateString('en-US', { weekday: 'long' });
      const daySh    = dt.toLocaleDateString('en-US', { weekday: 'short' });
      const num      = dt.getDate();
      const mon      = SHORT_MONTHS[dt.getMonth()];
      const isToday  = d === todayYMD;
      const todayStyle = isToday
        ? 'background:var(--primary-light);color:var(--primary-color);border-radius:var(--radius-sm);'
        : '';
      return `<th title="${dayFull}, ${d}" style="${todayStyle}">
        ${daySh}<br>
        <span style="font-size:1rem;font-weight:700">${num}</span>
        <br><span style="font-size:0.65rem;font-weight:400;opacity:.7">${mon}</span>
      </th>`;
    }).join('')}
    <th>Summary</th>
  </tr>`;

  // Body
  const tbody = document.getElementById('tableBody');
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="${dates.length + 2}" style="text-align:center;padding:40px;opacity:.5">No students found for this section.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    let present = 0, late = 0, absent = 0;
    const cells = dates.map(d => {
      const status = s.statuses[d] || 'none';
      if (status === 'present') present++;
      else if (status === 'late') late++;
      else if (status === 'absent') absent++;
      const cls   = status === 'none' ? 'dot-none' : `dot-${status}`;
      const label = status === 'none' ? 'No record' : status.charAt(0).toUpperCase() + status.slice(1);
      return `<td><span class="status-dot ${cls}" title="${label} — ${d}" onclick="cycleStatus(${s.id},'${d}',this)" oncontextmenu="openCtxMenu(event,${s.id},'${d}',this)"></span></td>`;
    }).join('');

    return `<tr data-name="${escHtml(s.full_name.toLowerCase())}">
      <td>
        <div class="student-name">
          <img src="${escHtml(s.avatar || '../../image/Student.png')}" alt="" class="student-avatar" onerror="this.style.display='none'"/>
          ${escHtml(s.full_name)}
        </div>
      </td>
      ${cells}
      <td style="font-size:0.78rem;white-space:nowrap;color:var(--text-secondary)">
        <span style="color:var(--status-present)">P:${present}</span>
        <span style="color:var(--status-late)"> L:${late}</span>
        <span style="color:var(--status-absent)"> A:${absent}</span>
      </td>
    </tr>`;
  }).join('');
}

// ── Status Cycling (left-click) ───────────────────────────

const CYCLE = { none: 'present', present: 'late', late: 'absent', absent: 'present' };

async function cycleStatus(studentId, date, dot) {
  const currentClass = [...dot.classList].find(c => c.startsWith('dot-')) || 'dot-none';
  const current      = currentClass.replace('dot-', '');
  const next         = CYCLE[current] || 'present';

  dot.classList.remove(currentClass);
  dot.classList.add(`dot-${next}`);
  dot.title = next.charAt(0).toUpperCase() + next.slice(1) + ' — ' + date;

  const student = tableData.students.find(s => s.id == studentId);
  if (student) student.statuses[date] = next;

  try {
    await apiPost({ student_id: studentId, date, status: next });
    loadSummary();
  } catch (e) {
    console.error('Save failed:', e);
  }
}

// ── Context Menu (right-click) ────────────────────────────

let ctxTarget = null;

function openCtxMenu(e, studentId, date, dot) {
  e.preventDefault();
  closeCtxMenu();
  ctxTarget = { studentId, date, dot };

  const current = ([...dot.classList].find(c => c.startsWith('dot-')) || 'dot-none').replace('dot-', '');

  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.id = 'ctxMenu';
  menu.innerHTML = `
    <div class="ctx-menu-header">${date}</div>
    <button onclick="setStatus('present')">
      <span class="ctx-dot" style="background:var(--status-present)"></span> Present
      ${current === 'present' ? '✓' : ''}
    </button>
    <button onclick="setStatus('late')">
      <span class="ctx-dot" style="background:var(--status-late)"></span> Late
      ${current === 'late' ? '✓' : ''}
    </button>
    <button onclick="setStatus('absent')">
      <span class="ctx-dot" style="background:var(--status-absent)"></span> Absent
      ${current === 'absent' ? '✓' : ''}
    </button>
    <div class="ctx-divider"></div>
    <button class="ctx-delete" onclick="clearStatus()">
      <span class="ctx-dot" style="background:#e2e8f0"></span> Clear / Delete
    </button>`;

  menu.style.left = Math.min(e.clientX, window.innerWidth  - 160) + 'px';
  menu.style.top  = Math.min(e.clientY, window.innerHeight - 220) + 'px';
  document.body.appendChild(menu);
}

function closeCtxMenu() {
  const m = document.getElementById('ctxMenu');
  if (m) m.remove();
  ctxTarget = null;
}

document.addEventListener('click',   closeCtxMenu);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCtxMenu(); });

async function setStatus(status) {
  if (!ctxTarget) return;
  const { studentId, date, dot } = ctxTarget;
  closeCtxMenu();

  dot.className = `status-dot dot-${status}`;
  dot.title = status.charAt(0).toUpperCase() + status.slice(1) + ' — ' + date;

  const student = tableData.students.find(s => s.id == studentId);
  if (student) student.statuses[date] = status;

  try {
    await apiPost({ student_id: studentId, date, status });
    loadSummary();
  } catch (e) { console.error('Save failed:', e); }
}

async function clearStatus() {
  if (!ctxTarget) return;
  const { studentId, date, dot } = ctxTarget;
  closeCtxMenu();

  dot.className = 'status-dot dot-none';
  dot.title = 'No record — ' + date;

  const student = tableData.students.find(s => s.id == studentId);
  if (student) delete student.statuses[date];

  updateRowSummary(studentId);

  try {
    await fetch(`${API}?student_id=${studentId}&date=${date}`, { method: 'DELETE' });
    loadSummary();
  } catch (e) { console.error('Delete failed:', e); }
}

function updateRowSummary(studentId) {
  const student = tableData.students.find(s => s.id == studentId);
  if (!student) return;
  let p = 0, l = 0, a = 0;
  Object.values(student.statuses).forEach(st => {
    if (st === 'present') p++;
    else if (st === 'late') l++;
    else if (st === 'absent') a++;
  });
  const row = document.querySelector(`#tableBody tr[data-name="${escHtml(student.full_name.toLowerCase())}"]`);
  if (row) {
    const lastTd = row.querySelector('td:last-child');
    if (lastTd) lastTd.innerHTML = `
      <span style="color:var(--status-present)">P:${p}</span>
      <span style="color:var(--status-late)"> L:${l}</span>
      <span style="color:var(--status-absent)"> A:${a}</span>`;
  }
}

// ── Search Filter ─────────────────────────────────────────

function filterTable() {
  const q = document.getElementById('search-input').value.toLowerCase();
  document.querySelectorAll('#tableBody tr[data-name]').forEach(row => {
    row.style.display = row.dataset.name.includes(q) ? '' : 'none';
  });
}

// ── Utilities ─────────────────────────────────────────────

function showError(msg) {
  document.getElementById('summaryCards').innerHTML =
    `<div class="summary-card" style="color:#ef4444;padding:20px">${escHtml(msg)}</div>`;
  document.getElementById('tableBody').innerHTML =
    `<tr><td colspan="9" style="text-align:center;padding:30px;color:#ef4444">${escHtml(msg)}</td></tr>`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Start ─────────────────────────────────────────────────
init();