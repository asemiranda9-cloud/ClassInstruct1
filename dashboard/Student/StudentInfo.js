'use strict';

// ════════════════════════════════════════════════════
//  API ENDPOINTS
// ════════════════════════════════════════════════════
const API_STUDENTS   = '/dashboard/api/db.php';
const API_ATTENDANCE = '/dashboard/attendance/attedance_db.php';
const API_GRADES     = '/dashboard/Student/grades_db.php';

const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Heatmap state ──────────────────────────────────
let hmYear        = new Date().getFullYear();
let hmMonth       = new Date().getMonth();
let studentId     = null;
let studentAttMap = {};
let _cachedStudent = null;

// ════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', bootPage);

async function bootPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { showError('No student ID provided.'); return; }

  try {
    const res = await fetch(API_STUDENTS);
    if (!res.ok) throw new Error('API responded with ' + res.status);
    const students = await res.json();
    const s = students.find(x => String(x.id) === String(id));
    if (!s) { showError('Student not found. They may have been deleted.'); return; }

    studentId      = s.id;
    _cachedStudent = s;

    renderPage(s);
    initRecords(s.id);

    // Fire these in parallel
    await Promise.allSettled([
      fetchAndRenderHeatmap(s.id, s.grade, s.section),
      loadSubjectFilter(s),
    ]);

  } catch (err) {
    showError('Could not load student data. Is XAMPP running?\n' + err.message);
  }
}

// ════════════════════════════════════════════════════
//  RENDER PAGE SKELETON
// ════════════════════════════════════════════════════
function buildFullName(s) {
  const lastName   = s.lastName   || '';
  const firstName  = s.firstName  || '';
  const middleInit = s.middleName ? s.middleName[0] + '.' : '';
  const parts = [firstName, middleInit].filter(Boolean);
  const fullName = parts.join(' ');
  return lastName ? (fullName ? lastName + ', ' + fullName : lastName) : fullName || '—';
}

function getInitials(s) {
  return ((s.firstName || '')[0] || '') + ((s.lastName || '')[0] || '');
}

function renderPage(s) {
  const name = buildFullName(s);
  document.title = name + ' — ClassInstruct';
  const bc = document.getElementById('breadcrumbName');
  if (bc) bc.textContent = name;

  renderProfileCard(s);
  renderGuardianCard(s);
  renderHeatmapSkeleton();

  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('pageContent').style.display  = 'flex';
}

// ════════════════════════════════════════════════════
//  PROFILE CARD
// ════════════════════════════════════════════════════
function renderProfileCard(s) {
  const name    = buildFullName(s);
  const lrn     = s.studentId || s.student_id || '—';
  const gender  = s.gender || '—';
  const dob     = s.dob ? formatDate(s.dob) : '—';
  const phone   = s.phone || '—';
  const address = s.address || '—';
  const section = s.section || '—';
  const grade   = s.grade   || '—';

  const initials = getInitials(s);
  const avatarEl = document.getElementById('studentAvatar');
  if (avatarEl) avatarEl.textContent = initials.toUpperCase();

  setText('studentName',    name);
  setText('studentLrn',     lrn);
  setText('studentSection', grade + ' · ' + section);
  setText('infoGender',     gender);
  setText('infoDob',        dob);
  setText('infoPhone',      phone);
  setText('infoAddress',    address);
}

// ════════════════════════════════════════════════════
//  GUARDIAN CARD
// ════════════════════════════════════════════════════
function renderGuardianCard(s) {
  const rows = [
    { role: 'Father',   name: s.fatherName,   phone: s.fatherPhone },
    { role: 'Mother',   name: s.motherName,   phone: s.motherPhone },
    { role: 'Guardian', name: s.guardianName, phone: s.guardianPhone, rel: s.guardianRelation },
  ].filter(r => r.name && r.name.trim());

  const container = document.getElementById('guardianRows');
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = '<p style="font-size:12px;color:rgba(107,107,107,.5);padding:10px 0">No guardian information provided.</p>';
    return;
  }

  container.innerHTML = rows.map(r => `
    <div class="guardian-row">
      <span class="guardian-role">${esc(r.role)}</span>
      <div>
        <div class="guardian-name">${esc(r.name)}${r.rel ? ' <span style="font-weight:400;color:var(--muted)">(' + esc(r.rel) + ')</span>' : ''}</div>
        <div class="guardian-phone">${r.phone ? esc(r.phone) : '<em style="opacity:.5">No phone</em>'}</div>
      </div>
    </div>`).join('');
}

// ════════════════════════════════════════════════════
//  ATTENDANCE HEATMAP
// ════════════════════════════════════════════════════
async function fetchAndRenderHeatmap(sid, grade, section) {
  try {
    const start = `${hmYear}-01-01`;
    const end   = `${hmYear}-12-31`;
    const url = API_ATTENDANCE +
      '?action=attendance' +
      '&start=' + encodeURIComponent(start) +
      '&end='   + encodeURIComponent(end) +
      (grade   ? '&grade='   + encodeURIComponent(grade)   : '') +
      (section ? '&section=' + encodeURIComponent(section) : '');

    const res  = await fetch(url);
    if (!res.ok) throw new Error('Attendance API error ' + res.status);
    const data = await res.json();
    const match = (data.students || []).find(x => String(x.id) === String(sid));
    studentAttMap = (match && match.statuses) ? match.statuses : {};
    renderHeatmap();
  } catch (err) {
    console.warn('Attendance fetch failed:', err.message);
    studentAttMap = {};
    renderHeatmap();
  }
}

function renderHeatmapSkeleton() {
  const grid = document.getElementById('hmGrid');
  if (grid) grid.innerHTML = '<div class="hm-loading">Loading attendance…</div>';
  setText('heatmapMonthLabel', '');
}

function renderHeatmap() {
  const label = document.getElementById('heatmapMonthLabel');
  if (label) label.textContent = MONTHS_LONG[hmMonth] + ' ' + hmYear;
  buildMonthGrid();
  updateAttSummary();
}

