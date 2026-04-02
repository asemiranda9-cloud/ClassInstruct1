// ── Config ────────────────────────────────────────────────────────────────────
// Path matches the project structure: Student.html uses /ClassInstruct1/dashboard/api/db.php
// Place grades_db.php in the same /api/ folder as db.php
const API = '/ClassInstruct1/dashboard/Student/grades_db.php';

// ── State ─────────────────────────────────────────────────────────────────────
let students         = [];
let filtered         = [];
let activeDesc       = '';
let weights          = { ww: 30, pt: 50, qa: 20 };
let gpaScales        = [];
let subjects         = [];
let allSubjects      = [];
let subjectIdCounter = 1;
let editingSubjectId = null;
let subjectFilter    = '';

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSubjects();
  loadWeights();
  loadGpaScales();
  renderWeights();
  loadAllStudents(); // Load students immediately — don't wait for subject selection
  const ov = document.getElementById('editOverlay');
  if (ov) ov.addEventListener('click', function(e){ if (e.target === this) closeEditModal(); });
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
  const ww  = s.ww  !== null ? Math.min(100, Math.max(0, parseFloat(s.ww)  || 0)) : 0;
  const pt  = s.pt  !== null ? Math.min(100, Math.max(0, parseFloat(s.pt)  || 0)) : 0;
  const qa  = s.qa  !== null ? Math.min(100, Math.max(0, parseFloat(s.qa)  || 0)) : 0;
  const wwPct = (parseInt(weights.ww) || 30)  / 100;
  const ptPct = (parseInt(weights.pt) || 50)  / 100;
  const qaPct = (parseInt(weights.qa) || 20)  / 100;
  // Guard: if weights don't sum to 1, normalize
  const total = wwPct + ptPct + qaPct;
  if (total <= 0) return 0;
  const raw = (ww * wwPct) + (pt * ptPct) + (qa * qaPct);
  return Math.round(raw * 100) / 100;
}
function hasAnyGrade(s) { return s.ww !== null || s.pt !== null || s.qa !== null; }

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

  document.getElementById('ww-pct-label').textContent = (weights.ww || 30) + '%';
  document.getElementById('pt-pct-label').textContent = (weights.pt || 50) + '%';
  document.getElementById('qa-pct-label').textContent = (weights.qa || 20) + '%';

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

  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--gray-400);">No students found.</td></tr>';
    renderStats(); return;
  }

  filtered.forEach((s, i) => {
    const hasGrade = hasAnyGrade(s);
    const f        = hasGrade ? computeFinal(s) : null;
    const info     = f !== null ? getGpaInfo(f) : null;
    const attVal   = s.att !== null ? s.att : 0;
    const tr       = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--gray-400);font-size:12px;">${i + 1}</td>
      <td>
        <div class="student-name">${esc(s.name)}</div>
        <div class="student-id">${esc(s.id || '')}${s._grade ? ' · ' + esc(s._grade) + ' ' + esc(s._section) : ''}</div>
      </td>
      <td><input class="grade-input" type="number" min="0" max="100" step="0.01"
            value="${s.ww !== null ? s.ww : ''}" placeholder="—"
            oninput="updateGrade(${students.indexOf(s)},'ww',this.value)"></td>
      <td><input class="grade-input" type="number" min="0" max="100" step="0.01"
            value="${s.pt !== null ? s.pt : ''}" placeholder="—"
            oninput="updateGrade(${students.indexOf(s)},'pt',this.value)"></td>
      <td><input class="grade-input" type="number" min="0" max="100" step="0.01"
            value="${s.qa !== null ? s.qa : ''}" placeholder="—"
            oninput="updateGrade(${students.indexOf(s)},'qa',this.value)"></td>
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
  const labels = { ww:'Written Works', pt:'Performance Tasks', qa:'Quarterly Assessment' };
  const grid   = document.getElementById('weightsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  Object.keys(weights).forEach(k => {
    const div = document.createElement('div');
    div.className = 'weight-card';
    div.innerHTML = `
      <div class="weight-header">
        <span class="weight-name">${labels[k]}</span>
        <span class="weight-pct" id="wpct-${k}">${weights[k]}%</span>
      </div>
      <input type="range" min="0" max="100" step="5" value="${weights[k]}" oninput="updateWeight('${k}',this.value)">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--gray-400);margin-top:4px;"><span>0%</span><span>100%</span></div>`;
    grid.appendChild(div);
  });
  updateWeightDisplay();
}
function updateWeight(k, v) { weights[k] = parseInt(v); document.getElementById('wpct-' + k).textContent = v + '%'; updateWeightDisplay(); }
function updateWeightDisplay() {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const ok    = total === 100;
  const box   = document.getElementById('weightTotalBox');
  if (box) box.innerHTML = 'Total: <strong style="color:' + (ok ? 'var(--success)' : 'var(--danger)') + ';">' + total + '%</strong> ' + (ok ? '✓ Ready to save' : '— needs to be 100% (off by ' + (total - 100) + '%)');
}
async function saveWeights() {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total !== 100) { toast('Weights must total 100%. Currently ' + total + '%.', 'error'); return; }
  try { await fetch(API + '?action=save_weights', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ written_works_pct: weights.ww, performance_tasks_pct: weights.pt, quarterly_assessment_pct: weights.qa }) }); } catch {}
  toast('Weights saved!', 'success'); renderTable();
}
function resetWeights() { weights = { ww:30, pt:50, qa:20 }; renderWeights(); }

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

  // Component averages
  let compData = {};
  if (serverData && serverData.components) {
    compData = serverData.components;
  } else {
    const avgOf = key => {
      const vals = graded.map(s => s[key]).filter(v => v !== null && v !== undefined);
      return vals.length ? vals.reduce((a,b)=>a+parseFloat(b),0)/vals.length : null;
    };
    compData = { written_works: avgOf('ww'), performance_tasks: avgOf('pt'), quarterly_assessment: avgOf('qa') };
  }
  document.getElementById('compBars').innerHTML = [
    { label: 'Written Works',        val: compData.written_works,        color: '#6c63ff' },
    { label: 'Performance Tasks',    val: compData.performance_tasks,    color: '#10b981' },
    { label: 'Quarterly Assessment', val: compData.quarterly_assessment, color: '#f59e0b' },
  ].map(c => {
    const a = c.val !== null && c.val !== undefined ? parseFloat(c.val) : null;
    const display = a !== null ? a.toFixed(1) : '—';
    const width   = a !== null ? Math.min(100, a) : 0;
    return `<div class="dist-row">
      <div class="dist-label">${c.label}</div>
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
  if (tab === 'components') renderWeights();
  if (tab === 'summary')    renderSummary();
  if (tab === 'gpa')        renderGpaTable();
  if (tab === 'subjects')   renderSubjectTable();
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