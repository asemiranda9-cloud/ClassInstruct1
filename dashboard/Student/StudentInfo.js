// ════════════════════════════════════════════════════
//  StudentInfo.js — ClassInstruct Student Info Page
// ════════════════════════════════════════════════════
'use strict';

const API = '../api/db.php';

const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT   = ['S','M','T','W','T','F','S'];

// ── Calendar state ─────────────────────────────────
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();
let studentAttendance = {}; // dateStr → status

// ════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadStudent();
});

// ════════════════════════════════════════════════════
//  LOAD STUDENT
// ════════════════════════════════════════════════════
async function loadStudent() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');

  if (!id) {
    showError('No student ID provided. Please go back and select a student.');
    return;
  }

  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error('API responded with ' + res.status);
    const students = await res.json();
    const s = students.find(x => String(x.id) === String(id));
    if (!s) {
      showError('Student not found. They may have been deleted.');
      return;
    }
    renderPage(s);
  } catch (err) {
    showError('Could not load student data. Is XAMPP running?\n' + err.message);
  }
}

// ════════════════════════════════════════════════════
//  RENDER PAGE
// ════════════════════════════════════════════════════
function renderPage(s) {
  // Update page title + breadcrumb
  const name = s.fullName || s.full_name || '—';
  document.title = name + ' — ClassInstruct';
  const bc = document.getElementById('breadcrumbName');
  if (bc) bc.textContent = name;

  // ── LEFT COLUMN ──
  renderProfileCard(s);
  renderGuardianCard(s);
  // Documents are static; they render from HTML

  // ── MIDDLE COLUMN ──
  // Attendance calendar (static demo until attendance API is wired per-student)
  renderCalendar();

  // ── RIGHT COLUMN ──
  renderAcademicCard(s);

  // Show page, hide loading
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('pageContent').style.display  = 'flex';
}

// ════════════════════════════════════════════════════
//  PROFILE CARD
// ════════════════════════════════════════════════════
function renderProfileCard(s) {
  const name    = s.fullName || s.full_name || '—';
  const lrn     = s.studentId || s.student_id || '—';
  const gender  = s.gender || '—';
  const dob     = s.dob ? formatDate(s.dob) : '—';
  const phone   = s.phone || '—';
  const address = s.address || '—';
  const section = s.section || '—';
  const grade   = s.grade   || '—';

  // Avatar: initials
  const initials = name.split(' ').map(w => w[0] || '').slice(0,2).join('').toUpperCase();
  const avatarEl = document.getElementById('studentAvatar');
  if (avatarEl) avatarEl.textContent = initials;

  setText('studentName',    name);
  setText('studentLrn',     lrn);
  setText('studentSection', grade + ' · ' + section);

  // Quick info rows
  setText('infoGender',  gender);
  setText('infoDob',     dob);
  setText('infoPhone',   phone);
  setText('infoAddress', address);
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
//  ACADEMIC CARD
// ════════════════════════════════════════════════════
function renderAcademicCard(s) {
  // For now we render static demo bars
  // When you have a grades API, fetch here and update bar heights + gauge
  // Nothing to pull from the student record for grades yet
}

// ════════════════════════════════════════════════════
//  ATTENDANCE CALENDAR
// ════════════════════════════════════════════════════
function renderCalendar() {
  const label = document.getElementById('calMonthLabel');
  if (label) label.textContent = MONTHS_LONG[calMonth] + ' ' + calYear;

  const grid = document.getElementById('calGrid');
  if (!grid) return;

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDow    = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const today       = new Date();
  const todayStr    = toYMD(today);

  let html = '';

  // Build weeks
  let dayCount = 1;
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;

  for (let week = 0; week < totalCells / 7; week++) {
    html += '<div class="cal-week">';
    for (let dow = 0; dow < 7; dow++) {
      const cellIndex = week * 7 + dow;
      html += '<div class="cal-cell">';
      if (cellIndex >= firstDow && dayCount <= daysInMonth) {
        const day     = dayCount;
        const dateStr = toYMD(new Date(calYear, calMonth, day));
        const status  = studentAttendance[dateStr];
        const isToday = dateStr === todayStr;

        let cls = 'cal-num';
        if (status === 'present') cls += ' present';
        else if (status === 'late')    cls += ' late';
        else if (status === 'absent')  cls += ' absent';
        else if (status === 'excused') cls += ' excused';
        if (isToday && !status) cls += ' today';

        html += `<div class="${cls}">${day}</div>`;
        dayCount++;
      } else if (cellIndex < firstDow) {
        // prev month grey
        const prevDay = new Date(calYear, calMonth, 1 - (firstDow - cellIndex));
        html += `<div class="cal-num muted">${prevDay.getDate()}</div>`;
      } else {
        // next month grey
        const nextDay = dayCount - daysInMonth;
        html += `<div class="cal-num muted">${nextDay}</div>`;
        dayCount++;
      }
      html += '</div>';
    }
    html += '</div>';
  }

  grid.innerHTML = html;
  updateAttSummary();
}

function updateAttSummary() {
  const counts = { present: 0, late: 0, excused: 0, absent: 0 };
  Object.values(studentAttendance).forEach(s => { if (counts[s] !== undefined) counts[s]++; });
  setText('attPresent', counts.present);
  setText('attLate',    counts.late);
  setText('attExcused', counts.excused);
  setText('attAbsent',  counts.absent);
}

function shiftCalMonth(delta) {
  calMonth += delta;
  if (calMonth > 11) { calMonth = 0;  calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendar();
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
//  HELPERS
// ════════════════════════════════════════════════════
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '—';
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
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}