function buildMonthGrid() {
  const grid = document.getElementById('hmGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const today    = new Date();
  const todayStr = toYMD(today);
  const DOW_HDRS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  DOW_HDRS.forEach(d => {
    const hdr = document.createElement('div');
    hdr.className   = 'hm-dow-hdr';
    hdr.textContent = d;
    grid.appendChild(hdr);
  });

  const firstDay = new Date(hmYear, hmMonth, 1);
  for (let i = 0; i < firstDay.getDay(); i++) {
    const blank = document.createElement('div');
    blank.className = 'hm-day hm-faded';
    grid.appendChild(blank);
  }

  const daysInMonth = new Date(hmYear, hmMonth + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${hmYear}-${String(hmMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const status  = studentAttMap[dateStr];
    const isToday = dateStr === todayStr;

    let cls = 'hm-day ';
    if      (status === 'present') cls += 'hm-present';
    else if (status === 'late')    cls += 'hm-late';
    else if (status === 'absent')  cls += 'hm-absent';
    else                           cls += 'hm-empty';
    if (isToday) cls += ' hm-today-ring';

    const cell = document.createElement('div');
    cell.className      = cls;
    cell.dataset.date   = dateStr;
    cell.dataset.status = status || 'none';

    const num = document.createElement('span');
    num.className   = 'hm-day-num';
    num.textContent = d;
    cell.appendChild(num);

    cell.addEventListener('mouseenter', showHmTooltip);
    cell.addEventListener('mousemove',  moveHmTooltip);
    cell.addEventListener('mouseleave', hideHmTooltip);
    grid.appendChild(cell);
  }
}

function shiftHeatmapMonth(delta) {
  hmMonth += delta;
  if (hmMonth > 11) { hmMonth = 0;  hmYear++; }
  if (hmMonth < 0)  { hmMonth = 11; hmYear--; }

  const needFetch = studentId && _cachedStudent &&
    (hmYear !== (_cachedStudent._fetchedYear || new Date().getFullYear()));

  if (needFetch) {
    renderHeatmapSkeleton();
    _cachedStudent._fetchedYear = hmYear;
    fetchAndRenderHeatmap(studentId, _cachedStudent.grade, _cachedStudent.section);
  } else {
    renderHeatmap();
  }
}

function updateAttSummary() {
  const counts = { present: 0, late: 0, absent: 0 };
  for (const [dateStr, status] of Object.entries(studentAttMap)) {
    if (!dateStr.startsWith(String(hmYear))) continue;
    if (counts[status] !== undefined) counts[status]++;
  }
  setText('attPresent', counts.present);
  setText('attLate',    counts.late);
  setText('attAbsent',  counts.absent);
}

function showHmTooltip(e) {
  const tip    = document.getElementById('hmTooltip');
  const date   = e.target.closest('.hm-day')?.dataset.date;
  const status = e.target.closest('.hm-day')?.dataset.status;
  if (!tip || !date) return;
  const d     = new Date(date + 'T00:00:00');
  const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  const emoji = status === 'present' ? '✅' : status === 'late' ? '🕐' : status === 'absent' ? '❌' : '—';
  const capSt = status === 'none' ? 'No record' : status.charAt(0).toUpperCase() + status.slice(1);
  tip.textContent = emoji + ' ' + label + ' · ' + capSt;
  tip.style.display = 'block';
  positionTooltip(e, tip);
}
function moveHmTooltip(e) { const tip = document.getElementById('hmTooltip'); if (tip) positionTooltip(e, tip); }
function hideHmTooltip()   { const tip = document.getElementById('hmTooltip'); if (tip) tip.style.display = 'none'; }
function positionTooltip(e, tip) { tip.style.left = e.clientX + 'px'; tip.style.top = (e.clientY - 8) + 'px'; }

// ════════════════════════════════════════════════════
//  ACADEMIC PERFORMANCE — FULLY WORKING
// ════════════════════════════════════════════════════
let _allSubjects  = [];
let _acadGradeTable = false;

async function loadSubjectFilter(s) {
  try {
    const res = await fetch(API_GRADES + '?action=subjects');
    if (!res.ok) throw new Error('Subjects API ' + res.status);
    _allSubjects = await res.json();

    const sel = document.getElementById('acadSubjectFilter');
    if (sel) {
      sel.innerHTML = '<option value="">All Subjects</option>' +
        _allSubjects.map(sub => `<option value="${esc(sub.name)}">${esc(sub.name)}</option>`).join('');
    }
  } catch (err) {
    console.warn('Could not load subjects:', err.message);
  }

  // Render initial performance with default quarter Q1
  await loadAcademicPerformance();
}

async function loadAcademicPerformance() {
  const subjectEl = document.getElementById('acadSubjectFilter');
  const quarterEl = document.getElementById('acadQuarterFilter');
  const subject   = subjectEl ? subjectEl.value : '';
  const quarter   = quarterEl ? quarterEl.value : 'Q1';

  if (!studentId) return;

  const s = _cachedStudent;

  try {
    let myRows = [];

    if (subject) {
      // Specific subject — single fetch
      const url = API_GRADES +
        '?action=grades' +
        '&quarter=' + encodeURIComponent(quarter) +
        '&subject=' + encodeURIComponent(subject) +
        (s && s.grade   ? '&grade='   + encodeURIComponent(s.grade)   : '') +
        (s && s.section ? '&section=' + encodeURIComponent(s.section) : '');
      const res  = await fetch(url);
      if (!res.ok) throw new Error('Grades API ' + res.status);
      const rows = await res.json();
      myRows = rows.filter(r => String(r.id) === String(studentId));
    } else {
      // All subjects — the API JOIN needs a subject param to return grades,
      // so we must fetch each subject individually then merge.
      const subjects = _allSubjects.length ? _allSubjects : [];
      const results = await Promise.allSettled(subjects.map(async (sub) => {
        const url = API_GRADES +
          '?action=grades' +
          '&quarter=' + encodeURIComponent(quarter) +
          '&subject=' + encodeURIComponent(sub.name) +
          (s && s.grade   ? '&grade='   + encodeURIComponent(s.grade)   : '') +
          (s && s.section ? '&section=' + encodeURIComponent(s.section) : '');
        const res  = await fetch(url);
        if (!res.ok) return null;
        const rows = await res.json();
        const mine = rows.find(r => String(r.id) === String(studentId));
        return mine ? { ...mine, subject: sub.name } : null;
      }));
      myRows = results
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);
    }

    renderAcademicPerformance(myRows, quarter, subject);

  } catch (err) {
    console.warn('Grades fetch failed:', err.message);
    renderAcademicEmpty('Could not load grade data. Is XAMPP running?');
  }
}

function renderAcademicPerformance(rows, quarter, subject) {
  const graded = rows.filter(r => r.final_grade !== null && r.final_grade !== undefined);

  let avg = null, avgWW = null, avgPT = null, avgQA = null;

  if (!subject) {
    // All subjects: avg across all quarters for gauge
    computeOverallAverage().then(overall => {
      updateGauge(overall);
      renderCompBreakdown(null, null, null);
    });
  } else {
    // Specific subject: avg across all 4 quarters for gauge
    computeSubjectOverallAverage(subject).then(overall => {
      updateGauge(overall);
    });
    avgWW  = avg_col(graded, 'written_works');
    avgPT  = avg_col(graded, 'performance_tasks');
    avgQA  = avg_col(graded, 'quarterly_assessment');
    renderCompBreakdown(avgWW, avgPT, avgQA);
  }

  // Quarter bars
  renderQuarterBars(subject);

  // Grade table
  renderGradeTable(rows, subject);
}

async function computeOverallAverage() {
  const s = _cachedStudent;
  if (!s || !_allSubjects.length) return null;
  // Must fetch per-subject per-quarter: the API JOIN requires a subject to return grades
  const quarters = ['Q1','Q2','Q3','Q4'];
  let allGrades = [];

  await Promise.allSettled(_allSubjects.map(async (sub) => {
    await Promise.allSettled(quarters.map(async (q) => {
      const url = API_GRADES + '?action=grades&quarter=' + encodeURIComponent(q) +
        '&subject=' + encodeURIComponent(sub.name) +
        (s.grade   ? '&grade='   + encodeURIComponent(s.grade)   : '') +
        (s.section ? '&section=' + encodeURIComponent(s.section) : '');
      try {
        const res  = await fetch(url);
        if (!res.ok) return;
        const rows = await res.json();
        const mine = rows.filter(r => String(r.id) === String(studentId));
        const graded = mine.filter(r => r.final_grade !== null && r.final_grade !== undefined);
        allGrades = allGrades.concat(graded);
      } catch (e) { /* ignore */ }
    }));
  }));

  return allGrades.length
    ? allGrades.reduce((a, r) => a + parseFloat(r.final_grade), 0) / allGrades.length
    : null;
}

async function computeSubjectOverallAverage(subject) {
  const s = _cachedStudent;
  if (!s) return null;
  const quarters = ['Q1','Q2','Q3','Q4'];
  let allGrades = [];

  await Promise.allSettled(quarters.map(async (q) => {
    const url = API_GRADES + '?action=grades&quarter=' + encodeURIComponent(q) +
      '&subject=' + encodeURIComponent(subject) +
      (s.grade   ? '&grade='   + encodeURIComponent(s.grade)   : '') +
      (s.section ? '&section=' + encodeURIComponent(s.section) : '');
    try {
      const res  = await fetch(url);
      if (!res.ok) return;
      const rows = await res.json();
      const mine = rows.filter(r => String(r.id) === String(studentId));
      const graded = mine.filter(r => r.final_grade !== null && r.final_grade !== undefined);
      allGrades = allGrades.concat(graded);
    } catch (e) { /* ignore */ }
  }));

  return allGrades.length
    ? allGrades.reduce((a, r) => a + parseFloat(r.final_grade), 0) / allGrades.length
    : null;
}

function updateGauge(avg) {
  const scoreEl = document.getElementById('gaugeScore');
  const outofEl = document.getElementById('gaugeOutof');
  const arcEl   = document.getElementById('gaugeArc');
  const descEl  = document.getElementById('gaugeDescriptor');

  if (avg === null) {
    if (scoreEl) scoreEl.textContent = '—';
    if (outofEl) outofEl.textContent = '';
    if (descEl)  descEl.textContent  = 'No grades yet';
    // Reset arc
    if (arcEl) arcEl.setAttribute('d', 'M 10 65 A 50 50 0 0 1 10.01 65');
    return;
  }

  const score = Math.round(avg * 10) / 10;
  if (scoreEl) scoreEl.textContent = score.toFixed(1);
  if (outofEl) outofEl.textContent = '/ 100';

  // Descriptor
  const descriptor = gradeDescriptor(score);
  if (descEl) descEl.textContent = descriptor;

  // Arc path: semicircle from left (10,65) to right (110,65), radius 50
  // Angle: 0% = 0deg (left), 100% = 180deg (right)
  const pct   = Math.min(100, Math.max(0, score)) / 100;
  const angle = pct * Math.PI; // 0..π
  const cx    = 60;
  const cy    = 65;
  const r     = 50;
  const ex    = cx - r * Math.cos(angle);
  const ey    = cy - r * Math.sin(angle);
  const large = pct > 0.5 ? 1 : 0;
  if (arcEl) {
    if (pct <= 0) {
      arcEl.setAttribute('d', 'M 10 65 A 50 50 0 0 1 10.01 65');
    } else {
      arcEl.setAttribute('d', `M 10 65 A 50 50 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`);
    }
    // Color by grade
    const color = score >= 90 ? '#6c63ff' : score >= 85 ? '#6c63ff' : score >= 80 ? '#6c63ff' : score >= 75 ? '#6c63ff' : '#dc2626';
    arcEl.setAttribute('stroke', color);
    const gaugeScoreColor = document.getElementById('gaugeScore');
    if (gaugeScoreColor) gaugeScoreColor.style.color = color;
  }
}

async function renderQuarterBars(subject) {
  const quarters = ['Q1','Q2','Q3','Q4'];
  const labels   = ['1st Quarter','2nd Quarter','3rd Quarter','4th Quarter'];
  const container = document.getElementById('quarterBars');
  if (!container) return;

  container.innerHTML = labels.map((lbl, i) => `
    <div class="quarter-bar" id="qbar-${quarters[i]}">
      <div class="q-bar q-bar-empty" style="height:4px" id="qbar-fill-${quarters[i]}"></div>
      <div class="quarter-score" id="qbar-score-${quarters[i]}">—</div>
      <span class="quarter-label">${lbl}</span>
    </div>`).join('');

  const s = _cachedStudent;
  const maxBarHeight = 90;

  // When "All Subjects" (empty subject), must fetch per-subject because the API
  // JOIN requires a subject param to return final_grade values.
  const fetchFn = async (q) => {
    if (subject) {
      // Specific subject — single fetch
      const url = API_GRADES +
        '?action=grades&quarter=' + encodeURIComponent(q) +
        '&subject=' + encodeURIComponent(subject) +
        (s && s.grade   ? '&grade='   + encodeURIComponent(s.grade)   : '') +
        (s && s.section ? '&section=' + encodeURIComponent(s.section) : '');
      try {
        const res   = await fetch(url);
        if (!res.ok) return null;
        const rows  = await res.json();
        const graded = rows.filter(r => String(r.id) === String(studentId) && r.final_grade !== null && r.final_grade !== undefined);
        return graded.length ? graded.reduce((a, r) => a + parseFloat(r.final_grade), 0) / graded.length : null;
      } catch (e) { return null; }
    } else {
      // All subjects — fetch each subject individually, then average
      if (!_allSubjects.length) return null;
      let allGrades = [];
      await Promise.allSettled(_allSubjects.map(async (sub) => {
        const url = API_GRADES +
          '?action=grades&quarter=' + encodeURIComponent(q) +
          '&subject=' + encodeURIComponent(sub.name) +
          (s && s.grade   ? '&grade='   + encodeURIComponent(s.grade)   : '') +
          (s && s.section ? '&section=' + encodeURIComponent(s.section) : '');
        try {
          const res   = await fetch(url);
          if (!res.ok) return;
          const rows  = await res.json();
          const graded = rows.filter(r => String(r.id) === String(studentId) && r.final_grade !== null && r.final_grade !== undefined);
          allGrades = allGrades.concat(graded);
        } catch (e) { /* ignore */ }
      }));
      return allGrades.length ? allGrades.reduce((a, r) => a + parseFloat(r.final_grade), 0) / allGrades.length : null;
    }
  };

  await Promise.allSettled(quarters.map(async (q) => {
    const avg = await fetchFn(q);
    const fillEl  = document.getElementById('qbar-fill-' + q);
    const scoreEl = document.getElementById('qbar-score-' + q);

    if (avg !== null) {
      const pct    = Math.min(100, Math.max(0, avg)) / 100;
      const height = Math.max(4, Math.round(pct * maxBarHeight));
      const color  = avg >= 90 ? '#6c63ff' : avg >= 85 ? '#6c63ff' : avg >= 80 ? '#6c63ff' : avg >= 75 ? '#6c63ff' : '#dc2626';
      if (fillEl) {
        fillEl.style.height     = height + 'px';
        fillEl.style.background = color;
        fillEl.classList.remove('q-bar-empty');
      }
      if (scoreEl) scoreEl.textContent = avg.toFixed(1);
    } else {
      if (scoreEl) scoreEl.textContent = '—';
    }
  }));
}

function renderGradeTable(rows, subject) {
  const tbody = document.getElementById('acadTableBody');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);font-size:12px">No grade records found for this student.</td></tr>`;
    return;
  }

  // If single subject selected, show a single row; else show one row per subject
  tbody.innerHTML = rows.map(r => {
    const subjectName = subject || r.subject || 'Unknown';
    const fg = r.final_grade !== null && r.final_grade !== undefined ? parseFloat(r.final_grade) : null;
    const { cls, label } = gradeClass(fg);
    return `
      <tr>
        <td><strong>${escHtml(subjectName)}</strong></td>
        <td>${r.written_works !== null && r.written_works !== undefined ? parseFloat(r.written_works).toFixed(1) : '—'}</td>
        <td>${r.performance_tasks !== null && r.performance_tasks !== undefined ? parseFloat(r.performance_tasks).toFixed(1) : '—'}</td>
        <td>${r.quarterly_assessment !== null && r.quarterly_assessment !== undefined ? parseFloat(r.quarterly_assessment).toFixed(1) : '—'}</td>
        <td><strong>${fg !== null ? fg.toFixed(1) : '—'}</strong></td>
        <td><span class="grade-badge ${cls}">${label}</span></td>
      </tr>`;
  }).join('');
}

