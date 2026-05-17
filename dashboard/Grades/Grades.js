// ── Config ────────────────────────────────────────────────────────────────────
// Path matches the project structure: Student.html uses /ClassInstruct1/dashboard/api/db.php
// Place grades_db.php in the same /api/ folder as db.php
const API = './grades_db.php';

// ── State ─────────────────────────────────────────────────────────────────────
let students         = [];
let filtered         = [];
let activeDesc       = '';
// Student list cache: avoids reloading the same grade+section on every filter change.
// Key: "<grade>|<section>", value: shallow copy of the students array.
const _studentCache  = {};
let   _lastGradeKey  = null;  // tracks the grade+section that is currently loaded
// Dynamic components — each has: { key, label, pct, color, items:[{id,name,score,maxScore}] }
let components = [
  { key:'ww', label:'Written Works',        pct:30, color:'#6c63ff', items:[] },
  { key:'pt', label:'Performance Tasks',    pct:50, color:'#10b981', items:[] },
  { key:'qa', label:'Quarterly Assessment', pct:20, color:'#f59e0b', items:[] },
];
let compItemCounter = 1;
// Proxy so saveWeights() can read weights.ww / weights.pt / weights.qa from components
const weights = new Proxy({}, {
  get(_,k){ const c=components.find(c=>c.key===k); return c?c.pct:0; },
  set(_,k,v){ const c=components.find(c=>c.key===k); if(c)c.pct=parseInt(v)||0; return true; }
});
let gpaScales        = [];
let subjects         = [];
let allSubjects      = [];
let subjectIdCounter = 1;
let editingSubjectId = null;
let subjectFilter    = '';
let gradingMode      = 'quarterly'; // 'quarterly' | 'college' | 'sem2' | 'sem3'

// Helper to get the effective quarter value (combines semester + sub-period for sem2/sem3)
function getEffectiveQuarter() {
  const quarterSel = document.getElementById('quarterSel');
  const subPeriodSel = document.getElementById('subPeriodSel');
  if (!quarterSel) return 'Q1';

  const quarter = quarterSel.value;
  // For sem2/sem3 modes, combine semester with sub-period
  if ((gradingMode === 'sem2' || gradingMode === 'sem3') && subPeriodSel && subPeriodSel.style.display !== 'none') {
    const subPeriod = subPeriodSel.value;
    return quarter + '_' + subPeriod;
  }
  return quarter;
}

// Show/hide sub-period dropdown based on grading mode
function updateSubPeriodVisibility() {
  const subPeriodSel = document.getElementById('subPeriodSel');
  if (!subPeriodSel) return;

  if (gradingMode === 'sem2' || gradingMode === 'sem3') {
    subPeriodSel.style.display = 'inline-flex';
  } else {
    subPeriodSel.style.display = 'none';
  }
}

// Handle sub-period dropdown change
function onSubPeriodChange() {
  refresh();
}
// Per-student per-item scores: studentItemScores[studentId][componentKey][itemId] = score
let studentItemScores = {};

// ── Unsaved Changes Tracking ───────────────────────────────────────────────────
let hasUnsavedGrades = false;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSubjects();
  loadWeights();
  loadGpaScales();
  loadComponentItems();
  loadStudentItemScores();
  renderWeights();
  loadAllStudents();
  const ov = document.getElementById('editOverlay');
  if (ov) ov.addEventListener('click', function(e){ if (e.target === this) closeEditModal(); });

  // ── Re-pull attendance when the Attendance page saves ────────────────────
  // attendance.js writes 'ci_att_updated' to localStorage after each save.
  // Only update values that actually changed — don't clobber manual entries.
  window.addEventListener('storage', function(e) {
    if (e.key !== 'ci_att_updated') return;
    _onAttendanceBroadcast();
  });

  // ── Unsaved-changes guard ──────────────────────────────────────────────────
  // Native browser dialog (shown when tab is closed / navigated away)
  window.addEventListener('beforeunload', e => {
    if (!hasUnsavedGrades) return;
    e.preventDefault();
    e.returnValue = ''; // Required for Chrome to show the dialog
  });

  // Custom in-page modal — intercept all <a> clicks inside the page
  document.addEventListener('click', e => {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript')) return;
    if (!hasUnsavedGrades) return;
    e.preventDefault();
    showUnsavedModal(href);
  });
});

// Load ALL students into the grade sheet immediately (grades will be empty until subject is picked)
async function loadAllStudents() {
  const loadEl = document.getElementById('loadingRow');
  const wrapEl = document.getElementById('tableWrap');
  if (loadEl) { loadEl.style.display = 'block'; loadEl.textContent = 'Loading students...'; }
  if (wrapEl) wrapEl.style.display = 'none';

  const grade   = document.getElementById('gradeSel')   ? document.getElementById('gradeSel').value   : '';
  const section = document.getElementById('sectionSel') ? document.getElementById('sectionSel').value : '';
  const cacheKey = grade + '|' + section;

  try {
    const params = new URLSearchParams({ action: 'students' });
    if (grade)   params.append('grade',   grade);
    if (section) params.append('section', section);
    const res  = await fetch(API + '?' + params, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    students = data.map(r => ({
      _id:      r.id,
      _sid:     r.student_id,
      _grade:   r.grade   || '',
      _section: r.section || '',
      name:     r.full_name,
      id:       r.student_id,
      ww:     null,
      pt:     null,
      qa:     null,
      att:    null,
      _late:  null,
      _absent:null,
    }));
    filtered = [...students];

    // Cache the freshly-fetched roster for this grade+section
    _studentCache[cacheKey] = students.map(s => ({ ...s }));
    _lastGradeKey           = cacheKey;

    // ── Dynamically populate Grade & Section dropdowns ──────────────────────────
    populateGradeSectionFilters(data);

    if (loadEl) loadEl.style.display = 'none';
    if (wrapEl) wrapEl.style.display = 'block';
    renderTable();
    // If a subject is already selected (e.g. after filter change), merge grades
    const subject = document.getElementById('subjectSel').value;
    const quarter = document.getElementById('quarterSel').value;
    if (subject) {
      if (quarter === 'Total') { await loadTotalPeriodGrades(subject); renderTable(); }
      else mergeGradesForSubject(subject, quarter);
    }
  } catch (err) {
    if (loadEl) { loadEl.style.display = 'block'; loadEl.textContent = 'Could not load students — is XAMPP running? (' + err.message + ')'; }
  }
}

// Populate grade and section <select> dropdowns from live student data
function populateGradeSectionFilters(data) {
  const gradeOrder = ['Kindergarten','Grade 1','Grade 2','Grade 3','Grade 4',
    'Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'];

  // Determine which grades the selected subject is assigned to (if any)
  const selectedSubjectName = document.getElementById('subjectSel')
    ? document.getElementById('subjectSel').value : '';
  const selectedSubject  = subjects.find(s => s.name === selectedSubjectName);
  const assignedGrades   = selectedSubject && subjectGradeMap[selectedSubject.id]
    ? subjectGradeMap[selectedSubject.id] : null;

  // Build grade set: all grades in data, filtered by subject assignments if subject selected
  const allGradesInData = new Set();
  data.forEach(r => { if (r.grade) allGradesInData.add(r.grade); });
  const gradeSet = assignedGrades
    ? new Set([...allGradesInData].filter(g => assignedGrades.has(g)))
    : allGradesInData;

  // Current grade selection (before we repopulate)
  const gradeSel   = document.getElementById('gradeSel');
  const sectionSel = document.getElementById('sectionSel');
  const prevGrade   = gradeSel   ? gradeSel.value   : '';
  const prevSection = sectionSel ? sectionSel.value : '';

  // Populate grade dropdown
  if (gradeSel) {
    while (gradeSel.options.length > 1) gradeSel.remove(1);
    [...gradeSet].sort((a, b) => {
      const ai = gradeOrder.indexOf(a), bi = gradeOrder.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    }).forEach(g => {
      const o = document.createElement('option');
      o.value = g; o.textContent = g;
      if (g === prevGrade) o.selected = true;
      gradeSel.appendChild(o);
    });
    // Reset if previous grade is no longer valid for this subject
    if (prevGrade && !gradeSet.has(prevGrade)) gradeSel.value = '';
  }

  // Build section set: only from students whose grade is in the active grade filter
  const activeGrade = gradeSel ? gradeSel.value : '';
  const sectionSet  = new Set();
  data.forEach(r => {
    if (!r.section) return;
    // If a grade is selected, only include sections from that grade
    // If no grade selected but subject has assigned grades, restrict to those grades
    if (activeGrade) {
      if (r.grade === activeGrade) sectionSet.add(r.section);
    } else if (assignedGrades) {
      if (assignedGrades.has(r.grade)) sectionSet.add(r.section);
    } else {
      sectionSet.add(r.section);
    }
  });

  // Populate section dropdown
  if (sectionSel) {
    while (sectionSel.options.length > 1) sectionSel.remove(1);
    [...sectionSet].sort().forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      if (s === prevSection) o.selected = true;
      sectionSel.appendChild(o);
    });
    // Reset if previous section is no longer valid
    if (prevSection && !sectionSet.has(prevSection)) sectionSel.value = '';
  }

  // Re-render subject dropdown so it filters to the selected grade
  renderSubjectDropdown();
}

