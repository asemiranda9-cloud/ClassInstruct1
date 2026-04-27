'use strict';

// ═══════════════════════════════════════════
//  API  — points to your db.php
// ═══════════════════════════════════════════
const API = '/dashboard/api/db.php';

async function apiGet() {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Failed to load students');
  return res.json();
}
async function apiPost(data) {
  const res  = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch(e) { throw new Error('Server error: ' + text.replace(/<[^>]+>/g,' ').trim().slice(0,300)); }
  if (!res.ok) throw new Error(json.error || json.message || 'HTTP ' + res.status);
  return json;
}
async function apiPut(id, data) {
  const res  = await fetch(`${API}?id=${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to update student');
  return json;
}
async function apiDelete(id) {
  const res  = await fetch(`${API}?id=${id}`, { method:'DELETE' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to delete student');
  return json;
}

// ═══════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════
let students    = [];
let filtered    = [];
let editingId   = null;
let currentPage = 1;
const PAGE_SIZE = 10;
let localSections = [];

// ═══════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme || 'light');
}

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
async function init() {
  try {
    const data = await apiGet();
    students = data.map(s => ({ ...s }));
    applyFilters();
  } catch (e) {
    toast('Could not connect to database. Is XAMPP running and db.php in the right folder?', 'danger');
    applyFilters();
  }
  initFlatpickr();
  populateSections();
}

function initFlatpickr() {
  if (typeof flatpickr === 'undefined') return;
  flatpickr('#f-dob', {
    dateFormat: 'Y-m-d',
    minDate: '1990-01-01',
    defaultDate: '1990-01-01',
    altInput: true,
    altFormat: 'Y-m-d',
  });
  flatpickr('#f-enrollDate', {
    dateFormat: 'Y-m-d',
    defaultDate: new Date(),
    altInput: true,
    altFormat: 'Y-m-d',
  });
}

function initBulkDobPicker() {
  if (typeof flatpickr === 'undefined') return;
  const el = document.getElementById('bulkDob');
  if (!el || el._flatpickr) return;
  flatpickr(el, {
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'F j, Y',
    allowInput: false,
    onChange(selectedDates, dateStr) {
      applyBulkField('dob', dateStr);
    },
  });
}

// ═══════════════════════════════════════════
//  SECTION HELPERS
// ═══════════════════════════════════════════
function openAddSectionModal() {
  document.getElementById('newSectionName').value = '';
  document.getElementById('addSectionOverlay').classList.add('open');
  buildSectionRemoveList();
}
function closeAddSectionModal() {
  document.getElementById('addSectionOverlay').classList.remove('open');
}
async function saveAddSection() {
  const name = document.getElementById('newSectionName').value.trim();
  if (!name) return;
  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ _action: 'add_section', name })
  });
  if (!localSections.includes(name)) localSections.push(name);
  closeAddSectionModal();
  populateSections();
  toast('Section "' + name + '" added', 'success');
}
function populateSections() {
  const studentSections = [...new Set(students.map(s => s.section).filter(Boolean))].sort();
  const allSections = [...new Set([...localSections, ...studentSections])].sort();
  refreshSectionDropdowns(allSections);

  // Refresh bulk section dropdown in import modal
  const bulkSec = document.getElementById('bulkSection');
  if (bulkSec) {
    const bulkVal = bulkSec.value;
    while (bulkSec.options.length > 1) bulkSec.remove(1);
    allSections.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      bulkSec.appendChild(o);
    });
    if (allSections.includes(bulkVal)) bulkSec.value = bulkVal;
  }

  // If the import preview (step 3) is visible, re-render rows so
  // per-row section dropdowns also reflect the new section list
  const importStep3 = document.getElementById('importStep3');
  const importOverlay = document.getElementById('importOverlay');
  if (
    importOverlay && importOverlay.classList.contains('open') &&
    importStep3 && importStep3.style.display !== 'none' &&
    typeof renderImportPreview === 'function'
  ) {
    renderImportPreview();
  }
}
function refreshSectionDropdowns(sections) {
  ['filterSection', 'f-section'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const selected = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    sections.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      sel.appendChild(o);
    });
    if (sections.includes(selected)) sel.value = selected;
  });
}
function removeSection(name) {
  localSections = localSections.filter(s => s !== name);
  populateSections();
  buildSectionRemoveList();
}
function buildSectionRemoveList() {
  const wrap = document.getElementById('sectionRemoveList');
  if (!wrap) return;
  const all = getAllSections();
  wrap.innerHTML = '';
  if (all.length === 0) {
    wrap.innerHTML = '<span style="font-size:13px;color:var(--text-light)">No sections yet.</span>';
    return;
  }
  all.forEach(s => {
    const row = document.createElement('div');
    row.style = 'display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bg-input)';
    const nameSpan = document.createElement('span');
    nameSpan.style = 'font-size:13px;color:var(--text-primary)';
    nameSpan.textContent = s;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style = 'background:none;border:none;cursor:pointer;color:var(--accent-danger);font-size:12px;font-weight:500';
    btn.textContent = 'Remove';
    btn.onclick = () => removeSection(s);
    row.appendChild(nameSpan);
    row.appendChild(btn);
    wrap.appendChild(row);
  });
}
function getAllSections() {
  const studentSections = [...new Set(students.map(s => s.section).filter(Boolean))].sort();
  return [...new Set([...localSections, ...studentSections])].sort();
}
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ═══════════════════════════════════════════
//  FILTERS & RENDER
// ═══════════════════════════════════════════
function buildFullName(s) {
  const lastName   = s.lastName   || '';
  const firstName  = s.firstName  || '';
  const middleInit = s.middleName ? s.middleName[0] + '.' : '';
  const parts = [firstName, middleInit].filter(Boolean);
  const fullName = parts.join(' ');
  return lastName ? (fullName ? lastName + ', ' + fullName : lastName) : fullName || '—';
}

function getInitials(s) {
  const first = s.firstName  || '';
  const last  = s.lastName   || '';
  return ((first[0] || '') + (last[0] || '')).toUpperCase();
}

function applyFilters() {
  const q       = (document.getElementById('globalSearch')?.value || '').toLowerCase();
  const grade   = document.getElementById('filterGrade')?.value   || '';
  const section = document.getElementById('filterSection')?.value || '';
  const gender  = document.getElementById('filterGender')?.value  || '';
  const sort    = document.getElementById('sortBy')?.value        || 'name';

  filtered = students.filter(s => {
    const name = buildFullName(s);
    const matchQ       = !q || name.toLowerCase().includes(q) || (s.studentId||'').toLowerCase().includes(q);
    const matchGrade   = !grade   || s.grade   === grade;
    const matchSection = !section || s.section === section;
    const matchGender  = !gender  || s.gender  === gender;
    return matchQ && matchGrade && matchSection && matchGender;
  });

  filtered.sort((a,b) => {
    if (sort === 'name')      return buildFullName(a).localeCompare(buildFullName(b));
    if (sort === 'name-desc') return buildFullName(b).localeCompare(buildFullName(a));
    if (sort === 'id')        return (a.studentId||'').localeCompare(b.studentId||'');
    if (sort === 'date')      return (a.enrollDate||'').localeCompare(b.enrollDate||'');
    return 0;
  });

  currentPage = 1;
  renderTable();
  renderStats();
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  const empty = document.getElementById('emptyState');

  if (!filtered.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    document.getElementById('pageInfo').textContent = '';
    document.getElementById('pageBtns').innerHTML   = '';
    return;
  }
  empty.style.display = 'none';

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = filtered.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = page.map((s, i) => {
    const name    = esc(buildFullName(s));
    const initials = getInitials(s);
    const lrn     = esc(s.studentId || '—');
    const gender  = esc(s.gender    || '—');
    const email   = esc(s.email     || '—');
    const phone   = esc(s.phone     || '—');

    return `<tr>
      <td>${start + i + 1}</td>
      <td>
        <div class="student-name-cell">
          <div class="student-avatar">${initials}</div>
          <div>
            <div style="font-weight:600">
              <a href="StudentInfo.html?id=${s.id}" style="color:inherit;text-decoration:none"
                onmouseover="this.style.color='#4f46e5';this.style.textDecoration='underline'"
                onmouseout="this.style.color='inherit';this.style.textDecoration='none'">${name}</a>
            </div>
            <div style="font-size:0.75rem;color:var(--text-secondary)">${esc(s.dob||'—')}</div>
          </div>
        </div>
      </td>
      <td><code style="background:var(--bg-input);padding:2px 8px;border-radius:6px;font-size:0.82rem">${lrn}</code></td>
      <td>${esc(s.grade||'—')} · ${esc(s.section||'—')}</td>
      <td>${gender}</td>
      <td style="font-size:0.85rem">${email}</td>
      <td style="font-size:0.85rem">${phone}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-secondary btn-sm" title="View" onclick="viewStudent(${s.id})">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          </button>
          <button class="btn btn-secondary btn-sm" title="Edit" onclick="openEditModal(${s.id})">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button class="btn btn-danger btn-sm" title="Delete" onclick="confirmDelete(${s.id})">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('pageInfo').textContent =
    `Showing ${start+1}–${Math.min(start+PAGE_SIZE, filtered.length)} of ${filtered.length} students`;

  const btns = document.getElementById('pageBtns');
  btns.innerHTML = '';
  const prev = document.createElement('button');
  prev.className = 'page-btn'; prev.textContent = '‹'; prev.disabled = currentPage === 1;
  prev.onclick = () => { currentPage--; renderTable(); };
  btns.appendChild(prev);
  for (let p = 1; p <= totalPages; p++) {
    const b = document.createElement('button');
    b.className = 'page-btn' + (p === currentPage ? ' active' : '');
    b.textContent = p;
    b.onclick = (pp => () => { currentPage = pp; renderTable(); })(p);
    btns.appendChild(b);
  }
  const next = document.createElement('button');
  next.className = 'page-btn'; next.textContent = '›'; next.disabled = currentPage === totalPages;
  next.onclick = () => { currentPage++; renderTable(); };
  btns.appendChild(next);
}

function renderStats() {
  document.getElementById('statTotal').textContent  = students.length;
  document.getElementById('statMale').textContent   = students.filter(s => s.gender === 'Male').length;
  document.getElementById('statFemale').textContent = students.filter(s => s.gender === 'Female').length;
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ═══════════════════════════════════════════
//  OPEN / CLOSE ADD-EDIT MODAL
// ═══════════════════════════════════════════
function openAddModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent   = 'Add New Student';
  document.getElementById('saveBtnText').textContent  = 'Add Student';
  clearForm();
  document.getElementById('formOverlay').classList.add('open');
}

function openEditModal(id) {
  const s = students.find(x => x.id === id);
  if (!s) return;
  editingId = id;
  document.getElementById('modalTitle').textContent  = 'Edit Student';
  document.getElementById('saveBtnText').textContent = 'Save Changes';
  fillForm(s);
  document.getElementById('formOverlay').classList.add('open');
  document.getElementById('viewOverlay').classList.remove('open');
}

function closeFormModal() {
  document.getElementById('formOverlay').classList.remove('open');
  clearErrors();
}

// ═══════════════════════════════════════════
//  FORM HELPERS
// ═══════════════════════════════════════════
function clearForm() {
  const ids = [
    'f-studentId','f-firstName','f-middleName','f-lastName','f-dob','f-enrollDate','f-prevSchool',
    'f-email','f-phone','f-address',
    'f-fatherName','f-fatherPhone','f-motherName','f-motherPhone',
    'f-guardianName','f-guardianRelation','f-guardianPhone',
    'f-grade','f-section'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.querySelectorAll('input[name="f-gender"]').forEach(r => r.checked = false);
  clearErrors();
}

function fillForm(s) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('f-studentId',        s.studentId        || '');
  set('f-firstName',        s.firstName        || '');
  set('f-middleName',       s.middleName       || '');
  set('f-lastName',         s.lastName         || '');
  set('f-dob',              s.dob              || '');
  set('f-grade',            s.grade            || '');
  set('f-section',          s.section          || '');
  set('f-enrollDate',       s.enrollDate       || '');
  set('f-prevSchool',       s.prevSchool       || '');
  set('f-email',            s.email            || '');
  set('f-phone',            s.phone            || '');
  set('f-address',          s.address          || '');
  set('f-fatherName',       s.fatherName       || '');
  set('f-fatherPhone',      s.fatherPhone      || '');
  set('f-motherName',       s.motherName       || '');
  set('f-motherPhone',      s.motherPhone      || '');
  set('f-guardianName',     s.guardianName     || '');
  set('f-guardianRelation', s.guardianRelation || '');
  set('f-guardianPhone',    s.guardianPhone    || '');
  document.querySelectorAll('input[name="f-gender"]').forEach(r => {
    r.checked = (r.value === s.gender);
  });
  clearErrors();
}

function getFormData() {
  const get = id => (document.getElementById(id)?.value || '').trim();
  const gender = document.querySelector('input[name="f-gender"]:checked')?.value || '';
  return {
    studentId:        get('f-studentId'),
    firstName:        get('f-firstName'),
    middleName:       get('f-middleName'),
    lastName:         get('f-lastName'),
    dob:              get('f-dob'),
    gender,
    grade:            get('f-grade'),
    section:          get('f-section'),
    enrollDate:       get('f-enrollDate'),
    prevSchool:       get('f-prevSchool'),
    email:            get('f-email'),
    phone:            get('f-phone'),
    address:          get('f-address'),
    fatherName:       get('f-fatherName'),
    fatherPhone:      get('f-fatherPhone'),
    motherName:       get('f-motherName'),
    motherPhone:      get('f-motherPhone'),
    guardianName:     get('f-guardianName'),
    guardianRelation: get('f-guardianRelation'),
    guardianPhone:    get('f-guardianPhone'),
  };
}

function validate(data) {
  let ok = true;
  clearErrors();
  if (!data.firstName) { setErr('firstName', 'First name is required'); ok = false; }
  if (!data.lastName)  { setErr('lastName',  'Last name is required');  ok = false; }
  if (!data.gender)    { setErr('gender',    'Please select a gender'); ok = false; }
  if (!data.grade)     { setErr('grade',     'Grade level is required'); ok = false; }
  return ok;
}

function setErr(field, msg) {
  const el  = document.getElementById('err-' + field);
  if (el) el.textContent = msg;
  const inp = document.getElementById('f-' + field);
  if (inp) inp.classList.add('error');
}

function clearErrors() {
  document.querySelectorAll('.error-msg').forEach(e => e.textContent = '');
  document.querySelectorAll('.form-input.error,.form-select.error').forEach(e => e.classList.remove('error'));
}

async function saveStudent() {
  const data = getFormData();
  if (!validate(data)) return;
  try {
    if (editingId) {
      const updated = await apiPut(editingId, data);
      const idx = students.findIndex(s => s.id === editingId);
      if (idx !== -1) students[idx] = { ...updated };
      toast('Student updated successfully!', 'success');
      if (window.CILog) CILog.push('student_updated', 'Student updated', buildFullName(updated) + (data.section ? ' · ' + data.section : ''));
    } else {
      const created = await apiPost(data);
      students.push({ ...created });
      toast('Student added successfully!', 'success');
      if (window.CILog) CILog.push('student_added', 'Student enrolled', buildFullName(created) + (data.section ? ' · ' + data.section : ''));
    }
    closeFormModal();
    applyFilters();
  } catch (e) {
    if (e.message.includes('already exists')) {
      setErr('studentId', e.message);
    } else {
      toast(e.message, 'danger');
    }
  }
}

// ═══════════════════════════════════════════
//  VIEW MODAL
// ═══════════════════════════════════════════
function viewStudent(id) {
  const s = students.find(x => x.id === id);
  if (!s) return;
  const name     = buildFullName(s);
  const initials = getInitials(s);
  const colors   = ['#4f46e5','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6'];
  const color    = colors[(name.charCodeAt(0)||0) % colors.length];
  const avatarEl = document.getElementById('viewAvatarBadge');
  if (avatarEl) { avatarEl.textContent = initials; avatarEl.style.background = `linear-gradient(135deg,${color},#7c3aed)`; }
  const nameEl = document.getElementById('viewModalName');
  if (nameEl) nameEl.textContent = name;
  const subEl = document.getElementById('viewModalSub');
  if (subEl) subEl.textContent = `${s.studentId||'No ID'}  •  ${s.grade||''} ${s.section||''}`;
  const v = val => val
    ? `<span class="view-value">${esc(val)}</span>`
    : '<span class="view-value empty">Not provided</span>';
  document.getElementById('viewBody').innerHTML = `
    <div class="view-section">
      <div class="view-section-title">Personal Information</div>
      <div class="view-grid">
        <div class="view-item"><div class="view-label">First Name</div>${v(s.firstName)}</div>
        <div class="view-item"><div class="view-label">Middle Name</div>${v(s.middleName)}</div>
        <div class="view-item"><div class="view-label">Last Name</div>${v(s.lastName)}</div>
        <div class="view-item"><div class="view-label">Student ID / LRN</div>${v(s.studentId)}</div>
        <div class="view-item"><div class="view-label">Date of Birth</div>${v(s.dob)}</div>
        <div class="view-item"><div class="view-label">Gender</div>${v(s.gender)}</div>
      </div>
    </div>
    <div class="view-section">
      <div class="view-section-title">Academic Information</div>
      <div class="view-grid">
        <div class="view-item"><div class="view-label">Grade Level</div>${v(s.grade)}</div>
        <div class="view-item"><div class="view-label">Section</div>${v(s.section)}</div>
        <div class="view-item"><div class="view-label">Enrollment Date</div>${v(s.enrollDate)}</div>
        <div class="view-item"><div class="view-label">Previous School</div>${v(s.prevSchool)}</div>
      </div>
    </div>
    <div class="view-section">
      <div class="view-section-title">Contact Information</div>
      <div class="view-grid">
        <div class="view-item"><div class="view-label">Email</div>${v(s.email)}</div>
        <div class="view-item"><div class="view-label">Phone</div>${v(s.phone)}</div>
        <div class="view-item" style="grid-column:1/-1"><div class="view-label">Address</div>${v(s.address)}</div>
      </div>
    </div>
    <div class="view-section">
      <div class="view-section-title">Parent / Guardian</div>
      <div class="view-grid">
        <div class="view-item"><div class="view-label">Father's Name</div>${v(s.fatherName)}</div>
        <div class="view-item"><div class="view-label">Father's Phone</div>${v(s.fatherPhone)}</div>
        <div class="view-item"><div class="view-label">Mother's Name</div>${v(s.motherName)}</div>
        <div class="view-item"><div class="view-label">Mother's Phone</div>${v(s.motherPhone)}</div>
        <div class="view-item"><div class="view-label">Guardian's Name</div>${v(s.guardianName)}</div>
        <div class="view-item"><div class="view-label">Relationship</div>${v(s.guardianRelation)}</div>
        <div class="view-item"><div class="view-label">Guardian's Phone</div>${v(s.guardianPhone)}</div>
      </div>
    </div>`;
  document.getElementById('editFromViewBtn').onclick = () => openEditModal(id);
  document.getElementById('viewOverlay').classList.add('open');
}

function closeViewModal() {
  document.getElementById('viewOverlay').classList.remove('open');
}

// ═══════════════════════════════════════════
//  DELETE
// ═══════════════════════════════════════════
let deleteTargetId = null;

function confirmDelete(id) {
  const s = students.find(x => x.id === id);
  if (!s) return;
  deleteTargetId = id;
  document.getElementById('confirmMsg').textContent =
    `Are you sure you want to delete "${buildFullName(s)}"? This cannot be undone.`;
  document.getElementById('confirmOverlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
  deleteTargetId = null;
}

document.getElementById('confirmDeleteBtn').onclick = async function() {
  if (!deleteTargetId) return;
  try {
    const target = students.find(s => s.id === deleteTargetId);
    await apiDelete(deleteTargetId);
    students = students.filter(s => s.id !== deleteTargetId);
    toast('Student deleted.', 'danger');
    if (window.CILog && target) CILog.push('student_deleted', 'Student removed', buildFullName(target) + (target.section ? ' · ' + target.section : ''));
    closeConfirm();
    applyFilters();
  } catch (e) {
    toast(e.message, 'danger');
  }
};

// ═══════════════════════════════════════════════════════════════════════
//  IMPORT MODAL — IMAGE (Gemini Vision AI via gemini_proxy.php) + EXCEL/CSV
// ═══════════════════════════════════════════════════════════════════════

let _importStudents  = [];
let _importMode      = 'image'; // 'image' | 'excel'
let _importStep      = 1;
let _currentImgFile  = null;

// ── Open / Close ──────────────────────────────────────────────────────
function openImportModal() {
  _importStudents = [];
  _importMode     = 'image';
  _importStep     = 1;
  _currentImgFile = null;
  resetImportUI();
  populateSections(); // ensure section dropdowns are up-to-date
  document.getElementById('importOverlay').classList.add('open');
  setTimeout(initBulkDobPicker, 50);
}

function closeImportModal() {
  document.getElementById('importOverlay').classList.remove('open');
  resetImportUI();
}

function resetImportUI() {
  setStep(1);
  // Clear image side
  const fi = document.getElementById('importFileInput');
  if (fi) fi.value = '';
  const pw = document.getElementById('importPreviewWrap');
  if (pw) pw.style.display = 'none';
  const pi = document.getElementById('importPreviewImg');
  if (pi) pi.src = '';
  const ctx = document.getElementById('importContext');
  if (ctx) ctx.value = '';
  // Clear excel side
  const ef = document.getElementById('importExcelInput');
  if (ef) ef.value = '';
  const epw = document.getElementById('importExcelPreviewWrap');
  if (epw) epw.style.display = 'none';
  // Reset action button
  const btn = document.getElementById('importActionBtn');
  if (btn) { btn.disabled = true; document.getElementById('importActionLabel').textContent = 'Analyze Image'; }
  // Reset step 4
  const s4 = document.getElementById('importStep4');
  if (s4) s4.style.display = 'none';
  // Sync tab UI
  _syncImportTabs();
}

function _syncImportTabs() {
  document.querySelectorAll('.import-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === _importMode);
  });
  const imgPanel = document.getElementById('importImagePanel');
  const xlsPanel = document.getElementById('importExcelPanel');
  if (imgPanel) imgPanel.style.display = _importMode === 'image' ? 'block' : 'none';
  if (xlsPanel) xlsPanel.style.display = _importMode === 'excel' ? 'block' : 'none';
  const btn = document.getElementById('importActionBtn');
  if (btn) {
    const label = document.getElementById('importActionLabel');
    if (_importMode === 'image') {
      label.textContent = 'Analyze Image';
      btn.disabled = !_currentImgFile;
    } else {
      label.textContent = 'Preview Data';
      const ef = document.getElementById('importExcelInput');
      btn.disabled = !(ef && ef.files && ef.files.length > 0);
    }
  }
}

function switchImportTab(mode) {
  _importMode = mode;
  _syncImportTabs();
}

// ── Step management ───────────────────────────────────────────────────
function setStep(step) {
  _importStep = step;
  ['importStep1','importStep2','importStep3','importStep4'].forEach((id, idx) => {
    const el = document.getElementById(id);
    if (el) el.style.display = (idx + 1 === step) ? (step === 1 ? 'block' : step === 2 ? 'block' : 'block') : 'none';
  });

  const footer = document.getElementById('importFooter');
  const btn    = document.getElementById('importActionBtn');
  const lbl    = document.getElementById('importActionLabel');

  if (step === 1) {
    if (footer) footer.style.display = 'flex';
    if (btn) { btn.style.display = 'inline-flex'; _syncImportTabs(); }
  } else if (step === 2) {
    if (footer) footer.style.display = 'flex';
    if (btn) btn.style.display = 'none';
  } else if (step === 3) {
    if (footer) footer.style.display = 'flex';
    if (btn) { btn.style.display = 'inline-flex'; btn.disabled = false; if (lbl) lbl.textContent = 'Import Students'; }
  } else if (step === 4) {
    if (footer) footer.style.display = 'flex';
    if (btn) { btn.style.display = 'none'; }
  }
}

// ── Drag & drop for IMAGE ─────────────────────────────────────────────
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('importDropZone')?.classList.add('drag-over');
}
function handleDragLeave(e) {
  document.getElementById('importDropZone')?.classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('importDropZone')?.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    _loadImageFile(file);
  } else {
    toast('Please drop an image file (JPG, PNG, WEBP)', 'danger');
  }
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  _loadImageFile(file);
}

