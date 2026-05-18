// ════════════════════════════════════════════════
//  SIDEBAR NAVIGATION (called from dashboard links)
//  dashboard.php lives INSIDE the sidebar's iframe.
//  To navigate without losing the sidebar, we tell
//  the parent (sidebar.html) to call its own navTo().
// ════════════════════════════════════════════════
function sidebarNav(url) {
  if (window.parent && window.parent !== window) {
    // Tell the sidebar to navigate its iframe
    window.parent.postMessage({ type: 'CI_NAV', url: url }, '*');
  } else {
    // Fallback: we ARE the top window (no iframe), just navigate
    window.location.href = url;
  }
}


const ATT_API    = '/dashboard/attendance/attendance_db.php';
const STUD_API   = '/dashboard/api/db.php';
const GRADES_API = '/dashboard/Grades/grades_db.php';   // serves ?action=grades|subjects|gpa_scales|summary|weights
const CAL_KEY    = 'ci_dayEntries';

const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TYPE_ICONS = { holiday:'🌿', event:'📅', meeting:'🤝', note:'📝', exam:'📋', activity:'🎯', quiz:'❓' };

// ════════════════════════════════════════════════
//  PHILIPPINE PUBLIC HOLIDAYS
// ════════════════════════════════════════════════
function getPhHolidays(year) {
  const R = 'regular', S = 'special';
  const fixed = [
    { m:0,  d:1,  name:"New Year's Day",                     type:R },
    { m:1,  d:25, name:"EDSA People Power Revolution",       type:S },
    { m:3,  d:9,  name:"Day of Valor (Araw ng Kagitingan)",  type:R },
    { m:4,  d:1,  name:"Labor Day",                          type:R },
    { m:5,  d:12, name:"Independence Day",                   type:R },
    { m:7,  d:21, name:"Ninoy Aquino Day",                   type:S },
    { m:7,  d:26, name:"National Heroes Day",                type:R },
    { m:10, d:1,  name:"All Saints' Day",                    type:S },
    { m:10, d:2,  name:"All Souls' Day",                     type:S },
    { m:10, d:30, name:"Bonifacio Day",                      type:R },
    { m:11, d:8,  name:"Feast of the Immaculate Conception", type:S },
    { m:11, d:24, name:"Christmas Eve",                      type:S },
    { m:11, d:25, name:"Christmas Day",                      type:R },
    { m:11, d:30, name:"Rizal Day",                          type:R },
    { m:11, d:31, name:"New Year's Eve",                     type:S },
  ];
  // Easter-based holidays
  function easterSunday(y) {
    const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4;
    const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
    const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7;
    const m2=Math.floor((a+11*h+22*l)/451);
    const mo=Math.floor((h+l-7*m2+114)/31)-1;
    const dy=((h+l-7*m2+114)%31)+1;
    return new Date(y,mo,dy);
  }
  const easter=easterSunday(year);
  const holyThu=new Date(easter); holyThu.setDate(easter.getDate()-3);
  const goodFri=new Date(easter); goodFri.setDate(easter.getDate()-2);
  const blackSat=new Date(easter); blackSat.setDate(easter.getDate()-1);
  const movable=[
    { m:holyThu.getMonth(),  d:holyThu.getDate(),  name:"Maundy Thursday", type:R },
    { m:goodFri.getMonth(),  d:goodFri.getDate(),   name:"Good Friday",     type:R },
    { m:blackSat.getMonth(), d:blackSat.getDate(),  name:"Black Saturday",  type:S },
  ];
  // Chinese New Year lookup
  const cny={2024:{m:1,d:10},2025:{m:0,d:29},2026:{m:1,d:17},2027:{m:1,d:6},2028:{m:0,d:26},2029:{m:1,d:13},2030:{m:1,d:3}};
  if (cny[year]) movable.push({ m:cny[year].m, d:cny[year].d, name:"Chinese New Year", type:S });
  // Election days
  const edays={2025:{m:4,d:12},2028:{m:4,d:13}};
  if (edays[year]) movable.push({ m:edays[year].m, d:edays[year].d, name:"National/Local Elections", type:S });
  return [...fixed,...movable].map(h=>({...h,year}));
}

function buildPhHolidayMap(year) {
  const map={};
  getPhHolidays(year).forEach(h=>{
    const key=`${h.year}-${String(h.m+1).padStart(2,'0')}-${String(h.d).padStart(2,'0')}`;
    map[key]=h;
  });
  return map;
}

// Shared student cache
let _allStudents = [];
let _sections    = [];

// ════════════════════════════════════════════════
//  GREETING
// ════════════════════════════════════════════════
async function fetchUserFromDB() {
  const email = sessionStorage.getItem('ci_email');
  try {
    // Try with email from sessionStorage
    const res = await fetch('api/user.php?email=' + encodeURIComponent(email));
    const data = await res.json();
    if (data.success) {
      return data;
    }
  } catch (e) {
    console.error('Failed to fetch user from DB:', e);
  }
  return null;
}

