// ── Data ──────────────────────────────────────────────────────────────────────
let students = [
  {name:'Rosal Cotabato',   id:'2024-0001', ww:88, pt:91, qa:85, att:98},
  {name:'Marco Dela Cruz',  id:'2024-0002', ww:75, pt:80, qa:72, att:95},
  {name:'Ana Santos',       id:'2024-0003', ww:92, pt:95, qa:90, att:100},
  {name:'James Reyes',      id:'2024-0004', ww:60, pt:65, qa:58, att:88},
  {name:'Maria Garcia',     id:'2024-0005', ww:55, pt:60, qa:50, att:80},
  {name:'Kevin Lim',        id:'2024-0006', ww:82, pt:78, qa:80, att:96},
  {name:'Sofia Bautista',   id:'2024-0007', ww:70, pt:74, qa:68, att:92},
  {name:'Diego Mendoza',    id:'2024-0008', ww:95, pt:97, qa:93, att:100},
  {name:'Lea Torres',       id:'2024-0009', ww:78, pt:82, qa:76, att:94},
  {name:'Rico Flores',      id:'2024-0010', ww:65, pt:70, qa:63, att:85},
];

let weights = {ww:30, pt:50, qa:20};
let filtered = [...students];
let activeDesc = '';

// ── Computed ──────────────────────────────────────────────────────────────────
function computeFinal(s){
  return Math.round(s.ww*(weights.ww/100) + s.pt*(weights.pt/100) + s.qa*(weights.qa/100));
}
function descriptor(f){
  if(f>=90) return 'Outstanding';
  if(f>=85) return 'Very Satisfactory';
  if(f>=80) return 'Satisfactory';
  if(f>=75) return 'Fairly Satisfactory';
  return 'Did Not Meet';
}
function gpa(f){
  if(f>=98) return '1.00';
  if(f>=95) return '1.25';
  if(f>=92) return '1.50';
  if(f>=89) return '1.75';
  if(f>=86) return '2.00';
  if(f>=83) return '2.25';
  if(f>=80) return '2.50';
  if(f>=77) return '2.75';
  if(f>=75) return '3.00';
  return '5.00';
}
function letterGrade(f){
  if(f>=90) return 'A';
  if(f>=85) return 'B+';
  if(f>=80) return 'B';
  if(f>=75) return 'C';
  return 'F';
}
function badgeClass(d){
  const map = {
    'Outstanding':'badge-outstanding',
    'Very Satisfactory':'badge-vs',
    'Satisfactory':'badge-s',
    'Fairly Satisfactory':'badge-fs',
    'Did Not Meet':'badge-dnm'
  };
  return map[d] || 'badge-s';
}
function progColor(v){
  if(v>=90) return '#10b981';
  if(v>=75) return '#6c63ff';
  if(v>=60) return '#f59e0b';
  return '#ef4444';
}