function _loadImageFile(file) {
  _currentImgFile = file;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('importPreviewImg').src = e.target.result;
    document.getElementById('importPreviewWrap').style.display = 'block';
    _syncImportTabs();
  };
  reader.readAsDataURL(file);
}

function clearImportImage() {
  _currentImgFile = null;
  document.getElementById('importFileInput').value = '';
  document.getElementById('importPreviewWrap').style.display = 'none';
  document.getElementById('importPreviewImg').src = '';
  _syncImportTabs();
}

// ── Drag & drop for EXCEL panel ───────────────────────────────────────
function handleExcelDragOver(e) {
  e.preventDefault();
  document.getElementById('importExcelDropZone')?.classList.add('drag-over');
}
function handleExcelDragLeave(e) {
  document.getElementById('importExcelDropZone')?.classList.remove('drag-over');
}
function handleExcelDrop(e) {
  e.preventDefault();
  document.getElementById('importExcelDropZone')?.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) _loadExcelFile(file);
}
function handleExcelFile(event) {
  const file = event.target.files[0];
  if (file) _loadExcelFile(file);
}
function _loadExcelFile(file) {
  const pw   = document.getElementById('importExcelPreviewWrap');
  const name = document.getElementById('importExcelFileName');
  if (name) name.textContent = file.name + ' (' + _fmtSize(file.size) + ')';
  if (pw)   pw.style.display = 'block';
  _syncImportTabs();
}
function clearImportExcel() {
  document.getElementById('importExcelInput').value = '';
  document.getElementById('importExcelPreviewWrap').style.display = 'none';
  _syncImportTabs();
}
function _fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}