async function renderGreeting() {
  const greetEl = document.getElementById('dashGreeting');
  const subEl   = document.getElementById('dashGreetingSub');
  if (!greetEl) return;

  // ── Time-based salutation ──
  const hour = new Date().getHours();
  let salutation;
  if      (hour >= 5  && hour < 12) salutation = 'Good morning';
  else if (hour >= 12 && hour < 18) salutation = 'Good afternoon';
  else                               salutation = 'Good evening';

  // Try to get user data from database first
  let firstName = '';
  let lastName  = '';
  let gender    = '';

  const dbUser = await fetchUserFromDB();
  if (dbUser) {
    firstName = dbUser.first_name || '';
    lastName  = dbUser.last_name  || '';
    gender    = dbUser.gender     || '';
  }

  // Fallback to sessionStorage if DB failed
  if (!firstName && !lastName) {
    firstName = sessionStorage.getItem('ci_first_name') || '';
    lastName  = sessionStorage.getItem('ci_last_name')  || '';
    gender    = sessionStorage.getItem('ci_gender')     || '';
  }

  // Last fallback: PHP globals
  if (!firstName && !lastName) {
    firstName = window.CI_FIRST_NAME || '';
    lastName  = window.CI_LAST_NAME  || '';
    gender    = window.CI_GENDER     || '';
  }

  // ── Honorific ──
  const title = gender === 'Male' ? 'Sir' : gender === 'Female' ? "Ma'am" : '';

  // ── Compose greeting ──
  if (lastName || firstName) {
    const namePart = title
      ? `${title} ${lastName}${firstName ? ', ' + firstName : ''}`
      : `${lastName}${firstName ? ', ' + firstName : ''}`;
    greetEl.textContent = `${salutation}, ${namePart}!`;
  } else {
    greetEl.textContent = `${salutation}!`;
  }

  // ── Date subtitle ──
  if (subEl) {
    subEl.textContent = new Date().toLocaleDateString('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}

// ════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  renderGreeting();
  initAttMonthFilter();
  renderMiniCalendar();
  renderUpcomingEvents();
  renderRecentActivity();
  await loadStudents();
  loadStudentStatusStats();   // ← computes Active / Passing / At-Risk / Dropouts
  loadAttendanceCal();
  loadSubjectsForPerf();
  loadGradesSectionsForPerf();
  loadPerformanceChart();
});

// Re-render when another page logs an activity (cross-iframe postMessage)
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'CI_ACTIVITY_UPDATE') {
    renderRecentActivity();
  }
  // Grades page fired after saving — refresh performance chart so dashboard stays in sync
  if (e.data && e.data.type === 'CI_GRADES_UPDATED') {
    loadPerformanceChart();
  }
});

// Also re-render when tab regains focus (user switched pages then came back)
window.addEventListener('focus', renderRecentActivity);
// visibilitychange fires correctly inside an iframe when the user returns to the dashboard
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) renderRecentActivity();
});

// ════════════════════════════════════════════════
//  RECENT ACTIVITY
// ════════════════════════════════════════════════
//  ACTIVITY DETAIL POPUP (dashboard)
// ════════════════════════════════════════════════
const DASH_ROUTE_MAP = {
  attendance_saved:   'attendance/attendance.html',
  attendance_present: 'attendance/attendance.html',
  attendance_late:    'attendance/attendance.html',
  attendance_absent:  'attendance/attendance.html',
  student_added:      'Student/Student.html',
  student_updated:    'Student/Student.html',
  student_deleted:    'Student/Student.html',
  student_imported:   'Student/Student.html',
  grades_saved:       'Grades/Grades.php',
  ai_chat:            'ai/classinstruct-ai.html',
  lesson_plan:        'ai/classinstruct-ai.html',
  quiz_generated:     'ai/classinstruct-ai.html',
  calendar_entry:     'Calendar/calendarPAGE.html',
};

