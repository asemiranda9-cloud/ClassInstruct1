// ── Philippine Public Holidays ──────────────────────────────────────────────
// Returns an array of { month (0-based), day, name, type } for a given year.
// type: 'regular' = Regular Holiday | 'special' = Special Non-Working Day
function getPhHolidays(year) {
  const R = 'regular';
  const S = 'special';

  // ── Fixed-date holidays (same date every year) ──
  const fixed = [
    { m: 0,  d: 1,  name: "New Year's Day",                   type: R },
    { m: 1,  d: 25, name: "EDSA People Power Revolution",     type: S },
    { m: 3,  d: 9,  name: "Day of Valor (Araw ng Kagitingan)", type: R },
    { m: 4,  d: 1,  name: "Labor Day",                        type: R },
    { m: 5,  d: 12, name: "Independence Day",                 type: R },
    { m: 7,  d: 21, name: "Ninoy Aquino Day",                 type: S },
    { m: 7,  d: 26, name: "National Heroes Day",              type: R },
    { m: 10, d: 1,  name: "All Saints' Day",                  type: S },
    { m: 10, d: 2,  name: "All Souls' Day",                   type: S },
    { m: 10, d: 30, name: "Bonifacio Day",                    type: R },
    { m: 11, d: 8,  name: "Feast of the Immaculate Conception", type: S },
    { m: 11, d: 24, name: "Christmas Eve",                    type: S },
    { m: 11, d: 25, name: "Christmas Day",                    type: R },
    { m: 11, d: 30, name: "Rizal Day",                        type: R },
    { m: 11, d: 31, name: "New Year's Eve",                   type: S },
  ];

  // ── Movable / computed holidays ──
  // Easter-based: compute Easter Sunday using Anonymous Gregorian algorithm
  function easterSunday(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m2 = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m2 + 114) / 31) - 1; // 0-based
    const day   = ((h + l - 7 * m2 + 114) % 31) + 1;
    return new Date(y, month, day);
  }

  const easter = easterSunday(year);
  const holyThursday = new Date(easter); holyThursday.setDate(easter.getDate() - 3);
  const goodFriday   = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  const blackSaturday = new Date(easter); blackSaturday.setDate(easter.getDate() - 1);

  // Chinese New Year – 1st new moon after Jan 20 (approximation via lookup)
  // Using a known lookup table for accuracy
  const chineseNewYear = {
    2024: { m: 1, d: 10 }, 2025: { m: 0, d: 29 }, 2026: { m: 1, d: 17 },
    2027: { m: 1, d: 6  }, 2028: { m: 0, d: 26 }, 2029: { m: 1, d: 13 },
    2030: { m: 1, d: 3  },
  };

  const movable = [
    { m: holyThursday.getMonth(),  d: holyThursday.getDate(),  name: "Maundy Thursday",  type: R },
    { m: goodFriday.getMonth(),    d: goodFriday.getDate(),    name: "Good Friday",       type: R },
    { m: blackSaturday.getMonth(), d: blackSaturday.getDate(), name: "Black Saturday",    type: S },
  ];

  if (chineseNewYear[year]) {
    movable.push({ m: chineseNewYear[year].m, d: chineseNewYear[year].d, name: "Chinese New Year", type: S });
  }

  // National Election Day (declared by COMELEC for election years — mid-term & national)
  // Mid-term: 2025 (May 12), National: 2028 (May 13), etc.
  const electionDays = { 2025: { m: 4, d: 12 }, 2028: { m: 4, d: 13 } };
  if (electionDays[year]) {
    movable.push({ m: electionDays[year].m, d: electionDays[year].d, name: "National/Local Elections", type: S });
  }

  return [...fixed, ...movable].map(h => ({ ...h, year }));
}

// ── Build a lookup map: "YYYY-MM-DD" → holiday info ──
function buildHolidayMap(year) {
  const map = {};
  getPhHolidays(year).forEach(h => {
    const key = `${h.year}-${String(h.m + 1).padStart(2,'0')}-${String(h.d).padStart(2,'0')}`;
    map[key] = h;
  });
  return map;
}