// ── Main action dispatcher ────────────────────────────────────────────
async function runImportAction() {
  if (_importStep === 1) {
    if (_importMode === 'image') await _runOcrImport();
    else                         await _runExcelImport();
  } else if (_importStep === 3) {
    await _commitImport();
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  IMAGE IMPORT — Gemini Vision AI  (via gemini_proxy.php)
//  API key lives in .env → read server-side → never sent to browser.
// ═══════════════════════════════════════════════════════════════════════

// Path to the PHP proxy — same folder as Student.html
const GEMINI_PROXY = 'gemini_proxy.php';

async function _runOcrImport() {
  const imgEl = document.getElementById('importPreviewImg');
  if (!imgEl || !imgEl.src || imgEl.src === window.location.href) {
    toast('Please select an image first', 'danger'); return;
  }

  setStep(2);
  const pBar = document.getElementById('ocrProgressBar');
  const pLbl = document.getElementById('ocrProgressLabel');
  const msg  = document.getElementById('importLoadingMsg');
  const sub  = document.getElementById('importLoadingSub');

  const prog = (pct, label, sublabel) => {
    if (pBar) pBar.style.width = pct + '%';
    if (pLbl) pLbl.textContent = pct + '%';
    if (msg  && label)    msg.textContent = label;
    if (sub  && sublabel) sub.textContent = sublabel;
  };

  try {
    prog(10, 'Preparing image…', 'Resizing image for Gemini Vision');

    // Resize image to max 1600 px wide and convert to JPEG base64
    const { base64, mimeType } = await _imageToBase64Jpeg(_currentImgFile, imgEl, 1600);

    prog(25, 'Sending to Gemini AI…', 'AI is scanning your master list — please wait');

    const context = (document.getElementById('importContext')?.value || '').trim();

    // Build the optional context hint to append to the server-side prompt
    const promptSuffix = context
      ? `\nAdditional context from user: ${context}`
      : '';

    // POST to PHP proxy — the proxy adds the API key from .env
    const response = await fetch(GEMINI_PROXY, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ imageBase64: base64, mimeType, promptSuffix: promptSuffix }),
    });

    prog(75, 'Processing AI response…', 'Parsing extracted student records');

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error || ('Server error ' + response.status));
    }

    const parsed = result.students;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('No students detected. Make sure the photo shows a student masterlist clearly.');
    }

    prog(90, 'Finalizing student list…', 'Almost done');

    // Normalise, title-case, dedup, flag existing duplicates
    const seen = new Set();
    _importStudents = parsed
      .map(s => {
        const lastName   = _toTitleCase((s.lastName   || '').toString().trim());
        const firstName  = _toTitleCase((s.firstName  || '').toString().trim());
        const middleName = _toTitleCase((s.middleName || '').toString().trim().replace(/\.$/, ''));
        const studentId  = (s.studentId || '').toString().replace(/\D/g, '');
        const gRaw       = (s.gender || '').toString().toLowerCase();
        const gender     = gRaw.startsWith('f') ? 'Female'
                         : gRaw.startsWith('m') ? 'Male' : '';
        return { lastName, firstName, middleName, studentId, gender,
                 grade: '', section: '', dob: '', selected: true };
      })
      .filter(s => s.lastName.length >= 2)
      .filter(s => {
        const key = (s.lastName + '|' + s.firstName).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key); return true;
      })
      .map(s => ({
        ...s,
        _duplicate: students.some(x =>
          x.lastName?.toLowerCase()  === s.lastName.toLowerCase() &&
          x.firstName?.toLowerCase() === s.firstName.toLowerCase()
        ),
      }));

    prog(100, 'Done!', `${_importStudents.length} students extracted by Gemini AI`);
    setTimeout(_showImportPreview, 400);

  } catch (e) {
    console.error('Gemini scan error:', e);

    const errMsg = e.message || '';
    let display  = '❌ Gemini scan failed: ' + errMsg;
    let hint     = 'Check your .env API key, server connection, or try a clearer image';
    let retrySec = 0;

    if (/quota|rate.?limit|exceeded|free.?tier/i.test(errMsg)) {
      const retryMatch = errMsg.match(/retry\s+in\s+([\d.]+)\s*s/i);
      retrySec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
      display = '⏳ Gemini free-tier quota reached.';
      hint    = 'You can upgrade your Gemini API key, or wait for the countdown below and retry.';
    } else if (/api.?key|not.?set|invalid/i.test(errMsg)) {
      display = '🔑 Invalid or missing Gemini API key.';
      hint    = 'Check that GEMINI_API_KEY is correctly set in your .env file.';
    } else if (/network|fetch|curl/i.test(errMsg)) {
      display = '🌐 Network error reaching Gemini API.';
      hint    = "Check your server's internet connection and that gemini_proxy.php is reachable.";
    }

    if (msg) msg.textContent = display;
    if (sub) sub.textContent = hint;

    if (retrySec > 0) {
      // Show countdown + retry button — don't auto-navigate away
      _showRetryCountdown(retrySec, msg, sub, pBar, pLbl);
    } else {
      setTimeout(() => setStep(1), 6000);
    }
  }
}

