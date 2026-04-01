// ════════════════════════════════════════════════
//  SHARED localStorage KEY — same as calendarPAGE
// ════════════════════════════════════════════════
const STORAGE_KEY = 'ci_dayEntries';

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

const typeIcons = {
  holiday:'🌿', event:'📅', meeting:'🤝',
  note:'📝', exam:'📋', activity:'🎯', quiz:'❓'
};

const MONTH_DATA = [
  { name:'January',   days:31, startDay:3 },
  { name:'February',  days:28, startDay:6 },
  { name:'March',     days:31, startDay:6 },
  { name:'April',     days:30, startDay:2 },
  { name:'May',       days:31, startDay:4 },
  { name:'June',      days:30, startDay:0 },
  { name:'July',      days:31, startDay:2 },
  { name:'August',    days:31, startDay:5 },
  { name:'September', days:30, startDay:1 },
  { name:'October',   days:31, startDay:3 },
  { name:'November',  days:30, startDay:6 },
  { name:'December',  days:31, startDay:1 }
];

// Start on current real month
const _now = new Date();
let calYear     = _now.getFullYear();
let calMonthIdx = _now.getMonth();

// ── Render mini calendar ──────────────────────
function renderCalendar() {
  const month   = MONTH_DATA[calMonthIdx];
  const entries = loadEntries();
  const today   = new Date();
  const isThisM = today.getMonth() === calMonthIdx && today.getFullYear() === calYear;

  document.getElementById('currentMonthDisplay').textContent = month.name;
  document.getElementById('calYearBadge').textContent = calYear;

  const container = document.getElementById('monthDays');
  container.innerHTML = '';

  // prev month filler
  for (let i = 0; i < month.startDay; i++) {
    const s = document.createElement('span');
    s.className = 'day empty'; container.appendChild(s);
  }

  // days
  for (let day = 1; day <= month.days; day++) {
    const key = `${calYear}-${String(calMonthIdx+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayEntries = entries[key] || [];

    const s = document.createElement('span');
    s.className = 'day';
    if (isThisM && day === today.getDate()) s.classList.add('today');

    if (dayEntries.length > 0) {
      s.classList.add('has-event');
      // colored type dots
      const uniqueTypes = [...new Set(dayEntries.map(e => e.type))];
      const dotsHtml = uniqueTypes.map(t => `<span class="day-type-dot ${t}"></span>`).join('');
      s.innerHTML = `<span>${day}</span><div class="day-type-dots">${dotsHtml}</div>`;
    } else {
      s.textContent = day;
    }
    container.appendChild(s);
  }

  // next month filler
  const total = month.startDay + month.days;
  const rem   = total > 35 ? 42 - total : 35 - total;
  for (let i = 1; i <= rem; i++) {
    const s = document.createElement('span');
    s.className = 'day empty'; container.appendChild(s);
  }

  renderUpcomingEvents();
}

function changeMonth(dir) {
  calMonthIdx += dir;
  if (calMonthIdx < 0)  { calMonthIdx = 11; calYear--; }
  if (calMonthIdx > 11) { calMonthIdx = 0;  calYear++; }
  renderCalendar();
}

// ── Render Upcoming Events ────────────────────
function renderUpcomingEvents() {
  const entries = loadEntries();
  const prefix  = `${calYear}-${String(calMonthIdx+1).padStart(2,'0')}-`;
  const monthName = MONTH_DATA[calMonthIdx].name;

  // Gather all entries for this month
  const items = [];
  Object.entries(entries).forEach(([k, arr]) => {
    if (!k.startsWith(prefix)) return;
    const day = parseInt(k.split('-')[2]);
    arr.forEach(e => items.push({ day, key: k, ...e }));
  });
  items.sort((a, b) => a.day - b.day);

  const label = document.getElementById('eventsMonthLabel');
  label.textContent = monthName + ' ' + calYear;

  const container = document.getElementById('eventsContent');

  if (items.length === 0) {
    container.innerHTML = `<div class="no-events-msg"><span>🗓️</span>No events in ${monthName}.<br><a href="Calendar/calendarPAGE.html" style="color:#4f46e5;font-weight:600;text-decoration:none">Add in Calendar →</a></div>`;
    return;
  }

  const monthShort = monthName.slice(0, 3);
  container.innerHTML = items.map(e => `
    <div class="event-item type-${e.type}">
      <span class="event-date">${monthShort} ${e.day}</span>
      <span class="event-icon">${typeIcons[e.type] || '📌'}</span>
      <span class="event-title">${escHtml(e.title)}${e.time ? ' · ' + escHtml(e.time) : ''}</span>
      <span class="event-type-tag">${cap(e.type)}</span>
    </div>
  `).join('');
}

// ── Helpers ──────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ════════════════════════════════════════════════
//  ATTENDANCE CHART
// ════════════════════════════════════════════════
const ATTENDANCE_API = 'attendance/attendance_db.php';
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

async function loadAttendanceChart() {
  const chart  = document.getElementById('attendanceBarChart');
  const filter = document.getElementById('attendanceFilter').value;
  const now    = new Date();
  const year   = now.getFullYear();
  const month  = now.getMonth() + 1;

  try {
    const res = await fetch(`${ATTENDANCE_API}?action=attendance&grade=&section=&year=${year}&month=${month}`);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();

    if (!data.students || data.students.length === 0) { renderPlaceholderBars(chart); return; }

    const totalStudents = data.students.length;
    const presentMap = {};
    data.students.forEach(s => {
      Object.entries(s.statuses || {}).forEach(([date, status]) => {
        if (!presentMap[date]) presentMap[date] = 0;
        if (status === 'present' || status === 'late') presentMap[date]++;
      });
    });

    const datesWithData = Object.keys(presentMap).filter(d => {
      const dow = new Date(d + 'T00:00:00').getDay();
      return dow >= 1 && dow <= 5;
    }).sort();

    let days = [];

    if (filter === 'week') {
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const weekDates = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(monday); d.setDate(monday.getDate() + i);
        weekDates.push(d.toISOString().slice(0,10));
      }
      const currentWeekHasData = weekDates.some(d => presentMap[d] !== undefined);
      if (!currentWeekHasData && datesWithData.length > 0) {
        const lastDate = new Date(datesWithData[datesWithData.length-1] + 'T00:00:00');
        const lastDow  = lastDate.getDay();
        const lastMon  = new Date(lastDate);
        lastMon.setDate(lastDate.getDate() - (lastDow === 0 ? 6 : lastDow - 1));
        for (let i = 0; i < 5; i++) {
          const d = new Date(lastMon); d.setDate(lastMon.getDate() + i);
          const key = d.toISOString().slice(0,10);
          const pct = presentMap[key] !== undefined ? Math.round((presentMap[key]/totalStudents)*100) : null;
          days.push({ label: DAY_NAMES[d.getDay()], pct, key });
        }
      } else {
        weekDates.forEach(key => {
          const d = new Date(key+'T00:00:00');
          const pct = presentMap[key] !== undefined ? Math.round((presentMap[key]/totalStudents)*100) : null;
          days.push({ label: DAY_NAMES[d.getDay()], pct, key });
        });
      }
    } else {
      const weeks = {};
      data.dates.forEach(date => {
        const d = new Date(date+'T00:00:00'); const dow = d.getDay();
        if (dow === 0 || dow === 6) return;
        const weekNum = Math.ceil(d.getDate()/7);
        if (!weeks[weekNum]) weeks[weekNum] = { total: 0, count: 0 };
        if (presentMap[date] !== undefined) {
          weeks[weekNum].total += Math.round((presentMap[date]/totalStudents)*100);
          weeks[weekNum].count++;
        }
      });
      const weekLabels = ['Wk 1','Wk 2','Wk 3','Wk 4','Wk 5'];
      Object.entries(weeks).forEach(([wk, v], i) => {
        days.push({ label: weekLabels[i]||`Wk ${wk}`, pct: v.count > 0 ? Math.round(v.total/v.count) : null });
      });
      if (!days.length) days = weekLabels.map(l => ({ label: l, pct: null }));
    }

    chart.innerHTML = days.map(({ label, pct }) => {
      const display  = pct !== null ? pct+'%' : '—';
      const height   = pct !== null ? Math.max(pct, 5) : 20;
      const belowCls = (pct !== null && pct < 75) ? ' below' : '';
      return `<div class="bar-item">
        <div class="bar${belowCls}" style="height:${height}%"><span class="bar-value">${display}</span></div>
        <span class="bar-label">${label}</span>
      </div>`;
    }).join('');
  } catch (err) {
    renderPlaceholderBars(chart);
  }
}

function renderPlaceholderBars(chart) {
  chart.innerHTML = ['Mon','Tue','Wed','Thu','Fri'].map(d => `
    <div class="bar-item">
      <div class="bar" style="height:20%"><span class="bar-value">—</span></div>
      <span class="bar-label">${d}</span>
    </div>`).join('');
}

// ════════════════════════════════════════════════
//  DASHBOARD STATS
// ════════════════════════════════════════════════
const API = 'api/db.php';

async function loadDashboardStats() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error('API error');
    const students = await res.json();

    const total     = students.length;
    const males     = students.filter(s => s.gender === 'Male').length;
    const females   = students.filter(s => s.gender === 'Female').length;
    const malePct   = total > 0 ? Math.round((males/total)*100) : 0;
    const femalePct = total > 0 ? 100 - malePct : 0;

    const countEl = document.getElementById('enrolledCount');
    if (countEl) countEl.textContent = total;

    const pieChart = document.querySelector('.gender-pie-chart');
    if (pieChart) {
      pieChart.style.setProperty('--boys', malePct + '%');
      pieChart.style.setProperty('--girls', femalePct + '%');
    }

    const el = id => document.getElementById(id);
    if (el('genderTotal')) el('genderTotal').textContent = total;
    if (el('boysCount'))   el('boysCount').textContent   = males;
    if (el('girlsCount'))  el('girlsCount').textContent  = females;
    if (el('boysPct'))     el('boysPct').textContent     = malePct + '%';
    if (el('girlsPct'))    el('girlsPct').textContent    = femalePct + '%';

    renderRecentStudents(students.slice(-5).reverse());
  } catch(err) {
    console.warn('Dashboard stats: could not load.', err.message);
  }
}

function renderRecentStudents(students) {
  const container = document.getElementById('recentStudents');
  if (!container || !students.length) return;
  const colors = ['#6366f1','#10b981','#f59e0b','#8b5cf6','#ec4899'];
  container.innerHTML = students.map((s, i) => {
    const initials = s.fullName.split(' ').map(p => p[0]).slice(0,2).join('');
    const color = colors[i % colors.length];
    return `<div class="recent-student-item">
      <div style="width:36px;height:36px;border-radius:50%;background:${color}22;color:${color};display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;flex-shrink:0">${initials}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.fullName}</div>
        <div style="font-size:11px;color:#64748b">${s.grade} · ${s.section}</div>
      </div>
      <span style="font-size:11px;color:#94a3b8;white-space:nowrap">${s.gender}</span>
    </div>`;
  }).join('');
}

// ── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderCalendar();
  loadDashboardStats();
  loadAttendanceChart();
});