// ── State ──
const months = [
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

const now = new Date();
let curMonthIdx = now.getMonth();
let curYear     = now.getFullYear();

let dayEntries = JSON.parse(localStorage.getItem('ci_dayEntries') || '{}');
let selectedType = 'holiday';
let modalKey = null;

const typeIcons = { holiday:'🌿', event:'📅', meeting:'🤝', note:'📝', exam:'📋', activity:'🎯', quiz:'❓' };

function dayKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function saveEntries() { localStorage.setItem('ci_dayEntries', JSON.stringify(dayEntries)); }

// ── Returns days in a given month/year (leap-year aware) ──
function daysInMonth(year, monthIdx) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

// ── Returns start day (0=Sun) for a month/year using JS Date ──
function startDayOf(year, monthIdx) {
  return new Date(year, monthIdx, 1).getDay();
}

// ── Type chips ──
document.getElementById('typeChips').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
  selectedType = chip.dataset.type;
});

// ── Modal ──
function openModal(day) {
  modalKey = dayKey(curYear, curMonthIdx, day);
  document.getElementById('modalDayBig').textContent = day;
  document.getElementById('modalMonthLbl').textContent = months[curMonthIdx].name + ' ' + curYear;
  document.getElementById('entryTitle').value = '';
  document.getElementById('entryTime').value = '';
  document.getElementById('entryNote').value = '';

  // Show PH holiday banner if this day is a holiday
  const holidayMap = buildHolidayMap(curYear);
  const phHol = holidayMap[modalKey];
  let holBanner = document.getElementById('phHolBanner');
  if (!holBanner) {
    holBanner = document.createElement('div');
    holBanner.id = 'phHolBanner';
    holBanner.className = 'ph-hol-banner';
    const modalHdr = document.querySelector('.modal-hdr');
    modalHdr.insertAdjacentElement('afterend', holBanner);
  }
  if (phHol) {
    holBanner.innerHTML = `<span class="ph-hol-flag">🇵🇭</span>
      <div>
        <div class="ph-hol-name">${esc(phHol.name)}</div>
        <div class="ph-hol-type">${phHol.type === 'regular' ? '🔴 Regular Holiday' : '🟡 Special Non-Working Day'}</div>
      </div>`;
    holBanner.style.display = 'flex';
  } else {
    holBanner.style.display = 'none';
  }

  renderEntriesList();
  document.getElementById('dayModal').classList.add('open');
  document.getElementById('entryTitle').focus();
}

function closeModal() {
  document.getElementById('dayModal').classList.remove('open');
  modalKey = null;
}