// ── Countdown timer shown after a quota error ─────────────────────────
function _showRetryCountdown(seconds, msgEl, subEl, pBar, pLbl) {
  let remaining = seconds;
  if (pBar) { pBar.style.width = '0%'; pBar.style.background = 'var(--accent-warning, #f59e0b)'; }
  if (pLbl) pLbl.textContent = '';

  // Inject a retry button below the sub-label
  let retryBtn = document.getElementById('_geminiRetryBtn');
  if (!retryBtn) {
    retryBtn = document.createElement('button');
    retryBtn.id = '_geminiRetryBtn';
    retryBtn.className = 'btn btn-primary';
    retryBtn.style = 'margin-top:16px;min-width:140px';
    subEl?.parentNode?.insertBefore(retryBtn, subEl.nextSibling);
  }
  retryBtn.disabled = true;
  retryBtn.style.display = 'inline-flex';

  const tick = () => {
    if (remaining <= 0) {
      if (pBar) { pBar.style.width = '100%'; pBar.style.background = 'var(--primary-color)'; }
      if (pLbl) pLbl.textContent = 'Ready';
      retryBtn.disabled = false;
      retryBtn.textContent = '🔄 Retry Now';
      retryBtn.onclick = () => {
        retryBtn.style.display = 'none';
        if (pBar) pBar.style.background = '';
        setStep(1);
        // Small delay so UI settles, then re-trigger scan
        setTimeout(() => runImportAction(), 80);
      };
      return;
    }
    const pct = Math.round(((seconds - remaining) / seconds) * 100);
    if (pBar) pBar.style.width = pct + '%';
    if (pLbl) pLbl.textContent = remaining + 's';
    retryBtn.textContent = `⏳ Retry in ${remaining}s`;
    remaining--;
    setTimeout(tick, 1000);
  };
  tick();
}

