// ── Config ────────────────────────────────────────────────────────────────────
// Path matches the project structure: Student.html uses /ClassInstruct1/dashboard/api/db.php
// Place grades_db.php in the same /api/ folder as db.php
const API = '/ClassInstruct1/dashboard/Student/grades_db.php';

// ── State ─────────────────────────────────────────────────────────────────────
let students         = [];
let filtered         = [];
let activeDesc       = '';
// Dynamic components — each has: { key, label, pct, color, items:[{id,name,score,maxScore}] }
let components = [
  { key:'ww', label:'Written Works',        pct:30, color:'#6c63ff', items:[] },
  { key:'pt', label:'Performance Tasks',    pct:50, color:'#10b981', items:[] },
  { key:'qa', label:'Quarterly Assessment', pct:20, color:'#f59e0b', items:[] },
];
let compItemCounter = 1;
// Legacy aliases kept so the rest of the codebase still works unchanged
function weights_get()  { return Object.fromEntries(components.map(c=>[c.key,c.pct])); }
// keep a live proxy-like object for code that reads weights.ww / weights.pt / weights.qa
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

// ── Unsaved Changes Tracking ───────────────────────────────────────────────────
let hasUnsavedGrades = false;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSubjects();
  loadWeights();
  loadGpaScales();
  loadComponentItems();
  renderWeights();
  loadAllStudents(); // Load students immediately — don't wait for subject selection
  const ov = document.getElementById('editOverlay');
  if (ov) ov.addEventListener('click', function(e){ if (e.target === this) closeEditModal(); });

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

  try {
    const params = new URLSearchParams({ action: 'students' });
    if (grade)   params.append('grade',   grade);
    if (section) params.append('section', section);
    const res  = await fetch(API + '?' + params);
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
      ww:   null,
      pt:   null,
      qa:   null,
      att:  null,
    }));
    filtered = [...students];

    if (loadEl) loadEl.style.display = 'none';
    if (wrapEl) wrapEl.style.display = 'block';
    renderTable();
    // If a subject is already selected (e.g. after filter change), merge grades
    const subject = document.getElementById('subjectSel').value;
    const quarter = document.getElementById('quarterSel').value;
    if (subject) mergeGradesForSubject(subject, quarter);
  } catch (err) {
    if (loadEl) { loadEl.style.display = 'block'; loadEl.textContent = 'Could not load students — is XAMPP running? (' + err.message + ')'; }
  }
}

// Merge saved grade data into the already-loaded students array
async function mergeGradesForSubject(subject, quarter) {
  try {
    const grade   = document.getElementById('gradeSel')   ? document.getElementById('gradeSel').value   : '';
    const section = document.getElementById('sectionSel') ? document.getElementById('sectionSel').value : '';
    const params  = new URLSearchParams({ action: 'grades', subject, quarter });
    if (grade)   params.append('grade',   grade);
    if (section) params.append('section', section);
    const res  = await fetch(API + '?' + params);
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
      s.ww  = g ? g.ww  : null;
      s.pt  = g ? g.pt  : null;
      s.qa  = g ? g.qa  : null;
      s.att = g ? g.att : null;
    });
    filtered = [...students];
    renderTable();
  } catch (err) {
    toast('Could not load grades for this subject: ' + err.message, 'error');
  }
}


// ════════════════════════════════════════
//  GPA SCALE
// ════════════════════════════════════════
async function loadGpaScales() {
  try {
    const res  = await fetch(API + '?action=gpa_scales');
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
    const res  = await fetch(API + '?action=save_gpa', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ scales }) });
    const data = await res.json();
    if (data.success) { toast('GPA scale saved (' + data.saved + ' rows)', 'success'); loadGpaScales(); renderTable(); }
    else toast('Error: ' + (data.error || 'unknown'), 'error');
  } catch {
    gpaScales = scales;
    renderTable();
    toast('GPA scale updated locally.', 'success');
  }
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
async function loadSubjects() {
  try {
    const res  = await fetch(API + '?action=subjects');
    const data = await res.json();
    subjects    = data.map(s => ({ id: s.id, name: s.name, code: s.code || '', active: !!parseInt(s.is_active) }));
    allSubjects = [...subjects];
    subjectIdCounter = subjects.length ? Math.max(...subjects.map(s => s.id)) + 1 : 1;
  } catch {
    subjects = [
      { id:1, name:'Mathematics', code:'MATH', active:true },
      { id:2, name:'Science',     code:'SCI',  active:true },
      { id:3, name:'English',     code:'ENG',  active:true },
      { id:4, name:'Filipino',    code:'FIL',  active:true },
      { id:5, name:'MAPEH',       code:'MAPEH',active:true },
      { id:6, name:'AP',          code:'AP',   active:true },
      { id:7, name:'ESP',         code:'ESP',  active:true },
    ];
    allSubjects = [...subjects];
    subjectIdCounter = 8;
  }
  renderSubjectDropdown();
  renderSubjectTable();
}