// ── Render Grade Sheet ────────────────────────────────────────────────────────
function renderTable(){
  const quarter = document.getElementById('quarterSel').value;
  const subject = document.getElementById('subjectSel').value;
  document.getElementById('tableTitle').textContent = quarter + ' Grade Sheet — ' + subject;
  document.getElementById('ww-pct-label').textContent = weights.ww + '%';
  document.getElementById('pt-pct-label').textContent = weights.pt + '%';
  document.getElementById('qa-pct-label').textContent = weights.qa + '%';

  const body = document.getElementById('gradeBody');
  body.innerHTML = '';

  filtered.forEach((s, i) => {
    const f = computeFinal(s);
    const d = descriptor(f);
    const g = gpa(f);
    const l = letterGrade(f);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--gray-400);font-size:12px;">${i+1}</td>
      <td>
        <div class="student-name">${s.name}</div>
        <div class="student-id">${s.id}</div>
      </td>
      <td><input class="grade-input" type="number" min="0" max="100" value="${s.ww}" oninput="updateGrade(${students.indexOf(s)},'ww',this.value)"></td>
      <td><input class="grade-input" type="number" min="0" max="100" value="${s.pt}" oninput="updateGrade(${students.indexOf(s)},'pt',this.value)"></td>
      <td><input class="grade-input" type="number" min="0" max="100" value="${s.qa}" oninput="updateGrade(${students.indexOf(s)},'qa',this.value)"></td>
      <td>
        <div class="prog-wrap">
          <div class="prog-bar"><div class="prog-fill" style="width:${s.att}%;background:${progColor(s.att)};"></div></div>
          <span class="prog-label">${s.att}%</span>
        </div>
      </td>
      <td><span class="final-grade" style="color:${progColor(f)};">${f}</span></td>
      <td><span class="badge ${badgeClass(d)}">${d}</span></td>
      <td style="font-family:'DM Mono',monospace;font-size:13px;">${g}</td>
      <td style="font-weight:700;color:${progColor(f)};font-size:14px;">${l}</td>
    `;
    body.appendChild(tr);
  });

  renderStats();
}

function updateGrade(idx, field, val){
  const v = Math.min(100, Math.max(0, parseInt(val) || 0));
  students[idx][field] = v;
  renderStats();
}

function renderStats(){
  const finals = filtered.map(s => computeFinal(s));
  if(!finals.length) return;
  const avg = Math.round(finals.reduce((a,b)=>a+b,0)/finals.length);
  const passing = finals.filter(f=>f>=75).length;
  const highest = Math.max(...finals);
  const lowest = Math.min(...finals);
  document.getElementById('statGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Class average</div>
      <div class="stat-value">${avg}</div>
      <div class="stat-sub">out of 100</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Passing rate</div>
      <div class="stat-value">${Math.round((passing/finals.length)*100)}%</div>
      <div class="stat-sub">${passing} of ${finals.length} students</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Highest grade</div>
      <div class="stat-value" style="color:var(--success);">${highest}</div>
      <div class="stat-sub">top score</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Lowest grade</div>
      <div class="stat-value" style="color:var(--danger);">${lowest}</div>
      <div class="stat-sub">needs attention</div>
    </div>
  `;
}

// ── Filters ───────────────────────────────────────────────────────────────────
function filterSearch(q){
  filtered = students.filter(s => {
    const matchName = s.name.toLowerCase().includes(q.toLowerCase());
    const matchDesc = activeDesc ? descriptor(computeFinal(s)) === activeDesc : true;
    return matchName && matchDesc;
  });
  renderTable();
}
function filterDesc(d){
  activeDesc = d;
  filtered = students.filter(s => d ? descriptor(computeFinal(s)) === d : true);
  renderTable();
}
function refresh(){ filtered=[...students]; renderTable(); }

// ── Weights ───────────────────────────────────────────────────────────────────
function renderWeights(){
  const labels = {ww:'Written Works',pt:'Performance Tasks',qa:'Quarterly Assessment'};
  const grid = document.getElementById('weightsGrid');
  grid.innerHTML = '';
  Object.keys(weights).forEach(k => {
    const div = document.createElement('div');
    div.className = 'weight-card';
    div.innerHTML = `
      <div class="weight-header">
        <span class="weight-name">${labels[k]}</span>
        <span class="weight-pct" id="wpct-${k}">${weights[k]}%</span>
      </div>
      <input type="range" min="0" max="100" step="5" value="${weights[k]}" oninput="updateWeight('${k}',this.value)">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--gray-400);margin-top:4px;"><span>0%</span><span>100%</span></div>
    `;
    grid.appendChild(div);
  });
  updateWeightDisplay();
}
function updateWeight(k, v){
  weights[k] = parseInt(v);
  document.getElementById('wpct-'+k).textContent = v+'%';
  updateWeightDisplay();
}
function updateWeightDisplay(){
  const total = Object.values(weights).reduce((a,b)=>a+b,0);
  const box = document.getElementById('weightTotalBox');
  const ok = total === 100;
  box.innerHTML = `Total: <strong style="color:${ok?'var(--success)':'var(--danger)'};">${total}%</strong> ${ok ? '✓ Ready to save' : `— needs to be 100% (off by ${total-100}%)`}`;
}
function saveWeights(){
  const total = Object.values(weights).reduce((a,b)=>a+b,0);
  if(total !== 100){ toast('Weights must total 100%. Currently '+total+'%.','error'); return; }
  toast('Weights saved successfully!','success');
  renderTable();
}
function resetWeights(){ weights={ww:30,pt:50,qa:20}; renderWeights(); }

// ── Summary ───────────────────────────────────────────────────────────────────
function renderSummary(){
  const finals = students.map(s=>computeFinal(s));
  const avg = Math.round(finals.reduce((a,b)=>a+b,0)/finals.length);
  const passing = finals.filter(f=>f>=75).length;
  const avgWw = Math.round(students.reduce((a,s)=>a+s.ww,0)/students.length);
  const avgPt = Math.round(students.reduce((a,s)=>a+s.pt,0)/students.length);
  const avgQa = Math.round(students.reduce((a,s)=>a+s.qa,0)/students.length);

  document.getElementById('summaryStats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total students</div><div class="stat-value">${students.length}</div></div>
    <div class="stat-card"><div class="stat-label">Class average</div><div class="stat-value">${avg}</div></div>
    <div class="stat-card"><div class="stat-label">Passing</div><div class="stat-value" style="color:var(--success);">${passing}</div><div class="stat-sub">${Math.round(passing/students.length*100)}% pass rate</div></div>
    <div class="stat-card"><div class="stat-label">Needs support</div><div class="stat-value" style="color:var(--danger);">${finals.filter(f=>f<75).length}</div></div>
  `;

  const dist = {'Outstanding':0,'Very Satisfactory':0,'Satisfactory':0,'Fairly Satisfactory':0,'Did Not Meet':0};
  finals.forEach(f=>dist[descriptor(f)]++);
  const colors = {'Outstanding':'#3b82f6','Very Satisfactory':'#10b981','Satisfactory':'#22c55e','Fairly Satisfactory':'#f59e0b','Did Not Meet':'#ef4444'};
  let distHtml = '';
  Object.entries(dist).forEach(([d,count])=>{
    const pct = Math.round(count/students.length*100);
    distHtml += `
      <div class="dist-row">
        <div class="dist-label">${d}</div>
        <div class="dist-bar-wrap"><div class="dist-bar-fill" style="width:${pct}%;background:${colors[d]};"></div></div>
        <div class="dist-count">${count} student${count!==1?'s':''} (${pct}%)</div>
      </div>`;
  });
  document.getElementById('distBars').innerHTML = distHtml;

  const comps = [
    {label:'Written Works', avg:avgWw, color:'#6c63ff'},
    {label:'Performance Tasks', avg:avgPt, color:'#10b981'},
    {label:'Quarterly Assessment', avg:avgQa, color:'#f59e0b'},
  ];
  let compHtml = '';
  comps.forEach(c=>{
    compHtml += `
      <div class="dist-row">
        <div class="dist-label">${c.label}</div>
        <div class="dist-bar-wrap"><div class="dist-bar-fill" style="width:${c.avg}%;background:${c.color};"></div></div>
        <div class="dist-count">${c.avg} avg</div>
      </div>`;
  });
  document.getElementById('compBars').innerHTML = compHtml;
}

// ── Import Excel ──────────────────────────────────────────────────────────────
function toggleImport(){
  document.getElementById('importZone').classList.toggle('show');
}
function handleImport(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try{
      const wb = XLSX.read(e.target.result, {type:'binary'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      if(!rows.length){ toast('No data found in file.','error'); return; }
      const imported = rows.map((r,i)=>({
        name: r['Name'] || r['name'] || r['Student'] || 'Student '+(i+1),
        id:   r['ID'] || r['id'] || r['LRN'] || '----',
        ww:   parseInt(r['Written Works'] || r['WW'] || r['ww'] || 0),
        pt:   parseInt(r['Performance Tasks'] || r['PT'] || r['pt'] || 0),
        qa:   parseInt(r['Quarterly Assessment'] || r['QA'] || r['qa'] || 0),
        att:  parseInt(r['Attendance'] || r['att'] || 100),
      }));
      students = imported;
      filtered = [...students];
      renderTable();
      toggleImport();
      toast(`Imported ${imported.length} students from ${file.name}`,'success');
    } catch(err){
      toast('Could not read file. Check format and try again.','error');
    }
  };
  reader.readAsBinaryString(file);
  input.value = '';
}

// ── Export Excel ──────────────────────────────────────────────────────────────
function exportExcel(){
  const subject = document.getElementById('subjectSel').value;
  const quarter = document.getElementById('quarterSel').value;
  const rows = students.map((s,i)=>{
    const f = computeFinal(s);
    return {
      '#': i+1,
      'Name': s.name,
      'Student ID': s.id,
      'Written Works': s.ww,
      'Performance Tasks': s.pt,
      'Quarterly Assessment': s.qa,
      'Attendance (%)': s.att,
      'Final Grade': f,
      'Descriptor': descriptor(f),
      'GPA': gpa(f),
      'Letter Grade': letterGrade(f),
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{wch:4},{wch:22},{wch:12},{wch:14},{wch:18},{wch:22},{wch:14},{wch:12},{wch:20},{wch:8},{wch:12}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, quarter+' Grades');
  XLSX.writeFile(wb, `ClassInstruct_${subject}_${quarter}_Grades.xlsx`);
  toast('Grade sheet exported successfully!','success');
}

// ── Save Grades ───────────────────────────────────────────────────────────────
function saveGrades(){
  toast('Grades saved!','success');
}

// ── Subjects ──────────────────────────────────────────────────────────────────
let subjects = [
  {id:1, name:'Mathematics',  code:'MATH',    active:true},
  {id:2, name:'Science',      code:'SCI',     active:true},
  {id:3, name:'English',      code:'ENG',     active:true},
  {id:4, name:'Filipino',     code:'FIL',     active:true},
  {id:5, name:'MAPEH',        code:'MAPEH',   active:true},
  {id:6, name:'AP',           code:'AP',      active:true},
  {id:7, name:'ESP',          code:'ESP',     active:true},
];
let subjectIdCounter = 8;
let editingSubjectId = null;
let subjectFilter = '';

function renderSubjectDropdown(){
  const sel = document.getElementById('subjectSel');
  const current = sel.value;
  sel.innerHTML = '';
  subjects.filter(s=>s.active).forEach(s=>{
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name + (s.code ? ' ('+s.code+')' : '');
    if(s.name === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderSubjectTable(){
  const body = document.getElementById('subjectBody');
  const list = subjects.filter(s=>
    s.name.toLowerCase().includes(subjectFilter.toLowerCase()) ||
    s.code.toLowerCase().includes(subjectFilter.toLowerCase())
  );
  document.getElementById('subjectCount').textContent = '(' + subjects.length + ' total)';
  body.innerHTML = '';
  if(!list.length){
    body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray-400);padding:2rem;">No subjects found.</td></tr>';
    return;
  }
  list.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--gray-400);font-size:12px;">${i+1}</td>
      <td><div style="font-weight:600;color:var(--gray-900);">${s.name}</div></td>
      <td><span style="font-family:'DM Mono',monospace;font-size:12px;background:var(--gray-100);padding:2px 8px;border-radius:4px;color:var(--gray-600);">${s.code || '—'}</span></td>
      <td><span class="badge ${s.active?'badge-active':'badge-inactive'}">${s.active?'Active':'Inactive'}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm" onclick="openEditModal(${s.id})">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="btn btn-sm" onclick="toggleSubjectStatus(${s.id})" style="${s.active?'color:var(--warning);border-color:var(--warning);':'color:var(--success);border-color:var(--success);'}">
            ${s.active ? 'Deactivate' : 'Activate'}
          </button>
          <button class="btn btn-sm" onclick="deleteSubject(${s.id})" style="color:var(--danger);border-color:var(--danger);">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
}

function addSubject(){
  const nameEl = document.getElementById('newSubjectName');
  const codeEl = document.getElementById('newSubjectCode');
  const errEl  = document.getElementById('subjectFormError');
  const name = nameEl.value.trim();
  const code = codeEl.value.trim().toUpperCase();
  if(!name){ errEl.textContent='Subject name is required.'; errEl.style.display='block'; nameEl.focus(); return; }
  if(subjects.some(s=>s.name.toLowerCase()===name.toLowerCase())){ errEl.textContent='A subject with this name already exists.'; errEl.style.display='block'; nameEl.focus(); return; }
  errEl.style.display='none';
  subjects.push({id:subjectIdCounter++, name, code, active:true});
  nameEl.value=''; codeEl.value='';
  renderSubjectTable(); renderSubjectDropdown();
  toast('Subject "'+name+'" added successfully!','success');
}

function toggleSubjectStatus(id){
  const s = subjects.find(s=>s.id===id);
  if(!s) return;
  s.active = !s.active;
  renderSubjectTable(); renderSubjectDropdown();
  toast(s.name+' is now '+(s.active?'active':'inactive')+'.','success');
}

function deleteSubject(id){
  const s = subjects.find(s=>s.id===id);
  if(!s) return;
  if(!confirm('Delete "'+s.name+'"? This cannot be undone.')) return;
  subjects = subjects.filter(s=>s.id!==id);
  renderSubjectTable(); renderSubjectDropdown();
  toast('Subject deleted.','success');
}

function filterSubjects(q){ subjectFilter=q; renderSubjectTable(); }

function openEditModal(id){
  const s = subjects.find(s=>s.id===id);
  if(!s) return;
  editingSubjectId = id;
  document.getElementById('editSubjectName').value = s.name;
  document.getElementById('editSubjectCode').value = s.code;
  document.getElementById('editOverlay').classList.add('show');
}
function closeEditModal(){ editingSubjectId=null; document.getElementById('editOverlay').classList.remove('show'); }
function saveEdit(){
  const name = document.getElementById('editSubjectName').value.trim();
  const code = document.getElementById('editSubjectCode').value.trim().toUpperCase();
  if(!name){ alert('Subject name is required.'); return; }
  const duplicate = subjects.find(s=>s.name.toLowerCase()===name.toLowerCase() && s.id!==editingSubjectId);
  if(duplicate){ alert('A subject with this name already exists.'); return; }
  const s = subjects.find(s=>s.id===editingSubjectId);
  if(!s) return;
  s.name=name; s.code=code;
  closeEditModal(); renderSubjectTable(); renderSubjectDropdown();
  toast('Subject updated successfully!','success');
}
document.getElementById('editOverlay').addEventListener('click', function(e){ if(e.target===this) closeEditModal(); });

function switchTab(el, tab){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-gradesheet').style.display  = tab==='gradesheet'  ? 'block' : 'none';
  document.getElementById('tab-components').style.display  = tab==='components'  ? 'block' : 'none';
  document.getElementById('tab-summary').style.display     = tab==='summary'     ? 'block' : 'none';
  document.getElementById('tab-subjects').style.display    = tab==='subjects'    ? 'block' : 'none';
  if(tab==='components') renderWeights();
  if(tab==='summary')    renderSummary();
  if(tab==='subjects')   renderSubjectTable();
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function toast(msg, type='success'){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = type==='error' ? '#ef4444' : '#111827';
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 3000);
}

// ── Init ──────────────────────────────────────────────────────────────────────
renderSubjectDropdown();
renderTable();