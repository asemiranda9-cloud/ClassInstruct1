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

      // Use actual current month/year
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
      }

      function fmtTime(t) {
        const [h, m] = t.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        return `${h%12||12}:${String(m).padStart(2,'0')} ${ampm}`;
      }

      // ── Delete entry ──
      function deleteEntry(key, id) {
        dayEntries[key] = (dayEntries[key]||[]).filter(e => e.id !== id);
        if (!dayEntries[key].length) delete dayEntries[key];
        saveEntries();
        renderEntriesList();
        renderCalendar();
        renderSched();
      }

      // ── Render entries modal ──
      function renderEntriesList() {
        const list = document.getElementById('entriesList');
        const entries = dayEntries[modalKey] || [];
        if (!entries.length) {
          list.innerHTML = '<div class="empty-msg"><span>📋</span>No entries yet. Add one above!</div>';
          return;
        }
        list.innerHTML = entries.map(e => `
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
        const items = [];
        Object.entries(dayEntries).forEach(([k, arr]) => {
          if (k.startsWith(prefix)) {
            const day = parseInt(k.split('-')[2]);
            arr.forEach(e => items.push({ day, ...e }));
          }
        });
        items.sort((a, b) => a.day - b.day);

        if (!items.length) {
          list.innerHTML = '<div class="empty-msg"><span>🗓️</span>No events this month.<br>Click a day to add some!</div>';
          return;
        }

        list.innerHTML = items.map(e => `
          <article class="sched-item type-${e.type}">
            <div class="sched-time-col">
              <span class="sched-day-lbl">Day ${e.day}</span>
              ${e.time ? `<span class="sched-hour-lbl">${esc(e.time)}</span>` : ''}
            </div>
            <div class="sched-content">
              <span class="sched-item-title">${typeIcons[e.type]} ${esc(e.title)}</span>
              <span class="sched-item-type">${cap(e.type)}</span>
            </div>
          </article>
        `).join('');
      }

      // ── Render calendar ──
      function renderCalendar() {
        const month = months[curMonthIdx];
        document.getElementById('calMonthYear').textContent = month.name + ' ' + curYear;
        const container = document.getElementById('calDays');
        container.innerHTML = '';

        const today = new Date();
        const isThisMonth = today.getMonth() === curMonthIdx && today.getFullYear() === curYear;
        const todayDate = today.getDate();
        const prevMonthDays = months[curMonthIdx === 0 ? 11 : curMonthIdx - 1].days;

        // prev month filler
        for (let i = month.startDay - 1; i >= 0; i--) {
          const d = document.createElement('div');
          d.className = 'cal-day other-month';
          d.innerHTML = `<span class="day-num">${prevMonthDays - i}</span>`;
          container.appendChild(d);
        }

        // current month
        for (let day = 1; day <= month.days; day++) {
          const key = dayKey(curYear, curMonthIdx, day);
          const entries = dayEntries[key] || [];
          const d = document.createElement('div');
          d.className = 'cal-day';
          if (isThisMonth && day === todayDate) d.classList.add('today');
          if (entries.length) d.classList.add('has-event');

          const uniqueTypes = [...new Set(entries.map(e => e.type))];
          const dots = uniqueTypes.map(t => `<span class="day-dot ${t}"></span>`).join('');

          d.innerHTML = `
            <span class="day-num">${day}</span>
            ${dots ? `<div class="day-dots">${dots}</div>` : ''}
            ${entries.length ? `<div class="event-pill">${esc(entries[0].title)}${entries.length > 1 ? ` +${entries.length-1}` : ''}</div>` : ''}
          `;
          d.setAttribute('role', 'button');
          d.setAttribute('tabindex', '0');
          d.setAttribute('aria-label', `${month.name} ${day}, ${curYear}${entries.length ? `, ${entries.length} entr${entries.length>1?'ies':'y'}` : ''}`);
          d.addEventListener('click', () => openModal(day));
          d.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(day); });
          container.appendChild(d);
        }

        // next month filler
        const total = month.startDay + month.days;
        const rem = total > 35 ? 42 - total : 35 - total;
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
