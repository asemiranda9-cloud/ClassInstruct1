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

async function init() {
  try {
    const data = await apiGet();
    students = data.map(s => ({ ...s }));
    applyFilters();
  } catch (e) {
    toast('Could not connect to database. Is XAMPP running and db.php in the right folder?', 'danger');
    // Still show empty state so the page is usable
    applyFilters();
  }
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
//  FORM HELPERS  — field IDs match Student.html
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
  // Clear gender radio
  document.querySelectorAll('input[name="f-gender"]').forEach(r => r.checked = false);
  clearErrors();
}

function fillForm(s) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('f-studentId',        s.studentId        || '');
  set('f-firstName',        s.firstName         || '');
  set('f-middleName',       s.middleName        || '');
  set('f-lastName',         s.lastName          || '');
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

  // Gender radio
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
    guardianPhone:   get('f-guardianPhone'),
  };
}

function validate(data) {
  let ok = true;
  clearErrors();
  if (!data.firstName) { setErr('firstName', 'First name is required'); ok = false; }
  if (!data.lastName)  { setErr('lastName',  'Last name is required');  ok = false; }
  if (!data.gender)    { setErr('gender',    'Please select a gender'); ok = false; }
  if (!data.grade)     { setErr('grade',      'Grade level is required'); ok = false; }
  if (!data.section)   { setErr('section',   'Section is required');    ok = false; }
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
    } else {
      const created = await apiPost(data);
      students.push({ ...created });
      toast('Student added successfully!', 'success');
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
    await apiDelete(deleteTargetId);
    students = students.filter(s => s.id !== deleteTargetId);
    toast('Student deleted.', 'danger');
    closeConfirm();
    applyFilters();
  } catch (e) {
    toast(e.message, 'danger');
  }
};

// ═══════════════════════════════════════════
//  IMPORT MODAL (stub)
// ═══════════════════════════════════════════
function openImportModal()  { document.getElementById('importOverlay').classList.add('open'); }
function closeImportModal() { document.getElementById('importOverlay').classList.remove('open'); }

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