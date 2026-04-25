'use strict';

// ════════════════════════════════════════════════
//  CONFIG
// ════════════════════════════════════════════════
const ATT_API    = '/dashboard/attendance/attedance_db.php';
const STUD_API   = '/dashboard/api/db.php';
const GRADES_API = '/dashboard/Student/grades_db.php';   // serves ?action=grades|subjects|gpa_scales|summary|weights
const CAL_KEY    = 'ci_dayEntries';

const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TYPE_ICONS = { holiday:'🌿', event:'📅', meeting:'🤝', note:'📝', exam:'📋', activity:'🎯', quiz:'❓' };

// Shared student cache
let _allStudents = [];
let _sections    = [];

// ════════════════════════════════════════════════
//  GREETING
// ════════════════════════════════════════════════
function renderGreeting() {
  const greetEl = document.getElementById('dashGreeting');
  const subEl   = document.getElementById('dashGreetingSub');
  if (!greetEl) return;

  // ── Time-based salutation ──
  const hour = new Date().getHours();
  let salutation;
  if      (hour >= 5  && hour < 12) salutation = 'Good morning';
  else if (hour >= 12 && hour < 18) salutation = 'Good afternoon';
  else                               salutation = 'Good evening';

  // ── User data from sessionStorage (set by signin/register flow) ──
  const firstName = sessionStorage.getItem('ci_first_name') || '';
  const lastName  = sessionStorage.getItem('ci_last_name')  || '';
  const gender    = sessionStorage.getItem('ci_gender')     || '';

  // ── Honorific ──
  const title = gender === 'Male' ? 'Sir' : gender === 'Female' ? "Ma'am" : '';

  // ── Compose greeting — always include name if available ──
  if (lastName || firstName) {
    const namePart = title
      ? `${title} ${lastName}${firstName ? ', ' + firstName : ''}`
      : `${lastName}${firstName ? ', ' + firstName : ''}`;
    greetEl.textContent = `${salutation}, ${namePart}!`;
  } else {
    // Fallback: check if PHP echoed any user data via a global var
    const phpFirst = window.CI_FIRST_NAME || '';
    const phpLast  = window.CI_LAST_NAME  || '';
    const phpGender= window.CI_GENDER     || '';
    if (phpFirst || phpLast) {
      const t2 = phpGender === 'Male' ? 'Sir' : phpGender === 'Female' ? "Ma'am" : '';
      const np = t2
        ? `${t2} ${phpLast}${phpFirst ? ', ' + phpFirst : ''}`
        : `${phpLast}${phpFirst ? ', ' + phpFirst : ''}`;
      greetEl.textContent = `${salutation}, ${np}!`;
    } else {
      greetEl.textContent = `${salutation}!`;
    }
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
  await loadStudents();
  loadAttendanceCal();
  loadSubjectsForPerf();
  loadPerformanceChart();
});