function showActivityModal(entry) {
  // Remove any existing modal
  const existing = document.getElementById('ciActModal');
  if (existing) existing.remove();

  const hasRoute = !!DASH_ROUTE_MAP[entry.type];

  // Format the timestamp into a readable date/time
  const dateStr = new Date(entry.ts).toLocaleString('en-PH', {
    weekday: 'short', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const overlay = document.createElement('div');
  overlay.id = 'ciActModal';
  overlay.style.cssText = [
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99999',
    'display:flex;align-items:center;justify-content:center',
    'animation:ciActFadeIn 0.15s ease',
    'font-family:inherit'
  ].join(';');

  overlay.innerHTML = `
    <style>
      @keyframes ciActFadeIn  { from { opacity:0 } to { opacity:1 } }
      @keyframes ciActSlideUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
    </style>
    <div style="
      background:var(--card-bg,#fff);
      border:0.5px solid var(--card-border,#e5e7eb);
      border-radius:20px;
      padding:28px 28px 24px;
      width:360px;max-width:92vw;
      box-shadow:0 24px 64px rgba(0,0,0,0.22);
      animation:ciActSlideUp 0.18s ease;
      text-align:center;
    ">
      <!-- Icon -->
      <div style="
        width:58px;height:58px;border-radius:50%;
        background:${esc(entry.gradient)};
        display:flex;align-items:center;justify-content:center;
        font-size:22px;margin:0 auto 16px;
        box-shadow:0 4px 16px rgba(0,0,0,0.15);
      ">${esc(entry.icon)}</div>

      <!-- Title -->
      <div style="font-size:1rem;font-weight:700;color:var(--text-primary,#111);margin-bottom:6px;line-height:1.3">${esc(entry.title)}</div>

      <!-- Detail -->
      <div style="font-size:.82rem;color:var(--text-muted,#6b7280);line-height:1.5;margin-bottom:14px">${esc(entry.detail) || 'No additional details.'}</div>

      <!-- Timestamp badge -->
      <div style="
        display:inline-block;
        font-size:.7rem;font-weight:600;
        color:var(--text-muted,#6b7280);
        background:var(--input-bg,#f3f4f6);
        border:0.5px solid var(--input-border,#e5e7eb);
        border-radius:9999px;padding:4px 12px;margin-bottom:22px;
      ">🕐 ${esc(dateStr)}</div>

      <!-- Buttons -->
      <div style="display:flex;gap:10px;">
        <button id="ciActClose" style="
          flex:1;padding:11px;
          background:var(--input-bg,#f3f4f6);
          border:0.5px solid var(--input-border,#e5e7eb);
          border-radius:10px;font-size:.82rem;font-weight:600;
          color:var(--text-secondary,#374151);cursor:pointer;
          font-family:inherit;transition:all 0.15s;
        ">Close</button>
        ${hasRoute ? `<button id="ciActView" style="
          flex:1;padding:11px;
          background:linear-gradient(135deg,#6c63ff,#a78bfa);
          border:none;border-radius:10px;font-size:.82rem;font-weight:600;
          color:#fff;cursor:pointer;font-family:inherit;
          box-shadow:0 4px 14px rgba(108,99,255,0.35);transition:opacity 0.15s;
        ">View Module</button>` : ''}
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Close handlers
  function closeModal() { overlay.remove(); }
  document.getElementById('ciActClose').onclick = closeModal;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // View handler
  if (hasRoute) {
    document.getElementById('ciActView').onclick = function() {
      closeModal();
      sidebarNav(DASH_ROUTE_MAP[entry.type]);
    };
  }
}

// ════════════════════════════════════════════════
function renderRecentActivity() {
  const el = document.getElementById('recentActivity');
  if (!el) return;

  // Guard: if activity_log.js hasn't loaded yet, retry in 100ms
  if (typeof window.CILog === 'undefined') {
    setTimeout(renderRecentActivity, 100);
    return;
  }

  const entries = window.CILog.get(5);

  if (!entries.length) {
    el.innerHTML = `<div style="color:var(--text-3);font-size:13px;text-align:center;padding:20px 0">
      No activity yet. Changes you make will appear here.
    </div>`;
    return;
  }

  // Store entries on window so inline onclick can reference them
  window._ciDashEntries = entries;

  el.innerHTML = entries.map((e, i) => `
    <div onclick="showActivityModal(window._ciDashEntries[${i}])" style="
      display:flex;align-items:center;gap:12px;padding:10px;
      background:var(--bg-input);border-radius:var(--r-md);
      cursor:pointer;transition:box-shadow 0.15s,transform 0.15s,background 0.15s;
    "
    onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.10)';this.style.transform='translateY(-1px)';this.style.background='var(--primary-light,rgba(108,99,255,0.07))'"
    onmouseout="this.style.boxShadow='';this.style.transform='';this.style.background='var(--bg-input)'">
      <div style="width:36px;height:36px;border-radius:50%;background:${esc(e.gradient)};display:flex;align-items:center;justify-content:center;color:white;font-size:14px;flex-shrink:0">${e.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.85rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.title)}</div>
        <div style="font-size:.72rem;color:var(--text-3)">${esc(e.detail)}</div>
      </div>
      <span style="font-size:.68rem;color:var(--text-3);white-space:nowrap">${esc(e.relTime)}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  `).join('');
}

// ════════════════════════════════════════════════
//  STUDENTS — loads all, drives enrolled + gender + recent
// ════════════════════════════════════════════════
async function loadStudents() {
  try {
    const res = await fetch(STUD_API, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    _allStudents = await res.json();
  } catch (e) {
    console.warn('Students API error:', e.message);
    _allStudents = [];
  }

  // Build sections list
  const seen = new Set();
  _sections = [];
  _allStudents.forEach(s => {
    const k = `${s.grade}||${s.section}`;
    if (!seen.has(k)) { seen.add(k); _sections.push({ grade: s.grade, section: s.section, name: `${s.grade} – ${s.section}` }); }
  });
  _sections.sort((a,b) => a.name.localeCompare(b.name));

  // Populate dropdowns
  populateDropdown('genderSectionFilter');
  populateDropdown('attSectionFilter');

  // Enrolled card
  setEl('enrolledCount', _allStudents.length);
  setEl('enrolledSub',   `${_sections.length} section${_sections.length !== 1 ? 's' : ''}`);

  // Charts
  renderGenderChart(_allStudents);
  renderRecentStudents([..._allStudents].slice(-5).reverse());

  // Hero banner stats — Total Students & Sections
  setEl('heroTotalStudents', _allStudents.length || '—');
  setEl('heroSections', _sections.length || '—');

  // Hero banner — Avg Attendance from attendance summary API
  try {
    const attRes = await fetch(ATT_API + '?action=summary', { credentials: 'same-origin' });
    if (attRes.ok) {
      const attData = await attRes.json();
      const pct = attData.overall ? attData.overall.present_pct : null;
      setEl('heroAvgAtt', pct !== null ? pct + '%' : '—');
    }
  } catch(e) { /* leave as — */ }

  // Hero banner — Passing Rate from grades API
  // NOTE: heroPassRate is also updated by loadPerformanceChart() once the full
  //       grade distribution is known; this is just an early rough estimate.
  try {
    const gradeRes = await fetch(GRADES_API + '?action=grades&quarter=Q1', { credentials: 'same-origin' });
    if (gradeRes.ok) {
      const gradeData = await gradeRes.json();
      const grades = (Array.isArray(gradeData) ? gradeData : [])
        .filter(r => r.written_works !== null || r.performance_tasks !== null || r.quarterly_assessment !== null)
        .map(r => {
          const ww = r.written_works        !== null ? parseFloat(r.written_works)        : 0;
          const pt = r.performance_tasks    !== null ? parseFloat(r.performance_tasks)    : 0;
          const qa = r.quarterly_assessment !== null ? parseFloat(r.quarterly_assessment) : 0;
          return Math.round((ww * 0.30 + pt * 0.50 + qa * 0.20) * 100) / 100;
        })
        .filter(g => !isNaN(g) && g > 0);
      if (grades.length > 0) {
        const passing  = grades.filter(g => g >= 75).length;
        const passRate = Math.round((passing / grades.length) * 100);
        setEl('heroPassRate', passRate + '%');
      }
    }
  } catch(e) { /* leave as — */ }
}

// ════════════════════════════════════════════════
//  STUDENT STATUS HERO STATS
//  Computes: Active · Passing · At-Risk · Dropouts
//
//  DATA SOURCES NEEDED
//  ─────────────────────────────────────────────
//  1. _allStudents  (already loaded by loadStudents())
//     FROM: /dashboard/api/db.php  (STUD_API)
//     FIELDS EXPECTED ON EACH STUDENT RECORD:
//       • status  — string: 'active' | 'inactive' | 'dropout' | 'transferred'
//                   If your student table uses a different column name
//                   (e.g. enrollment_status, is_active) update the filter
//                   expressions inside _computeStudentCounts() below.
//
//  2. grades summary
//     FROM: /dashboard/Grades/grades_db.php  (GRADES_API)
//     ACTION: ?action=grades&quarter=Q1  (already used by loadStudents)
//     FIELDS:  written_works, performance_tasks, quarterly_assessment
//     Used to determine per-student computed average → Passing (≥75) vs At-Risk (<75)
//
//  HOW TO ADD DROPOUT / STATUS DATA (if not yet in your DB):
//  • Add a `status` column to your students table
//      ALTER TABLE students ADD COLUMN status VARCHAR(20) DEFAULT 'active';
//  • Expose it through db.php (it will appear in _allStudents automatically)
//  • Values: 'active', 'dropout', 'inactive', 'transferred'
// ════════════════════════════════════════════════
async function loadStudentStatusStats() {
  // ── Step 1: Status counts from _allStudents ──
  // Adjust field name / values to match YOUR database schema:
  const statusField = 'status';   // ← change if your column is named differently
  const activeStatuses  = ['active', 'enrolled'];   // ← values that mean "active"
  const dropoutStatuses = ['dropout', 'dropped', 'inactive', 'transferred']; // ← dropout

  const total    = _allStudents.length;
  const dropouts = _allStudents.filter(s => dropoutStatuses.includes((s[statusField] || '').toLowerCase())).length;
  const active   = _allStudents.filter(s => activeStatuses.includes((s[statusField]  || 'active').toLowerCase())).length;
  // If your student records don't have a status field yet, fall back: treat all as active
  const activeCount  = active  || (total - dropouts);
  const dropoutCount = dropouts;

  setEl('heroActiveStudents', activeCount  || '—');
  setEl('heroDropouts',       dropoutCount || '0');
  if (dropoutCount > 0 && total > 0) {
    setEl('heroDropoutChange', Math.round((dropoutCount / total) * 100) + '% of total');
  }

  // ── Step 2: Passing & At-Risk from grades API ──
  // Reuses the same GRADES_API call already made in loadStudents() —
  // this is a second call so we keep the two concerns independent and
  // the hero cards update even if the performance chart hasn't loaded yet.
  try {
    const params = new URLSearchParams({ action: 'grades', quarter: 'Q1' });
    const res    = await fetch(GRADES_API + '?' + params, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return;

    // Build per-student average: group grade rows by student_id
    // EXPECTED FIELDS on each grade row:
    //   student_id, written_works, performance_tasks, quarterly_assessment
    const studentMap = {};
    rows.forEach(r => {
      const sid = r.student_id;
      if (!sid) return;
      const ww  = r.written_works        !== null ? parseFloat(r.written_works)        : null;
      const pt  = r.performance_tasks    !== null ? parseFloat(r.performance_tasks)    : null;
      const qa  = r.quarterly_assessment !== null ? parseFloat(r.quarterly_assessment) : null;
      if (ww === null && pt === null && qa === null) return;
      const avg = Math.round(((ww||0)*0.30 + (pt||0)*0.50 + (qa||0)*0.20) * 100) / 100;
      if (!studentMap[sid] || studentMap[sid] < avg) studentMap[sid] = avg;
    });

    const graded   = Object.values(studentMap);
    const passing  = graded.filter(g => g >= 75).length;
    const atRisk   = graded.filter(g => g > 0 && g < 75).length;

    setEl('heroPassingCount', passing || '—');
    setEl('heroAtRisk',       atRisk  || '0');

    if (graded.length > 0) {
      setEl('heroPassingChange', Math.round((passing / graded.length) * 100) + '% of graded');
      if (atRisk > 0) {
        setEl('heroAtRiskChange', atRisk + ' student' + (atRisk !== 1 ? 's' : '') + ' below 75');
      }
    }
  } catch(e) {
    console.warn('Status stats grades fetch error:', e.message);
  }
}

function populateDropdown(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  _sections.forEach(s => {
    const o = document.createElement('option');
    o.value = `${s.grade}||${s.section}`;
    o.textContent = s.name;
    sel.appendChild(o);
  });
}

// ── 2. Gender by section ──
function updateGenderBySection() {
  const val = document.getElementById('genderSectionFilter').value;
  const sub = val
    ? (() => { const [g,s] = val.split('||'); return _allStudents.filter(x => x.grade===g && x.section===s); })()
    : _allStudents;
  renderGenderChart(sub);
}

function renderGenderChart(students) {
  const total   = students.length;
  const males   = students.filter(s => s.gender === 'Male').length;
  const females = total - males;
  const mp = total > 0 ? Math.round((males/total)*100) : 0;
  const fp = total > 0 ? 100 - mp : 0;

  const pie = document.getElementById('genderPie');
  if (pie) pie.style.background = `conic-gradient(#4f46e5 0% ${mp}%, #ec4899 ${mp}% 100%)`;

  setEl('genderTotal', total);
  setEl('boysCount',   males);
  setEl('girlsCount',  females);
  setEl('boysPct',     mp + '%');
  setEl('girlsPct',    fp + '%');
}

function renderRecentStudents(students) {
  const c = document.getElementById('recentStudents');
  if (!c) return;
  if (!students.length) {
    c.innerHTML = '<div style="color:var(--text-3);font-size:13px;text-align:center;padding:20px 0">No students found.</div>';
    return;
  }
  const colors = ['#6366f1','#10b981','#f59e0b','#8b5cf6','#ec4899'];
  c.innerHTML = students.map((s, i) => {
    const name = s.full_name || s.fullName || '?';
    const ini  = name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
    const col  = colors[i % colors.length];
    return `<div class="recent-student-item">
      <div style="width:34px;height:34px;border-radius:50%;background:${col}22;color:${col};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0">${ini}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
        <div style="font-size:11px;color:#64748b">${esc(s.grade||'')} · ${esc(s.section||'')}</div>
      </div>
      <span style="font-size:11px;color:#94a3b8;white-space:nowrap">${esc(s.gender||'')}</span>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════
//  1. ATTENDANCE CALENDAR
// ════════════════════════════════════════════════
function initAttMonthFilter() {
  const sel = document.getElementById('attMonthFilter');
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const o = document.createElement('option');
    o.value = `${d.getFullYear()}-${d.getMonth()+1}`;
    o.textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (i === 0) o.selected = true;
    sel.appendChild(o);
  }
}

async function loadAttendanceCal() {
  const grid     = document.getElementById('attCalGrid');
  const monthVal = document.getElementById('attMonthFilter').value;
  const secVal   = document.getElementById('attSectionFilter').value;
  const [year, month] = monthVal.split('-').map(Number);
  let grade = '', section = '';
  if (secVal) [grade, section] = secVal.split('||');

  // Clear day cells (keep weekday headers)
  const headers = Array.from(grid.querySelectorAll('.att-cal-weekday'));
  grid.innerHTML = '';
  headers.forEach(h => grid.appendChild(h));

  try {
    const url = `${ATT_API}?action=attendance&grade=${encodeURIComponent(grade)}&section=${encodeURIComponent(section)}&year=${year}&month=${month}`;
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    buildAttCalGrid(data, year, month, grid);
  } catch(e) {
    console.warn('Attendance API error:', e.message);
    buildAttCalGridEmpty(year, month, grid);
  }
}

function buildAttCalGrid(data, year, month, grid) {
  const students      = data.students || [];
  const totalStudents = students.length;

  // Build per-date tallies (always — even with 0 students so the grid still renders)
  const dayMap = {};
  let totP=0, totL=0, totA=0;
  students.forEach(s => {
    Object.entries(s.statuses || {}).forEach(([date, status]) => {
      if (!dayMap[date]) dayMap[date] = { present:0, late:0, absent:0 };
      dayMap[date][status]++;
      if (status==='present') totP++;
      else if (status==='late') totL++;
      else totA++;
    });
  });

  const totalRec = totP + totL + totA;
  const avg = totalRec > 0 ? Math.round(((totP+totL)/totalRec)*100) : 0;
  setAttStats(totP, totL, totA, avg);

  // Always render day cells — if no students, all show as no-data
  appendDayCells(grid, year, month, (day, dateStr, dow) => {
    const rec = dayMap[dateStr];
    const isWeekend = dow === 0 || dow === 6;

    if (isWeekend) {
      // Weekend WITH attendance data → show heatmap color at reduced opacity
      if (rec && totalStudents > 0) {
        const attended = rec.present + rec.late;
        const pct = Math.round((attended / totalStudents) * 100);
        const bg  = pctToColor(pct);
        const fg  = pct >= 45 ? '#fff' : '#1e293b';
        const tip = `${dateStr} (Weekend)\nPresent: ${rec.present}  Late: ${rec.late}  Absent: ${rec.absent}\nRate: ${pct}%`;
        return {
          cls:   'weekend-data',
          style: `background:${bg};color:${fg};opacity:0.78`,
          html:  `<span class="day-num">${day}</span><span class="day-pct">${pct}%</span>`,
          title: tip
        };
      }
      // Weekend with no data → styled weekend rest day
      return { cls: 'weekend', html: `<span class="day-num">${day}</span>` };
    }

    if (!totalStudents || !rec) {
      return { cls: 'no-data', html: `<span class="day-num">${day}</span>` };
    }
    const attended = rec.present + rec.late;
    const pct = Math.round((attended / totalStudents) * 100);
    const bg  = pctToColor(pct);
    const fg  = pct >= 45 ? '#fff' : '#1e293b';
    const tip = `${dateStr}\nPresent: ${rec.present}  Late: ${rec.late}  Absent: ${rec.absent}\nRate: ${pct}%`;
    return {
      style: `background:${bg};color:${fg}`,
      html:  `<span class="day-num">${day}</span><span class="day-pct">${pct}%</span>`,
      title: tip
    };
  });
}

function buildAttCalGridEmpty(year, month, grid) {
  appendDayCells(grid, year, month, (day, dateStr, dow) => {
    if (dow === 0 || dow === 6) return { cls: 'weekend', html: `<span class="day-num">${day}</span>` };
    return { cls: 'no-data', html: `<span class="day-num">${day}</span>` };
  });
  setAttStats(0, 0, 0, 0);
}

// Generic: renders empty + day cells into grid using a callback per day
function appendDayCells(grid, year, month, cb) {
  const firstDow    = new Date(year, month-1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today       = new Date();
  const isThisMonth = today.getFullYear()===year && today.getMonth()+1===month;

  // Leading empty cells
  for (let i=0; i<firstDow; i++) { const e=div('att-cal-day empty'); grid.appendChild(e); }

  // Day cells
  for (let day=1; day<=daysInMonth; day++) {
    const dow     = new Date(year, month-1, day).getDay();
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const info    = cb(day, dateStr, dow);

    const cell = div('att-cal-day ' + (info.cls||''));
    if (info.style) cell.style.cssText = info.style;
    if (info.title) cell.title = info.title;
    cell.innerHTML = info.html || `<span class="day-num">${day}</span>`;
    if (isThisMonth && day===today.getDate()) cell.classList.add('today-ring');
    grid.appendChild(cell);
  }

  // Trailing empty cells
  const total = firstDow + daysInMonth;
  const rem   = total%7===0 ? 0 : 7-(total%7);
  for (let i=0; i<rem; i++) { const e=div('att-cal-day empty'); grid.appendChild(e); }
}

function appendGridMsg(grid, msg) {
  const m = document.createElement('div');
  m.style.cssText = 'grid-column:span 7;text-align:center;padding:24px;color:var(--text-3);font-size:.85rem';
  m.textContent = msg;
  grid.appendChild(m);
}

// Color scale: red → orange → green
function pctToColor(pct) {
  if (pct >= 80) return lerp('#34d399','#10b981',(pct-80)/20);
  if (pct >= 60) return lerp('#f59e0b','#34d399',(pct-60)/20);
  return lerp('#ef4444','#f59e0b', pct/60);
}
function lerp(a, b, t) {
  const ah=parseInt(a.slice(1),16), bh=parseInt(b.slice(1),16);
  const r=Math.round(((ah>>16)&255)+(((bh>>16)&255)-((ah>>16)&255))*t);
  const g=Math.round(((ah>>8)&255)+(((bh>>8)&255)-((ah>>8)&255))*t);
  const bl=Math.round((ah&255)+((bh&255)-(ah&255))*t);
  return '#'+[r,g,bl].map(x=>x.toString(16).padStart(2,'0')).join('');
}

function setAttStats(p, l, a, avg) {
  setEl('attPresent', p);
  setEl('attLate',    l);
  setEl('attAbsent',  a);
  setEl('attAvg',     avg ? avg + '%' : '—');
  setEl('heroAvgAtt', avg ? avg + '%' : '—');
}

// ════════════════════════════════════════════════
//  MINI CALENDAR
// ════════════════════════════════════════════════
const _todayObj = new Date();
let calYear = _todayObj.getFullYear();
let calMon  = _todayObj.getMonth();

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(CAL_KEY) || '{}'); } catch { return {}; }
}

function renderMiniCalendar() {
  const entries    = loadEntries();
  const holidayMap = buildPhHolidayMap(calYear);
  const container  = document.getElementById('miniCalDays');
  const isThisM    = _todayObj.getMonth()===calMon && _todayObj.getFullYear()===calYear;

  setEl('currentMonthDisplay', MONTHS[calMon]);
  setEl('calYearBadge',        calYear);
  container.innerHTML = '';

  const firstDay  = new Date(calYear, calMon, 1).getDay();
  const totalDays = new Date(calYear, calMon+1, 0).getDate();

  for (let i=0; i<firstDay; i++) { const s=span('day empty'); container.appendChild(s); }

  for (let day=1; day<=totalDays; day++) {
    const key   = `${calYear}-${String(calMon+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const de    = entries[key] || [];
    const phHol = holidayMap[key];
    const s     = span('day');

    if (isThisM && day===_todayObj.getDate()) s.classList.add('today');

    // PH holiday styling
    if (phHol) {
      s.classList.add(phHol.type === 'regular' ? 'ph-regular' : 'ph-special');
      s.title = phHol.name + (phHol.type === 'regular' ? ' (Regular Holiday)' : ' (Special Non-Working)');
    }

    if (de.length > 0 || phHol) {
      s.classList.add('has-event');
      const types = [...new Set(de.map(e=>e.type))];
      const phDot = phHol ? `<span class="day-type-dot ph-holiday" title="${esc(phHol.name)}"></span>` : '';
      const userDots = types.map(t=>`<span class="day-type-dot ${t}"></span>`).join('');
      s.innerHTML = `<span>${day}</span><div class="day-type-dots">${phDot}${userDots}</div>`;
    } else {
      s.textContent = day;
    }
    container.appendChild(s);
  }

  const total = firstDay + totalDays;
  const rem   = total%7===0 ? 0 : 7-(total%7);
  for (let i=0; i<rem; i++) { const s=span('day empty'); container.appendChild(s); }

  renderUpcomingEvents();
}

function changeMonth(dir) {
  calMon += dir;
  if (calMon < 0)  { calMon = 11; calYear--; }
  if (calMon > 11) { calMon = 0;  calYear++; }
  renderMiniCalendar();
}

// ════════════════════════════════════════════════
//  UPCOMING EVENTS
// ════════════════════════════════════════════════
function renderUpcomingEvents() {
  const entries   = loadEntries();
  const container = document.getElementById('eventsContent');
  const labelEl   = document.getElementById('eventsMonthLabel');
  if (!container) return;

  const now = new Date(); now.setHours(0,0,0,0);
  const todayStr = toYMD(now);

  // ── Collect user entries ──
  const all = [];
  Object.entries(entries).forEach(([ds, arr]) => {
    (arr||[]).forEach(e => all.push({ ds, date: new Date(ds+'T00:00:00'), e, isPH: false }));
  });

  // ── Collect PH holidays for current year + next year (to catch upcoming ones) ──
  const thisYear = now.getFullYear();
  [thisYear, thisYear+1].forEach(yr => {
    const map = buildPhHolidayMap(yr);
    Object.entries(map).forEach(([ds, hol]) => {
      all.push({
        ds, date: new Date(ds+'T00:00:00'),
        e: { title: hol.name, type: 'ph-holiday', time: '', phType: hol.type },
        isPH: true
      });
    });
  });

  all.sort((a,b) => a.date-b.date || (a.e.time||'').localeCompare(b.e.time||''));

  const future = all.filter(x => x.ds >= todayStr);
  const shown  = future.length > 0 ? future.slice(0,8) : all.slice(-8).reverse();

  if (labelEl) labelEl.textContent = shown.length > 0
    ? `${MON_SHORT[shown[0].date.getMonth()]} ${shown[0].date.getFullYear()}`
    : '';

  if (!shown.length) {
    container.innerHTML = `<div class="no-events-msg"><span>🗓️</span>No upcoming events.<br><a href="Calendar/calendarPAGE.html" style="color:#4f46e5;font-weight:600;text-decoration:none">Add in Calendar →</a></div>`;
    return;
  }

  container.innerHTML = shown.map(({ ds, date, e, isPH }) => {
    const isToday = ds === todayStr;
    const label   = isToday ? 'Today' : `${MON_SHORT[date.getMonth()]} ${date.getDate()}`;

    if (isPH) {
      const typeLabel = e.phType === 'regular' ? 'Regular Hol.' : 'Special Non-Working';
      return `<div class="event-item type-ph-holiday" title="${esc(e.title)}">
        <span class="event-date">${label}</span>
        <span class="event-icon">🇵🇭</span>
        <span class="event-title">${esc(e.title)}</span>
        <span class="event-type-tag ph-tag">${typeLabel}</span>
      </div>`;
    }

    return `<div class="event-item type-${e.type}">
      <span class="event-date">${label}</span>
      <span class="event-icon">${TYPE_ICONS[e.type]||'📌'}</span>
      <span class="event-title">${esc(e.title)}${e.time?' · '+esc(e.time):''}</span>
      <span class="event-type-tag">${cap(e.type)}</span>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════
//  STUDENT PERFORMANCE CHART (from Grades API)
// ════════════════════════════════════════════════

// Descriptor → bar style mapping (matches Grades.js GPA scale labels)
const PERF_TIERS = [
  { key: 'Outstanding',        label: 'Outstanding',      barClass: 'excellent', color: '#10b981' },
  { key: 'Very Satisfactory',  label: 'Very Satisfactory',barClass: 'good',      color: '#4f46e5' },
  { key: 'Satisfactory',       label: 'Satisfactory',     barClass: 'good',      color: '#6366f1' },
  { key: 'Fairly Satisfactory',label: 'Fairly Satisf.',   barClass: 'average',   color: '#f59e0b' },
  { key: 'Did Not Meet',       label: 'Did Not Meet',     barClass: 'poor',      color: '#ef4444' },
];

// GPA scale fallback (mirrors Grades.js default)
const _defaultGpaScales = [
  { min:90,    max:100,   letter:'A',  descriptor:'Outstanding' },
  { min:85,    max:89.99, letter:'B+', descriptor:'Very Satisfactory' },
  { min:80,    max:84.99, letter:'B',  descriptor:'Satisfactory' },
  { min:75,    max:79.99, letter:'C',  descriptor:'Fairly Satisfactory' },
  { min:0,     max:74.99, letter:'F',  descriptor:'Did Not Meet' },
];

function _getDescriptor(grade, scales) {
  const list = (scales && scales.length ? scales : _defaultGpaScales)
    .sort((a,b) => parseFloat(b.max||b.max_grade) - parseFloat(a.max||a.max_grade));
  for (const sc of list) {
    const mn = parseFloat(sc.min || sc.min_grade);
    const mx = parseFloat(sc.max || sc.max_grade);
    if (grade >= mn && grade <= mx) return sc.descriptor || 'Unknown';
  }
  return 'Did Not Meet';
}

async function loadSubjectsForPerf() {
  try {
    const res  = await fetch(GRADES_API + '?action=subjects', { credentials: 'same-origin' });
    const data = await res.json();
    const sel  = document.getElementById('perfSubjectFilter');
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    data.filter(s => parseInt(s.is_active)).forEach(s => {
      const o = document.createElement('option');
      o.value = s.name;
      o.textContent = s.name + (s.code ? ' (' + s.code + ')' : '');
      sel.appendChild(o);
    });
  } catch(e) {
    console.warn('Could not load subjects for performance chart:', e.message);
  }
}

async function loadGradesSectionsForPerf() {
  try {
    const res  = await fetch(STUD_API + '?action=students', { credentials: 'same-origin' });
    const data = await res.json();
    const grades   = [...new Set((data||[]).map(s => s.grade  || s.grade_level || '').filter(Boolean))];
    const sections = [...new Set((data||[]).map(s => s.section || '').filter(Boolean))];
    const gSel = document.getElementById('perfGradeFilter');
    const sSel = document.getElementById('perfSectionFilter');
    if (gSel) {
      while (gSel.options.length > 1) gSel.remove(1);
      const order = ['Kindergarten','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'];
      grades.sort((a,b)=>(order.indexOf(a)===-1?99:order.indexOf(a))-(order.indexOf(b)===-1?99:order.indexOf(b))).forEach(g => {
        const o = document.createElement('option'); o.value = g; o.textContent = g; gSel.appendChild(o);
      });
    }
    if (sSel) {
      while (sSel.options.length > 1) sSel.remove(1);
      sections.sort().forEach(s => {
        const o = document.createElement('option'); o.value = s; o.textContent = s; sSel.appendChild(o);
      });
    }
  } catch(e) { console.warn('Could not load grades/sections:', e.message); }
}

function onPerfGradingTypeChange() {
  const type = (document.getElementById('perfGradingTypeFilter') || {}).value || 'quarterly';
  const qSel = document.getElementById('perfQuarterFilter');
  const pSel = document.getElementById('perfPeriodFilter');
  if (!qSel) return;

  const maps = {
    quarterly: [
      {value:'Q1',label:'Q1 — First Quarter'},{value:'Q2',label:'Q2 — Second Quarter'},
      {value:'Q3',label:'Q3 — Third Quarter'},{value:'Q4',label:'Q4 — Fourth Quarter'},
    ],
    sem2: [
      {value:'Sem1',label:'1st Semester'},{value:'Sem2',label:'2nd Semester'},
    ],
    sem3: [
      {value:'Sem1',label:'1st Semester'},{value:'Sem2',label:'2nd Semester'},{value:'Sem3',label:'3rd Semester'},
    ],
  };

  qSel.innerHTML = '';
  (maps[type] || maps.quarterly).forEach(o => {
    const opt = document.createElement('option'); opt.value = o.value; opt.textContent = o.label; qSel.appendChild(opt);
  });

  // Show/hide period sub-filter depending on type
  if (pSel) {
    if (type === 'sem2' || type === 'sem3') {
      pSel.style.display = '';   // show Prelim/Midterm/Finals
    } else {
      pSel.style.display = 'none'; // hide for quarterly
    }
  }

  loadPerformanceChart();
}

// Called when the semester dropdown changes — just re-runs the chart (period filter stays as-is)
function onPerfSemesterChange() {
  loadPerformanceChart();
}

async function loadPerformanceChart() {
  const barEl  = document.getElementById('perfBarChart');
  const distEl = document.getElementById('perfDistBars');
  const statsEl= document.getElementById('perfStatsRow');
  if (!barEl) return;

  const subject = (document.getElementById('perfSubjectFilter') || {}).value || '';
  const gradingType = (document.getElementById('perfGradingTypeFilter') || {}).value || 'quarterly';
  const semVal  = (document.getElementById('perfQuarterFilter') || {}).value || 'Q1';
  const period  = (document.getElementById('perfPeriodFilter')  || {}).value || '';
  // Build the quarter param: for semester modes combine sem + period (e.g. "Sem1_Prelim")
  const quarter = (gradingType === 'sem2' || gradingType === 'sem3') && period
    ? `${semVal}_${period}`
    : semVal;
  const gradeF  = (document.getElementById('perfGradeFilter')   || {}).value || '';
  const sectionF= (document.getElementById('perfSectionFilter') || {}).value || '';

  barEl.innerHTML  = '<div style="width:100%;display:flex;align-items:center;justify-content:center;height:130px;color:var(--text-3);font-size:.82rem">Loading…</div>';
  if (distEl) distEl.innerHTML = '';
  if (statsEl) statsEl.innerHTML = '';

  let grades = [];
  let gpaScales = [];

  try {
    const gsRes  = await fetch(GRADES_API + '?action=gpa_scales', { credentials: 'same-origin' });
    const gsData = await gsRes.json();
    if (Array.isArray(gsData) && gsData.length) gpaScales = gsData;
  } catch(e) { /* use defaults */ }

  try {
    const params = new URLSearchParams({ action: 'grades', quarter });
    if (subject)  params.append('subject',  subject);
    if (gradeF)   params.append('grade',    gradeF);
    if (sectionF) params.append('section',  sectionF);
    const res  = await fetch(GRADES_API + '?' + params, { credentials: 'same-origin' });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    grades = data
      .filter(r => r.written_works !== null || r.performance_tasks !== null || r.quarterly_assessment !== null)
      .map(r => {
        const ww  = r.written_works        !== null ? parseFloat(r.written_works)        : 0;
        const pt  = r.performance_tasks    !== null ? parseFloat(r.performance_tasks)    : 0;
        const qa  = r.quarterly_assessment !== null ? parseFloat(r.quarterly_assessment) : 0;
        return Math.round((ww * 0.30 + pt * 0.50 + qa * 0.20) * 100) / 100;
      });
  } catch(e) {
    console.warn('Performance chart API error:', e.message);
    _renderPerfEmpty(barEl, distEl, statsEl, 'No grade data yet.');
    return;
  }

  if (!grades.length) {
    _renderPerfEmpty(barEl, distEl, statsEl, subject ? 'No grades recorded for this subject.' : 'No grades recorded yet.');
    return;
  }

  // 3. Build distribution counts per tier
  const tierCounts = PERF_TIERS.map(tier => {
    const count = grades.filter(g => _getDescriptor(g, gpaScales) === tier.key).length;
    return { ...tier, count };
  }).filter(t => t.count > 0 || PERF_TIERS.indexOf(t) < 3);

  // 4. Build letter-grade distribution for bar chart
  const letterMap = {};
  const scaleList = (gpaScales.length ? gpaScales : _defaultGpaScales)
    .sort((a,b) => parseFloat(b.max||b.max_grade) - parseFloat(a.max||a.max_grade));
  grades.forEach(g => {
    for (const sc of scaleList) {
      const mn = parseFloat(sc.min || sc.min_grade);
      const mx = parseFloat(sc.max || sc.max_grade);
      if (g >= mn && g <= mx) {
        const ltr = sc.letter_grade || sc.letter || '?';
        letterMap[ltr] = (letterMap[ltr] || 0) + 1;
        break;
      }
    }
  });

  const letterEntries = Object.entries(letterMap).sort((a,b) => {
    const order = ['A','A+','B+','B','C+','C','D','F'];
    return (order.indexOf(a[0]) === -1 ? 99 : order.indexOf(a[0])) - (order.indexOf(b[0]) === -1 ? 99 : order.indexOf(b[0]));
  });
  const maxCount = Math.max(...letterEntries.map(([,c]) => c), 1);

  // 5. Render bar chart
  const barColors = ['#10b981','#4f46e5','#6366f1','#f59e0b','#ef4444','#8b5cf6'];
  barEl.innerHTML = letterEntries.length
    ? letterEntries.map(([ltr, cnt], i) => {
        const pct   = Math.round((cnt / maxCount) * 100);
        const color = barColors[i % barColors.length];
        const isLow = ltr === 'F' || ltr === 'D';
        return `<div class="bar-item">
          <div class="bar ${isLow ? 'needs-improvement' : ''}" style="height:${Math.max(pct,8)}%;background:linear-gradient(180deg,${color} 0%,${color}aa 100%)">
            <span class="bar-value">${cnt}</span>
          </div>
          <span class="bar-label">${esc(ltr)}</span>
        </div>`;
      }).join('')
    : '<div style="width:100%;text-align:center;padding:40px 0;color:var(--text-3);font-size:.82rem">No data</div>';

  // 6. Render distribution bars
  if (distEl) {
    const allTiers = PERF_TIERS.filter(t => {
      const c = grades.filter(g => _getDescriptor(g, gpaScales) === t.key).length;
      return c > 0;
    });
    const maxTierCount = Math.max(...allTiers.map(t => grades.filter(g => _getDescriptor(g, gpaScales) === t.key).length), 1);

    distEl.innerHTML = PERF_TIERS.map(tier => {
      const count = grades.filter(g => _getDescriptor(g, gpaScales) === tier.key).length;
      const pct   = Math.round((count / grades.length) * 100);
      const width = Math.round((count / maxTierCount) * 100);
      if (!count) return '';
      return `<div class="grade-row">
        <span class="grade-label" style="font-size:.72rem">${tier.label}</span>
        <div class="grade-bar-container">
          <div class="grade-bar ${tier.barClass}" style="width:${Math.max(width,4)}%;background:linear-gradient(90deg,${tier.color},${tier.color}bb)">
            ${pct >= 12 ? pct + '%' : ''}
          </div>
        </div>
        <span style="font-size:.68rem;color:var(--text-3);margin-left:4px;min-width:22px">${pct < 12 ? pct+'%' : ''}</span>
      </div>`;
    }).join('');
  }

  // 7. Summary stats
  if (statsEl) {
    const avg     = (grades.reduce((a,b)=>a+b,0)/grades.length).toFixed(1);
    const passing = grades.filter(g => g >= 75).length;
    const passRate= Math.round((passing/grades.length)*100);
    setEl('heroPassRate', passRate + '%');
    statsEl.innerHTML = `
      <div class="perf-stat"><span class="perf-stat-label">Avg Grade</span><span class="perf-stat-val" style="color:var(--primary)">${avg}</span></div>
      <div class="perf-stat"><span class="perf-stat-label">Graded</span><span class="perf-stat-val">${grades.length}</span></div>
      <div class="perf-stat"><span class="perf-stat-label">Passing</span><span class="perf-stat-val" style="color:var(--green)">${passing}</span></div>
      <div class="perf-stat"><span class="perf-stat-label">Pass Rate</span><span class="perf-stat-val" style="color:var(--green)">${passRate}%</span></div>`;
  }
}

function _renderPerfEmpty(barEl, distEl, statsEl, msg) {
  if (barEl)  barEl.innerHTML  = `<div style="width:100%;display:flex;align-items:center;justify-content:center;height:130px;color:var(--text-3);font-size:.82rem">${msg}</div>`;
  if (distEl) distEl.innerHTML = `<p style="font-size:.78rem;color:var(--text-3);text-align:center;padding:8px 0">${msg}</p>`;
  if (statsEl) statsEl.innerHTML = '';
}

// ════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function cap(s) { return s ? s.charAt(0).toUpperCase()+s.slice(1) : ''; }
function setEl(id, val) { const e=document.getElementById(id); if(e) e.textContent=val; }
function div(cls) { const e=document.createElement('div'); e.className=cls; return e; }
function span(cls) { const e=document.createElement('span'); e.className=cls; return e; }
function toYMD(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }