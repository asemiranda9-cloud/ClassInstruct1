'use strict';

// ═══════════════════════════════════════════
//  API  — points to your db.php
// ═══════════════════════════════════════════
const API = '/dashboard/api/db.php';

async function apiGet() {
  const res = await fetch(API, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load students');
  return res.json();
}
async function apiPost(data) {
  const res  = await fetch(API, { method:'POST', credentials: 'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch(e) { throw new Error('Server error: ' + text.replace(/<[^>]+>/g,' ').trim().slice(0,300)); }
  if (!res.ok) throw new Error(json.error || json.message || 'HTTP ' + res.status);
  return json;
}
async function apiPut(id, data) {
  const res  = await fetch(`${API}?id=${id}`, { method:'PUT', credentials: 'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to update student');
  return json;
}
async function apiDelete(id) {
  const res  = await fetch(`${API}?id=${id}`, { method:'DELETE', credentials: 'same-origin' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to delete student');
  return json;
}

// ═══════════════════════════════════════════════════════════════════════
//  ARCHIVE TO LIBRARY — moves students out of the active roster and
//  drops each one into the Library (shared localStorage) with their
//  grade history attached as a downloadable .xlsx file.
// ═══════════════════════════════════════════════════════════════════════
const ARCHIVE_API = '/dashboard/api/archive_db.php';
const LIB_KEY = 'ci_library_items';

function defaultSchoolYear() {
  const y = new Date().getFullYear();
  return y + '-' + (y + 1);
}

function openArchiveModal() {
  try {
    const sel = document.getElementById('archiveSection');
    const studentSections = [...new Set(students.map(s => s.section).filter(Boolean))].sort();
    const allSections = [...new Set([...(localSections||[]), ...studentSections])].sort();
    const current = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    allSections.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      sel.appendChild(o);
    });
    if (allSections.includes(current)) sel.value = current;
    document.getElementById('archiveSchoolYear').value = defaultSchoolYear();
    document.getElementById('archiveOverlay').classList.add('open');
  } catch (e) {
    console.error('openArchiveModal failed:', e);
    alert('Could not open the Archive modal (' + e.message + '). Please hard-refresh the page (Ctrl/Cmd+Shift+R) — Student.html and Student.js may be out of sync.');
  }
}
function closeArchiveModal() {
  document.getElementById('archiveOverlay').classList.remove('open');
}

async function confirmArchive() {
  const section        = document.getElementById('archiveSection').value;
  const schoolYearLabel = document.getElementById('archiveSchoolYear').value.trim() || defaultSchoolYear();
  const who = section ? `all students in "${section}"` : 'ALL current students (every section)';
  if (!confirm(`Move ${who} into the archive under "${schoolYearLabel}"? Their grades will be attached to a Library entry as an Excel file. This can't be undone in bulk.`)) return;

  try {
    const res = await fetch(`${ARCHIVE_API}?action=archive_now`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolYearLabel, section }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Archive failed');

    const archivedIds = new Set((result.students || []).map(s => s.id));
    students = students.filter(s => !archivedIds.has(s.id));
    applyFilters();
    populateSections();

    const libCount = pushArchivedStudentsToLibrary(result.students, result.schoolYear);
    toast(`${result.archivedCount} student(s) archived under ${result.schoolYear}` +
      (libCount ? ' and added to the Library with grade sheets.' : '.'), 'success');
    closeArchiveModal();
  } catch (e) {
    toast('Archive failed: ' + e.message, 'danger');
  }
}

function buildStudentGradesWorkbook(student) {
  const rows = (student.grades || []).map(g => ({
    'Subject': g.subject || '',
    'Quarter': g.quarter || '',
    'Written Works': g.written_works ?? '',
    'Performance Tasks': g.performance_tasks ?? '',
    'Quarterly Assessment': g.quarterly_assessment ?? '',
    'Attendance': g.attendance ?? '',
    'Final Grade': g.final_grade ?? '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Note': 'No grades were on file for this student.' }]);
  ws['!cols'] = [{ wch: 18 }, { wch: 9 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Grades');
  return wb;
}

// Adds one Library card per archived student, with a grades .xlsx attached.
// Returns how many were added (0 if XLSX isn't loaded or nothing to add).
function pushArchivedStudentsToLibrary(archivedStudents, schoolYear) {
  if (!archivedStudents || !archivedStudents.length) return 0;
  if (typeof XLSX === 'undefined') {
    toast('Archived, but the grade-sheet exporter did not load — Library entries were skipped.', 'warning');
    return 0;
  }
  let items;
  try { items = JSON.parse(localStorage.getItem(LIB_KEY)) || []; } catch { items = []; }
  let added = 0;
  archivedStudents.forEach(s => {
    try {
      const wb = buildStudentGradesWorkbook(s);
      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const dataUrl = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + base64;
      const safeName = (s.fullName || 'Student').replace(/[^\w\- ]+/g, '').trim() || 'Student';
      const fileName = `${safeName} - ${schoolYear} Grades.xlsx`;
      const gradeSection = [s.grade, s.section].filter(Boolean).join(' - ');

      items.unshift({
        id: 'lib_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        type: 'student_archive',
        subject: 'General',
        grade: s.grade || '',
        title: `${s.fullName || 'Unnamed Student'} — ${schoolYear}`,
        content: [
          `Student ID / LRN: ${s.studentId || '—'}`,
          `Grade & Section: ${gradeSection || '—'}`,
          `School Year: ${schoolYear}`,
          `Archived on: ${new Date().toLocaleDateString()}`,
          '',
          (s.grades && s.grades.length)
            ? `${s.grades.length} grade record(s) attached below as an Excel file.`
            : 'No grades were on file for this student at the time of archiving.',
        ].join('\n'),
        tags: [schoolYear, s.grade, s.section].filter(Boolean),
        files: [{
          name: fileName,
          size: Math.round(base64.length * 0.75),
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dataUrl,
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      added++;
    } catch (e) { /* skip this one student, keep going */ }
  });
  if (added) { try { localStorage.setItem(LIB_KEY, JSON.stringify(items)); } catch {} }
  return added;
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
//  PIN GATE
// ═══════════════════════════════════════════
const PIN_STORAGE_KEY = 'ci_pin';
let _pinBuffer = '';
let _pendingAction = null; // { fn: function, args: [] }

function _getStoredPin() {
  const raw = localStorage.getItem(PIN_STORAGE_KEY);
  if (!raw) return null;
  try { return atob(raw); } catch(e) { return raw; }
}

function _showPinGate(actionFn) {
  const saved = localStorage.getItem(PIN_STORAGE_KEY);
  if (!saved) {
    toast('No PIN set. Go to Settings → Security to create one.', 'danger');
    return;
  }
  _pendingAction = { fn: actionFn, args: [] };
  _pinBuffer = '';
  document.getElementById('pinGate').style.display = 'flex';
  document.getElementById('pinGate').style.opacity = '1';
  document.getElementById('pinError').textContent = '';
  _updatePinDots();
}

function _updatePinDots() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach(function(d, i) {
    d.style.background = i < _pinBuffer.length ? '#4f46e5' : 'transparent';
  });
}

function pinKey(digit) {
  if (_pinBuffer.length >= 4) return;
  _pinBuffer += digit;
  _updatePinDots();
  if (_pinBuffer.length === 4) setTimeout(_pinSubmit, 120);
}

function pinBackspace() {
  _pinBuffer = _pinBuffer.slice(0, -1);
  _updatePinDots();
  document.getElementById('pinError').textContent = '';
}

function pinClear() {
  _pinBuffer = '';
  _updatePinDots();
  document.getElementById('pinError').textContent = '';
}

function _pinSubmit() {
  const stored = _getStoredPin();
  if (_pinBuffer === stored) {
    document.getElementById('pinGate').style.display = 'none';
    _pinBuffer = '';
    if (_pendingAction) {
      _pendingAction.fn.apply(null, _pendingAction.args);
      _pendingAction = null;
    }
  } else {
    _pinBuffer = '';
    _updatePinDots();
    document.getElementById('pinError').textContent = 'Incorrect PIN';
    const dots = document.getElementById('pinDots');
    if (dots) {
      dots.style.transition = 'none';
      dots.style.transform = 'translateX(10px)';
      setTimeout(function() { dots.style.transform = 'translateX(-10px)'; }, 50);
      setTimeout(function() { dots.style.transform = 'translateX(0)'; }, 100);
    }
  }
}

function closePinGate() {
  document.getElementById('pinGate').style.display = 'none';
  _pinBuffer = '';
  _pendingAction = null;
}

// Keyboard support for PIN gate
document.addEventListener('keydown', function(e) {
  const gate = document.getElementById('pinGate');
  if (!gate || gate.style.display === 'none') return;
  if (e.key >= '0' && e.key <= '9') { pinKey(e.key); }
  else if (e.key === 'Backspace') { pinBackspace(); }
  else if (e.key === 'Escape') { closePinGate(); }
});

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
async function init() {
  try {
    const [studentData, sectionData] = await Promise.all([
      apiGet(),
      fetch(API + '?action=sections', { credentials: 'same-origin' }).then(r => r.json()).catch(() => [])
    ]);
    students = studentData.map(s => ({ ...s }));
    localSections = Array.isArray(sectionData) ? sectionData : [];
    applyFilters();
  } catch (e) {
    toast('Could not connect to database. Is XAMPP running and db.php in the right folder?', 'danger');
    applyFilters();
  }
  initFlatpickr();
  populateSections();

  // Auto-open edit modal when coming from StudentInfo page (?edit=<id>)
  const editParam = new URLSearchParams(window.location.search).get('edit');
  if (editParam) {
    // Wait a tick for students to be ready, then open
    setTimeout(() => openEditModal(parseInt(editParam)), 100);
    // Clean the URL so a refresh doesn't re-open the modal
    history.replaceState(null, '', window.location.pathname);
  }
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
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ _action: 'add_section', name })
  });
  if (!localSections.includes(name)) localSections.push(name);
  document.getElementById('newSectionName').value = '';
  populateSections();
  buildSectionRemoveList();
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
async function removeSection(name) {
  await fetch(API + '?action=delete_section', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  localSections = localSections.filter(s => s !== name);
  populateSections();
  buildSectionRemoveList();
  toast('Section "' + name + '" removed', 'info');
}

function editSection(name) {
  const row = document.getElementById('secrow-' + CSS.escape(name));
  if (!row) return;
  row.innerHTML = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = name;
  input.className = 'form-input';
  input.style = 'flex:1;font-size:13px;padding:4px 8px;height:30px';
  input.onkeydown = e => { if (e.key === 'Enter') saveEditSection(name, input.value); if (e.key === 'Escape') buildSectionRemoveList(); };

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save';
  saveBtn.style = 'background:var(--primary-color);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer';
  saveBtn.onclick = () => saveEditSection(name, input.value);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style = 'background:none;border:1px solid var(--bg-input);border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:var(--text-secondary)';
  cancelBtn.onclick = () => buildSectionRemoveList();

  const btnWrap = document.createElement('div');
  btnWrap.style = 'display:flex;gap:5px';
  btnWrap.appendChild(saveBtn);
  btnWrap.appendChild(cancelBtn);

  row.style = 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bg-input)';
  row.appendChild(input);
  row.appendChild(btnWrap);
  input.focus();
  input.select();
}

async function saveEditSection(oldName, newName) {
  newName = newName.trim();
  if (!newName || newName === oldName) { buildSectionRemoveList(); return; }
  if (getAllSections().includes(newName)) {
    toast('Section "' + newName + '" already exists', 'error'); return;
  }
  // Add the new name then delete the old one
  await fetch(API, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ _action: 'add_section', name: newName })
  });
  await fetch(API + '?action=delete_section', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: oldName })
  });
  localSections = localSections.filter(s => s !== oldName);
  if (!localSections.includes(newName)) localSections.push(newName);
  populateSections();
  buildSectionRemoveList();
  toast('Section renamed to "' + newName + '"', 'success');
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
    row.id = 'secrow-' + s;
    row.style = 'display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bg-input)';

    const nameSpan = document.createElement('span');
    nameSpan.style = 'font-size:13px;color:var(--text-primary);flex:1';
    nameSpan.textContent = s;

    const btnWrap = document.createElement('div');
    btnWrap.style = 'display:flex;gap:8px;align-items:center';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.title = 'Rename';
    editBtn.style = 'background:none;border:none;cursor:pointer;color:var(--primary-color);display:flex;align-items:center;gap:3px;font-size:12px;font-weight:500';
    editBtn.innerHTML = '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Edit';
    editBtn.onclick = () => editSection(s);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.style = 'background:none;border:none;cursor:pointer;color:var(--accent-danger);font-size:12px;font-weight:500';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => removeSection(s);

    btnWrap.appendChild(editBtn);
    btnWrap.appendChild(removeBtn);
    row.appendChild(nameSpan);
    row.appendChild(btnWrap);
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
  const firstName  = s.firstName  || '';
  const middleInit = s.middleName ? s.middleName[0] + '.' : '';
  const lastName   = s.lastName   || '';
  const parts = [firstName, middleInit, lastName].filter(Boolean);
  return parts.join(' ') || '—';
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
  const status  = document.getElementById('filterStatus')?.value  || '';
  const sort    = document.getElementById('sortBy')?.value        || 'name';

  filtered = students.filter(s => {
    const name = buildFullName(s);
    const matchQ       = !q || name.toLowerCase().includes(q) || (s.studentId||'').toLowerCase().includes(q);
    const matchGrade   = !grade   || s.grade   === grade;
    const matchSection = !section || s.section === section;
    const matchGender  = !gender  || s.gender  === gender;
    const matchStatus  = !status  || (s.status || 'Active') === status;
    return matchQ && matchGrade && matchSection && matchGender && matchStatus;
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
              <a href="javascript:void(0)" onclick="_showPinGate(()=>window.location.href='StudentInfo.html?id=${s.id}')" style="color:inherit;text-decoration:none"
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
      <td>
        <span style="
          display:inline-block;border-radius:20px;padding:3px 12px;font-size:0.75rem;font-weight:600;
          background:${(s.status||'Active')==='Active'?'rgba(16,185,129,0.18)':'rgba(239,68,68,0.18)'};
          color:${(s.status||'Active')==='Active'?'#059669':'#dc2626'};
          box-shadow:0 0 0 1.5px ${(s.status||'Active')==='Active'?'#10b981':'#ef4444'};
          user-select:none;">
          ${esc(s.status||'Active')}
        </span>
      </td>
      <td style="font-size:0.85rem">${email}</td>
      <td style="font-size:0.85rem">${phone}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-secondary btn-sm" title="View" onclick="_showPinGate(()=>viewStudent(${s.id}))">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
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
  // Default status to Active on clear
  document.querySelectorAll('input[name="f-status"]').forEach(r => { r.checked = (r.value === 'Active'); });
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
  document.querySelectorAll('input[name="f-status"]').forEach(r => {
    r.checked = (r.value === (s.status || 'Active'));
  });
  clearErrors();
}

function getFormData() {
  const get = id => (document.getElementById(id)?.value || '').trim();
  const gender = document.querySelector('input[name="f-gender"]:checked')?.value || '';
  const status = document.querySelector('input[name="f-status"]:checked')?.value || 'Active';
  return {
    studentId:        get('f-studentId'),
    firstName:        get('f-firstName'),
    middleName:       get('f-middleName'),
    lastName:         get('f-lastName'),
    dob:              get('f-dob'),
    gender,
    status,
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
  _viewStudent(id);
}

function _viewStudent(id) {
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
        <div class="view-item"><div class="view-label">Status</div><span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:0.78rem;font-weight:600;background:${(s.status||'Active')==='Active'?'rgba(16,185,129,0.12)':'rgba(239,68,68,0.12)'};color:${(s.status||'Active')==='Active'?'#059669':'#dc2626'}">${esc(s.status||'Active')}</span></div>
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

async function setStudentStatus(id, newStatus) {
  const s = students.find(x => x.id === id);
  if (!s) return;
  const updated = { ...s, status: newStatus };
  try {
    const result = await apiPut(id, updated);
    const idx = students.findIndex(x => x.id === id);
    if (idx !== -1) students[idx] = { ...students[idx], status: newStatus };
    applyFilters();
    toast(`${buildFullName(s)} marked as ${newStatus}.`, newStatus === 'Active' ? 'success' : 'info');
  } catch (e) {
    toast('Failed to update status.', 'error');
    applyFilters(); // re-render to revert the select visually
  }
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

    // Resize image to max 2400 px wide and convert to JPEG base64
    const { base64, mimeType } = await _imageToBase64Jpeg(_currentImgFile, imgEl, 2400);

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
      const preview = result.preview ? '\n\nGemini returned:\n' + result.preview : '';
      throw new Error((result.error || ('Server error ' + response.status)) + preview);
    }

    const parsed = result.students;

    if (result.truncated) {
      toast(`⚠️ Response was cut off — ${parsed.length} students recovered. Scroll down to verify all rows.`, 'warning');
    }

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
        // Grade: normalise "7" → "Grade 7", "Grade 7" stays, "" stays ""
        let grade = (s.grade || '').toString().trim();
        if (grade && !/^grade\s/i.test(grade)) grade = 'Grade ' + grade;
        else if (grade) grade = grade.replace(/^grade\s+/i, 'Grade ');
        // Section: title-case the section name from the header
        const section = _toTitleCase((s.section || '').toString().trim());
        return { lastName, firstName, middleName, studentId, gender,
                 grade, section, dob: '', selected: true };
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

// ── Validation warning modal for missing required fields ─────────────
function _showImportValidationWarning(incomplete) {
  // Remove any previous instance
  const old = document.getElementById('importValidationOverlay');
  if (old) old.remove();

  const rows = incomplete.map(({ s, missing }) => {
    const name = [s.firstName, s.lastName].filter(Boolean).join(' ') || '(No name)';
    const badges = missing.map(f => {
      const label = f === 'studentId' ? 'LRN / ID' : f === 'grade' ? 'Grade Level' : f === 'section' ? 'Section' : f;
      return `<span style="
        display:inline-block;background:rgba(239,68,68,0.12);color:#dc2626;
        border:1px solid rgba(239,68,68,0.3);border-radius:5px;
        font-size:0.72rem;font-weight:700;padding:1px 7px;margin-left:4px;letter-spacing:0.02em
      ">${label}</span>`;
    }).join('');
    return `<li style="
      display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;
      padding:8px 0;border-bottom:1px solid var(--bg-input,#f1f5f9)
    ">
      <span style="font-size:0.85rem;color:var(--text-primary,#1e293b);font-weight:500">${esc(name)}</span>
      <span>${badges}</span>
    </li>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = 'importValidationOverlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);
    display:flex;align-items:center;justify-content:center;padding:16px;
    animation:fadeIn 150ms ease
  `;

  overlay.innerHTML = `
    <div style="
      background:var(--bg-card,#fff);border-radius:16px;width:100%;max-width:520px;
      box-shadow:0 20px 60px rgba(0,0,0,0.25);overflow:hidden;
      animation:slideUp 200ms cubic-bezier(0.34,1.56,0.64,1)
    ">
      <!-- Header -->
      <div style="
        display:flex;align-items:center;gap:12px;
        padding:20px 24px 16px;border-bottom:1px solid var(--bg-input,#f1f5f9)
      ">
        <div style="
          width:40px;height:40px;border-radius:10px;flex-shrink:0;
          background:rgba(245,158,11,0.12);display:flex;align-items:center;justify-content:center
        ">
          <svg width="22" height="22" fill="none" stroke="#d97706" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <div>
          <div style="font-size:1rem;font-weight:700;color:var(--text-primary,#1e293b)">
            Required Fields Missing
          </div>
          <div style="font-size:0.8rem;color:var(--text-secondary,#64748b);margin-top:2px">
            ${incomplete.length} student${incomplete.length > 1 ? 's' : ''} ${incomplete.length > 1 ? 'are' : 'is'} missing required information
          </div>
        </div>
      </div>

      <!-- Body -->
      <div style="padding:16px 24px;max-height:280px;overflow-y:auto">
        <p style="font-size:0.82rem;color:var(--text-secondary,#64748b);margin:0 0 10px">
          The following students are missing <strong>LRN / ID</strong>, <strong>Grade Level</strong>, or <strong>Section</strong>.
          Please fill in all required fields before importing.
        </p>
        <ul style="list-style:none;margin:0;padding:0">${rows}</ul>
      </div>

      <!-- Footer — Go Back only, no bypass allowed -->
      <div style="
        display:flex;justify-content:flex-end;
        padding:14px 24px 20px;border-top:1px solid var(--bg-input,#f1f5f9);background:var(--bg-body,#f8fafc)
      ">
        <button onclick="document.getElementById('importValidationOverlay').remove()" style="
          border:1px solid var(--bg-input,#e2e8f0);background:var(--bg-card,#fff);color:var(--text-primary,#1e293b);
          border-radius:8px;padding:8px 20px;font-size:0.85rem;font-weight:600;cursor:pointer
        ">
          ← Go Back &amp; Fix
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  // No backdrop-click dismissal — user must click the button
}

// ── Commit (save to DB) ───────────────────────────────────────────────
async function _commitImport() {
  const toImport = _importStudents.filter(s => s.selected);
  if (!toImport.length) {
    toast('No students selected to import', 'danger'); return;
  }

  // ── Validate required fields ──────────────────────────────────────
  const incomplete = toImport.reduce((acc, s) => {
    const missing = [];
    if (!s.studentId || !String(s.studentId).trim()) missing.push('studentId');
    if (!s.grade     || !String(s.grade).trim())     missing.push('grade');
    if (!s.section   || !String(s.section).trim())   missing.push('section');
    if (missing.length) acc.push({ s, missing });
    return acc;
  }, []);

  if (incomplete.length > 0) {
    _showImportValidationWarning(incomplete);
    return;
  }

  // No issues — proceed directly
  await _runImport(toImport);
}

// ── Shared import executor ────────────────────────────────────────────
async function _runImport(toImport) {
  if (!toImport.length) {
    toast('No valid students to import after filtering', 'danger'); return;
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