// Merge saved grade data into the already-loaded students array
async function mergeGradesForSubject(subject, quarter) {
  try {
    const grade   = document.getElementById('gradeSel')   ? document.getElementById('gradeSel').value   : '';
    const section = document.getElementById('sectionSel') ? document.getElementById('sectionSel').value : '';
    const params  = new URLSearchParams({ action: 'grades', subject, quarter });
    if (grade)   params.append('grade',   grade);
    if (section) params.append('section', section);
    const res  = await fetch(API + '?' + params, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    // Map grade records by DB id for fast lookup
    const gradeMap = {};
    data.forEach(r => {
      gradeMap[r.id] = {
        ww:  r.written_works        !== null ? parseFloat(r.written_works)        : null,
        pt:  r.performance_tasks    !== null ? parseFloat(r.performance_tasks)    : null,
        qa:  r.quarterly_assessment !== null ? parseFloat(r.quarterly_assessment) : null,
        att: r.attendance           !== null ? parseFloat(r.attendance)           : null,
      };
    });

    // Merge into students (reset grades for all, then apply saved ones)
    students.forEach(s => {
      const g = gradeMap[s._id];
      s.ww     = g ? g.ww  : null;
      s.pt     = g ? g.pt  : null;
      s.qa     = g ? g.qa  : null;
      s.att    = g ? g.att : null;
      // keep live L/A counts if already populated; they'll be refreshed by _fillMissingAttendance
      if (!g) { s._late = null; s._absent = null; }
    });
    filtered = [...students];

    // Also load item scores from server
    await loadItemScoresForSubject(subject, quarter, grade, section);

    // Fill att % from attendance DB only for students with no saved att value
    await _fillMissingAttendance(grade, section);

    renderTable();
  } catch (err) {
    toast('Could not load grades for this subject: ' + err.message, 'error');
  }
}

// Load item scores from server for a subject+quarter
async function loadItemScoresForSubject(subject, quarter, grade, section) {
  try {
    const params = new URLSearchParams({ action: 'item_scores', subject, quarter });
    if (grade)   params.append('grade',   grade);
    if (section) params.append('section', section);
    const res = await fetch(API + '?' + params, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    // Build studentItemScores from server data
    data.forEach(r => {
      if (r.student_id && r.component_key && r.item_name && r.score !== null) {
        setStudentItemScore(r.student_id, r.component_key, r.item_name, parseFloat(r.score));
      }
    });
  } catch (err) {
    // Silently fail - item scores are optional
    console.log('Could not load item scores:', err.message);
  }
}


// ════════════════════════════════════════
//  GPA SCALE
// ════════════════════════════════════════
async function loadGpaScales() {
  try {
    const res  = await fetch(API + '?action=gpa_scales', { credentials: 'same-origin' });
    const data = await res.json();
    if (Array.isArray(data) && data.length) {
      // Deduplicate by min_grade+max_grade (in case DB has duplicate rows)
      const seen = new Set();
      gpaScales = data.filter(sc => {
        const key = sc.min_grade + '_' + sc.max_grade;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } else {
      throw new Error('empty');
    }
    renderGpaTable();
    if (students.length) renderTable();
  } catch {
    gpaScales = [
      { scale_name:'DepEd Default', min_grade:90,    max_grade:100,   gpa_value:1.00, letter_grade:'A',  descriptor:'Outstanding' },
      { scale_name:'DepEd Default', min_grade:85,    max_grade:89.99, gpa_value:1.50, letter_grade:'B+', descriptor:'Very Satisfactory' },
      { scale_name:'DepEd Default', min_grade:80,    max_grade:84.99, gpa_value:2.00, letter_grade:'B',  descriptor:'Satisfactory' },
      { scale_name:'DepEd Default', min_grade:75,    max_grade:79.99, gpa_value:2.50, letter_grade:'C',  descriptor:'Fairly Satisfactory' },
      { scale_name:'DepEd Default', min_grade:0,     max_grade:74.99, gpa_value:5.00, letter_grade:'F',  descriptor:'Did Not Meet' },
    ];
    renderGpaTable();
  }
}

function getGpaInfo(finalGrade) {
  // Sort descending by max_grade so higher ranges are checked first (avoids boundary overlap)
  const sorted = [...gpaScales].sort((a, b) => parseFloat(b.max_grade) - parseFloat(a.max_grade));
  for (const sc of sorted) {
    const min = parseFloat(sc.min_grade);
    const max = parseFloat(sc.max_grade);
    if (finalGrade >= min && finalGrade <= max) {
      return { gpa: parseFloat(sc.gpa_value).toFixed(2), letter: sc.letter_grade || '—', descriptor: sc.descriptor || '—' };
    }
  }
  // Fallback: find the lowest range's descriptor
  if (sorted.length) {
    const lowest = sorted[sorted.length - 1];
    return { gpa: parseFloat(lowest.gpa_value).toFixed(2), letter: lowest.letter_grade || 'F', descriptor: lowest.descriptor || 'Did Not Meet' };
  }
  return { gpa: '5.00', letter: 'F', descriptor: 'Did Not Meet' };
}

function descriptor(f) { return getGpaInfo(f).descriptor; }
function gpa(f)         { return getGpaInfo(f).gpa; }
function letterGrade(f) { return getGpaInfo(f).letter; }

function badgeClass(d) {
  const d2 = (d || '').toLowerCase();
  if (d2.includes('outstanding'))       return 'badge-outstanding';
  if (d2.includes('very satisfactory')) return 'badge-vs';
  if (d2.includes('satisfactory'))      return 'badge-s';
  if (d2.includes('fairly'))            return 'badge-fs';
  if (d2.includes('did not'))           return 'badge-dnm';
  return 'badge-s';
}
function progColor(v) {
  if (v >= 90) return '#10b981';
  if (v >= 75) return '#6c63ff';
  if (v >= 60) return '#f59e0b';
  return '#ef4444';
}

function renderGpaTable() {
  const tbody = document.getElementById('gpaBody');
  if (!tbody) return;
  if (!gpaScales.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--gray-400);">No GPA rows yet. Click "Add Row".</td></tr>';
    return;
  }
  tbody.innerHTML = gpaScales.map((sc, i) => `
    <tr>
      <td><input class="grade-input" type="number" step="0.01" min="0" max="100" value="${sc.min_grade}"
            oninput="gpaScales[${i}].min_grade=parseFloat(this.value)||0" style="width:70px;"></td>
      <td><input class="grade-input" type="number" step="0.01" min="0" max="100" value="${sc.max_grade}"
            oninput="gpaScales[${i}].max_grade=parseFloat(this.value)||0" style="width:70px;"></td>
      <td><input class="grade-input" type="number" step="0.01" min="0" value="${sc.gpa_value}"
            oninput="gpaScales[${i}].gpa_value=parseFloat(this.value)||0" style="width:70px;"></td>
      <td><input class="grade-input" type="text" maxlength="5" value="${esc(sc.letter_grade||'')}"
            oninput="gpaScales[${i}].letter_grade=this.value" style="width:60px;text-align:center;"></td>
      <td><input type="text" value="${esc(sc.descriptor||'')}" oninput="gpaScales[${i}].descriptor=this.value"
            style="width:180px;padding:4px 8px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:13px;font-family:'Inter',sans-serif;color:var(--gray-800);outline:none;"></td>
      <td><input type="text" value="${esc(sc.scale_name||'')}" oninput="gpaScales[${i}].scale_name=this.value"
            style="width:130px;padding:4px 8px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:13px;font-family:'Inter',sans-serif;color:var(--gray-800);outline:none;"></td>
      <td><button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);"
            onclick="gpaScales.splice(${i},1);renderGpaTable();">Remove</button></td>
    </tr>`).join('');
}

function addGpaRow() {
  gpaScales.push({ scale_name:'Custom', min_grade:0, max_grade:100, gpa_value:1.00, letter_grade:'A', descriptor:'New Level' });
  renderGpaTable();
}

async function saveGpaScales() {
  verifyPin(async function(confirmed) {
    if (!confirmed) { toast('PIN required to save GPA scales.', 'warning'); return; }
    const tbody  = document.getElementById('gpaBody');
    const rows   = tbody.querySelectorAll('tr');
    const scales = [];
    rows.forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      if (inputs.length < 6) return;
      scales.push({ min_grade: parseFloat(inputs[0].value)||0, max_grade: parseFloat(inputs[1].value)||0,
        gpa_value: parseFloat(inputs[2].value)||0, letter_grade: inputs[3].value,
        descriptor: inputs[4].value, scale_name: inputs[5].value });
    });
    if (!scales.length) { toast('Add at least one GPA row.', 'error'); return; }
    try {
      const res  = await fetch(API + '?action=save_gpa', { method:'POST', credentials: 'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ scales }) });
      const data = await res.json();
      if (data.success) { toast('GPA scale saved (' + data.saved + ' rows)', 'success'); loadGpaScales(); renderTable(); }
      else toast('Error: ' + (data.error || 'unknown'), 'error');
    } catch {
      gpaScales = scales;
      renderTable();
      toast('GPA scale updated locally.', 'success');
    }
  });
}

function resetGpaDefault() {
  gpaScales = [
    { scale_name:'DepEd Default', min_grade:90,    max_grade:100,   gpa_value:1.00, letter_grade:'A',  descriptor:'Outstanding' },
    { scale_name:'DepEd Default', min_grade:85,    max_grade:89.99, gpa_value:1.50, letter_grade:'B+', descriptor:'Very Satisfactory' },
    { scale_name:'DepEd Default', min_grade:80,    max_grade:84.99, gpa_value:2.00, letter_grade:'B',  descriptor:'Satisfactory' },
    { scale_name:'DepEd Default', min_grade:75,    max_grade:79.99, gpa_value:2.50, letter_grade:'C',  descriptor:'Fairly Satisfactory' },
    { scale_name:'DepEd Default', min_grade:0,     max_grade:74.99, gpa_value:5.00, letter_grade:'F',  descriptor:'Did Not Meet' },
  ];
  renderGpaTable();
}

// ════════════════════════════════════════
//  SUBJECTS
// ════════════════════════════════════════
// ── Subject ↔ Grade assignments: { subjectId: [gradeLevels] } ──
let subjectGradeMap = {}; // subjectId → Set of grade levels

async function loadSubjects() {
  try {
    const res  = await fetch(API + '?action=subjects', { credentials: 'same-origin' });
    const data = await res.json();
    subjects    = data.map(s => ({ id: parseInt(s.id), name: s.name, code: s.code || '', active: !!parseInt(s.is_active) }));
    allSubjects = [...subjects];
    subjectIdCounter = subjects.length ? Math.max(...subjects.map(s => s.id)) + 1 : 1;
  } catch {
    subjects    = [];
    allSubjects = [];
    subjectIdCounter = 1;
  }
  // Load subject→grade assignments
  try {
    const res2 = await fetch(API + '?action=subject_grades', { credentials: 'same-origin' });
    const data2 = await res2.json();
    subjectGradeMap = {};
    data2.forEach(row => {
      if (!subjectGradeMap[row.subject_id]) subjectGradeMap[row.subject_id] = new Set();
      subjectGradeMap[row.subject_id].add(row.grade_level);
    });
  } catch {
    subjectGradeMap = {};
  }
  renderSubjectDropdown();
  renderSubjectTable();
}

function renderSubjectDropdown() {
  const sel      = document.getElementById('subjectSel');
  const current  = sel.value;
  const selGrade = document.getElementById('gradeSel') ? document.getElementById('gradeSel').value : '';
  sel.innerHTML  = '<option value="">— Select Subject —</option>';

  let list = subjects.filter(s => s.active);

  // Only show subjects assigned to the selected grade. No fallback.
  if (selGrade) {
    list = list.filter(s => {
      const grades = subjectGradeMap[s.id];
      return grades && grades.has(selGrade);
    });
  }

  list.forEach(s => {
    const opt = document.createElement('option');
    opt.value       = s.name;
    opt.textContent = s.name + (s.code ? ' (' + s.code + ')' : '');
    if (s.name === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderSubjectTable() {
  const body = document.getElementById('subjectBody');
  const list = (allSubjects.length ? allSubjects : subjects).filter(s =>
    s.name.toLowerCase().includes(subjectFilter.toLowerCase()) ||
    (s.code || '').toLowerCase().includes(subjectFilter.toLowerCase())
  );
  document.getElementById('subjectCount').textContent = '(' + subjects.length + ' total)';
  // Show Delete All button only when there are subjects
  const deleteAllBtn = document.getElementById('deleteAllBtn');
  if (deleteAllBtn) deleteAllBtn.style.display = subjects.length ? 'inline-flex' : 'none';
  body.innerHTML = '';
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--gray-400);padding:2rem;">No subjects found.</td></tr>';
    return;
  }
  list.forEach((s, i) => {
    const assignedGrades = subjectGradeMap[s.id] ? [...subjectGradeMap[s.id]].sort().join(', ') : '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--gray-400);font-size:12px;">${i + 1}</td>
      <td><div style="font-weight:600;color:var(--gray-900);">${esc(s.name)}</div></td>
      <td><span style="font-family:'DM Mono',monospace;font-size:12px;background:var(--gray-100);padding:2px 8px;border-radius:4px;color:var(--gray-600);">${esc(s.code || '—')}</span></td>
      <td><span class="badge ${s.active ? 'badge-active' : 'badge-inactive'}">${s.active ? 'Active' : 'Inactive'}</span></td>
      <td style="font-size:12px;color:var(--gray-600);max-width:180px;">${esc(assignedGrades)}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-sm" onclick="openEditModal(${s.id})">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="btn btn-sm" onclick="openAssignGradesModal(${s.id})" style="color:var(--primary);border-color:var(--primary);">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Assign Grades
          </button>
          <button class="btn btn-sm" onclick="toggleSubjectStatus(${s.id})" style="${s.active ? 'color:var(--warning);border-color:var(--warning);' : 'color:var(--success);border-color:var(--success);'}">
            ${s.active ? 'Deactivate' : 'Activate'}
          </button>
          <button class="btn btn-sm" onclick="deleteSubject(${s.id})" style="color:var(--danger);border-color:var(--danger);">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </td>`;
    body.appendChild(tr);
  });
}

async function addSubject() {
  verifyPin(async function(confirmed) {
    if (!confirmed) { toast('PIN required to add subject.', 'warning'); return; }
    const nameEl = document.getElementById('newSubjectName');
    const codeEl = document.getElementById('newSubjectCode');
    const errEl  = document.getElementById('subjectFormError');
    const name   = nameEl.value.trim();
    const code   = codeEl.value.trim().toUpperCase();
    if (!name) { errEl.textContent = 'Subject name is required.'; errEl.style.display = 'block'; nameEl.focus(); return; }
    if (subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      errEl.textContent = 'A subject with this name already exists.'; errEl.style.display = 'block'; nameEl.focus(); return;
    }
    errEl.style.display = 'none';
    try {
      const res  = await fetch(API + '?action=add_subject', { method:'POST', credentials: 'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, code }) });
      const data = await res.json();
      if (data.error) { errEl.textContent = data.error; errEl.style.display = 'block'; return; }
      subjects.push({ id: parseInt(data.id) || subjectIdCounter++, name, code, active: true });
    } catch {
      subjects.push({ id: subjectIdCounter++, name, code, active: true });
    }
    allSubjects = [...subjects];
    nameEl.value = ''; codeEl.value = '';
    renderSubjectTable(); renderSubjectDropdown();
    toast('Subject "' + name + '" added!', 'success');
  });
}

async function toggleSubjectStatus(id) {
  const s = subjects.find(s => s.id === id); if (!s) return;
  s.active = !s.active; allSubjects = [...subjects];
  renderSubjectTable(); renderSubjectDropdown();
  toast(s.name + ' is now ' + (s.active ? 'active' : 'inactive') + '.', 'success');
  try {
    await fetch(API + '?action=toggle_subject&id=' + id, { credentials: 'same-origin',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: s.active ? 1 : 0 })
    });
  } catch {}
}

async function deleteSubject(id) {
  verifyPin(async function(confirmed) {
    if (!confirmed) { toast('PIN required to delete subject.', 'warning'); return; }
    const s = subjects.find(s => s.id === id); if (!s) return;
    if (!confirm('Delete "' + s.name + '"? This cannot be undone.')) return;
    try { await fetch(API + '?action=delete_subject&id=' + id, { method:'DELETE', credentials: 'same-origin' }); } catch {}
    subjects = subjects.filter(s => s.id !== id); allSubjects = [...subjects];
    renderSubjectTable(); renderSubjectDropdown();
    toast('Subject deleted.', 'success');
  });
}

function filterSubjects(q) { subjectFilter = q; renderSubjectTable(); }

async function deleteAllSubjects() {
  verifyPin(async function(confirmed) {
    if (!confirmed) { toast('PIN required.', 'warning'); return; }
    if (!subjects.length) return;
    if (!confirm('Delete ALL subjects? This cannot be undone.')) return;
    const ids = subjects.map(s => s.id);
    for (const id of ids) {
      try { await fetch(API + '?action=delete_subject&id=' + id, { method: 'DELETE', credentials: 'same-origin' }); } catch {}
    }
    subjects = []; allSubjects = [];
    renderSubjectTable(); renderSubjectDropdown();
    toast('All subjects deleted.', 'success');
  });
}

function openEditModal(id) {
  const s = subjects.find(s => s.id === id); if (!s) return;
  editingSubjectId = id;
  document.getElementById('editSubjectName').value = s.name;
  document.getElementById('editSubjectCode').value = s.code;
  const ov = document.getElementById('editOverlay');
  ov.classList.add('show'); ov.style.display = 'flex';
}
function closeEditModal() {
  editingSubjectId = null;
  const ov = document.getElementById('editOverlay');
  ov.classList.remove('show'); ov.style.display = 'none';
}
async function saveEdit() {
  verifyPin(async function(confirmed) {
    if (!confirmed) { toast('PIN required to update subject.', 'warning'); return; }
    const name = document.getElementById('editSubjectName').value.trim();
    const code = document.getElementById('editSubjectCode').value.trim().toUpperCase();
    if (!name) { alert('Subject name is required.'); return; }
    if (subjects.find(s => s.name.toLowerCase() === name.toLowerCase() && s.id !== editingSubjectId)) { alert('A subject with this name already exists.'); return; }
    try { await fetch(API + '?action=edit_subject&id=' + editingSubjectId, { method:'PUT', credentials: 'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, code }) }); } catch {}
    const s = subjects.find(s => s.id === editingSubjectId);
    if (s) { s.name = name; s.code = code; } allSubjects = [...subjects];
    closeEditModal(); renderSubjectTable(); renderSubjectDropdown();
    toast('Subject updated!', 'success');
  });
}

// ════════════════════════════════════════
//  ASSIGN GRADES TO SUBJECT MODAL
// ════════════════════════════════════════
async function openAssignGradesModal(subjectId) {
  const s = subjects.find(s => s.id === subjectId); if (!s) return;
  const assigned = subjectGradeMap[subjectId] ? [...subjectGradeMap[subjectId]] : [];

  const existing = document.getElementById('assignGradesModal');
  if (existing) existing.remove();

  // Fetch only grade levels that have enrolled students
  let gradeLevels = [];
  try {
    const res = await fetch(API + '?action=distinct_grades', { credentials: 'same-origin' });
    gradeLevels = await res.json();
    if (!Array.isArray(gradeLevels)) gradeLevels = [];
  } catch { gradeLevels = []; }

  const checkboxHtml = gradeLevels.length === 0
    ? '<p style="font-size:13px;color:var(--gray-400);text-align:center;padding:12px 0;">No students enrolled yet.</p>'
    : gradeLevels.map(g => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;
                  background:${assigned.includes(g) ? 'var(--primary-light,#ede9fe)' : 'var(--gray-50)'};
                  border:1px solid ${assigned.includes(g) ? 'var(--primary)' : 'var(--gray-200)'};
                  transition:all 0.15s;" id="lbl-ag-${g.replace(' ','-')}">
      <input type="checkbox" value="${g}" ${assigned.includes(g) ? 'checked' : ''}
        onchange="this.closest('label').style.background=this.checked?'var(--primary-light,#ede9fe)':'var(--gray-50)';
                  this.closest('label').style.borderColor=this.checked?'var(--primary)':'var(--gray-200)';"
        style="width:15px;height:15px;accent-color:var(--primary);cursor:pointer;">
      <span style="font-size:13px;font-weight:500;color:var(--gray-800);">${g}</span>
    </label>`).join('');

  const overlay = document.createElement('div');
  overlay.id = 'assignGradesModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(17,24,39,0.55);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';
  overlay.innerHTML = `
    <div style="background:var(--white);border-radius:14px;padding:0;max-width:480px;width:calc(100% - 2rem);
                box-shadow:0 20px 60px rgba(0,0,0,.18);" onclick="event.stopPropagation()">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:1.25rem 1.5rem;border-bottom:1px solid var(--gray-200);">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--gray-900);">Assign Grade Levels</div>
          <div style="font-size:12px;color:var(--gray-400);margin-top:2px;">Subject: <strong>${esc(s.name)}</strong></div>
        </div>
        <button onclick="document.getElementById('assignGradesModal').remove()"
          style="background:none;border:none;font-size:18px;color:var(--gray-400);cursor:pointer;padding:4px;border-radius:6px;">✕</button>
      </div>
      <div style="padding:1.25rem 1.5rem;">
        <p style="font-size:12px;color:var(--gray-500);margin:0 0 12px;">Select which grade levels this subject is offered in. When a grade is selected in the Grade Sheet, only assigned subjects will appear.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;" id="gradeCheckboxes">
          ${checkboxHtml}
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:16px;border-top:1px solid var(--gray-100);">
          <button class="btn" onclick="document.getElementById('assignGradesModal').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="saveSubjectGradeAssignment(${subjectId})">Save Assignment</button>
        </div>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function saveSubjectGradeAssignment(subjectId) {
  const modal     = document.getElementById('assignGradesModal');
  const checkboxes = modal.querySelectorAll('input[type=checkbox]');
  const selected  = [...checkboxes].filter(c => c.checked).map(c => c.value);

  // Update local map
  subjectGradeMap[subjectId] = new Set(selected);

  // Build full assignments array from all subjects
  const allAssignments = [];
  Object.entries(subjectGradeMap).forEach(([sid, grades]) => {
    grades.forEach(g => allAssignments.push({ subject_id: parseInt(sid), grade_level: g }));
  });

  try {
    const res  = await fetch(API + '?action=save_subject_grades', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments: allAssignments })
    });
    const data = await res.json();
    if (data.error) { toast('Error: ' + data.error, 'error'); return; }
    toast('Grade assignments saved!', 'success');
  } catch {
    toast('Saved locally (DB offline).', 'success');
  }
  modal.remove();
  renderSubjectTable();
  renderSubjectDropdown();
}

// ════════════════════════════════════════
//  GRADE SHEET — called when filters change
// ════════════════════════════════════════
async function refresh() {
  const subject  = document.getElementById('subjectSel').value;
  const quarter  = document.getElementById('quarterSel').value;
  const grade    = document.getElementById('gradeSel')   ? document.getElementById('gradeSel').value   : '';
  const section  = document.getElementById('sectionSel') ? document.getElementById('sectionSel').value : '';
  const gradeKey = grade + '|' + section;

  const gradeOrSectionChanged = gradeKey !== _lastGradeKey;

  if (gradeOrSectionChanged) {
    // Grade or section changed — must reload the student roster
    await loadAllStudents();
  } else {
    // Only subject or quarter changed — reuse cached roster, reset grades only
    students.forEach(s => { s.ww = null; s.pt = null; s.qa = null; s.att = null; });
    filtered = [...students];
  }

  // If a subject is selected, overlay saved grade data
  if (subject) {
    if (quarter === 'Total') {
      await loadTotalPeriodGrades(subject);
      renderTable();
    } else {
      await mergeGradesForSubject(subject, quarter);
    }
  } else {
    renderTable();
  }
}

// ── Grading Period Toggle ─────────────────────────────────────────────────
function onGradingPeriodChange() {
  const modeSel = document.getElementById('gradingPeriodSel');
  const quarterSel = document.getElementById('quarterSel');
  const subPeriodSel = document.getElementById('subPeriodSel');
  gradingMode = modeSel.value;

  const options = {
    quarterly: [
      { value: 'Q1', label: 'Q1 — First Quarter' },
      { value: 'Q2', label: 'Q2 — Second Quarter' },
      { value: 'Q3', label: 'Q3 — Third Quarter' },
      { value: 'Q4', label: 'Q4 — Fourth Quarter' },
    ],
    sem2: [
      { value: 'Sem1', label: '1st Semester' },
      { value: 'Sem2', label: '2nd Semester' },
    ],
    sem3: [
      { value: 'Sem1', label: '1st Semester' },
      { value: 'Sem2', label: '2nd Semester' },
      { value: 'Sem3', label: '3rd Semester' },
    ],
  };

  const selected = quarterSel.value;
  quarterSel.innerHTML = '';
  (options[gradingMode] || options.quarterly).forEach(opt => {
    const optEl = document.createElement('option');
    optEl.value = opt.value;
    optEl.textContent = opt.label;
    if (opt.value === selected) optEl.selected = true;
    quarterSel.appendChild(optEl);
  });

  // Show Prelim/Midterm/Finals sub-period only for semester modes
  updateSubPeriodVisibility();

  refresh();
}

// ── Computed ──────────────────────────────────────────────────────────────────
function computeFinal(s) {
  const total = components.reduce((a,c)=>a+c.pct,0);
  if (total <= 0) return 0;
  const raw = components.reduce((sum,c) => {
    let v = 0;
    if (c.items && c.items.length > 0) {
      // Compute from item scores
      const scoredItems = c.items.filter(it => {
        const score = getStudentItemScore(s._id, c.key, it.id);
        return score !== null;
      });
      if (scoredItems.length > 0) {
        const totalPct = scoredItems.reduce((sum, it) => {
          const score = getStudentItemScore(s._id, c.key, it.id);
          const max = it.maxScore || 100;
          return sum + (parseFloat(score) / max) * 100;
        }, 0);
        v = totalPct / scoredItems.length;
      }
    } else {
      v = s[c.key] !== null && s[c.key] !== undefined ? Math.min(100,Math.max(0,parseFloat(s[c.key])||0)) : 0;
    }
    return sum + v * (c.pct/100);
  },0);
  // Normalize in case total ≠ 100
  return Math.round((raw / (total/100)) * 100) / 100;
}

function hasAnyGrade(s) {
  return components.some(c => {
    if (c.items && c.items.length > 0) {
      // Check if any item has a score for this student
      return c.items.some(it => getStudentItemScore(s._id, c.key, it.id) !== null);
    }
    return s[c.key] !== null && s[c.key] !== undefined;
  });
}

// Compute just the component average from items (for display in grade sheet)
function computeComponentAvgFromItems(studentId, componentKey) {
  const c = components.find(c => c.key === componentKey);
  if (!c || !c.items || c.items.length === 0) return null;
  const scoredItems = c.items.filter(it => {
    const score = getStudentItemScore(studentId, c.key, it.id);
    return score !== null;
  });
  if (scoredItems.length === 0) return null;
  const totalPct = scoredItems.reduce((sum, it) => {
    const score = getStudentItemScore(studentId, c.key, it.id);
    const max = it.maxScore || 100;
    return sum + (parseFloat(score) / max) * 100;
  }, 0);
  return totalPct / scoredItems.length;
}

// ── Render Grade Sheet ────────────────────────────────────────────────────────
// Store multi-period grades for Total view: periodGrades[studentId][period] = {ww,pt,qa,att,final}
let periodGrades = {};

async function loadTotalPeriodGrades(subject) {
  const periods = ['Prelim','Midterm','Prefinals','Finals'];
  const grade   = document.getElementById('gradeSel')   ? document.getElementById('gradeSel').value   : '';
  const section = document.getElementById('sectionSel') ? document.getElementById('sectionSel').value : '';
  periodGrades  = {};
  await Promise.all(periods.map(async p => {
    try {
      const params = new URLSearchParams({ action:'grades', subject, quarter: p });
      if (grade)   params.append('grade',   grade);
      if (section) params.append('section', section);
      const res  = await fetch(API + '?' + params, { credentials: 'same-origin' });
      const data = await res.json();
      if (!data.error) {
        data.forEach(r => {
          if (!periodGrades[r.id]) periodGrades[r.id] = {};
          const ww  = r.written_works        !== null ? parseFloat(r.written_works)        : null;
          const pt  = r.performance_tasks    !== null ? parseFloat(r.performance_tasks)    : null;
          const qa  = r.quarterly_assessment !== null ? parseFloat(r.quarterly_assessment) : null;
          const att = r.attendance           !== null ? parseFloat(r.attendance)           : null;
          let final = null;
          if (ww !== null || pt !== null || qa !== null) {
            const w = components.reduce((a,c)=>a+c.pct,0) || 100;
            final = components.reduce((sum,c) => {
              let v = 0;
              if (c.key === 'ww') v = ww || 0;
              else if (c.key === 'pt') v = pt || 0;
              else if (c.key === 'qa') v = qa || 0;
              return sum + v*(c.pct/100);
            },0);
            final = Math.round((final/(w/100))*100)/100;
          }
          periodGrades[r.id][p] = { ww, pt, qa, att, final };
        });
      }
    } catch {}
  }));
}

function renderTable() {
  const quarter = document.getElementById('quarterSel').value;
  const subject = document.getElementById('subjectSel').value;
  const isTotalView = (quarter === 'Total');
  const titleEl = document.getElementById('tableTitle');
  if (titleEl) {
    if (subject) {
      titleEl.textContent = (isTotalView ? 'All Periods' : quarter) + ' Grade Sheet — ' + subject + ' (' + filtered.length + ' students)';
    } else {
      titleEl.textContent = 'All Students (' + filtered.length + ') — Select a subject above to enter grades';
    }
  }

  // ── TOTAL VIEW: multi-period read-only table ──────────────────────────────────
  if (isTotalView) {
    renderTotalView();
    return;
  }

  // Build column configuration: for each component, either single column or multiple item columns
  const colConfig = []; // { key, label, pct, isItem, itemId, itemName, itemMaxScore, colspan }
  components.forEach(c => {
    if (c.items && c.items.length > 0) {
      // Add parent cell with colspan = number of items
      colConfig.push({ key: c.key, label: c.label, pct: c.pct, isItem: false, colspan: c.items.length });
      // Add item cells
      c.items.forEach(it => {
        colConfig.push({ key: c.key, label: it.name || ('Item ' + it.id), pct: null, isItem: true, itemId: it.id, itemName: it.name, itemMaxScore: it.maxScore || 100, colspan: 1 });
      });
    } else {
      colConfig.push({ key: c.key, label: c.label, pct: c.pct, isItem: false, colspan: 1 });
    }
  });

  // Update column headers dynamically from components
  const thead = document.querySelector('#gradeBody')?.closest('table')?.querySelector('thead tr');
  if (thead) {
    const hasItems = components.some(c => c.items && c.items.length > 0);

    const vb = hasItems ? 'vertical-align:bottom;' : '';
    let theadHTML = `
      <th style="width:36px;white-space:nowrap;${vb}">#</th>
      <th style="min-width:160px;max-width:200px;${vb}">Student</th>
      ${colConfig.map(col => {
        if (col.isItem) {
          return `<th style="min-width:52px;width:60px;max-width:80px;font-size:9px;font-weight:500;color:var(--gray-600);text-align:center;word-break:break-word;white-space:normal;padding:4px 4px 6px;" title="${esc(col.itemName || 'Unnamed')}">${esc(truncate(col.itemName || ('Item ' + col.itemId), 7))}<br><small style="font-weight:400;color:var(--gray-400);">/${col.itemMaxScore}</small></th>`;
        } else {
          return `<th style="min-width:70px;white-space:nowrap;${vb}" colspan="${col.colspan}">${esc(col.label)}<br><small style="font-weight:400;color:var(--gray-400);text-transform:none;letter-spacing:0;">${col.pct}%</small></th>`;
        }
      }).join('')}
      <th style="min-width:100px;${vb}">Att.</th>
      <th style="min-width:55px;white-space:nowrap;${vb}">Final</th>
      <th style="min-width:110px;${vb}">Descriptor</th>
      <th style="min-width:45px;white-space:nowrap;${vb}">GPA</th>
      <th style="min-width:45px;white-space:nowrap;${vb}">Letter</th>`;

    thead.innerHTML = theadHTML;
  }

  // Populate descriptor filter — deduplicated, sorted high to low
  const descSel = document.getElementById('descFilter');
  if (descSel) {
    const current = descSel.value;
    descSel.innerHTML = '<option value="">All descriptors</option>';
    const sortedScales = [...gpaScales].sort((a, b) => parseFloat(b.max_grade) - parseFloat(a.max_grade));
    const seenDesc = new Set();
    sortedScales.forEach(sc => {
      if (sc.descriptor && !seenDesc.has(sc.descriptor)) {
        seenDesc.add(sc.descriptor);
        const opt = document.createElement('option');
        opt.value = sc.descriptor;
        opt.textContent = sc.descriptor;
        if (sc.descriptor === current) opt.selected = true;
        descSel.appendChild(opt);
      }
    });
  }

  const body = document.getElementById('gradeBody');
  body.innerHTML = '';

  // Calculate total columns for the "no students" message
  let totalCols = 2 + colConfig.length + 4; // #, Student, [colConfig], Attendance, Final, Desc, GPA, Letter

  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="${totalCols}" style="text-align:center;padding:30px;color:var(--gray-400);">No students found.</td></tr>`;
    renderStats(); return;
  }

  filtered.forEach((s, i) => {
    const hasGrade = hasAnyGrade(s);
    const f        = hasGrade ? computeFinal(s) : null;
    const info     = f !== null ? getGpaInfo(f) : null;
    const attVal   = s.att !== null ? s.att : 0;
    const tr       = document.createElement('tr');

    // Build component cells using colConfig
    const compCells = colConfig.map(col => {
      if (col.isItem) {
        const val = getStudentItemScore(s._id, col.key, col.itemId);
        return `<td style="text-align:center;padding:4px 3px;"><input class="grade-input grade-input-sm" type="number" min="0" max="${col.itemMaxScore}" step="0.01"
          value="${val !== null ? val : ''}" placeholder="—"
          oninput="updateItemScore(${students.indexOf(s)},'${col.key}',${col.itemId},this.value,'${col.itemMaxScore}')"></td>`;
      } else {
        const val = s[col.key] !== null && s[col.key] !== undefined ? s[col.key] : '';
        return `<td><input class="grade-input" type="number" min="0" max="100" step="0.01"
          value="${val}" placeholder="—"
          oninput="updateGrade(${students.indexOf(s)},'${col.key}',this.value)"></td>`;
      }
    }).join('');
    tr.innerHTML = `
      <td style="color:var(--gray-400);font-size:12px;">${i + 1}</td>
      <td>
        <div class="student-name">${esc(s.name)}</div>
        <div class="student-id">${esc(s.id || '')}${s._grade ? ' · ' + esc(s._grade) + ' ' + esc(s._section) : ''}</div>
      </td>
      ${compCells}
      <td class="att-cell">
        <div class="att-pct-row">
          <input class="att-pct-input" type="number" min="0" max="100" step="0.01"
            value="${s.att !== null ? s.att : ''}" placeholder="—"
            oninput="updateGrade(${students.indexOf(s)},'att',this.value);">
          <span class="att-pct-symbol">%</span>
        </div>
        <div class="att-bar-row">
          <div class="prog-bar"><div class="prog-fill" id="attbar-${i}" style="width:${attVal}%;background:${progColor(attVal)};"></div></div>
        </div>
        <div class="att-badges-row">
          <span class="att-badge att-late"  id="latebadge-${i}">L&nbsp;${s._late  !== null && s._late  !== undefined ? s._late  : '—'}</span>
          <span class="att-badge att-absent" id="absentbadge-${i}">A&nbsp;${s._absent !== null && s._absent !== undefined ? s._absent : '—'}</span>
        </div>
      </td>
      <td><span class="final-grade" id="fg-${i}" style="color:${f !== null ? progColor(f) : 'var(--gray-400)'};">${f !== null ? f.toFixed(1) : '—'}</span></td>
      <td id="desc-${i}">${info ? '<span class="badge ' + badgeClass(info.descriptor) + '">' + esc(info.descriptor) + '</span>' : '—'}</td>
      <td style="font-family:'DM Mono',monospace;font-size:13px;" id="gpa-${i}">${info ? info.gpa : '—'}</td>
      <td style="font-weight:700;color:${f !== null ? progColor(f) : 'var(--gray-400)'};font-size:14px;" id="ltr-${i}">${info ? info.letter : '—'}</td>`;
    body.appendChild(tr);
  });
  renderStats();
}

// ── Total View (Prelim + Midterm + Pre-finals + Finals + Computed Total) ─────
function renderTotalView() {
  const periods = ['Prelim','Midterm','Prefinals','Finals'];
  const periodLabels = { Prelim:'Prelim', Midterm:'Midterm', Prefinals:'Pre-Finals', Finals:'Finals' };
  const thead = document.querySelector('#gradeBody')?.closest('table')?.querySelector('thead tr');
  if (thead) {
    thead.innerHTML = `
      <th style="width:36px;">#</th>
      <th style="min-width:160px;">Student</th>
      ${periods.map(p => `<th style="min-width:70px;text-align:center;">${periodLabels[p]}</th>`).join('')}
      <th style="min-width:80px;text-align:center;color:var(--primary);font-weight:700;">Total Avg</th>
      <th style="min-width:110px;">Descriptor</th>
      <th style="min-width:45px;">GPA</th>
      <th style="min-width:45px;">Letter</th>`;
  }

  const descSel = document.getElementById('descFilter');
  if (descSel) {
    descSel.innerHTML = '<option value="">All descriptors</option>';
    const sortedScales = [...gpaScales].sort((a, b) => parseFloat(b.max_grade) - parseFloat(a.max_grade));
    const seenDesc = new Set();
    sortedScales.forEach(sc => {
      if (sc.descriptor && !seenDesc.has(sc.descriptor)) {
        seenDesc.add(sc.descriptor);
        const opt = document.createElement('option');
        opt.value = sc.descriptor; opt.textContent = sc.descriptor;
        descSel.appendChild(opt);
      }
    });
  }

  const body = document.getElementById('gradeBody');
  body.innerHTML = '';

  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--gray-400);">No students found.</td></tr>`;
    document.getElementById('statGrid').innerHTML = `<div class="stat-card"><div class="stat-label">Total Students</div><div class="stat-value">${filtered.length}</div><div class="stat-sub">no grades yet</div></div>`;
    return;
  }

  const allFinals = [];
  filtered.forEach((s, i) => {
    const periodFinals = periods.map(p => {
      const pg = periodGrades[s._id] && periodGrades[s._id][p];
      return pg && pg.final !== null ? pg.final : null;
    });
    const validFinals = periodFinals.filter(f => f !== null);
    const totalAvg = validFinals.length ? Math.round((validFinals.reduce((a,b)=>a+b,0)/validFinals.length)*100)/100 : null;
    if (totalAvg !== null) allFinals.push(totalAvg);

    const info = totalAvg !== null ? getGpaInfo(totalAvg) : null;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--gray-400);font-size:12px;">${i + 1}</td>
      <td>
        <div class="student-name">${esc(s.name)}</div>
        <div class="student-id">${esc(s.id || '')}${s._grade ? ' · ' + esc(s._grade) + ' ' + esc(s._section) : ''}</div>
      </td>
      ${periodFinals.map(f => `<td style="text-align:center;font-family:'DM Mono',monospace;font-size:13px;color:${f !== null ? progColor(f) : 'var(--gray-400)'};">
        ${f !== null ? f.toFixed(1) : '—'}
      </td>`).join('')}
      <td style="text-align:center;">
        <span class="final-grade" style="color:${totalAvg !== null ? progColor(totalAvg) : 'var(--gray-400)'};">
          ${totalAvg !== null ? totalAvg.toFixed(1) : '—'}
        </span>
      </td>
      <td>${info ? '<span class="badge ' + badgeClass(info.descriptor) + '">' + esc(info.descriptor) + '</span>' : '—'}</td>
      <td style="font-family:'DM Mono',monospace;font-size:13px;">${info ? info.gpa : '—'}</td>
      <td style="font-weight:700;color:${totalAvg !== null ? progColor(totalAvg) : 'var(--gray-400)'};font-size:14px;">${info ? info.letter : '—'}</td>`;
    body.appendChild(tr);
  });

  // Stat grid for total view
  if (allFinals.length) {
    const avg     = (allFinals.reduce((a,b)=>a+b,0)/allFinals.length).toFixed(2);
    const passing = allFinals.filter(f=>f>=75).length;
    const highest = Math.max(...allFinals).toFixed(1);
    const lowest  = Math.min(...allFinals).toFixed(1);
    document.getElementById('statGrid').innerHTML = `
      <div class="stat-card"><div class="stat-label">Class average</div><div class="stat-value">${avg}</div><div class="stat-sub">all periods</div></div>
      <div class="stat-card"><div class="stat-label">Passing rate</div><div class="stat-value">${Math.round((passing/allFinals.length)*100)}%</div><div class="stat-sub">${passing} of ${allFinals.length} students</div></div>
      <div class="stat-card"><div class="stat-label">Highest grade</div><div class="stat-value" style="color:var(--success);">${highest}</div><div class="stat-sub">top score</div></div>
      <div class="stat-card"><div class="stat-label">Lowest grade</div><div class="stat-value" style="color:var(--danger);">${lowest}</div><div class="stat-sub">needs attention</div></div>`;
  } else {
    document.getElementById('statGrid').innerHTML = `<div class="stat-card"><div class="stat-label">Total Students</div><div class="stat-value">${filtered.length}</div><div class="stat-sub">no grades yet</div></div>`;
  }
}

function updateItemScore(idx, componentKey, itemId, val, maxScore) {
  const s = students[idx];
  const score = val === '' ? null : Math.min(parseFloat(maxScore) || 100, Math.max(0, parseFloat(val) || 0));
  setStudentItemScore(s._id, componentKey, itemId, score);
  hasUnsavedGrades = true;
  markUnsavedIndicator(true);

  const fIdx = filtered.indexOf(s);
  if (fIdx < 0) return;

  const f    = hasAnyGrade(s) ? computeFinal(s) : null;
  const info = f !== null ? getGpaInfo(f) : null;

  const fgEl   = document.getElementById('fg-'    + fIdx);
  const descEl = document.getElementById('desc-'  + fIdx);
  const gpaEl  = document.getElementById('gpa-'   + fIdx);
  const ltrEl  = document.getElementById('ltr-'   + fIdx);

  if (fgEl)   { fgEl.textContent = f !== null ? f.toFixed(1) : '—'; fgEl.style.color = f !== null ? progColor(f) : 'var(--gray-400)'; }
  if (descEl) descEl.innerHTML  = info ? '<span class="badge ' + badgeClass(info.descriptor) + '">' + esc(info.descriptor) + '</span>' : '—';
  if (gpaEl)  gpaEl.textContent = info ? info.gpa    : '—';
  if (ltrEl)  { ltrEl.textContent = info ? info.letter : '—'; ltrEl.style.color = f !== null ? progColor(f) : 'var(--gray-400)'; }

  renderStats();
}

function updateGrade(idx, field, val) {
  const v = val === '' ? null : Math.min(100, Math.max(0, parseFloat(val) || 0));
  students[idx][field] = v;
  hasUnsavedGrades = true;          // ← mark dirty
  markUnsavedIndicator(true);       // ← update UI indicator
  const s    = students[idx];
  const fIdx = filtered.indexOf(s);
  if (fIdx < 0) return;

  const f    = hasAnyGrade(s) ? computeFinal(s) : null;
  const info = f !== null ? getGpaInfo(f) : null;

  const fgEl   = document.getElementById('fg-'    + fIdx);
  const descEl = document.getElementById('desc-'  + fIdx);
  const gpaEl  = document.getElementById('gpa-'   + fIdx);
  const ltrEl  = document.getElementById('ltr-'   + fIdx);

  if (fgEl)   { fgEl.textContent = f !== null ? f.toFixed(1) : '—'; fgEl.style.color = f !== null ? progColor(f) : 'var(--gray-400)'; }
  if (descEl) descEl.innerHTML  = info ? '<span class="badge ' + badgeClass(info.descriptor) + '">' + esc(info.descriptor) + '</span>' : '—';
  if (gpaEl)  gpaEl.textContent = info ? info.gpa    : '—';
  if (ltrEl)  { ltrEl.textContent = info ? info.letter : '—'; ltrEl.style.color = f !== null ? progColor(f) : 'var(--gray-400)'; }

  if (field === 'att') {
    const bar = document.getElementById('attbar-' + fIdx);
    if (bar) { bar.style.width = (v || 0) + '%'; bar.style.background = progColor(v || 0); }
  }
  renderStats();
}

function renderStats() {
  const finals = filtered.filter(s => hasAnyGrade(s)).map(s => computeFinal(s));
  if (!finals.length) {
    document.getElementById('statGrid').innerHTML = `<div class="stat-card"><div class="stat-label">Total Students</div><div class="stat-value">${filtered.length}</div><div class="stat-sub">no grades yet</div></div>`;
    return;
  }
  const avg     = (finals.reduce((a, b) => a + b, 0) / finals.length).toFixed(2);
  const passing = finals.filter(f => f >= 75).length;
  const highest = Math.max(...finals).toFixed(1);
  const lowest  = Math.min(...finals).toFixed(1);
  document.getElementById('statGrid').innerHTML = `
    <div class="stat-card"><div class="stat-label">Class average</div><div class="stat-value">${avg}</div><div class="stat-sub">out of 100</div></div>
    <div class="stat-card"><div class="stat-label">Passing rate</div><div class="stat-value">${Math.round((passing / finals.length) * 100)}%</div><div class="stat-sub">${passing} of ${finals.length} students</div></div>
    <div class="stat-card"><div class="stat-label">Highest grade</div><div class="stat-value" style="color:var(--success);">${highest}</div><div class="stat-sub">top score</div></div>
    <div class="stat-card"><div class="stat-label">Lowest grade</div><div class="stat-value" style="color:var(--danger);">${lowest}</div><div class="stat-sub">needs attention</div></div>`;
}

// ── Filters ───────────────────────────────────────────────────────────────────
function filterSearch(q) {
  filtered = students.filter(s => {
    const matchName = s.name.toLowerCase().includes(q.toLowerCase()) || (s.id || '').toLowerCase().includes(q.toLowerCase());
    const matchDesc = activeDesc ? (hasAnyGrade(s) && descriptor(computeFinal(s)) === activeDesc) : true;
    return matchName && matchDesc;
  });
  renderTable();
}
function filterDesc(d) {
  activeDesc = d;
  filtered   = students.filter(s => d ? (hasAnyGrade(s) && descriptor(computeFinal(s)) === d) : true);
  renderTable();
}

// ════════════════════════════════════════
//  SAVE GRADES
// ════════════════════════════════════════
async function saveGrades() {
  verifyPin(async function(confirmed) {
    if (!confirmed) { toast('PIN required to save grades.', 'warning'); return; }
    const subject = document.getElementById('subjectSel').value;
    const quarter = document.getElementById('quarterSel').value;
    if (!subject) { toast('Select a subject first.', 'error'); return; }
    const itemScoresMap = {};
    students.forEach(s => {
      if (studentItemScores[s._id]) { itemScoresMap[s._id] = studentItemScores[s._id]; }
    });
    const records = students.map(s => ({
      student_id: s._id, written_works: s.ww, performance_tasks: s.pt,
      quarterly_assessment: s.qa, attendance: s.att,
      final_grade: hasAnyGrade(s) ? computeFinal(s) : null,
      item_scores: studentItemScores[s._id] || {},
    }));
    try {
      const res  = await fetch(API + '?action=save_grades', { method:'POST', credentials: 'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subject, quarter, records }) });
      const data = await res.json();
      if (data.error) { toast('Error: ' + data.error, 'error'); return; }
      hasUnsavedGrades = false;
      markUnsavedIndicator(false);
      saveStudentItemScores();
      toast('Grades saved! (' + data.saved + ' records)', 'success');
      if (window.CILog) CILog.push('grades_saved', 'Grades saved', subject + ' · ' + quarter + ' · ' + data.saved + ' record' + (data.saved !== 1 ? 's' : ''));
      // Notify dashboard to refresh performance chart
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'CI_GRADES_UPDATED', subject, quarter }, '*');
        }
      } catch(e) {}
    } catch { toast('Network error — is XAMPP running?', 'error'); }
  });
}

// ════════════════════════════════════════
//  WEIGHTS
// ════════════════════════════════════════
async function loadWeights() {
  try {
    const res  = await fetch(API + '?action=weights', { credentials: 'same-origin' });
    const data = await res.json();
    const def  = data.find(w => w.subject === '__default__');
    if (def) {
      const wc = components.find(c => c.key === 'ww');
      const pc = components.find(c => c.key === 'pt');
      const qc = components.find(c => c.key === 'qa');
      if (wc) wc.pct = parseInt(def.written_works_pct)        || 30;
      if (pc) pc.pct = parseInt(def.performance_tasks_pct)    || 50;
      if (qc) qc.pct = parseInt(def.quarterly_assessment_pct) || 20;
    }
    renderWeights();
    // Re-render grade sheet if already loaded so weights apply correctly
    if (students.length) renderTable();
  } catch {}
}

function renderWeights() {
  const grid = document.getElementById('weightsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  components.forEach((c, ci) => {
    const div = document.createElement('div');
    div.className = 'weight-card';
    div.setAttribute('data-ci', ci);
    div.innerHTML = `
      <div class="weight-header">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
          <div style="width:10px;height:10px;border-radius:50%;background:${c.color};flex-shrink:0;"></div>
          <input type="text" value="${esc(c.label)}"
            style="flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--gray-800);border:1px solid transparent;background:transparent;padding:2px 6px;border-radius:var(--radius-sm);font-family:'Inter',sans-serif;outline:none;transition:var(--transition);"
            onfocus="this.style.borderColor='var(--primary)';this.style.background='var(--white)';"
            onblur="this.style.borderColor='transparent';this.style.background='transparent';"
            oninput="components[${ci}].label=this.value;syncCompLabels();"
            placeholder="Component name">
        </div>
        <span class="weight-pct" id="wpct-${c.key}">${c.pct}%</span>
        ${components.length > 1 ? `<button class="btn btn-icon btn-sm" title="Remove component"
            style="color:var(--danger);border-color:var(--danger);margin-left:6px;"
            onclick="removeComponent(${ci})">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>` : ''}
      </div>
      <input type="range" min="0" max="100" step="5" value="${c.pct}" oninput="updateWeight('${c.key}',this.value)">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--gray-400);margin-top:4px;"><span>0%</span><span>100%</span></div>`;
    grid.appendChild(div);
  });
  // Add component button
  const addBtn = document.createElement('div');
  addBtn.className = 'weight-card';
  addBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px dashed var(--gray-300);background:none;min-height:90px;';
  addBtn.innerHTML = `<button onclick="addComponent()" style="background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--gray-500);font-family:'Inter',sans-serif;font-size:13px;font-weight:500;">
    <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
    Add Component
  </button>`;
  grid.appendChild(addBtn);
  updateWeightDisplay();
}

function syncCompLabels() {
  renderTable();
  renderComponentItems();
}

function addComponent() {
  verifyPin(function(confirmed) {
    if (!confirmed) { toast('PIN required to add component.', 'warning'); return; }
    const PALETTE = ['#8b5cf6','#ef4444','#06b6d4','#f97316','#ec4899','#14b8a6'];
    const usedColors = components.map(c=>c.color);
    const color = PALETTE.find(p=>!usedColors.includes(p)) || PALETTE[components.length % PALETTE.length];
    const key = 'c' + Date.now();
    components.push({ key, label:'New Component', pct:0, color, items:[] });
    renderWeights();
    renderComponentItems();
    updateWeightDisplay();
    const cards = document.querySelectorAll('#weightsGrid .weight-card');
    const lastCard = cards[cards.length - 2];
    if (lastCard) { const inp = lastCard.querySelector('input[type=text]'); if (inp) { inp.focus(); inp.select(); } }
  });
}

function removeComponent(ci) {
  verifyPin(function(confirmed) {
    if (!confirmed) { toast('PIN required to remove component.', 'warning'); return; }
    if (components.length <= 1) { toast('You must have at least one component.', 'error'); return; }
    const name = components[ci].label;
    if (!confirm(`Remove "${name}"? Its items will also be deleted.`)) return;
    components.splice(ci, 1);
    renderWeights();
    renderComponentItems();
    updateWeightDisplay();
    renderTable();
    toast(`"${name}" removed.`, 'success');
  });
}

function updateWeight(k, v) {
  const c = components.find(c=>c.key===k);
  if (c) c.pct = parseInt(v);
  const el = document.getElementById('wpct-' + k);
  if (el) el.textContent = v + '%';
  updateWeightDisplay();
}
function updateWeightDisplay() {
  const total = components.reduce((a,c)=>a+c.pct,0);
  const ok    = total === 100;
  const box   = document.getElementById('weightTotalBox');
  if (box) box.innerHTML = 'Total: <strong style="color:' + (ok ? 'var(--success)' : 'var(--danger)') + ';">' + total + '%</strong> ' + (ok ? '✓ Ready to save' : '— needs to be 100% (off by ' + (total - 100) + '%)');
}
async function saveWeights() {
  verifyPin(async function(confirmed) {
    if (!confirmed) { toast('PIN required to save weights.', 'warning'); return; }
    const total = components.reduce((a,c)=>a+c.pct,0);
    if (total !== 100) { toast('Weights must total 100%. Currently ' + total + '%.', 'error'); return; }
    try { localStorage.setItem('classinstruct_components', JSON.stringify(components.map(c=>({key:c.key,label:c.label,pct:c.pct,color:c.color})))); } catch {}
    try { await fetch(API + '?action=save_weights', { method:'POST', credentials: 'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ written_works_pct: weights.ww||0, performance_tasks_pct: weights.pt||0, quarterly_assessment_pct: weights.qa||0 }) }); } catch {}
    toast('Weights saved!', 'success'); renderTable();
  });
}
function resetWeights() {
  components = [
    { key:'ww', label:'Written Works',        pct:30, color:'#6c63ff', items:[] },
    { key:'pt', label:'Performance Tasks',    pct:50, color:'#10b981', items:[] },
    { key:'qa', label:'Quarterly Assessment', pct:20, color:'#f59e0b', items:[] },
  ];
  try { localStorage.removeItem('classinstruct_components'); } catch {}
  renderWeights(); renderComponentItems(); renderTable();
}

// ════════════════════════════════════════
//  SUMMARY
// ════════════════════════════════════════
async function renderSummary() {
  const subject = document.getElementById('subjectSel').value;
  const quarter = document.getElementById('quarterSel').value;
  const grade   = document.getElementById('gradeSel')   ? document.getElementById('gradeSel').value   : '';
  const section = document.getElementById('sectionSel') ? document.getElementById('sectionSel').value : '';

  // Try server-side summary first (more accurate total counts)
  let serverData = null;
  if (subject) {
    try {
      const params = new URLSearchParams({ action:'summary', subject, quarter });
      if (grade)   params.append('grade',   grade);
      if (section) params.append('section', section);
      const res = await fetch(API + '?' + params, { credentials: 'same-origin' });
      serverData = await res.json();
    } catch {}
  }

  const graded  = students.filter(s => hasAnyGrade(s));
  const finals  = graded.map(s => computeFinal(s));
  const total   = serverData ? serverData.total_students : students.length;

  if (!finals.length && !serverData) {
    document.getElementById('summaryStats').innerHTML = `
      <div class="stat-card"><div class="stat-label">Total Students</div><div class="stat-value">${total}</div><div class="stat-sub">no grades yet</div></div>
      <div class="stat-card"><div class="stat-label">Class Average</div><div class="stat-value">—</div></div>
      <div class="stat-card"><div class="stat-label">Passing</div><div class="stat-value">—</div></div>
      <div class="stat-card"><div class="stat-label">Needs Support</div><div class="stat-value">—</div></div>`;
    document.getElementById('distBars').innerHTML = '<p style="color:var(--gray-400);font-size:13px;padding:12px 0;">No graded students yet.</p>';
    document.getElementById('compBars').innerHTML = '';
    return;
  }

  const avg     = serverData ? serverData.average : (finals.reduce((a,b)=>a+b,0)/finals.length).toFixed(2);
  const passing = serverData ? serverData.passing  : finals.filter(f=>f>=75).length;
  const failing = serverData ? serverData.failing  : (finals.length - passing);
  const gradeCount = serverData ? serverData.graded : finals.length;
  const passRate = gradeCount ? Math.round((passing / gradeCount) * 100) : 0;

  document.getElementById('summaryStats').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Students</div>
      <div class="stat-value">${total}</div>
      <div class="stat-sub">${gradeCount} graded</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Class Average</div>
      <div class="stat-value">${parseFloat(avg).toFixed(2)}</div>
      <div class="stat-sub">${getGpaInfo(parseFloat(avg)).descriptor}</div>
    </div>
    <div class="stat-card clickable" onclick="showStudentList('passing')">
      <div class="stat-label">Passing</div>
      <div class="stat-value" style="color:var(--success);">${passing}</div>
      <div class="stat-sub">${passRate}% pass rate</div>
    </div>
    <div class="stat-card clickable" onclick="showStudentList('failing')">
      <div class="stat-label">Needs Support</div>
      <div class="stat-value" style="color:var(--danger);">${failing}</div>
      <div class="stat-sub">below 75</div>
    </div>`;

  // Distribution — use server data if available, otherwise compute client-side
  const sortedScales = [...gpaScales].sort((a, b) => parseFloat(b.max_grade) - parseFloat(a.max_grade));
  const distColors   = ['#3b82f6','#10b981','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
  if (serverData && serverData.distrib && serverData.distrib.length) {
    document.getElementById('distBars').innerHTML = serverData.distrib.map((d, i) => {
      return `<div class="dist-row">
        <div class="dist-label">${esc(d.descriptor)}</div>
        <div class="dist-bar-wrap"><div class="dist-bar-fill" style="width:${d.pct}%;background:${distColors[i % distColors.length]};"></div></div>
        <div class="dist-count">${d.count} student${d.count !== 1 ? 's' : ''} (${d.pct}%)</div>
      </div>`;
    }).join('');
  } else {
    document.getElementById('distBars').innerHTML = sortedScales.map((sc, i) => {
      const min   = parseFloat(sc.min_grade);
      const max   = parseFloat(sc.max_grade);
      const count = finals.filter(f => f >= min && f <= max).length;
      const pct   = finals.length ? Math.round(count / finals.length * 100) : 0;
      return `<div class="dist-row">
        <div class="dist-label">${esc(sc.descriptor)}</div>
        <div class="dist-bar-wrap"><div class="dist-bar-fill" style="width:${pct}%;background:${distColors[i % distColors.length]};"></div></div>
        <div class="dist-count">${count} student${count !== 1 ? 's' : ''} (${pct}%)</div>
      </div>`;
    }).join('');
  }

  // Component averages — dynamic from components array
  document.getElementById('compBars').innerHTML = components.map(c => {
    const vals = graded.map(s => s[c.key]).filter(v => v !== null && v !== undefined);
    const a = vals.length ? vals.reduce((sum,v)=>sum+parseFloat(v),0)/vals.length : null;
    const display = a !== null ? a.toFixed(1) : '—';
    const width   = a !== null ? Math.min(100, a) : 0;
    return `<div class="dist-row">
      <div class="dist-label">${esc(c.label)}</div>
      <div class="dist-bar-wrap"><div class="dist-bar-fill" style="width:${width}%;background:${c.color};"></div></div>
      <div class="dist-count">${display} avg</div>
    </div>`;
  }).join('');
}

// ── Student List Modal ───────────────────────────────────────────────────
function showStudentList(type) {
  const graded = students.filter(s => hasAnyGrade(s));
  const list = graded.filter(s => {
    const f = computeFinal(s);
    return type === 'passing' ? f >= 75 : f < 75;
  });

  const title = type === 'passing' ? 'Passing Students' : 'Needs Support';
  const titleColor = type === 'passing' ? 'var(--success)' : 'var(--danger)';
  const borderColor = type === 'passing' ? 'var(--success)' : 'var(--danger)';

  let html = `
    <div id="studentListModal" style="
      position:fixed;inset:0;z-index:10000;
      background:rgba(17,24,39,0.55);
      display:flex;align-items:center;justify-content:center;
      backdrop-filter:blur(2px);" onclick="closeStudentListModal(event)">
      <div style="
        background:var(--white);border-radius:14px;
        padding:0;max-width:600px;width:calc(100% - 2rem);
        max-height:80vh;overflow:hidden;
        box-shadow:0 20px 60px rgba(0,0,0,.18);" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:1.25rem 1.5rem;border-bottom:1px solid var(--gray-200);">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:12px;height:12px;border-radius:50%;background:${borderColor};"></div>
            <span style="font-size:16px;font-weight:700;color:var(--gray-900);">${title}</span>
            <span style="font-size:12px;color:var(--gray-400);font-weight:400;">(${list.length} student${list.length !== 1 ? 's' : ''})</span>
          </div>
          <button onclick="closeStudentListModal()" style="
            background:none;border:none;font-size:18px;color:var(--gray-400);cursor:pointer;padding:4px;
            display:flex;align-items:center;justify-content:center;border-radius:6px;transition:all 0.15s;">
            ✕
          </button>
        </div>
        <div style="overflow-y:auto;max-height:calc(80vh - 70px);">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.4px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);">#</th>
                <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.4px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);">Student</th>
                <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.4px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);">Section</th>
                <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.4px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);">Final</th>
                <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.4px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);">Status</th>
              </tr>
            </thead>
            <tbody>
  `;

  if (!list.length) {
    html += `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--gray-400);">No students found.</td></tr>`;
  } else {
    list.forEach((s, i) => {
      const f = computeFinal(s);
      const info = getGpaInfo(f);
      const statusClass = type === 'passing' ? 'badge-s' : 'badge-dnm';
      const statusLabel = type === 'passing' ? info.descriptor : 'Needs Support';
      html += `
        <tr style="border-bottom:1px solid var(--gray-100);">
          <td style="padding:10px 16px;color:var(--gray-400);font-size:12px;">${i + 1}</td>
          <td style="padding:10px 16px;">
            <div style="font-weight:600;color:var(--gray-900);font-size:13px;">${esc(s.name)}</div>
            <div style="font-size:11px;color:var(--gray-400);">${esc(s.id || '')}</div>
          </td>
          <td style="padding:10px 16px;color:var(--gray-600);font-size:13px;">${s._grade ? esc(s._grade + ' - ' + s._section) : '—'}</td>
          <td style="padding:10px 16px;text-align:center;font-family:'DM Mono',monospace;font-weight:600;font-size:14px;color:${type === 'passing' ? 'var(--success)' : 'var(--danger)'};">${f.toFixed(1)}</td>
          <td style="padding:10px 16px;"><span class="badge ${statusClass}">${esc(statusLabel)}</span></td>
        </tr>
      `;
    });
  }

  html += `
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
}

function closeStudentListModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById('studentListModal');
  if (modal) modal.remove();
}
function toggleImport() { document.getElementById('importZone').classList.toggle('show'); }

function handleImport(input) {
  verifyPin(function(confirmed) {
    if (!confirmed) { toast('PIN required to import grades.', 'warning'); input.value = ''; return; }
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const wb   = XLSX.read(e.target.result, { type:'binary' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);
        if (!rows.length) { toast('No data found in file.', 'error'); return; }
        rows.forEach(r => {
          const name  = (r['Name'] || r['name'] || r['Student'] || '').toLowerCase().trim();
          const match = students.find(s => s.name.toLowerCase().trim() === name);
          if (match) {
            if (r['Written Works']        !== undefined) match.ww  = parseFloat(r['Written Works'])        || null;
            if (r['Performance Tasks']    !== undefined) match.pt  = parseFloat(r['Performance Tasks'])    || null;
            if (r['Quarterly Assessment'] !== undefined) match.qa  = parseFloat(r['Quarterly Assessment']) || null;
            if (r['Attendance']           !== undefined) match.att = parseFloat(r['Attendance'])           || null;
          }
        });
        filtered = [...students]; renderTable(); toggleImport();
        toast('Imported grades from ' + file.name, 'success');
      } catch { toast('Could not read file. Check format and try again.', 'error'); }
    };
    reader.readAsBinaryString(file); input.value = '';
  });
}

function exportExcel() {
  const subject = document.getElementById('subjectSel').value || 'Grades';
  const quarter = document.getElementById('quarterSel').value;
  const rows = students.map((s, i) => {
    const f    = hasAnyGrade(s) ? computeFinal(s) : null;
    const info = f !== null ? getGpaInfo(f) : null;
    return { '#': i+1, 'Name': s.name, 'Student ID': s.id || '',
      'Grade & Section': s._grade ? (s._grade + ' ' + s._section).trim() : '',
      'Written Works': s.ww !== null ? s.ww : '', 'Performance Tasks': s.pt !== null ? s.pt : '',
      'Quarterly Assessment': s.qa !== null ? s.qa : '', 'Attendance': s.att !== null ? s.att : '',
      'Final Grade': f !== null ? f.toFixed(2) : '', 'Descriptor': info ? info.descriptor : '',
      'GPA': info ? info.gpa : '', 'Letter Grade': info ? info.letter : '' };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{wch:4},{wch:22},{wch:12},{wch:16},{wch:14},{wch:18},{wch:22},{wch:12},{wch:12},{wch:20},{wch:8},{wch:12}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, quarter + ' Grades');
  XLSX.writeFile(wb, 'ClassInstruct_' + subject + '_' + quarter + '_Grades.xlsx');
  toast('Grade sheet exported!', 'success');
}

// ════════════════════════════════════════
//  TABS
// ════════════════════════════════════════
function switchTab(el, tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ['gradesheet','components','summary','gpa','subjects'].forEach(t => {
    const el2 = document.getElementById('tab-' + t);
    if (el2) el2.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'components') { renderWeights(); renderComponentItems(); }
  if (tab === 'summary')    renderSummary();
  if (tab === 'gpa')        renderGpaTable();
  if (tab === 'subjects')   renderSubjectTable();
}

// ════════════════════════════════════════
//  COMPONENT ITEMS (uses unified components[])
// ════════════════════════════════════════
function renderComponentItems() {
  const grid = document.getElementById('compItemsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  components.forEach(c => {
    const items = c.items || [];
    const avg   = computeItemsAvg(c.key);
    const card  = document.createElement('div');
    card.className = 'comp-item-card';
    card.innerHTML = `
      <div class="comp-item-header">
        <div class="comp-item-title">
          <div class="comp-item-dot" style="background:${c.color};"></div>
          ${esc(c.label)}
          <span class="comp-item-count">${items.length} item${items.length !== 1 ? 's' : ''}</span>
        </div>
        <span style="font-size:11px;color:var(--gray-400);">Weight: <strong style="color:var(--primary);">${c.pct}%</strong></span>
      </div>
      <div class="comp-item-body" id="ci-body-${c.key}">
        ${items.length ? '' : '<p style="font-size:12px;color:var(--gray-400);padding:8px 0;text-align:center;">No items yet. Click below to add.</p>'}
        ${items.map(item => renderItemRow(c.key, item)).join('')}
        <button class="comp-item-add" onclick="addComponentItem('${c.key}')">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add item
        </button>
      </div>
      <div class="comp-item-avg">
        <span>Computed component score</span>
        <strong id="ci-avg-${c.key}">${avg !== null ? avg.toFixed(2) : '—'}</strong>
      </div>`;
    grid.appendChild(card);
  });
}

function renderItemRow(key, item) {
  return `<div class="comp-item-row" id="ci-row-${key}-${item.id}">
    <input type="text" value="${esc(item.name)}" placeholder="Item name (e.g. Quiz 1)"
      oninput="updateCompItem('${key}',${item.id},'name',this.value)" style="flex:1;min-width:0;">
    <input type="number" min="0" step="0.01" value="${item.score !== null && item.score !== undefined ? item.score : ''}" placeholder="Score"
      title="Score" oninput="updateCompItem('${key}',${item.id},'score',this.value)" style="width:70px;text-align:center;">
    <input type="number" min="1" step="1" value="${item.maxScore || 100}" placeholder="Max"
      title="Max score" oninput="updateCompItem('${key}',${item.id},'maxScore',this.value)" style="width:60px;text-align:center;">
    <button class="btn btn-icon btn-sm" title="Remove item" onclick="removeCompItem('${key}',${item.id})">
      <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>`;
}

function addComponentItem(key) {
  const c = components.find(c=>c.key===key); if (!c) return;
  if (!c.items) c.items = [];
  c.items.push({ id: compItemCounter++, name: '', score: null, maxScore: 100 });
  renderComponentItems();
  const body = document.getElementById('ci-body-' + key);
  if (body) { const inputs = body.querySelectorAll('input[type=text]'); if (inputs.length) inputs[inputs.length-1].focus(); }
}

function removeCompItem(key, id) {
  const c = components.find(c=>c.key===key); if (!c) return;
  c.items = (c.items||[]).filter(it => it.id !== id);
  renderComponentItems();
}

function updateCompItem(key, id, field, value) {
  const c = components.find(c=>c.key===key); if (!c) return;
  const item = (c.items||[]).find(it => it.id === id); if (!item) return;
  if (field === 'score')         item.score    = value === '' ? null : Math.max(0, parseFloat(value) || 0);
  else if (field === 'maxScore') item.maxScore = Math.max(1, parseFloat(value) || 100);
  else item[field] = value;
  const avg = computeItemsAvg(key);
  const el  = document.getElementById('ci-avg-' + key);
  if (el) el.textContent = avg !== null ? avg.toFixed(2) : '—';
}

function computeItemsAvg(key) {
  const c = components.find(c=>c.key===key); if (!c) return null;
  const scored = (c.items||[]).filter(it => it.score !== null && it.score !== undefined);
  if (!scored.length) return null;
  const total = scored.reduce((sum, it) => sum + (parseFloat(it.score) / (parseFloat(it.maxScore)||100)) * 100, 0);
  return total / scored.length;
}

function saveComponentItems() {
  const hasUnnamed = components.some(c => (c.items||[]).some(it => !it.name.trim()));
  if (hasUnnamed) { toast('Some items are missing names — please fill them in.', 'error'); return; }
  try { localStorage.setItem('classinstruct_components', JSON.stringify(components)); } catch {}
  saveStudentItemScores();
  if (students.length) renderTable();
  toast('Component items saved!', 'success');
}

function resetComponentItems() {
  if (!confirm('Clear all component items?')) return;
  components.forEach(c => { c.items = []; });
  studentItemScores = {};
  try { localStorage.removeItem('classinstruct_student_items'); } catch {}
  renderComponentItems();
  if (students.length) renderTable();
  toast('Component items reset.', 'success');
}

function loadComponentItems() {
  try {
    const raw = localStorage.getItem('classinstruct_components');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        components = parsed.map(c => ({ ...c, items: c.items || [] }));
        compItemCounter = Math.max(...components.flatMap(c=>(c.items||[]).map(it=>it.id)), 0) + 1;
      }
    }
  } catch {}
}

// ── Student Item Scores ────────────────────────────────────────────────────
function loadStudentItemScores() {
  try {
    const raw = localStorage.getItem('classinstruct_student_items');
    if (raw) {
      studentItemScores = JSON.parse(raw);
    } else {
      studentItemScores = {};
    }
  } catch {
    studentItemScores = {};
  }
}

function saveStudentItemScores() {
  try {
    localStorage.setItem('classinstruct_student_items', JSON.stringify(studentItemScores));
  } catch {}
}

function getStudentItemScore(studentId, componentKey, itemId) {
  return studentItemScores[studentId]?.[componentKey]?.[itemId] ?? null;
}

function setStudentItemScore(studentId, componentKey, itemId, score) {
  if (!studentItemScores[studentId]) studentItemScores[studentId] = {};
  if (!studentItemScores[studentId][componentKey]) studentItemScores[studentId][componentKey] = {};
  studentItemScores[studentId][componentKey][itemId] = score;
}

// ════════════════════════════════════════
//  ATTENDANCE SYNC
// ════════════════════════════════════════

// Fetches att % map { student_id → att_pct } from the attendance DB.
// Returns null on any error so callers can bail cleanly.
async function _fetchAttPercent(grade, section) {
  try {
    const params = new URLSearchParams({ action: 'att_by_quarter' });
    if (grade)   params.append('grade',   grade);
    if (section) params.append('section', section);
    const res  = await fetch(API + '?' + params, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.error) return null;
    const map = {};
    data.forEach(function(r) {
      map[r.student_id] = {
        att_pct: r.att_pct,
        late:    r.late_count   || 0,
        absent:  r.absent_count || 0,
      };
    });
    return map;
  } catch (_) { return null; }
}

// Called by mergeGradesForSubject — always refreshes att% from the attendance
// table so the grades page stays in sync even after the first save.
async function _fillMissingAttendance(grade, section) {
  const attMap = await _fetchAttPercent(grade, section);
  if (!attMap) return;
  students.forEach(function(s) {
    // Always apply the live value — not just when att is null.
    const attData = attMap[s._id];
    if (attData !== undefined) {
      s.att    = typeof attData === 'object' ? attData.att_pct : attData;
      s._late  = typeof attData === 'object' ? attData.late    : null;
      s._absent = typeof attData === 'object' ? attData.absent : null;
    }
  });
  filtered = students.slice();
}

// Called when the Attendance page broadcasts a save via localStorage.
// Updates only students whose att % actually changed — manual overrides are
// kept if the DB value is the same as what the teacher typed.
// Marks grades dirty so the teacher knows to re-save.
async function _onAttendanceBroadcast() {
  const grade   = document.getElementById('gradeSel')   ? document.getElementById('gradeSel').value   : '';
  const section = document.getElementById('sectionSel') ? document.getElementById('sectionSel').value : '';
  const attMap  = await _fetchAttPercent(grade, section);
  if (!attMap) return;
  let changed = 0;
  students.forEach(function(s) {
    const attData = attMap[s._id];
    if (attData === undefined) return;
    const fresh = typeof attData === 'object' ? attData.att_pct : attData;
    if (s.att !== fresh) {
      s.att    = fresh;
      s._late  = typeof attData === 'object' ? attData.late   : null;
      s._absent = typeof attData === 'object' ? attData.absent : null;
      changed++;
    }
  });
  if (changed > 0) {
    filtered = students.slice();
    hasUnsavedGrades = true;
    markUnsavedIndicator(true);
    renderTable();
  }
}

// ════════════════════════════════════════
//  TOAST + HELPERS
// ════════════════════════════════════════
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = type === 'error' ? '#ef4444' : '#111827';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function truncate(str, maxLen) {
  str = String(str || '');
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

// ════════════════════════════════════════
//  UNSAVED CHANGES GUARD
// ════════════════════════════════════════

// Pending navigation target (set when user tries to leave with unsaved grades)
let _pendingNavHref = null;

/**
 * Show or hide the small "Unsaved changes" pill next to the Save button.
 * Looks for an element with id="unsavedBadge" — add it in your HTML near
 * the Save Grades button.  Falls back silently if the element is absent.
 */
function markUnsavedIndicator(dirty) {
  const badge = document.getElementById('unsavedBadge');
  if (!badge) return;
  if (dirty) {
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

/**
 * Inject the unsaved-changes modal into the page the first time it is needed,
 * then display it.  `href` is where the user was trying to navigate (may be
 * null when the browser's own close/navigate-away dialog cannot be suppressed).
 */
function showUnsavedModal(href) {
  _pendingNavHref = href || null;

  // Create modal only once
  if (!document.getElementById('unsavedModal')) {
    const overlay = document.createElement('div');
    overlay.id = 'unsavedModal';
    overlay.style.cssText = [
      'position:fixed','inset:0','z-index:10000',
      'background:rgba(17,24,39,0.55)',
      'display:flex','align-items:center','justify-content:center',
      'backdrop-filter:blur(2px)',
      'opacity:0','transition:opacity 180ms ease',
    ].join(';');

    overlay.innerHTML = `
      <div id="unsavedModalBox" style="
        background:var(--white);border-radius:14px;
        padding:2rem 2rem 1.5rem;
        max-width:400px;width:calc(100% - 2rem);
        box-shadow:0 20px 60px rgba(0,0,0,.18);
        transform:translateY(12px);
        transition:transform 220ms ease,opacity 220ms ease;
        opacity:0;
      ">
        <!-- Icon -->
        <div style="width:48px;height:48px;background:#fef3c7;border-radius:50%;
                    display:flex;align-items:center;justify-content:center;margin-bottom:1rem;">
          <svg width="22" height="22" fill="none" stroke="#d97706" stroke-width="2.2"
               viewBox="0 0 24 24">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0
                     1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>

        <h3 style="font-size:17px;font-weight:700;color:var(--gray-900);margin:0 0 .5rem;">
          Unsaved grades
        </h3>
        <p style="font-size:13px;color:var(--gray-500);margin:0 0 1.5rem;line-height:1.6;">
          You have grade changes that haven't been saved yet.<br>
          What would you like to do?
        </p>

        <div style="display:flex;flex-direction:column;gap:8px;">
          <button onclick="unsavedModalSaveAndExit()"
            style="padding:10px 18px;border-radius:8px;border:none;
                   background:#6c63ff;color:#fff;font-size:13px;font-weight:600;
                   font-family:'Inter',sans-serif;cursor:pointer;
                   display:flex;align-items:center;justify-content:center;gap:8px;
                   transition:background 160ms ease;">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"
                 viewBox="0 0 24 24">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Save grades &amp; exit
          </button>

          <button onclick="unsavedModalDiscardAndExit()"
            style="padding:10px 18px;border-radius:8px;
                   border:1px solid #fca5a5;background:var(--white);color:#dc2626;
                   font-size:13px;font-weight:600;font-family:'Inter',sans-serif;
                   cursor:pointer;transition:background 160ms ease;">
            Discard changes &amp; exit
          </button>

          <button onclick="unsavedModalCancel()"
            style="padding:10px 18px;border-radius:8px;
                   border:1px solid var(--gray-200);background:var(--white);color:var(--gray-500);
                   font-size:13px;font-weight:500;font-family:'Inter',sans-serif;
                   cursor:pointer;transition:background 160ms ease;">
            Cancel — keep editing
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener('click', e => {
      if (e.target === overlay) unsavedModalCancel();
    });
  }

  // Animate in
  const modal = document.getElementById('unsavedModal');
  const box   = document.getElementById('unsavedModalBox');
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    modal.style.opacity = '1';
    box.style.opacity   = '1';
    box.style.transform = 'translateY(0)';
  });
}

function _hideUnsavedModal() {
  const modal = document.getElementById('unsavedModal');
  const box   = document.getElementById('unsavedModalBox');
  if (!modal) return;
  modal.style.opacity = '0';
  if (box) { box.style.opacity = '0'; box.style.transform = 'translateY(12px)'; }
  setTimeout(() => { if (modal) modal.style.display = 'none'; }, 220);
}

async function unsavedModalSaveAndExit() {
  _hideUnsavedModal();
  await saveGrades();
  // Only navigate if save succeeded (flag cleared by saveGrades on success)
  if (!hasUnsavedGrades && _pendingNavHref) {
    window.location.href = _pendingNavHref;
  }
  _pendingNavHref = null;
}

function unsavedModalDiscardAndExit() {
  hasUnsavedGrades = false;
  markUnsavedIndicator(false);
  _hideUnsavedModal();
  if (_pendingNavHref) {
    window.location.href = _pendingNavHref;
  }
  _pendingNavHref = null;
}

function unsavedModalCancel() {
  _hideUnsavedModal();
  _pendingNavHref = null;
}