function renderSubjectDropdown() {
  const sel     = document.getElementById('subjectSel');
  const current = sel.value;
  sel.innerHTML = '<option value="">— Select Subject —</option>';
  subjects.filter(s => s.active).forEach(s => {
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
  body.innerHTML = '';
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray-400);padding:2rem;">No subjects found.</td></tr>';
    return;
  }
  list.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--gray-400);font-size:12px;">${i + 1}</td>
      <td><div style="font-weight:600;color:var(--gray-900);">${esc(s.name)}</div></td>
      <td><span style="font-family:'DM Mono',monospace;font-size:12px;background:var(--gray-100);padding:2px 8px;border-radius:4px;color:var(--gray-600);">${esc(s.code || '—')}</span></td>
      <td><span class="badge ${s.active ? 'badge-active' : 'badge-inactive'}">${s.active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm" onclick="openEditModal(${s.id})">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
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
    const res  = await fetch(API + '?action=add_subject', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, code }) });
    const data = await res.json();
    if (data.error) { errEl.textContent = data.error; errEl.style.display = 'block'; return; }
    subjects.push({ id: data.id || subjectIdCounter++, name, code, active: true });
  } catch {
    subjects.push({ id: subjectIdCounter++, name, code, active: true });
  }
  allSubjects = [...subjects];
  nameEl.value = ''; codeEl.value = '';
  renderSubjectTable(); renderSubjectDropdown();
  toast('Subject "' + name + '" added!', 'success');
}

function toggleSubjectStatus(id) {
  const s = subjects.find(s => s.id === id); if (!s) return;
  s.active = !s.active; allSubjects = [...subjects];
  renderSubjectTable(); renderSubjectDropdown();
  toast(s.name + ' is now ' + (s.active ? 'active' : 'inactive') + '.', 'success');
}

async function deleteSubject(id) {
  const s = subjects.find(s => s.id === id); if (!s) return;
  if (!confirm('Delete "' + s.name + '"? This cannot be undone.')) return;
  try { await fetch(API + '?action=delete_subject&id=' + id, { method:'DELETE' }); } catch {}
  subjects = subjects.filter(s => s.id !== id); allSubjects = [...subjects];
  renderSubjectTable(); renderSubjectDropdown();
  toast('Subject deleted.', 'success');
}

function filterSubjects(q) { subjectFilter = q; renderSubjectTable(); }

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
  const name = document.getElementById('editSubjectName').value.trim();
  const code = document.getElementById('editSubjectCode').value.trim().toUpperCase();
  if (!name) { alert('Subject name is required.'); return; }
  if (subjects.find(s => s.name.toLowerCase() === name.toLowerCase() && s.id !== editingSubjectId)) { alert('A subject with this name already exists.'); return; }
  try { await fetch(API + '?action=edit_subject&id=' + editingSubjectId, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, code }) }); } catch {}
  const s = subjects.find(s => s.id === editingSubjectId);
  if (s) { s.name = name; s.code = code; } allSubjects = [...subjects];
  closeEditModal(); renderSubjectTable(); renderSubjectDropdown();
  toast('Subject updated!', 'success');
}

// ════════════════════════════════════════
//  GRADE SHEET — called when filters change
// ════════════════════════════════════════
async function refresh() {
  const subject = document.getElementById('subjectSel').value;
  const quarter = document.getElementById('quarterSel').value;

  // Always reload students (in case grade/section filter changed)
  await loadAllStudents();

  // If a subject is selected, overlay saved grade data
  if (subject) {
    await mergeGradesForSubject(subject, quarter);
  }
}

