const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
const avatarColors = ['#6366f1','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4'];

let students = [
  {id:1, name:'Rosal Cotabato',  lrn:'02194523456', grade:'Grade 1', section:'Section A', gender:'Male'},
  {id:2, name:'Ana Reyes',       lrn:'03291823401', grade:'Grade 1', section:'Section A', gender:'Female'},
  {id:3, name:'Marco Santos',    lrn:'04123456789', grade:'Grade 1', section:'Section B', gender:'Male'},
  {id:4, name:'Liza Fernandez',  lrn:'05987654321', grade:'Grade 2', section:'Section A', gender:'Female'},
  {id:5, name:'Juan Dela Cruz',  lrn:'06543219876', grade:'Grade 2', section:'Section B', gender:'Male'},
];

let grades = {};
students.forEach(s => {
  grades[s.id] = {
    1: {ww: Math.round(70 + Math.random()*25), pt: Math.round(72 + Math.random()*25), qe: Math.round(68 + Math.random()*28)},
    2: {ww: Math.round(70 + Math.random()*25), pt: Math.round(72 + Math.random()*25), qe: Math.round(68 + Math.random()*28)},
    3: {ww: Math.round(70 + Math.random()*25), pt: Math.round(72 + Math.random()*25), qe: Math.round(68 + Math.random()*28)},
    4: {ww: Math.round(70 + Math.random()*25), pt: Math.round(72 + Math.random()*25), qe: Math.round(68 + Math.random()*28)},
  };
});

let currentQuarter = 1;
const quarterLabels = {1:'1st Quarter', 2:'2nd Quarter', 3:'3rd Quarter', 4:'4th Quarter'};

// ── Helpers ─────────────────────────────────────────────
function calcFinal(ww, pt, qe) { return Math.round(ww * 0.3 + pt * 0.5 + qe * 0.2); }
function getGradeLetter(s)     { return s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 75 ? 'C' : s >= 60 ? 'D' : 'F'; }
function getGradeClass(s)      { return s >= 90 ? 'grade-a' : s >= 80 ? 'grade-b' : s >= 75 ? 'grade-b' : s >= 60 ? 'grade-c' : 'grade-d'; }
function getProgressColor(s)   { return s >= 90 ? '#10b981' : s >= 75 ? '#6366f1' : s >= 60 ? '#f59e0b' : '#ef4444'; }
function getInitials(n)        { return n.split(' ').map(p => p[0]).slice(0, 2).join(''); }

