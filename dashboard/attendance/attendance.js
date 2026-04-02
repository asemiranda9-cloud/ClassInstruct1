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
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function weekDates(startMonday) {
  return Array.from({ length: 7 }, (_, i) => addDays(startMonday, i));
}

function fmtWeekLabel(startMonday) {
  const end = addDays(startMonday, 6);
  const sm  = SHORT_MONTHS[startMonday.getMonth()];
  const em  = SHORT_MONTHS[end.getMonth()];
  return startMonday.getMonth() === end.getMonth()
    ? `${sm} ${startMonday.getDate()}–${end.getDate()}, ${startMonday.getFullYear()}`
    : `${sm} ${startMonday.getDate()} – ${em} ${end.getDate()}, ${end.getFullYear()}`;
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
  const res = await fetch(`${API}?${new URLSearchParams(params)}`);
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
    showError('Could not connect to the database. Is XAMPP running?\n' + e.message);
  }
}

// ════════════════════════════════════════════════════
//  DROPDOWNS
// ════════════════════════════════════════════════════
function toggleDropdown(id) {
  const el = document.getElementById(id);
  const isOpen = el.style.display !== 'none';
  // Close all first
  document.querySelectorAll('.dropdown-menu').forEach(d => d.style.display = 'none');
  if (!isOpen) el.style.display = 'block';
}

document.addEventListener('click', e => {
  if (!e.target.closest('.toolbar-group') && !e.target.closest('.dropdown-menu')) {
    document.querySelectorAll('.dropdown-menu').forEach(d => d.style.display = 'none');
  }
});

function buildSectionDropdown() {
  const dd = document.getElementById('sectionDropdown');
  dd.innerHTML = `<button class="" onclick="selectAllSections()">All</button>` +
    state.sections.map(s =>
    `<button class="${s.id == state.sectionId ? 'selected' : ''}"
      onclick="selectSection(${s.id},'${esc(s.name)}','${esc(s.grade)}','${esc(s.section)}')"
    >${esc(s.name)}</button>`
  ).join('');
  const lbl = document.getElementById('sectionLabel');
  if (lbl) lbl.textContent = state.sectionName || 'All Sections';
}

function selectAllSections() {
  state.sectionId = 'all';
  state.sectionName = 'All Sections';
  const lbl = document.getElementById('sectionLabel');
  if (lbl) lbl.textContent = 'All Sections';
  document.getElementById('sectionDropdown').style.display = 'none';
  buildSectionDropdown();
  Promise.all([loadSummary(), loadAttendance()]);
}