// ════════════════════════════════════════════════
//  STUDENTS — loads all, drives enrolled + gender + recent
// ════════════════════════════════════════════════
async function loadStudents() {
  try {
    const res = await fetch(STUD_API);
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
    const attRes = await fetch(ATT_API + '?action=summary');
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
    const gradeRes = await fetch(GRADES_API + '?action=grades&quarter=Q1');
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
    const res = await fetch(url);
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

  if (!totalStudents) {
    appendGridMsg(grid, 'No students found for this selection.');
    setAttStats(0,0,0,0);
    return;
  }

  // Build per-date tallies
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

  appendDayCells(grid, year, month, (day, dateStr, dow) => {
    const rec = dayMap[dateStr];
    if (dow === 0 || dow === 6) {
      return { cls: 'weekend', html: `<span class="day-num">${day}</span>` };
    }
    if (!rec) {
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
    if (dow===0||dow===6) return { cls:'weekend', html:`<span class="day-num">${day}</span>` };
    return { cls:'no-data', html:`<span class="day-num">${day}</span>` };
  });
  setAttStats(0,0,0,0);
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
  const entries   = loadEntries();
  const container = document.getElementById('miniCalDays');
  const isThisM   = _todayObj.getMonth()===calMon && _todayObj.getFullYear()===calYear;

  setEl('currentMonthDisplay', MONTHS[calMon]);
  setEl('calYearBadge',        calYear);
  container.innerHTML = '';

  const firstDay  = new Date(calYear, calMon, 1).getDay();
  const totalDays = new Date(calYear, calMon+1, 0).getDate();

  for (let i=0; i<firstDay; i++) { const s=span('day empty'); container.appendChild(s); }

  for (let day=1; day<=totalDays; day++) {
    const key = `${calYear}-${String(calMon+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const de  = entries[key] || [];
    const s   = span('day');
    if (isThisM && day===_todayObj.getDate()) s.classList.add('today');
    if (de.length > 0) {
      s.classList.add('has-event');
      const types = [...new Set(de.map(e=>e.type))];
      s.innerHTML = `<span>${day}</span><div class="day-type-dots">${types.map(t=>`<span class="day-type-dot ${t}"></span>`).join('')}</div>`;
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

  // Flatten + sort all entries
  const all = [];
  Object.entries(entries).forEach(([ds, arr]) => {
    (arr||[]).forEach(e => all.push({ ds, date: new Date(ds+'T00:00:00'), e }));
  });
  all.sort((a,b) => a.date-b.date || (a.e.time||'').localeCompare(b.e.time||''));

  const future = all.filter(x => x.ds >= todayStr);
  const shown  = future.length > 0 ? future.slice(0,7) : all.slice(-7).reverse();

  if (labelEl) labelEl.textContent = shown.length > 0
    ? `${MON_SHORT[shown[0].date.getMonth()]} ${shown[0].date.getFullYear()}`
    : '';

  if (!shown.length) {
    container.innerHTML = `<div class="no-events-msg"><span>🗓️</span>No upcoming events.<br><a href="Calendar/calendarPAGE.html" style="color:#4f46e5;font-weight:600;text-decoration:none">Add in Calendar →</a></div>`;
    return;
  }

  container.innerHTML = shown.map(({ ds, date, e }) => {
    const isToday = ds === todayStr;
    const label   = isToday ? 'Today' : `${MON_SHORT[date.getMonth()]} ${date.getDate()}`;
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
    const res  = await fetch(GRADES_API + '?action=subjects');
    const data = await res.json();
    const sel  = document.getElementById('perfSubjectFilter');
    if (!sel) return;
    // remove old options except first "All Subjects"
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

async function loadPerformanceChart() {
  const barEl  = document.getElementById('perfBarChart');
  const distEl = document.getElementById('perfDistBars');
  const statsEl= document.getElementById('perfStatsRow');
  if (!barEl) return;

  const subject = (document.getElementById('perfSubjectFilter') || {}).value || '';
  const quarter = (document.getElementById('perfQuarterFilter') || {}).value || 'Q1';

  barEl.innerHTML  = '<div style="width:100%;display:flex;align-items:center;justify-content:center;height:130px;color:var(--text-3);font-size:.82rem">Loading…</div>';
  if (distEl) distEl.innerHTML = '';
  if (statsEl) statsEl.innerHTML = '';

  let grades = [];
  let gpaScales = [];

  try {
    // 1. Fetch GPA scales
    const gsRes  = await fetch(GRADES_API + '?action=gpa_scales');
    const gsData = await gsRes.json();
    if (Array.isArray(gsData) && gsData.length) gpaScales = gsData;
  } catch(e) { /* use defaults */ }

  try {
    // 2. Fetch grade summary from API
    const params = new URLSearchParams({ action: 'grades', quarter });
    if (subject) params.append('subject', subject);
    const res  = await fetch(GRADES_API + '?' + params);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    // Compute final grades for students that have at least one component
    grades = data
      .filter(r => r.written_works !== null || r.performance_tasks !== null || r.quarterly_assessment !== null)
      .map(r => {
        const ww  = r.written_works        !== null ? parseFloat(r.written_works)        : 0;
        const pt  = r.performance_tasks    !== null ? parseFloat(r.performance_tasks)    : 0;
        const qa  = r.quarterly_assessment !== null ? parseFloat(r.quarterly_assessment) : 0;
        // Use DepEd default weights if not available
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
  }).filter(t => t.count > 0 || PERF_TIERS.indexOf(t) < 3); // always show top 3 tiers

  // 4. Build letter-grade distribution for bar chart (A/B+/B/C/F)
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