function renderGradeTableAllSubjects(subject, quarter) {
  // Called when "All Subjects" is selected — fetch per-subject
  const s = _cachedStudent;
  if (!s) return;

  const subjectsToFetch = subject ? [subject] : _allSubjects.map(x => x.name);
  const tbody = document.getElementById('acadTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);font-size:12px">Loading…</td></tr>`;

  Promise.all(subjectsToFetch.map(async (sub) => {
    const url = API_GRADES +
      '?action=grades&quarter=' + encodeURIComponent(quarter) +
      '&subject=' + encodeURIComponent(sub) +
      (s.grade   ? '&grade='   + encodeURIComponent(s.grade)   : '') +
      (s.section ? '&section=' + encodeURIComponent(s.section) : '');
    const res  = await fetch(url);
    const rows = await res.json();
    const mine = rows.find(r => String(r.id) === String(studentId));
    return mine ? { ...mine, subjectName: sub } : { subjectName: sub };
  })).then(allRows => {
    tbody.innerHTML = allRows.map(r => {
      const fg = r.final_grade !== null && r.final_grade !== undefined ? parseFloat(r.final_grade) : null;
      const { cls, label } = gradeClass(fg);
      return `
        <tr>
          <td><strong>${escHtml(r.subjectName)}</strong></td>
          <td>${r.written_works !== null && r.written_works !== undefined ? parseFloat(r.written_works).toFixed(1) : '—'}</td>
          <td>${r.performance_tasks !== null && r.performance_tasks !== undefined ? parseFloat(r.performance_tasks).toFixed(1) : '—'}</td>
          <td>${r.quarterly_assessment !== null && r.quarterly_assessment !== undefined ? parseFloat(r.quarterly_assessment).toFixed(1) : '—'}</td>
          <td><strong>${fg !== null ? fg.toFixed(1) : '—'}</strong></td>
          <td><span class="grade-badge ${cls}">${label}</span></td>
        </tr>`;
    }).join('');
  }).catch(() => {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red);font-size:12px;padding:20px">Error loading grades.</td></tr>`;
  });
}

function renderCompBreakdown(ww, pt, qa) {
  const container = document.getElementById('compBreakdown');
  if (!container) return;

  if (ww === null && pt === null && qa === null) {
    container.innerHTML = '';
    return;
  }

  const comps = [
    { label: 'Written Works',     val: ww, color: '#6c63ff' },
    { label: 'Performance Tasks', val: pt, color: '#2563eb' },
    { label: 'Quarterly Assess.', val: qa, color: '#16a34a' },
  ];

  container.innerHTML = `
    <div style="margin-bottom:8px;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Component Averages</div>
    ${comps.map(c => `
      <div class="comp-row">
        <span class="comp-label">${escHtml(c.label)}</span>
        <div class="comp-bar-track">
          <div class="comp-bar-fill" style="width:${c.val !== null ? Math.min(100,c.val)+'%' : '0%'};background:${c.color}"></div>
        </div>
        <span class="comp-val">${c.val !== null ? c.val.toFixed(1) : '—'}</span>
      </div>`).join('')}`;
}

function renderAcademicEmpty(msg) {
  const container = document.getElementById('perfContent');
  if (container) container.innerHTML = `<div class="acad-loading">${escHtml(msg)}</div>`;
}

let _gradeTableVisible = false;
function toggleGradeTable() {
  _gradeTableVisible = !_gradeTableVisible;
  const wrap = document.getElementById('acadTableWrap');
  const btn  = document.getElementById('acadToggleBtn');
  if (wrap) wrap.style.display = _gradeTableVisible ? 'block' : 'none';
  if (btn)  btn.textContent = _gradeTableVisible ? '▲ Hide Grade Table' : '⊞ View Grade Table';

  if (_gradeTableVisible) {
    // Fetch all-subject table when showing
    const subjectEl = document.getElementById('acadSubjectFilter');
    const quarterEl = document.getElementById('acadQuarterFilter');
    const subject   = subjectEl ? subjectEl.value : '';
    const quarter   = quarterEl ? quarterEl.value : 'Q1';
    if (!subject) {
      renderGradeTableAllSubjects('', quarter);
    }
  }
}