// ── Computed ──────────────────────────────────────────────────────────────────
function computeFinal(s) {
  const total = components.reduce((a,c)=>a+c.pct,0);
  if (total <= 0) return 0;
  const raw = components.reduce((sum,c) => {
    const v = s[c.key] !== null && s[c.key] !== undefined ? Math.min(100,Math.max(0,parseFloat(s[c.key])||0)) : 0;
    return sum + v * (c.pct/100);
  },0);
  // Normalize in case total ≠ 100
  return Math.round((raw / (total/100)) * 100) / 100;
}
function hasAnyGrade(s) { return components.some(c => s[c.key] !== null && s[c.key] !== undefined); }

// ── Render Grade Sheet ────────────────────────────────────────────────────────
function renderTable() {
  const quarter = document.getElementById('quarterSel').value;
  const subject = document.getElementById('subjectSel').value;
  const titleEl = document.getElementById('tableTitle');
  if (titleEl) {
    if (subject) {
      titleEl.textContent = quarter + ' Grade Sheet — ' + subject + ' (' + filtered.length + ' students)';
    } else {
      titleEl.textContent = 'All Students (' + filtered.length + ') — Select a subject above to enter grades';
    }
  }

  // Update column headers dynamically from components
  const thead = document.querySelector('#gradeBody')?.closest('table')?.querySelector('thead tr');
  if (thead) {
    // Rebuild thead: #, Student, [components...], Attendance, Final, Descriptor, GPA, Letter
    thead.innerHTML = `
      <th style="width:36px;">#</th>
      <th style="width:180px;">Student</th>
      ${components.map(c=>`<th style="width:90px;">${esc(c.label)}<br><small style="font-weight:400;color:var(--gray-400);text-transform:none;letter-spacing:0;">${c.pct}%</small></th>`).join('')}
      <th style="width:100px;">Attendance</th>
      <th style="width:70px;">Final</th>
      <th style="width:140px;">Descriptor</th>
      <th style="width:65px;">GPA</th>
      <th style="width:70px;">Letter</th>`;
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
  const totalCols = 4 + components.length; // #, Student, [comps], Attendance, Final, Desc, GPA, Letter

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
    const compCells = components.map(c => {
      const val = s[c.key] !== null && s[c.key] !== undefined ? s[c.key] : '';
      return `<td><input class="grade-input" type="number" min="0" max="100" step="0.01"
        value="${val}" placeholder="—"
        oninput="updateGrade(${students.indexOf(s)},'${c.key}',this.value)"></td>`;
    }).join('');
    tr.innerHTML = `
      <td style="color:var(--gray-400);font-size:12px;">${i + 1}</td>
      <td>
        <div class="student-name">${esc(s.name)}</div>
        <div class="student-id">${esc(s.id || '')}${s._grade ? ' · ' + esc(s._grade) + ' ' + esc(s._section) : ''}</div>
      </td>
      ${compCells}
      <td>
        <div class="prog-wrap">
          <div class="prog-bar"><div class="prog-fill" id="attbar-${i}" style="width:${attVal}%;background:${progColor(attVal)};"></div></div>
          <input class="grade-input" type="number" min="0" max="100" step="0.01"
            value="${s.att !== null ? s.att : ''}" placeholder="—" style="width:52px;margin-left:4px;"
            oninput="updateGrade(${students.indexOf(s)},'att',this.value)">
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
  const subject = document.getElementById('subjectSel').value;
  const quarter = document.getElementById('quarterSel').value;
  if (!subject) { toast('Select a subject first.', 'error'); return; }
  const records = students.map(s => ({
    student_id: s._id, written_works: s.ww, performance_tasks: s.pt,
    quarterly_assessment: s.qa, attendance: s.att,
    final_grade: hasAnyGrade(s) ? computeFinal(s) : null,
  }));
  try {
    const res  = await fetch(API + '?action=save_grades', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subject, quarter, records }) });
    const data = await res.json();
    if (data.error) { toast('Error: ' + data.error, 'error'); return; }
    hasUnsavedGrades = false;         // ← clear dirty flag
    markUnsavedIndicator(false);      // ← update UI indicator
    toast('Grades saved! (' + data.saved + ' records)', 'success');
  } catch { toast('Network error — is XAMPP running?', 'error'); }
}

// ════════════════════════════════════════
//  WEIGHTS
// ════════════════════════════════════════
async function loadWeights() {
  try {
    const res  = await fetch(API + '?action=weights');
    const data = await res.json();
    const def  = data.find(w => w.subject === '__default__');
    if (def) {
      weights = {
        ww: parseInt(def.written_works_pct)          || 30,
        pt: parseInt(def.performance_tasks_pct)      || 50,
        qa: parseInt(def.quarterly_assessment_pct)   || 20,
      };
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
  // Update grade sheet column headers to match renamed components
  components.forEach(c => {
    const el = document.getElementById('ww-pct-label'); // handled in renderTable
  });
  renderTable();
  renderComponentItems();
}

function addComponent() {
  const PALETTE = ['#8b5cf6','#ef4444','#06b6d4','#f97316','#ec4899','#14b8a6'];
  const usedColors = components.map(c=>c.color);
  const color = PALETTE.find(p=>!usedColors.includes(p)) || PALETTE[components.length % PALETTE.length];
  const key = 'c' + Date.now();
  components.push({ key, label:'New Component', pct:0, color, items:[] });
  renderWeights();
  renderComponentItems();
  updateWeightDisplay();
  // Focus the new name input
  const cards = document.querySelectorAll('#weightsGrid .weight-card');
  const lastCard = cards[cards.length - 2]; // -2 because last is "Add" button
  if (lastCard) { const inp = lastCard.querySelector('input[type=text]'); if (inp) { inp.focus(); inp.select(); } }
}

function removeComponent(ci) {
  if (components.length <= 1) { toast('You must have at least one component.', 'error'); return; }
  const name = components[ci].label;
  if (!confirm(`Remove "${name}"? Its items will also be deleted.`)) return;
  components.splice(ci, 1);
  renderWeights();
  renderComponentItems();
  updateWeightDisplay();
  renderTable();
  toast(`"${name}" removed.`, 'success');
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
  const total = components.reduce((a,c)=>a+c.pct,0);
  if (total !== 100) { toast('Weights must total 100%. Currently ' + total + '%.', 'error'); return; }
  // Save to localStorage for custom components
  try { localStorage.setItem('classinstruct_components', JSON.stringify(components.map(c=>({key:c.key,label:c.label,pct:c.pct,color:c.color})))); } catch {}
  try { await fetch(API + '?action=save_weights', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ written_works_pct: weights.ww||0, performance_tasks_pct: weights.pt||0, quarterly_assessment_pct: weights.qa||0 }) }); } catch {}
  toast('Weights saved!', 'success'); renderTable();
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
      const res = await fetch(API + '?' + params);
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
    <div class="stat-card">
      <div class="stat-label">Passing</div>
      <div class="stat-value" style="color:var(--success);">${passing}</div>
      <div class="stat-sub">${passRate}% pass rate</div>
    </div>
    <div class="stat-card">
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

// ════════════════════════════════════════
//  IMPORT / EXPORT
// ════════════════════════════════════════
function toggleImport() { document.getElementById('importZone').classList.toggle('show'); }

function handleImport(input) {
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
  toast('Component items saved!', 'success');
}

function resetComponentItems() {
  if (!confirm('Clear all component items?')) return;
  components.forEach(c => { c.items = []; });
  renderComponentItems();
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
        background:#fff;border-radius:14px;
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

        <h3 style="font-size:17px;font-weight:700;color:#111827;margin:0 0 .5rem;">
          Unsaved grades
        </h3>
        <p style="font-size:13px;color:#6b7588;margin:0 0 1.5rem;line-height:1.6;">
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
                   border:1px solid #fca5a5;background:#fff;color:#dc2626;
                   font-size:13px;font-weight:600;font-family:'Inter',sans-serif;
                   cursor:pointer;transition:background 160ms ease;">
            Discard changes &amp; exit
          </button>

          <button onclick="unsavedModalCancel()"
            style="padding:10px 18px;border-radius:8px;
                   border:1px solid #e4e8f0;background:#fff;color:#6b7588;
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