// ── Render grades table ──────────────────────────────────
function renderGradesTable() {
  const q = currentQuarter;
  document.getElementById('quarterLabel').textContent = quarterLabels[q];

  const search = document.getElementById('searchInput').value.toLowerCase();
  const gf = document.getElementById('filterGrade').value;
  const sf = document.getElementById('filterSection').value;

  let filtered = students.filter(s => {
    if (search && !s.name.toLowerCase().includes(search)) return false;
    if (gf && s.grade !== gf) return false;
    if (sf && s.section !== sf) return false;
    return true;
  });

  let passing = 0, atRisk = 0, failing = 0, total = 0;
  students.forEach(s => {
    const g = grades[s.id][q];
    const f = calcFinal(g.ww, g.pt, g.qe);
    total += f;
    if (f >= 75) passing++;
    else if (f >= 60) atRisk++;
    else failing++;
  });

  document.getElementById('classAvg').textContent    = (total / students.length).toFixed(1) + '%';
  document.getElementById('passingCount').textContent = passing;
  document.getElementById('atRiskCount').textContent  = atRisk;
  document.getElementById('failingCount').textContent = failing;
  document.getElementById('recordCount').textContent  = `Showing ${filtered.length} of ${students.length} students`;

  const tbody = document.getElementById('gradesTbody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div style="font-size:32px;margin-bottom:8px">🔍</div><h3>No students found</h3><p>Try adjusting your filters.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((s, i) => {
    const g   = grades[s.id][q];
    const f   = calcFinal(g.ww, g.pt, g.qe);
    const gl  = getGradeLetter(f);
    const gc  = getGradeClass(f);
    const pc  = getProgressColor(f);
    const ac  = avatarColors[s.id % avatarColors.length];
    const remarks = f >= 75
      ? '<span style="color:#10b981;font-size:12px;font-weight:500">Passed</span>'
      : '<span style="color:#ef4444;font-size:12px;font-weight:500">Failed</span>';

    return `<tr>
      <td style="color:var(--color-text-secondary)">${i + 1}</td>
      <td><div class="student-cell">
        <div class="student-avatar" style="background:${ac}22;color:${ac}">${getInitials(s.name)}</div>
        <div>
          <div style="font-weight:500;font-size:13px">${s.name}</div>
          <div style="font-size:11px;color:var(--color-text-secondary)">${s.lrn}</div>
        </div>
      </div></td>
      <td><span style="font-size:12px">${s.grade} · ${s.section}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <input class="editable-score" type="number" min="0" max="100" value="${g.ww}" onchange="updateGrade(${s.id},${q},'ww',this.value)">
          <div style="flex:1"><div class="progress-bar"><div class="progress-fill" style="width:${g.ww}%;background:${pc}"></div></div></div>
        </div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <input class="editable-score" type="number" min="0" max="100" value="${g.pt}" onchange="updateGrade(${s.id},${q},'pt',this.value)">
          <div style="flex:1"><div class="progress-bar"><div class="progress-fill" style="width:${g.pt}%;background:${pc}"></div></div></div>
        </div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <input class="editable-score" type="number" min="0" max="100" value="${g.qe}" onchange="updateGrade(${s.id},${q},'qe',this.value)">
          <div style="flex:1"><div class="progress-bar"><div class="progress-fill" style="width:${g.qe}%;background:${pc}"></div></div></div>
        </div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:16px;font-weight:700;color:${pc}">${f}%</span>
          <span class="grade-badge ${gc}">${gl}</span>
        </div>
      </td>
      <td>${remarks}</td>
    </tr>`;
  }).join('');
}

// ── Update a single grade field ──────────────────────────
function updateGrade(sid, q, field, val) {
  grades[sid][q][field] = Math.min(100, Math.max(0, parseInt(val) || 0));
  renderGradesTable();
  showToast('Grade updated');
}

// ── Quarter filter ───────────────────────────────────────
function filterStudents() {
  const q = parseInt(document.getElementById('filterQuarter').value) || 1;
  currentQuarter = q;
  renderGradesTable();
}