document.getElementById('dayModal').addEventListener('click', e => {
  if (e.target === document.getElementById('dayModal')) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Add entry ──
function addEntry() {
  const title = document.getElementById('entryTitle').value.trim();
  if (!title) { document.getElementById('entryTitle').focus(); return; }
  const time = document.getElementById('entryTime').value;
  const note = document.getElementById('entryNote').value.trim();
  if (!dayEntries[modalKey]) dayEntries[modalKey] = [];
  dayEntries[modalKey].push({ id: Date.now(), type: selectedType, title, time: time ? fmtTime(time) : '', note });
  saveEntries();
  document.getElementById('entryTitle').value = '';
  document.getElementById('entryTime').value = '';
  document.getElementById('entryNote').value = '';
  renderEntriesList();
  renderCalendar();
  renderSched();
  if (window.CILog) {
    const dateLabel = months[curMonthIdx].name + ' ' + parseInt(modalKey.split('-')[2]) + ', ' + curYear;
    CILog.push('calendar_entry', cap(selectedType) + ' added to Calendar', esc(title) + ' · ' + dateLabel);
  }
}

function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h%12||12}:${String(m).padStart(2,'0')} ${ampm}`;
}

// ── Delete entry ──
function deleteEntry(key, id) {
  const entry = (dayEntries[key]||[]).find(e => e.id === id);
  dayEntries[key] = (dayEntries[key]||[]).filter(e => e.id !== id);
  if (!dayEntries[key].length) delete dayEntries[key];
  saveEntries();
  renderEntriesList();
  renderCalendar();
  renderSched();
  if (window.CILog && entry) {
    const parts = key.split('-');
    const dateLabel = months[parseInt(parts[1])-1].name + ' ' + parseInt(parts[2]) + ', ' + parts[0];
    CILog.push('calendar_entry', cap(entry.type) + ' removed from Calendar', esc(entry.title) + ' · ' + dateLabel);
  }
}

// ── Render entries modal ──
function renderEntriesList() {
  const list = document.getElementById('entriesList');
  const entries = dayEntries[modalKey] || [];

  // Also show PH holiday as a built-in entry (read-only)
  const holidayMap = buildHolidayMap(curYear);
  const phHol = holidayMap[modalKey];
  const phHolHTML = phHol ? `
    <div class="entry-card" data-type="holiday" style="opacity:.85">
      <span class="entry-icon">🇵🇭</span>
      <div class="entry-body">
        <div class="entry-ttl">${esc(phHol.name)}</div>
        <div class="entry-meta">
          <span class="entry-type-tag" style="background:rgba(5,150,105,.15);color:#059669">
            ${phHol.type === 'regular' ? 'Regular Holiday' : 'Special Non-Working'}
          </span>
        </div>
        <div class="entry-note">Philippine Public Holiday 🇵🇭</div>
      </div>
    </div>` : '';

  if (!entries.length && !phHol) {
    list.innerHTML = '<div class="empty-msg"><span>📋</span>No entries yet. Add one above!</div>';
    return;
  }

  list.innerHTML = phHolHTML + entries.map(e => `
    <div class="entry-card" data-type="${e.type}">
      <span class="entry-icon">${typeIcons[e.type]}</span>
      <div class="entry-body">
        <div class="entry-ttl">${esc(e.title)}</div>
        <div class="entry-meta">
          ${e.time ? `<span class="entry-time-badge">⏱ ${esc(e.time)}</span>` : ''}
          <span class="entry-type-tag">${cap(e.type)}</span>
        </div>
        ${e.note ? `<div class="entry-note">${esc(e.note)}</div>` : ''}
      </div>
      <button class="btn-del" onclick="deleteEntry('${modalKey}', ${e.id})" aria-label="Delete">✕</button>
    </div>
  `).join('');
}

// ── Render schedule sidebar ──
function renderSched() {
  const list = document.getElementById('schedList');
  const prefix = `${curYear}-${String(curMonthIdx+1).padStart(2,'0')}-`;
  const holidayMap = buildHolidayMap(curYear);
  const items = [];

  // Add PH holidays for this month
  Object.entries(holidayMap).forEach(([k, hol]) => {
    if (k.startsWith(prefix)) {
      const day = parseInt(k.split('-')[2]);
      items.push({ day, type: 'ph-holiday', title: hol.name, phType: hol.type, time: '', isPH: true });
    }
  });

  // Add user entries for this month
  Object.entries(dayEntries).forEach(([k, arr]) => {
    if (k.startsWith(prefix)) {
      const day = parseInt(k.split('-')[2]);
      arr.forEach(e => items.push({ day, ...e, isPH: false }));
    }
  });

  items.sort((a, b) => a.day - b.day);

  if (!items.length) {
    list.innerHTML = '<div class="empty-msg"><span>🗓️</span>No events this month.<br>Click a day to add some!</div>';
    return;
  }

  list.innerHTML = items.map(e => {
    if (e.isPH) {
      return `
        <article class="sched-item type-ph-holiday">
          <div class="sched-time-col">
            <span class="sched-day-lbl">Day ${e.day}</span>
            <span class="ph-flag-sm">🇵🇭</span>
          </div>
          <div class="sched-content">
            <span class="sched-item-title">${esc(e.title)}</span>
            <span class="sched-item-type">${e.phType === 'regular' ? 'Regular Holiday' : 'Special Non-Working'}</span>
          </div>
        </article>`;
    }
    return `
      <article class="sched-item type-${e.type}">
        <div class="sched-time-col">
          <span class="sched-day-lbl">Day ${e.day}</span>
          ${e.time ? `<span class="sched-hour-lbl">${esc(e.time)}</span>` : ''}
        </div>
        <div class="sched-content">
          <span class="sched-item-title">${typeIcons[e.type]} ${esc(e.title)}</span>
          <span class="sched-item-type">${cap(e.type)}</span>
        </div>
      </article>`;
  }).join('');
}

// ── Render calendar ──
function renderCalendar() {
  const totalDays   = daysInMonth(curYear, curMonthIdx);
  const startDay    = startDayOf(curYear, curMonthIdx);
  const monthName   = months[curMonthIdx].name;
  const prevMonDays = daysInMonth(curYear, curMonthIdx === 0 ? 11 : curMonthIdx - 1);

  document.getElementById('calMonthYear').textContent = monthName + ' ' + curYear;
  const container = document.getElementById('calDays');
  container.innerHTML = '';

  const today       = new Date();
  const isThisMonth = today.getMonth() === curMonthIdx && today.getFullYear() === curYear;
  const todayDate   = today.getDate();
  const holidayMap  = buildHolidayMap(curYear);

  // prev month filler
  for (let i = startDay - 1; i >= 0; i--) {
    const d = document.createElement('div');
    d.className = 'cal-day other-month';
    d.innerHTML = `<span class="day-num">${prevMonDays - i}</span>`;
    container.appendChild(d);
  }

  // current month days
  for (let day = 1; day <= totalDays; day++) {
    const key     = dayKey(curYear, curMonthIdx, day);
    const entries = dayEntries[key] || [];
    const phHol   = holidayMap[key];

    const d = document.createElement('div');
    d.className = 'cal-day';
    if (isThisMonth && day === todayDate) d.classList.add('today');
    if (entries.length) d.classList.add('has-event');
    if (phHol) d.classList.add(phHol.type === 'regular' ? 'ph-regular' : 'ph-special');

    // dots: PH holiday dot first, then user entry dots
    const uniqueTypes = [...new Set(entries.map(e => e.type))];
    let dots = '';
    if (phHol) dots += `<span class="day-dot ph-holiday" title="${esc(phHol.name)}"></span>`;
    dots += uniqueTypes.map(t => `<span class="day-dot ${t}"></span>`).join('');

    // pill: show holiday name if no user entry, else user entry
    let pill = '';
    if (phHol && !entries.length) {
      pill = `<div class="event-pill ph-hol-pill" title="${esc(phHol.name)}">🇵🇭 ${esc(phHol.name)}</div>`;
    } else if (entries.length) {
      pill = `<div class="event-pill">${esc(entries[0].title)}${entries.length > 1 ? ` +${entries.length-1}` : ''}</div>`;
    }

    d.innerHTML = `
      <span class="day-num">${day}</span>
      ${dots ? `<div class="day-dots">${dots}</div>` : ''}
      ${pill}
    `;

    // Show holiday name as aria label
    const holLabel = phHol ? `, Philippine Holiday: ${phHol.name}` : '';
    const entLabel = entries.length ? `, ${entries.length} entr${entries.length>1?'ies':'y'}` : '';
    d.setAttribute('role', 'button');
    d.setAttribute('tabindex', '0');
    d.setAttribute('aria-label', `${monthName} ${day}, ${curYear}${holLabel}${entLabel}`);
    d.addEventListener('click', () => openModal(day));
    d.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(day); });
    container.appendChild(d);
  }

  // next month filler
  const total = startDay + totalDays;
  const rem   = total > 35 ? 42 - total : 35 - total;
  for (let day = 1; day <= rem; day++) {
    const d = document.createElement('div');
    d.className = 'cal-day other-month';
    d.innerHTML = `<span class="day-num">${day}</span>`;
    container.appendChild(d);
  }
}

function changeMonth(dir) {
  curMonthIdx += dir;
  if (curMonthIdx < 0)  { curMonthIdx = 11; curYear--; }
  if (curMonthIdx > 11) { curMonthIdx = 0;  curYear++; }
  renderCalendar();
  renderSched();
}

function goToday() {
  const t = new Date();
  curMonthIdx = t.getMonth();
  curYear     = t.getFullYear();
  renderCalendar();
  renderSched();
}

// ── Helpers ──
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Init ──
document.addEventListener('DOMContentLoaded', () => { renderCalendar(); renderSched(); });
document.getElementById('entryTitle').addEventListener('keydown', e => { if (e.key === 'Enter') addEntry(); });