// Grade helpers
function gradeDescriptor(score) {
  if (score === null) return '';
  if (score >= 90) return 'Outstanding';
  if (score >= 85) return 'Very Satisfactory';
  if (score >= 80) return 'Satisfactory';
  if (score >= 75) return 'Fairly Satisfactory';
  return 'Did Not Meet Expectations';
}

function gradeClass(score) {
  if (score === null) return { cls: '', label: '—' };
  if (score >= 75) return { cls: 'grade-passing', label: score >= 90 ? 'Outstanding' : score >= 85 ? 'Very Satisfactory' : score >= 80 ? 'Satisfactory' : 'Fairly Satisfactory' };
  return { cls: 'grade-fail', label: 'Did Not Meet' };
}

function avg_col(rows, col) {
  const vals = rows.map(r => r[col]).filter(v => v !== null && v !== undefined).map(Number);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

// ════════════════════════════════════════════════════
//  HEALTH & MEDICAL — FULLY WORKING (localStorage)
// ════════════════════════════════════════════════════
let _editingHealthId = null;

function healthStorageKey(type) {
  return `ci_${type}_${_currentStudentId}`;
}
function loadHealthRecords() {
  try { return JSON.parse(localStorage.getItem(healthStorageKey('health'))) || []; }
  catch { return []; }
}
function saveHealthRecords(records) {
  localStorage.setItem(healthStorageKey('health'), JSON.stringify(records));
}

function loadVitals() {
  try { return JSON.parse(localStorage.getItem(healthStorageKey('vitals'))) || {}; }
  catch { return {}; }
}
function saveVitalsData(v) {
  localStorage.setItem(healthStorageKey('vitals'), JSON.stringify(v));
}

function initHealthSection() {
  renderVitals();
  renderHealthList();
}

function renderVitals() {
  const v = loadVitals();
  setText('vitalWeight', v.weight ? v.weight + ' kg'  : '—');
  setText('vitalHeight', v.height ? v.height + ' cm'  : '—');
  setText('vitalBlood',  v.blood  ? v.blood            : '—');
}

function toggleVitalsEdit() {
  const editWrap = document.getElementById('healthVitalsEdit');
  const editBtn  = document.getElementById('vitalsEditBtn');
  const isOpen   = editWrap.style.display !== 'none';

  if (isOpen) {
    cancelVitals();
    return;
  }

  const v = loadVitals();
  const wEl = document.getElementById('vi-weight');
  const hEl = document.getElementById('vi-height');
  const bEl = document.getElementById('vi-blood');
  if (wEl) wEl.value = v.weight || '';
  if (hEl) hEl.value = v.height || '';
  if (bEl) bEl.value = v.blood  || '';

  editWrap.style.display = 'flex';
  if (editBtn) editBtn.textContent = '✕ Cancel';
}

function cancelVitals() {
  const editWrap = document.getElementById('healthVitalsEdit');
  const editBtn  = document.getElementById('vitalsEditBtn');
  if (editWrap) editWrap.style.display = 'none';
  if (editBtn) {
    editBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Edit vitals';
  }
}

function saveVitals() {
  const weight = document.getElementById('vi-weight')?.value.trim();
  const height = document.getElementById('vi-height')?.value.trim();
  const blood  = document.getElementById('vi-blood')?.value;
  saveVitalsData({ weight, height, blood });
  renderVitals();
  cancelVitals();
  siToast('Vitals saved.', 'success');
}

function openHealthModal(id) {
  _editingHealthId = id || null;
  const isEdit = !!id;
  document.getElementById('healthModalTitle').textContent = isEdit ? 'Edit Health Record' : 'Add Health Record';
  document.getElementById('hlt-save-text').textContent    = isEdit ? 'Save Changes' : 'Add Record';

  ['hlt-desc','hlt-physician','hlt-notes'].forEach(i => { const el = document.getElementById(i); if (el) el.value = ''; });
  document.getElementById('hlt-date').value     = new Date().toISOString().slice(0,10);
  document.getElementById('hlt-category').value = '';
  document.getElementById('hlt-status').value   = 'Noted';
  clearHealthErrors();

  if (isEdit) {
    const rec = loadHealthRecords().find(r => r.id === id);
    if (rec) {
      document.getElementById('hlt-date').value      = rec.date      || '';
      document.getElementById('hlt-category').value  = rec.category  || '';
      document.getElementById('hlt-desc').value      = rec.desc      || '';
      document.getElementById('hlt-physician').value = rec.physician  || '';
      document.getElementById('hlt-status').value    = rec.status    || 'Noted';
      document.getElementById('hlt-notes').value     = rec.notes     || '';
    }
  }
  document.getElementById('healthOverlay').classList.add('open');
}

function closeHealthModal() {
  document.getElementById('healthOverlay').classList.remove('open');
}

function clearHealthErrors() {
  ['hlt-date-err','hlt-category-err','hlt-desc-err'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  ['hlt-date','hlt-category','hlt-desc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('si-input-err');
  });
}

function saveHealth() {
  clearHealthErrors();
  const date     = document.getElementById('hlt-date').value;
  const category = document.getElementById('hlt-category').value;
  const desc     = document.getElementById('hlt-desc').value.trim();
  let valid = true;

  if (!date) {
    document.getElementById('hlt-date-err').textContent = 'Date is required.';
    document.getElementById('hlt-date').classList.add('si-input-err');
    valid = false;
  }
  if (!category) {
    document.getElementById('hlt-category-err').textContent = 'Category is required.';
    document.getElementById('hlt-category').classList.add('si-input-err');
    valid = false;
  }
  if (!desc) {
    document.getElementById('hlt-desc-err').textContent = 'Description is required.';
    document.getElementById('hlt-desc').classList.add('si-input-err');
    valid = false;
  }
  if (!valid) return;

  const records = loadHealthRecords();
  const payload = {
    id:        _editingHealthId || uid(),
    date,
    category,
    desc,
    physician: document.getElementById('hlt-physician').value.trim(),
    status:    document.getElementById('hlt-status').value,
    notes:     document.getElementById('hlt-notes').value.trim(),
  };

  if (_editingHealthId) {
    const idx = records.findIndex(r => r.id === _editingHealthId);
    if (idx > -1) records[idx] = payload;
  } else {
    records.unshift(payload);
  }

  saveHealthRecords(records);
  renderHealthList();
  closeHealthModal();
  siToast(_editingHealthId ? 'Health record updated.' : 'Health record added.', 'success');
}

function deleteHealth(id) {
  if (!confirm('Delete this health record?')) return;
  const records = loadHealthRecords().filter(r => r.id !== id);
  saveHealthRecords(records);
  renderHealthList();
  siToast('Health record deleted.', '');
}

function renderHealthList() {
  const list = document.getElementById('healthList');
  if (!list) return;
  const records = loadHealthRecords();

  if (!records.length) {
    list.innerHTML = '<div class="empty-state"><span class="empty-text">No health records yet. Click + to add one.</span></div>';
    return;
  }

  const categoryTagMap = {
    Routine:     'tag-routine',
    Allergy:     'tag-allergy',
    Illness:     'tag-illness',
    Injury:      'tag-injury',
    Medication:  'tag-medication',
    Vaccination: 'tag-vaccination',
    Severe:      'tag-severe',
    Other:       'tag-other',
  };

  const statusColors = {
    Noted:      { bg: '#f3f4f6', color: '#6b7280' },
    Ongoing:    { bg: '#eff6ff', color: '#2563eb' },
    Resolved:   { bg: '#ecfdf5', color: '#16a34a' },
    Monitoring: { bg: '#fefce8', color: '#ca8a04' },
    Referred:   { bg: '#fff7ed', color: '#ea580c' },
  };

  list.innerHTML = records.map(r => {
    const tagCls = categoryTagMap[r.category] || 'tag-other';
    const sc     = statusColors[r.status] || { bg: '#f3f4f6', color: '#6b7280' };
    const notes  = r.notes ? `<div class="health-notes-text">${escHtml(r.notes)}</div>` : '';
    const physi  = r.physician ? `<div class="health-meta-text">👨‍⚕️ ${escHtml(r.physician)}</div>` : '';
    return `
      <div class="health-record-row">
        <div class="health-record-left">
          <span class="health-tag ${tagCls}">${escHtml(r.category)}</span>
          <div class="health-desc-text">${escHtml(r.desc)}</div>
          ${physi}
          ${notes}
        </div>
        <div class="health-record-right">
          <div class="health-date-text">${fmtDateShort(r.date)}</div>
          <span class="health-status-badge" style="background:${sc.bg};color:${sc.color}">${escHtml(r.status)}</span>
          <div class="rec-actions">
            <button class="rec-btn" title="Edit" onclick="openHealthModal('${r.id}')">
              <svg viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button class="rec-btn rec-btn-del" title="Delete" onclick="deleteHealth('${r.id}')">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════
//  SCHOLARSHIP & BEHAVIOR — localStorage-backed
// ════════════════════════════════════════════════════
let _currentStudentId = null;
let _editingSchId     = null;
let _editingBehId     = null;

function storageKey(type) { return `ci_${type}_${_currentStudentId}`; }
function loadRecords(type) {
  try { return JSON.parse(localStorage.getItem(storageKey(type))) || []; }
  catch { return []; }
}
function saveRecords(type, records) {
  localStorage.setItem(storageKey(type), JSON.stringify(records));
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function initRecords(studentDbId) {
  _currentStudentId = studentDbId;
  renderDocuments();
  renderScholarships();
  renderBehaviors();
  initHealthSection();
}

// ── DOCUMENTS ───────────────────────────────────────
function docStorageKey() { return 'ci_docs_' + _currentStudentId; }

function loadDocs() {
  try { return JSON.parse(localStorage.getItem(docStorageKey())) || []; }
  catch { return []; }
}
function saveDocs(docs) {
  localStorage.setItem(docStorageKey(), JSON.stringify(docs));
}

function triggerDocUpload() {
  document.getElementById('docFileInput').click();
}
function docDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function docDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function docDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  handleDocFiles({ target: { files: e.dataTransfer.files } });
}
function handleDocFiles(e) {
  const files = Array.from(e.files || []);
  if (!files.length) return;
  const docs = loadDocs();
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(ev) {
      docs.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: file.name,
        type: file.type,
        size: file.size,
        data: ev.target.result,
        date: new Date().toISOString().slice(0, 10),
      });
      saveDocs(docs);
      renderDocuments();
    };
    reader.readAsDataURL(file);
  });
}

function renderDocuments() {
  const list = document.getElementById('docList');
  if (!list) return;
  const docs = loadDocs();
  if (!docs.length) {
    list.innerHTML = '<div class="empty-state"><span class="empty-text">No documents uploaded yet.</span></div>';
    return;
  }
  list.innerHTML = docs.map(d => `
    <div class="doc-row">
      <div class="doc-icon">
        <svg viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div class="doc-name" title="${escHtml(d.name)}">${escHtml(d.name)}</div>
        <div class="doc-size">${formatFileSize(d.size)} · ${d.date}</div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button class="rec-btn" title="Download" onclick="downloadDoc('${d.id}')">
          <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="rec-btn rec-btn-del" title="Delete" onclick="deleteDoc('${d.id}')">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>`).join('');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function downloadDoc(id) {
  const docs = loadDocs();
  const doc = docs.find(d => d.id === id);
  if (!doc) return;
  const a = document.createElement('a');
  a.href = doc.data;
  a.download = doc.name;
  a.click();
}

function deleteDoc(id) {
  if (!confirm('Delete this document?')) return;
  saveDocs(loadDocs().filter(d => d.id !== id));
  renderDocuments();
}

// ── SCHOLARSHIP ──────────────────────────────────────
function openScholarshipModal(id) {
  _editingSchId = id || null;
  const isEdit = !!id;
  document.getElementById('scholarshipModalTitle').textContent = isEdit ? 'Edit Scholarship' : 'Add Scholarship';
  document.getElementById('sch-save-text').textContent = isEdit ? 'Save Changes' : 'Add Scholarship';
  ['sch-name','sch-grantor','sch-amount','sch-notes'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('sch-start').value  = '';
  document.getElementById('sch-end').value    = '';
  document.getElementById('sch-status').value = 'Active';
  clearSchErrors();
  if (isEdit) {
    const rec = loadRecords('scholarship').find(r => r.id === id);
    if (rec) {
      document.getElementById('sch-name').value    = rec.name    || '';
      document.getElementById('sch-grantor').value = rec.grantor || '';
      document.getElementById('sch-amount').value  = rec.amount  || '';
      document.getElementById('sch-start').value   = rec.start   || '';
      document.getElementById('sch-end').value     = rec.end     || '';
      document.getElementById('sch-status').value  = rec.status  || 'Active';
      document.getElementById('sch-notes').value   = rec.notes   || '';
    }
  }
  document.getElementById('scholarshipOverlay').classList.add('open');
}
function closeScholarshipModal() { document.getElementById('scholarshipOverlay').classList.remove('open'); }
function clearSchErrors() {
  ['sch-name-err','sch-grantor-err'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent=''; });
  ['sch-name','sch-grantor'].forEach(id => { const el = document.getElementById(id); if(el) el.classList.remove('si-input-err'); });
}
function saveScholarship() {
  clearSchErrors();
  const name    = document.getElementById('sch-name').value.trim();
  const grantor = document.getElementById('sch-grantor').value.trim();
  let valid = true;
  if (!name)    { document.getElementById('sch-name-err').textContent = 'Scholarship name is required.'; document.getElementById('sch-name').classList.add('si-input-err'); valid=false; }
  if (!grantor) { document.getElementById('sch-grantor-err').textContent = 'Grantor is required.'; document.getElementById('sch-grantor').classList.add('si-input-err'); valid=false; }
  if (!valid) return;

  const records = loadRecords('scholarship');
  const payload = {
    id: _editingSchId || uid(), name, grantor,
    amount: document.getElementById('sch-amount').value.trim(),
    start:  document.getElementById('sch-start').value,
    end:    document.getElementById('sch-end').value,
    status: document.getElementById('sch-status').value,
    notes:  document.getElementById('sch-notes').value.trim(),
  };
  if (_editingSchId) {
    const idx = records.findIndex(r => r.id === _editingSchId);
    if (idx > -1) records[idx] = payload;
  } else {
    records.unshift(payload);
  }
  saveRecords('scholarship', records);
  renderScholarships();
  closeScholarshipModal();
  siToast(_editingSchId ? 'Scholarship updated.' : 'Scholarship added.', 'success');
}
function deleteScholarship(id) {
  if (!confirm('Delete this scholarship record?')) return;
  saveRecords('scholarship', loadRecords('scholarship').filter(r => r.id !== id));
  renderScholarships();
  siToast('Scholarship deleted.', '');
}
function renderScholarships() {
  const list = document.getElementById('scholarshipList');
  if (!list) return;
  const records = loadRecords('scholarship');
  if (!records.length) { list.innerHTML = '<div class="empty-state"><span class="empty-text">No scholarship records yet.</span></div>'; return; }
  const statusColors = {
    Active:    { bg: '#ecfdf5', color: '#16a34a' },
    Completed: { bg: '#eff6ff', color: '#2563eb' },
    Pending:   { bg: '#fefce8', color: '#ca8a04' },
    Revoked:   { bg: '#fef2f2', color: '#dc2626' },
  };
  list.innerHTML = records.map(r => {
    const sc = statusColors[r.status] || { bg: '#f3f4f6', color: '#6b7280' };
    const dateRange = r.start || r.end
      ? `<div class="sch-dates font-mono">${r.start ? fmtDateShort(r.start) : '?'} → ${r.end ? fmtDateShort(r.end) : 'ongoing'}</div>` : '';
    const notes = r.notes ? `<div class="sch-notes-text">${escHtml(r.notes)}</div>` : '';
    return `
      <div class="sch-item">
        <div class="sch-item-top">
          <div class="sch-item-left">
            <div class="sch-name">${escHtml(r.name)}</div>
            <div class="sch-grantor">${escHtml(r.grantor)}${r.amount ? ' · <strong>' + escHtml(r.amount) + '</strong>' : ''}</div>
            ${dateRange}${notes}
          </div>
          <div class="sch-item-right">
            <span class="sch-badge" style="background:${sc.bg};color:${sc.color}">${escHtml(r.status)}</span>
            <div class="rec-actions">
              <button class="rec-btn" title="Edit" onclick="openScholarshipModal('${r.id}')">
                <svg viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button class="rec-btn rec-btn-del" title="Delete" onclick="deleteScholarship('${r.id}')">
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── BEHAVIOR ──────────────────────────────────────────
function openBehaviorModal(id) {
  _editingBehId = id || null;
  const isEdit = !!id;
  document.getElementById('behaviorModalTitle').textContent = isEdit ? 'Edit Behavior Record' : 'Add Behavior Record';
  document.getElementById('beh-save-text').textContent = isEdit ? 'Save Changes' : 'Add Record';
  ['beh-details','beh-reported','beh-notes'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('beh-date').value   = new Date().toISOString().slice(0,10);
  document.getElementById('beh-type').value   = '';
  document.getElementById('beh-status').value = 'Open';
  clearBehErrors();
  if (isEdit) {
    const rec = loadRecords('behavior').find(r => r.id === id);
    if (rec) {
      document.getElementById('beh-date').value     = rec.date     || '';
      document.getElementById('beh-type').value     = rec.type     || '';
      document.getElementById('beh-details').value  = rec.details  || '';
      document.getElementById('beh-reported').value = rec.reported || '';
      document.getElementById('beh-status').value   = rec.status   || 'Open';
      document.getElementById('beh-notes').value    = rec.notes    || '';
    }
  }
  document.getElementById('behaviorOverlay').classList.add('open');
}
function closeBehaviorModal() { document.getElementById('behaviorOverlay').classList.remove('open'); }
function clearBehErrors() {
  ['beh-date-err','beh-type-err','beh-details-err'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent=''; });
  ['beh-date','beh-type','beh-details'].forEach(id => { const el = document.getElementById(id); if(el) el.classList.remove('si-input-err'); });
}
function saveBehavior() {
  clearBehErrors();
  const date    = document.getElementById('beh-date').value;
  const type    = document.getElementById('beh-type').value;
  const details = document.getElementById('beh-details').value.trim();
  let valid = true;
  if (!date)    { document.getElementById('beh-date-err').textContent = 'Date is required.';       document.getElementById('beh-date').classList.add('si-input-err');    valid=false; }
  if (!type)    { document.getElementById('beh-type-err').textContent = 'Type is required.';       document.getElementById('beh-type').classList.add('si-input-err');    valid=false; }
  if (!details) { document.getElementById('beh-details-err').textContent = 'Details are required.'; document.getElementById('beh-details').classList.add('si-input-err'); valid=false; }
  if (!valid) return;

  const records = loadRecords('behavior');
  const payload = {
    id: _editingBehId || uid(), date, type, details,
    reported: document.getElementById('beh-reported').value.trim(),
    status:   document.getElementById('beh-status').value,
    notes:    document.getElementById('beh-notes').value.trim(),
  };
  if (_editingBehId) {
    const idx = records.findIndex(r => r.id === _editingBehId);
    if (idx > -1) records[idx] = payload;
  } else {
    records.unshift(payload);
  }
  saveRecords('behavior', records);
  renderBehaviors();
  closeBehaviorModal();
  siToast(_editingBehId ? 'Record updated.' : 'Record added.', 'success');
}
function deleteBehavior(id) {
  if (!confirm('Delete this behavior record?')) return;
  saveRecords('behavior', loadRecords('behavior').filter(r => r.id !== id));
  renderBehaviors();
  siToast('Record deleted.', '');
}
function renderBehaviors() {
  const list = document.getElementById('behaviorList');
  if (!list) return;
  const records = loadRecords('behavior');
  if (!records.length) {
    list.innerHTML = '<div class="empty-state" style="padding:28px 0"><span class="empty-text">No behavior records logged.</span></div>';
    return;
  }
  const typeColors = {
    Commendation:    { bg: '#ecfdf5', color: '#16a34a' },
    'Minor Offense': { bg: '#fefce8', color: '#ca8a04' },
    'Major Offense': { bg: '#fef2f2', color: '#dc2626' },
    Warning:         { bg: '#fff7ed', color: '#ea580c' },
    Suspension:      { bg: '#fce7f3', color: '#be185d' },
    Other:           { bg: '#f3f4f6', color: '#6b7280' },
  };
  const statusColors = {
    Open:      { bg: '#eff6ff', color: '#2563eb' },
    Resolved:  { bg: '#ecfdf5', color: '#16a34a' },
    Pending:   { bg: '#fefce8', color: '#ca8a04' },
    Escalated: { bg: '#fef2f2', color: '#dc2626' },
  };
  list.innerHTML = records.map(r => {
    const tc = typeColors[r.type]    || { bg: '#f3f4f6', color: '#6b7280' };
    const sc = statusColors[r.status] || { bg: '#f3f4f6', color: '#6b7280' };
    const notes = r.notes ? `<div class="beh-notes-text">${escHtml(r.notes)}</div>` : '';
    return `
      <div class="log-row beh-row">
        <div class="col-date">${fmtDateShort(r.date)}</div>
        <div class="col-type">
          <span class="beh-type-badge" style="background:${tc.bg};color:${tc.color}">${escHtml(r.type)}</span>
          <div class="beh-details-text">${escHtml(r.details)}</div>
          ${notes}
        </div>
        <div class="col-reported">${escHtml(r.reported || '—')}</div>
        <div class="col-status">
          <span class="beh-status-badge" style="background:${sc.bg};color:${sc.color}">${escHtml(r.status)}</span>
        </div>
        <div class="rec-actions" style="width:52px">
          <button class="rec-btn" title="Edit" onclick="openBehaviorModal('${r.id}')">
            <svg viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button class="rec-btn rec-btn-del" title="Delete" onclick="deleteBehavior('${r.id}')">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════
//  UI STATES
// ════════════════════════════════════════════════════
function showError(msg) {
  const loading = document.getElementById('loadingState');
  const error   = document.getElementById('errorState');
  const errMsg  = document.getElementById('errorMsg');
  if (loading) loading.style.display = 'none';
  if (errMsg)  errMsg.textContent = msg;
  if (error)   error.style.display = 'flex';
}

// ════════════════════════════════════════════════════
//  SHARED HELPERS
// ════════════════════════════════════════════════════
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = (value !== undefined && value !== null && value !== '') ? value : '—';
}
function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function toYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtDateShort(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function siToast(msg, type) {
  const wrap = document.getElementById('siToastWrap');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = 'si-toast' + (type === 'success' ? ' si-toast-success' : type === 'danger' ? ' si-toast-danger' : '');
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}