// ── Tab switching ────────────────────────────────────────
function switchTab(tab, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ['gradebook','components','import','reports'].forEach(t => {
    const panel = document.getElementById('tab-' + t);
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'components') renderComponents();
  if (tab === 'reports')    renderReports();
}

// ── Components tab ───────────────────────────────────────
function renderComponents() {
  const comps = [
    {name:'Written Works',    weight:30, desc:'Homework, quizzes, long tests',     color:'#6366f1'},
    {name:'Performance Task', weight:50, desc:'Projects, lab work, recitation',    color:'#10b981'},
    {name:'Quarterly Exam',   weight:20, desc:'End-of-quarter examination',        color:'#f59e0b'},
  ];
  document.getElementById('componentList').innerHTML = comps.map(c => `
    <div class="component-card">
      <div class="comp-name"><span class="comp-dot" style="background:${c.color}"></span>${c.name}</div>
      <div class="comp-weight">${c.weight}% weight</div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:4px">${c.desc}</div>
      <div class="progress-bar" style="margin-top:10px">
        <div class="progress-fill" style="width:${c.weight}%;background:${c.color}"></div>
      </div>
    </div>
  `).join('');
}

// ── Reports tab ──────────────────────────────────────────
function renderReports() {
  const quarters = [1,2,3,4];
  const html = quarters.map(q => {
    const avgs    = students.map(s => { const g = grades[s.id][q]; return calcFinal(g.ww, g.pt, g.qe); });
    const avg     = (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1);
    const passing = avgs.filter(a => a >= 75).length;
    const bgColors  = ['#ede9fe','#dbeafe','#d1fae5','#fef3c7'];
    const txtColors = ['#5b21b6','#1e40af','#065f46','#92400e'];

    return `<div style="background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:12px;padding:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-weight:600;font-size:13px">${quarterLabels[q]}</div>
        <span class="badge-pill pill-q" style="background:${bgColors[q-1]};color:${txtColors[q-1]}">${avg}% avg</span>
      </div>
      <div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:8px">${passing}/${students.length} students passing</div>
      ${students.map(s => {
        const g  = grades[s.id][q];
        const f  = calcFinal(g.ww, g.pt, g.qe);
        const pc = getProgressColor(f);
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div style="font-size:12px;width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-secondary)">${s.name.split(' ')[0]}</div>
          <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${f}%;background:${pc}"></div></div>
          <div style="font-size:12px;font-weight:600;width:36px;text-align:right;color:${pc}">${f}%</div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
  document.getElementById('reportsContent').innerHTML = html;
}

// ── Modal ────────────────────────────────────────────────
function openAddGrade() {
  const sel = document.getElementById('modalStudent');
  sel.innerHTML = `<option value="">Select student...</option>` +
    students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  document.getElementById('addGradeModal').classList.add('open');
}

function closeModal() {
  document.getElementById('addGradeModal').classList.remove('open');
}

function calcModalFinal() {
  const ww = parseFloat(document.getElementById('modalWW').value) || 0;
  const pt = parseFloat(document.getElementById('modalPT').value) || 0;
  const qe = parseFloat(document.getElementById('modalQE').value) || 0;
  document.getElementById('modalFinal').value = calcFinal(ww, pt, qe);
}

function saveGrade() {
  const sid = parseInt(document.getElementById('modalStudent').value);
  const q   = parseInt(document.getElementById('modalQuarter').value);
  const ww  = parseInt(document.getElementById('modalWW').value) || 0;
  const pt  = parseInt(document.getElementById('modalPT').value) || 0;
  const qe  = parseInt(document.getElementById('modalQE').value) || 0;
  if (!sid) { showToast('Please select a student'); return; }
  grades[sid][q] = {ww, pt, qe};
  closeModal();
  renderGradesTable();
  showToast('Grade saved successfully');
}

// ── Export ───────────────────────────────────────────────
function exportCSV(format = 'csv') {
  const q    = currentQuarter;
  const rows = [['#','Student','LRN','Grade','Section','Written Works','Performance Task','Quarterly Exam','Final Grade','Remarks']];
  students.forEach((s, i) => {
    const g = grades[s.id][q];
    const f = calcFinal(g.ww, g.pt, g.qe);
    rows.push([i+1, s.name, s.lrn, s.grade, s.section, g.ww, g.pt, g.qe, f, f >= 75 ? 'Passed' : 'Failed']);
  });
  const csv  = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `grades_q${q}_${format === 'sf9' ? 'sf9' : 'export'}.csv`;
  a.click();
  showToast(format === 'sf9' ? 'SF9 format exported' : 'Grades exported successfully');
}

// ── File import ──────────────────────────────────────────
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  showToast(`Importing ${file.name}...`);
  setTimeout(() => {
    students.push({id: students.length + 1, name:'Imported Student', lrn:'99999999999', grade:'Grade 1', section:'Section A', gender:'Male'});
    grades[students.length] = {
      1:{ww:82,pt:85,qe:78}, 2:{ww:80,pt:83,qe:76},
      3:{ww:84,pt:87,qe:80}, 4:{ww:86,pt:88,qe:82}
    };
    renderGradesTable();
    showToast('Import successful — 1 student added');
  }, 1200);
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('importZone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) { showToast(`Importing ${file.name}...`); }
}

// ── Toast ────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Components save ──────────────────────────────────────
function saveComponents() { showToast('Grade components saved'); }

// ── Init ─────────────────────────────────────────────────
renderGradesTable();