// ── Resize image → JPEG base64 (max maxWidth px wide) ────────────────
function _imageToBase64Jpeg(file, fallbackImgEl, maxWidth) {
  return new Promise((resolve, reject) => {
    const resize = (dataUrl) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const jpegUrl = canvas.toDataURL('image/jpeg', 0.93);
        resolve({ base64: jpegUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = () => resolve({ base64: dataUrl.split(',')[1] || dataUrl, mimeType: 'image/jpeg' });
      img.src = dataUrl;
    };

    if (file instanceof File) {
      const reader = new FileReader();
      reader.onload  = e => resize(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    } else if (fallbackImgEl?.src) {
      resize(fallbackImgEl.src);
    } else {
      reject(new Error('No image source available'));
    }
  });
}

// ── Helper: Title Case with Filipino connectors ───────────────────────
function _toTitleCase(str) {
  if (!str) return '';
  const LOWERS = new Set(['de','del','la','los','las','ng','ni','mga']);
  return str.split(/\s+/).map((w, i) => {
    if (!w) return '';
    if (i > 0 && LOWERS.has(w.toLowerCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

// ── Helper: extract grade from free text ─────────────────────────────
function _extractGradeFromText(text) {
  if (!text) return '';
  const m = text.match(/\b(kinder(?:garten)?|grade\s*\d+|gr\.?\s*\d+)\b/i);
  if (!m) return '';
  const s = m[0].toLowerCase().replace(/\s+/g, '');
  if (s.includes('kinder')) return 'Kindergarten';
  const num = s.match(/\d+/);
  return num ? 'Grade ' + num[0] : '';
}

// ── Helper: extract section from free text ───────────────────────────
function _extractSectionFromText(text) {
  if (!text) return '';
  const m = text.match(/\b(?:section|sec\.?)\s*([A-Za-z0-9\-]+)/i);
  return m ? _toTitleCase(m[1]) : '';
}

// ═══════════════════════════════════════════════════════════════════════
//  EXCEL / CSV IMPORT
// ═══════════════════════════════════════════════════════════════════════

async function _runExcelImport() {
  const input = document.getElementById('importExcelInput');
  if (!input || !input.files || !input.files.length) {
    toast('Please select an Excel or CSV file first', 'danger'); return;
  }
  const file = input.files[0];
  setStep(2);
  const msg = document.getElementById('importLoadingMsg');
  const sub = document.getElementById('importLoadingSub');
  const pBar = document.getElementById('ocrProgressBar');
  const pLbl = document.getElementById('ocrProgressLabel');
  if (msg)  msg.textContent  = 'Reading file…';
  if (sub)  sub.textContent  = file.name;
  if (pBar) pBar.style.width = '30%';
  if (pLbl) pLbl.textContent = '30%';

  try {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      const text = await file.text();
      if (pBar) pBar.style.width = '70%'; if (pLbl) pLbl.textContent = '70%';
      _importStudents = _parseCsv(text);
    } else {
      // XLSX — use SheetJS (must be loaded)
      if (typeof XLSX === 'undefined') throw new Error('SheetJS (XLSX) is not loaded. Add the SheetJS CDN script to your HTML.');
      const ab = await file.arrayBuffer();
      if (pBar) pBar.style.width = '50%'; if (pLbl) pLbl.textContent = '50%';
      const wb  = XLSX.read(ab, { type: 'array' });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      if (pBar) pBar.style.width = '80%'; if (pLbl) pLbl.textContent = '80%';
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      _importStudents = _mapExcelRows(rows);
    }
    if (pBar) pBar.style.width = '100%'; if (pLbl) pLbl.textContent = '100%';
    _showImportPreview();
  } catch (e) {
    console.error('Excel import error:', e);
    if (msg) msg.textContent = '❌ ' + e.message;
    if (sub) sub.textContent = 'Make sure the file is a valid Excel (.xlsx) or CSV file';
    setTimeout(() => setStep(1), 3500);
  }
}

// ── CSV parser (handles quoted fields) ───────────────────────────────
function _parseCsv(text) {
  const lines = text.split(/\r?\n/);
  if (!lines.length) return [];
  const headers = _csvRow(lines[0]).map(h => h.toLowerCase().trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = _csvRow(lines[i]);
    const row  = {};
    headers.forEach((h, j) => row[h] = (cols[j] || '').trim());
    rows.push(row);
  }
  return _mapExcelRows(rows);
}

function _csvRow(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += c;
  }
  result.push(cur);
  return result;
}

// ── Map Excel/CSV row → student object ───────────────────────────────
function _mapExcelRows(rows) {
  const seen    = new Set();
  const results = [];

  // Column aliases — covers many real-world master list headers
  const COL = {
    studentId: ['lrn','student id','studentid','id','student_id','learner reference number','learner ref'],
    lastName:  ['last name','lastname','surname','family name','apellido','lname','last_name'],
    firstName: ['first name','firstname','given name','givenname','fname','first_name','pangalan'],
    middleName:['middle name','middlename','mname','middle_name','middle initial','mi'],
    gender:    ['gender','sex','kasarian'],
    grade:     ['grade','grade level','gradelevel','year level','yearlevel'],
    section:   ['section','klase','class'],
    dob:       ['date of birth','dob','birthdate','birth date','birthday','petsa ng kapanganakan'],
    email:     ['email','email address','e-mail'],
    phone:     ['phone','contact','contact number','mobile','cellphone'],
    address:   ['address','home address'],
    fatherName:['father','fathers name','father name',"father's name"],
    motherName:['mother','mothers name','mother name',"mother's name"],
  };

  function findCol(row, aliases) {
    for (const alias of aliases) {
      for (const k of Object.keys(row)) {
        if (k.toLowerCase().replace(/[^a-z0-9]/g,'') === alias.replace(/[^a-z0-9]/g,'')) {
          return (row[k] || '').toString().trim();
        }
      }
    }
    return '';
  }

  // Detect if the sheet has a single "full name" column and no first/last split
  const sampleRow = rows[0] || {};
  const hasFirstLast = COL.lastName.some(a => Object.keys(sampleRow).some(k => k.toLowerCase().includes(a.split(' ')[0])));

  for (const row of rows) {
    // Skip obviously empty rows
    const vals = Object.values(row).join('').trim();
    if (!vals || vals.length < 2) continue;

    let lastName   = findCol(row, COL.lastName);
    let firstName  = findCol(row, COL.firstName);
    let middleName = findCol(row, COL.middleName);

    // Fallback: if no separate first/last, try "name" or "full name" columns
    if (!lastName && !firstName) {
      const fullNameKeys = ['name','full name','fullname','student name','studentname'];
      const fullName = findCol(row, fullNameKeys);
      if (fullName) {
        const parsed = _parseFullNameString(fullName);
        lastName   = parsed.lastName;
        firstName  = parsed.firstName;
        middleName = parsed.middleName;
      }
    }

    if (!lastName && !firstName) continue;

    // Normalize gender
    let gender = findCol(row, COL.gender);
    if (/^m$/i.test(gender) || /^male$/i.test(gender))   gender = 'Male';
    else if (/^f$/i.test(gender) || /^female$/i.test(gender)) gender = 'Female';
    else gender = '';

    // Normalize grade
    let grade = findCol(row, COL.grade);
    grade = _extractGradeFromText(grade) || _toTitleCase(grade);

    const studentId = findCol(row, COL.studentId);
    const section   = _toTitleCase(findCol(row, COL.section));
    const dob       = findCol(row, COL.dob);
    const email     = findCol(row, COL.email);
    const phone     = findCol(row, COL.phone);
    const address   = findCol(row, COL.address);
    const fatherName= findCol(row, COL.fatherName);
    const motherName= findCol(row, COL.motherName);

    lastName   = _toTitleCase(lastName.replace(/"/g,''));
    firstName  = _toTitleCase(firstName.replace(/"/g,''));
    middleName = _toTitleCase(middleName.replace(/"/g,''));

    if (!lastName || lastName.length < 2) continue;

    const key = (lastName + '|' + firstName).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const isDuplicate = students.some(s =>
      s.lastName?.toLowerCase()  === lastName.toLowerCase() &&
      s.firstName?.toLowerCase() === firstName.toLowerCase()
    );

    results.push({
      lastName, firstName, middleName,
      studentId, gender, grade, section, dob,
      email, phone, address, fatherName, motherName,
      selected: true,
      _duplicate: isDuplicate,
    });
  }
  return results;
}

function _parseFullNameString(name) {
  // Handles "DELA CRUZ, JUAN P." or "Juan Dela Cruz" etc.
  const commaIdx = name.indexOf(',');
  if (commaIdx > 0) {
    const last   = name.slice(0, commaIdx).trim();
    const rest   = name.slice(commaIdx + 1).trim().split(/\s+/);
    const miWord = rest.length > 1 && /^[A-Z]\.?$/.test(rest[rest.length-1]) ? rest.pop() : '';
    return { lastName: last, firstName: rest.join(' '), middleName: miWord };
  }
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2) return { lastName: words[0]||'', firstName: '', middleName: '' };
  return { lastName: words[0], firstName: words.slice(1).join(' '), middleName: '' };
}

// ═══════════════════════════════════════════════════════════════════════
//  SHOW IMPORT PREVIEW (Step 3)
// ═══════════════════════════════════════════════════════════════════════

function _showImportPreview() {
  const countEl = document.getElementById('importFoundCount');
  if (countEl) countEl.textContent = _importStudents.length + ' students found';

  const dupCount = _importStudents.filter(s => s._duplicate).length;
  const banner   = document.getElementById('importIssuesBanner');
  if (banner) {
    if (dupCount > 0) {
      banner.style.display = 'block';
      banner.textContent   = `⚠ ${dupCount} student(s) may already exist in the database (highlighted in orange). You can still import them if needed.`;
    } else {
      banner.style.display = 'none';
    }
  }

  const bulkHeader = document.getElementById('bulkEditHeader');
  if (bulkHeader) bulkHeader.style.display = 'block';

  setStep(3);
  renderImportPreview();
}

// ── Render the editable preview table ────────────────────────────────
function renderImportPreview() {
  const body = document.getElementById('importPreviewBody');
  if (!body) return;

  const sectionOpts = ['<option value="">—</option>',
    ...getAllSections().map(s => `<option value="${esc(s)}">${esc(s)}</option>`)
  ].join('');

  const gradeOpts = `<option value="">—</option>
    <optgroup label="Basic Education">
    <option>Kindergarten</option><option>Grade 1</option><option>Grade 2</option>
    <option>Grade 3</option><option>Grade 4</option><option>Grade 5</option>
    <option>Grade 6</option><option>Grade 7</option><option>Grade 8</option>
    <option>Grade 9</option><option>Grade 10</option><option>Grade 11</option>
    <option>Grade 12</option></optgroup>
    <optgroup label="College">
    <option>1st Year</option><option>2nd Year</option><option>3rd Year</option>
    <option>4th Year</option><option>5th Year</option></optgroup>`;

  const inStyle = 'background:var(--import-cell-bg);border:1px solid var(--import-cell-border);border-radius:6px;padding:5px 8px;font-size:0.82rem;width:100%;min-width:80px;color:var(--text-primary);font-family:inherit';
  const selStyle = 'background:var(--import-cell-bg);border:1px solid var(--import-cell-border);border-radius:6px;padding:5px 8px;font-size:0.82rem;width:100%;color:var(--text-primary);font-family:inherit';

  body.innerHTML = _importStudents.map((s, i) => {
    const rowCls = s._duplicate ? 'import-row-dup' : '';
    const dupBadge = s._duplicate
      ? `<span style="font-size:0.68rem;background:rgba(245,158,11,0.15);color:var(--accent-warning);border-radius:4px;padding:1px 5px;margin-left:4px;font-weight:600">dup?</span>` : '';

    // Status badge
    let statusHtml = '';
    if (s._duplicate) statusHtml = '<span style="font-size:0.75rem;background:rgba(245,158,11,0.15);color:var(--accent-warning);border-radius:6px;padding:2px 8px;font-weight:600">Possible dup</span>';
    else              statusHtml = '<span style="font-size:0.75rem;background:rgba(16,185,129,0.15);color:var(--accent-success);border-radius:6px;padding:2px 8px;font-weight:600">Ready</span>';

    const makeGradeOpts = () => gradeOpts.replace(`<option>${esc(s.grade)}</option>`, `<option selected>${esc(s.grade)}</option>`);
    const makeSecOpts   = () => sectionOpts.replace(`value="${esc(s.section)}"`, `value="${esc(s.section)}" selected`);
    const genderOpts    = `<option value="">—</option>
      <option${s.gender==='Male'?' selected':''}>Male</option>
      <option${s.gender==='Female'?' selected':''}>Female</option>`;

    return `<tr class="import-row ${rowCls}" data-i="${i}">
      <td style="text-align:center;padding:8px 6px">
        <input type="checkbox" ${s.selected?'checked':''} onchange="toggleImportRow(${i})" style="accent-color:var(--primary-color);width:15px;height:15px">
      </td>
      <td style="padding:6px 8px;min-width:130px">
        <input type="text" value="${esc(s.lastName)}" placeholder="Last Name"
          onchange="updateImportField(${i},'lastName',this.value)" style="${inStyle}">${dupBadge}
      </td>
      <td style="padding:6px 8px;min-width:120px">
        <input type="text" value="${esc(s.firstName)}" placeholder="First Name"
          onchange="updateImportField(${i},'firstName',this.value)" style="${inStyle}">
      </td>
      <td style="padding:6px 8px;min-width:110px">
        <input type="text" value="${esc(s.middleName||'')}" placeholder="Middle Name"
          onchange="updateImportField(${i},'middleName',this.value)" style="${inStyle}">
      </td>
      <td style="padding:6px 8px;min-width:90px">
        <input type="text" value="${esc(s.studentId||'')}" placeholder="LRN/ID"
          onchange="updateImportField(${i},'studentId',this.value)" style="${inStyle}">
      </td>
      <td style="padding:6px 8px;min-width:90px">
        <select onchange="updateImportField(${i},'gender',this.value)" style="${selStyle}">${genderOpts}</select>
      </td>
      <td style="padding:6px 8px;min-width:110px">
        <select onchange="updateImportField(${i},'grade',this.value)" style="${selStyle}">${makeGradeOpts()}</select>
      </td>
      <td style="padding:6px 8px;min-width:110px">
        <select onchange="updateImportField(${i},'section',this.value)" style="${selStyle}">${makeSecOpts()}</select>
      </td>
      <td style="padding:6px 8px;min-width:110px">
        <input type="date" value="${esc(s.dob||'')}"
          onchange="updateImportField(${i},'dob',this.value)" style="${inStyle}">
      </td>
      <td style="padding:6px 8px;text-align:center">${statusHtml}</td>
    </tr>`;
  }).join('');

  // Update header checkmark
  const ca = document.getElementById('importCheckAll');
  if (ca) ca.checked = _importStudents.every(s => s.selected);
}

// ── Preview table interactions ────────────────────────────────────────
function toggleImportRow(i) {
  _importStudents[i].selected = !_importStudents[i].selected;
  const ca = document.getElementById('importCheckAll');
  if (ca) ca.checked = _importStudents.every(s => s.selected);
}
function importToggleAll(checked) {
  _importStudents.forEach(s => s.selected = checked);
  renderImportPreview();
}
function importSelectAll(v) {
  _importStudents.forEach(s => s.selected = v);
  renderImportPreview();
}
function updateImportField(i, field, val) {
  _importStudents[i][field] = val;
}
function applyBulkField(field, val) {
  if (!val) return;
  _importStudents.forEach(s => { if (s.selected) s[field] = val; });
  renderImportPreview();
}
function clearBulkFields() {
  ['bulkGrade','bulkGender','bulkSection'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const dob = document.getElementById('bulkDob');
  if (dob && dob._flatpickr) dob._flatpickr.clear();
  else if (dob) dob.value = '';
}

// ── Commit (save to DB) ───────────────────────────────────────────────
async function _commitImport() {
  const toImport = _importStudents.filter(s => s.selected);
  if (!toImport.length) {
    toast('No students selected to import', 'danger'); return;
  }

  const btn = document.getElementById('importActionBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Importing…'; }

  let ok = 0, fail = 0;
  for (const s of toImport) {
    try {
      const created = await apiPost({
        studentId:  s.studentId  || '',
        firstName:  s.firstName  || '',
        middleName: s.middleName || '',
        lastName:   s.lastName   || '',
        gender:     s.gender     || '',
        grade:      s.grade      || '',
        section:    s.section    || '',
        dob:        s.dob        || '',
        email:      s.email      || '',
        phone:      s.phone      || '',
        address:    s.address    || '',
        fatherName: s.fatherName || '',
        motherName: s.motherName || '',
        enrollDate: new Date().toISOString().slice(0,10),
      });
      students.push({ ...created });
      ok++;
    } catch (e) {
      console.warn('Import failed for', s.lastName, ':', e.message);
      fail++;
    }
  }

  // Show completion step
  setStep(4);
  const t4 = document.getElementById('importStep4');
  if (t4) t4.style.display = 'block';
  const title = document.getElementById('importDoneTitle');
  const dmsg  = document.getElementById('importDoneMsg');
  if (title) title.textContent = ok > 0 ? 'Import Complete!' : 'Import Finished';
  if (dmsg) {
    let txt = '';
    if (ok)   txt += `✅ ${ok} student${ok>1?'s':''} imported successfully.`;
    if (fail) txt += ` ❌ ${fail} failed (may be duplicates or missing required fields).`;
    dmsg.textContent = txt;
  }

  // Refresh footer to just show Close
  const footer = document.getElementById('importFooter');
  if (footer) {
    footer.innerHTML = `
      <button class="btn btn-secondary" onclick="closeImportModal()">Close</button>
      <button class="btn btn-primary" onclick="closeImportModal();applyFilters()">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        Done
      </button>`;
  }

  applyFilters();
  populateSections();
  toast(`Imported ${ok} student${ok!==1?'s':''}${fail?' ('+fail+' failed)':''}`, ok > 0 ? 'success' : 'danger');
  if (window.CILog && ok > 0) CILog.push('student_imported', `${ok} student${ok!==1?'s':''} imported`, fail ? `${fail} failed` : 'All successful');
}

// ═══════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════
function toast(msg, type='') {
  const wrap = document.getElementById('toastWrap');
  const el   = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${type==='danger'?'M6 18L18 6M6 6l12 12':'M5 13l4 4L19 7'}"/></svg>${esc(msg)}`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateX(30px)'; el.style.transition = 'all 300ms';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ═══════════════════════════════════════════
//  BACKDROP CLOSE
// ═══════════════════════════════════════════
document.getElementById('formOverlay').addEventListener('click',    function(e){ if(e.target===this) closeFormModal(); });
document.getElementById('viewOverlay').addEventListener('click',    function(e){ if(e.target===this) closeViewModal(); });
document.getElementById('confirmOverlay').addEventListener('click', function(e){ if(e.target===this) closeConfirm(); });
document.getElementById('importOverlay').addEventListener('click',  function(e){ if(e.target===this) closeImportModal(); });

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
init();

// ═══════════════════════════════════════════
//  EXCEL TEMPLATE DOWNLOAD
//  Generates a blank .csv template the user can fill in
// ═══════════════════════════════════════════
function downloadExcelTemplate() {
  const headers = [
    'LRN', 'Last Name', 'First Name', 'Middle Name',
    'Gender', 'Grade', 'Section', 'Date of Birth',
    'Email', 'Phone', 'Address', "Father's Name", "Mother's Name"
  ];
  const example = [
    '123456789012', 'Dela Cruz', 'Juan', 'Santos',
    'Male', 'Grade 1', 'Sampaguita', '2015-06-15',
    '', '', '', 'Pedro Dela Cruz', 'Maria Dela Cruz'
  ];
  const csv = [headers, example]
    .map(row => row.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(','))
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'student_import_template.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}