function selectSection(id, name, grade, section) {
  state.sectionId   = id;
  state.sectionName = name;
  state.grade       = grade;
  state.section     = section;
  const lbl = document.getElementById('sectionLabel');
  if (lbl) lbl.textContent = name;
  document.getElementById('sectionDropdown').style.display = 'none';
  buildSectionDropdown();
  Promise.all([loadSummary(), loadAttendance()]);
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
  const dd       = document.getElementById('weekDropdown');
  const today    = new Date(); today.setHours(0,0,0,0);
  const todayYMD = toYMD(today);
  const wsYMD    = toYMD(state.weekStartDate);
  const weYMD    = toYMD(addDays(state.weekStartDate, 6));

  const firstDay    = new Date(calViewYear, calViewMonth, 1);
  const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
  let startOffset   = firstDay.getDay();
  startOffset       = startOffset === 0 ? 6 : startOffset - 1; // Mon-based

  const title    = `${MONTHS[calViewMonth]} ${calViewYear}`;
  const dayLabels = ['Mo','Tu','We','Th','Fr','Sa','Su'];
  let cells = '';

  for (let i = 0; i < startOffset; i++) {
    const prevDate = new Date(calViewYear, calViewMonth, 1 - (startOffset - i));
    const wStart   = toYMD(weekStart(prevDate));
    cells += `<button class="cal-day cal-day-empty cal-day-other-month" onclick="selectWeek('${wStart}')">${prevDate.getDate()}</button>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date   = new Date(calViewYear, calViewMonth, d);
    const ymd    = toYMD(date);
    const wYMD   = toYMD(weekStart(date));
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

  const rem = (startOffset + daysInMonth) % 7;
  if (rem > 0) {
    for (let d = 1; d <= 7 - rem; d++) {
      const nextDate = new Date(calViewYear, calViewMonth + 1, d);
      const wStart   = toYMD(weekStart(nextDate));
      cells += `<button class="cal-day cal-day-empty cal-day-other-month" onclick="selectWeek('${wStart}')">${d}</button>`;
    }
  }

  dd.innerHTML = `
    <div class="cal-header">
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
  renderWeekCalendar();
}

function calGoToday() {
  const today = new Date(); today.setHours(0,0,0,0);
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

// ════════════════════════════════════════════════════
//  SUMMARY CARDS
// ════════════════════════════════════════════════════
async function loadSummary() {
  const ws = state.weekStartDate;
  let data;

  if (state.sectionId === 'all') {
    const allData = await Promise.all(state.sections.map(s =>
      apiFetch({ action: 'summary', year: ws.getFullYear(), month: ws.getMonth() + 1 })
    ));
    data = { overall: { present: 0, late: 0, absent: 0, present_pct: 0, late_pct: 0, absent_pct: 0 }, sections: [] };
    allData.forEach(d => {
      data.overall.present += d.overall.present;
      data.overall.late += d.overall.late;
      data.overall.absent += d.overall.absent;
      data.sections.push(...d.sections);
    });
    const total = data.overall.present + data.overall.late + data.overall.absent || 1;
    data.overall.present_pct = Math.round(data.overall.present / total * 100);
    data.overall.late_pct = Math.round(data.overall.late / total * 100);
    data.overall.absent_pct = Math.round(data.overall.absent / total * 100);
  } else {
    data = await apiFetch({
      action: 'summary',
      year:   ws.getFullYear(),
      month:  ws.getMonth() + 1,
    });
  }

  const mkCard = (title, d) => {
    const total = d.present + d.late + d.absent || 1;
    return `
    <article class="summary-card">
      <div class="card-header">
        <h3>${esc(title)}</h3>
        <span class="badge badge-present">Present</span>
      </div>
      <div class="card-value">${d.present}</div>
      <div class="breakdown">
        <div class="breakdown-item">
          <span class="breakdown-dot" style="background:var(--present)"></span>
          <span class="breakdown-label">On-Time</span>
          <span class="breakdown-value">${d.present}</span>
          <span class="breakdown-pct pct-present">${d.present_pct}%</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-dot" style="background:var(--late)"></span>
          <span class="breakdown-label">Late</span>
          <span class="breakdown-value">${d.late}</span>
          <span class="breakdown-pct">${d.late_pct}%</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-dot" style="background:var(--absent)"></span>
          <span class="breakdown-label">Absent</span>
          <span class="breakdown-value">${d.absent}</span>
          <span class="breakdown-pct pct-absent">${d.absent_pct}%</span>
        </div>
      </div>
    </article>`;
  };

  let html = mkCard('All Students', data.overall);
  if (state.sectionId !== 'all') {
    const sec = data.sections.find(s => s.grade === state.grade && s.section === state.section);
    if (sec) html += mkCard(sec.name, sec);
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
    // Fetch attendance for all sections combined
    const allData = await Promise.all(state.sections.map(s =>
      apiFetch({ action: 'attendance', grade: s.grade, section: s.section, year: ws.getFullYear(), month: ws.getMonth() + 1 })
    ));
    data = { dates: [], students: [] };
    allData.forEach(d => {
      data.dates = [...data.dates, ...d.dates];
      data.students = [...data.students, ...d.students];
    });
  } else {
    data = await apiFetch({
      action: 'attendance', grade: state.grade, section: state.section,
      year: ws.getFullYear(), month: ws.getMonth() + 1,
    });
  }

  // Merge second month if week spans a boundary
  if (we.getMonth() !== ws.getMonth() || we.getFullYear() !== ws.getFullYear()) {
    let m2;
    if (state.sectionId === 'all') {
      const allData2 = await Promise.all(state.sections.map(s =>
        apiFetch({ action: 'attendance', grade: s.grade, section: s.section, year: we.getFullYear(), month: we.getMonth() + 1 })
      ));
      m2 = { dates: [], students: [] };
      allData2.forEach(d => {
        m2.dates = [...m2.dates, ...d.dates];
        m2.students = [...m2.students, ...d.students];
      });
    } else {
      m2 = await apiFetch({
        action: 'attendance', grade: state.grade, section: state.section,
        year: we.getFullYear(), month: we.getMonth() + 1,
      });
    }
    data.dates = [...data.dates, ...m2.dates];
    m2.students.forEach(s2 => {
      const ex = data.students.find(s => s.id === s2.id);
      if (ex) Object.assign(ex.statuses, s2.statuses);
    });
  }

  const weekYMDs = weekDates(ws).map(toYMD);
  tableData = {
    dates:    data.dates.filter(d => weekYMDs.includes(d)),
    students: data.students,
  };
  renderTable();
}

function renderTable() {
  const { dates, students } = tableData;
  const todayYMD = toYMD(new Date());

  // ── Head ──
  document.getElementById('tableHead').innerHTML = `<tr>
    <th>Student</th>
    ${dates.map(d => {
      const dt      = new Date(d + 'T00:00:00');
      const isToday = d === todayYMD;
      const inner   = `
        <div class="th-day${isToday ? ' th-today' : ''}">
          <span class="th-day-name">${dt.toLocaleDateString('en-US',{weekday:'short'})}</span>
          <span class="th-day-num">${dt.getDate()}</span>
          <span class="th-day-mon">${SHORT_MONTHS[dt.getMonth()]}</span>
        </div>`;
      return `<th title="${dt.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}">${inner}</th>`;
    }).join('')}
    <th>Summary</th>
  </tr>`;

  // ── Body ──
  const tbody = document.getElementById('tableBody');
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="${dates.length + 2}" class="table-loading">No students found for this section.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    let p = 0, l = 0, a = 0;

    const cells = dates.map(d => {
      const status = s.statuses[d] || 'none';
      if (status === 'present') p++;
      else if (status === 'late') l++;
      else if (status === 'absent') a++;
      const label = status === 'none' ? 'No record' : cap(status);
      return `<td>
        <span class="status-dot dot-${status}"
              title="${label} — ${d}"
              onclick="cycleStatus(${s.id},'${d}',this)"
              oncontextmenu="openCtxMenu(event,${s.id},'${d}',this)"></span>
      </td>`;
    }).join('');

    // Initials fallback avatar
    const initials = s.full_name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
    const avatar   = s.avatar
      ? `<img src="${esc(s.avatar)}" alt="" class="student-ava" onerror="this.outerHTML='<div class=\\'student-ava-fb\\'>${initials}</div>'">`
      : `<div class="student-ava-fb">${initials}</div>`;

    return `<tr data-name="${esc(s.full_name.toLowerCase())}">
      <td>
        <div class="student-cell">
          ${avatar}
          <span class="student-fullname">${esc(s.full_name)}</span>
        </div>
      </td>
      ${cells}
      <td>
        <div class="summary-cell">
          <span class="summary-pill" style="color:var(--present)">
            <span class="breakdown-dot" style="background:var(--present)"></span>P: ${p}
          </span>
          <span class="summary-pill" style="color:var(--late)">
            <span class="breakdown-dot" style="background:var(--late)"></span>L: ${l}
          </span>
          <span class="summary-pill" style="color:var(--absent)">
            <span class="breakdown-dot" style="background:var(--absent)"></span>A: ${a}
          </span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ════════════════════════════════════════════════════
//  STATUS CYCLING & CONTEXT MENU
// ════════════════════════════════════════════════════
const CYCLE = { none: 'present', present: 'late', late: 'absent', absent: 'present' };

async function cycleStatus(studentId, date, dot) {
  const cur  = ([...dot.classList].find(c => c.startsWith('dot-')) || 'dot-none').replace('dot-','');
  const next = CYCLE[cur] || 'present';

  dot.className = `status-dot dot-${next}`;
  dot.title = `${cap(next)} — ${date}`;

  const student = tableData.students.find(s => s.id == studentId);
  if (student) student.statuses[date] = next;
  updateRowSummary(studentId);

  try {
    await apiPost({ student_id: studentId, date, status: next });
    loadSummary();
  } catch (e) { console.error('Save failed:', e); }
}

let ctxTarget = null;

function openCtxMenu(e, studentId, date, dot) {
  e.preventDefault();
  closeCtxMenu();
  ctxTarget = { studentId, date, dot };

  const cur = ([...dot.classList].find(c => c.startsWith('dot-')) || 'dot-none').replace('dot-','');
  const chk = s => s === cur ? ' ✓' : '';

  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.id = 'ctxMenu';
  menu.innerHTML = `
    <div class="ctx-menu-header">${esc(date)}</div>
    <button onclick="setStatus('present')">
      <span class="ctx-dot" style="background:var(--present)"></span>Present${chk('present')}
    </button>
    <button onclick="setStatus('late')">
      <span class="ctx-dot" style="background:var(--late)"></span>Late${chk('late')}
    </button>
    <button onclick="setStatus('absent')">
      <span class="ctx-dot" style="background:var(--absent)"></span>Absent${chk('absent')}
    </button>
    <div class="ctx-divider"></div>
    <button class="ctx-delete" onclick="clearStatus()">
      <span class="ctx-dot" style="background:#e2e8f0"></span>Clear record
    </button>`;

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
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCtxMenu(); });

async function setStatus(status) {
  if (!ctxTarget) return;
  const { studentId, date, dot } = ctxTarget;
  closeCtxMenu();

  dot.className = `status-dot dot-${status}`;
  dot.title = `${cap(status)} — ${date}`;

  const student = tableData.students.find(s => s.id == studentId);
  if (student) student.statuses[date] = status;
  updateRowSummary(studentId);

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
  dot.title = `No record — ${date}`;

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
  const row = document.querySelector(`#tableBody tr[data-name="${esc(student.full_name.toLowerCase())}"]`);
  if (row) {
    const last = row.querySelector('td:last-child');
    if (last) last.innerHTML = `
      <div class="summary-cell">
        <span class="summary-pill" style="color:var(--present)">
          <span class="breakdown-dot" style="background:var(--present)"></span>P: ${p}
        </span>
        <span class="summary-pill" style="color:var(--late)">
          <span class="breakdown-dot" style="background:var(--late)"></span>L: ${l}
        </span>
        <span class="summary-pill" style="color:var(--absent)">
          <span class="breakdown-dot" style="background:var(--absent)"></span>A: ${a}
        </span>
      </div>`;
  }
}

// ════════════════════════════════════════════════════
//  SEARCH FILTER
// ════════════════════════════════════════════════════
function filterTable() {
  const q = (document.getElementById('search-input').value || '').toLowerCase();
  document.querySelectorAll('#tableBody tr[data-name]').forEach(row => {
    row.style.display = row.dataset.name.includes(q) ? '' : 'none';
  });
}

// ════════════════════════════════════════════════════
//  VIEW TOGGLE
// ════════════════════════════════════════════════════
let currentView = 'week';

function switchView(view) {
  currentView = view;
  const weekView = document.getElementById('weekView');
  const calView  = document.getElementById('calendarView');
  const btnWeek  = document.getElementById('btnViewWeek');
  const btnCal   = document.getElementById('btnViewCal');
  const weekNav  = document.getElementById('weekNav');

  if (view === 'calendar') {
    weekView.style.display = 'none';
    calView.style.display  = 'block';
    weekNav.style.display  = 'none';
    btnWeek.classList.remove('active');
    btnCal.classList.add('active');
    loadCalendarHeatmap();
  } else {
    weekView.style.display = 'block';
    calView.style.display  = 'none';
    weekNav.style.display  = 'flex';
    btnCal.classList.remove('active');
    btnWeek.classList.add('active');
  }
}

// ════════════════════════════════════════════════════
//  CALENDAR HEATMAP
// ════════════════════════════════════════════════════
let calHeatYear  = new Date().getFullYear();
let calHeatMonth = new Date().getMonth();

async function loadCalendarHeatmap() {
  const year  = calHeatYear;
  const month = calHeatMonth + 1;

  document.getElementById('calHeatMonthLabel').textContent = `${MONTHS[calHeatMonth]} ${calHeatYear}`;

  try {
    const data = await apiFetch({ action: 'attendance', grade: '', section: '', year, month });
    const total = data.students.length;
    const heatData = {};

    if (total > 0) {
      data.students.forEach(s => {
        Object.entries(s.statuses || {}).forEach(([date, status]) => {
          if (!heatData[date]) heatData[date] = { present: 0, total };
          if (status === 'present' || status === 'late') heatData[date].present++;
        });
      });
      Object.values(heatData).forEach(d => {
        d.pct = Math.round((d.present / d.total) * 100);
      });
    }

    renderCalendarHeatmap(heatData, total);
  } catch (err) {
    document.getElementById('calHeatGrid').innerHTML =
      `<div style="color:var(--absent);padding:20px;grid-column:1/-1">${esc(err.message)}</div>`;
  }
}

function renderCalendarHeatmap(heatData, totalStudents) {
  const year         = calHeatYear;
  const month        = calHeatMonth;
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const firstDow     = new Date(year, month, 1).getDay();
  // Mon-based offset
  const startOffset  = firstDow === 0 ? 6 : firstDow - 1;
  const todayYMD     = toYMD(new Date());

  let html = '';

  // Leading empties
  for (let i = 0; i < startOffset; i++) html += '<div class="heat-cell heat-empty"></div>';

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr  = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dow      = new Date(dateStr + 'T00:00:00').getDay();
    const isWknd   = dow === 0 || dow === 6;
    const isToday  = dateStr === todayYMD;
    const info     = heatData[dateStr];

    let cls = 'heat-cell';
    let style = '', label = '';

    if (isWknd) {
      cls  += ' heat-weekend';
      label = `<span class="heat-day-num">${day}</span>`;
    } else if (info) {
      const pct   = info.pct;
      const color = pctToColor(pct);
      style = `background:${color};`;
      cls  += ' heat-has-data';
      if (pct >= 75) cls += ' heat-light-text';
      label = `<span class="heat-day-num">${day}</span><span class="heat-pct">${pct}%</span>`;
    } else {
      cls  += ' heat-no-data';
      label = `<span class="heat-day-num">${day}</span>`;
    }

    if (isToday) cls += ' heat-today';

    const tip = info
      ? `${dateStr} — ${info.pct}% present (${info.present}/${info.total})`
      : dateStr;

    html += `<div class="${cls}" style="${style}" title="${esc(tip)}">${label}</div>`;
  }

  // Trailing empties
  const rem = (startOffset + daysInMonth) % 7;
  if (rem > 0) for (let i = 0; i < 7 - rem; i++) html += '<div class="heat-cell heat-empty"></div>';

  document.getElementById('calHeatGrid').innerHTML = html;
  document.getElementById('calHeatTotal').textContent = `${totalStudents} students`;
}

function pctToColor(pct) {
  if (pct >= 95) return '#059669';
  if (pct >= 85) return '#10b981';
  if (pct >= 75) return '#34d399';
  if (pct >= 60) return '#fbbf24';
  if (pct >= 40) return '#f97316';
  return '#ef4444';
}

function shiftHeatMonth(delta) {
  calHeatMonth += delta;
  if (calHeatMonth > 11) { calHeatMonth = 0;  calHeatYear++; }
  if (calHeatMonth < 0)  { calHeatMonth = 11; calHeatYear--; }
  loadCalendarHeatmap();
}

function heatGoToday() {
  const now    = new Date();
  calHeatYear  = now.getFullYear();
  calHeatMonth = now.getMonth();
  loadCalendarHeatmap();
}

// ════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════
function showError(msg) {
  document.getElementById('summaryCards').innerHTML =
    `<div class="summary-skeleton" style="color:var(--absent)">${esc(msg)}</div>`;
  document.getElementById('tableBody').innerHTML =
    `<tr><td colspan="9" class="table-loading" style="color:var(--absent)">${esc(msg)}</td></tr>`;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// ── Boot ──
init();