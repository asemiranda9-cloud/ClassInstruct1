/* ── DATA LAYER ── */
const LIB_KEY = 'ci_library_items';
const SUBJECTS_KEY = 'ci_library_subjects';

function getItems() {
  try { return JSON.parse(localStorage.getItem(LIB_KEY)) || []; } catch { return []; }
}
function saveItems(items) {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(items)); } catch {}
}
function generateId() { return 'lib_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

/* ── SUBJECTS ── */
const SUBJECT_COLORS = ['#6c63ff','#10b981','#f59e0b','#f43f5e','#0ea5e9','#a78bfa','#f97316','#14b8a6','#ec4899','#84cc16'];

function getSubjects() {
  try { return JSON.parse(localStorage.getItem(SUBJECTS_KEY)) || []; } catch { return []; }
}
function saveSubjects(subs) {
  try { localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subs)); } catch {}
}
function addSubject() {
  const input = document.getElementById('newSubjectInput');
  const name = input.value.trim();
  if (!name) return;
  const subs = getSubjects();
  if (subs.find(s => s.name.toLowerCase() === name.toLowerCase())) {
    showToast('Subject already exists.', 'error'); return;
  }
  const color = SUBJECT_COLORS[subs.length % SUBJECT_COLORS.length];
  subs.push({ name, color });
  saveSubjects(subs);
  input.value = '';
  renderSubjectFilters();
  populateSubjectDropdown();
  showToast('Subject added ✓');
}
function deleteSubject(name) {
  if (!confirm(`Delete subject "${name}"? Resources won't be deleted.`)) return;
  const subs = getSubjects().filter(s => s.name !== name);
  saveSubjects(subs);
  if (currentSubject === name) { currentSubject = null; }
  renderSubjectFilters();
  populateSubjectDropdown();
  renderGrid();
}
function renderSubjectFilters() {
  const list = document.getElementById('subjectFilterList');
  const subs = getSubjects();
  if (subs.length === 0) {
    list.innerHTML = `<div style="font-size:0.75rem;color:var(--text-muted);padding:6px 10px 2px">No subjects yet. Add one below.</div>`;
    return;
  }
  list.innerHTML = subs.map(s => `
    <button class="filter-btn${currentSubject===s.name?' active':''}" onclick="setSubjectFilter('${escHtml(s.name)}',this)" style="padding-right:4px">
      <span class="filter-dot" style="background:${s.color}"></span>
      <span style="flex:1;text-align:left">${escHtml(s.name)}</span>
      <button class="subject-delete-btn" onclick="event.stopPropagation();deleteSubject('${escHtml(s.name)}')" title="Remove subject">✕</button>
    </button>`).join('');
}
function populateSubjectDropdown() {
  const sel = document.getElementById('itemSubject');
  const cur = sel.value;
  const subs = getSubjects();
  sel.innerHTML = `<option value="General">General</option>` +
    subs.map(s => `<option value="${escHtml(s.name)}"${s.name===cur?' selected':''}>${escHtml(s.name)}</option>`).join('');
}

/* ── STATE ── */
let currentFilter = 'all';
let currentSubject = null;
let currentViewId = null;
let isEditing = false;

/* ── FILTER ── */
function setFilter(type, btn) {
  currentFilter = type;
  currentSubject = null;
  document.querySelectorAll('.lib-filter-panel .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderSubjectFilters();
  const titles = { all: 'All Resources', lesson_plan: 'Lesson Plans', quiz: 'Quizzes', ai_chat: 'From AI Chat', student_archive: 'Archived Students' };
  document.getElementById('sectionTitle').textContent = titles[type] || 'Resources';
  renderGrid();
}

function setSubjectFilter(subject, btn) {
  currentSubject = currentSubject === subject ? null : subject;
  currentFilter = 'all';
  document.querySelectorAll('.lib-filter-panel .filter-btn').forEach(b => b.classList.remove('active'));
  if (currentSubject) {
    btn.classList.add('active');
    document.getElementById('sectionTitle').textContent = subject + ' Resources';
  } else {
    document.querySelector('.filter-btn').classList.add('active');
    document.getElementById('sectionTitle').textContent = 'All Resources';
  }
  renderGrid();
}

function filterLibrary() { renderGrid(); }

/* ── RENDER GRID ── */
function renderGrid() {
  const grid = document.getElementById('libGrid');
  let items = getItems();
  const search = document.getElementById('libSearch').value.toLowerCase().trim();

  if (currentFilter !== 'all') items = items.filter(i => i.type === currentFilter);
  if (currentSubject) items = items.filter(i => i.subject === currentSubject);
  if (search) items = items.filter(i =>
    (i.title||'').toLowerCase().includes(search) ||
    (i.content||'').toLowerCase().includes(search) ||
    (i.tags||[]).some(t => t.toLowerCase().includes(search))
  );

  const all = getItems();
  document.getElementById('count-all').textContent = all.length;
  document.getElementById('count-lesson_plan').textContent = all.filter(i=>i.type==='lesson_plan').length;
  document.getElementById('count-quiz').textContent = all.filter(i=>i.type==='quiz').length;
  document.getElementById('count-ai_chat').textContent = all.filter(i=>i.type==='ai_chat').length;
  const countArchiveEl = document.getElementById('count-student_archive');
  if (countArchiveEl) countArchiveEl.textContent = all.filter(i=>i.type==='student_archive').length;

  document.getElementById('stat-total').textContent = all.length;
  document.getElementById('stat-quizzes').textContent = all.filter(i=>i.type==='quiz').length;
  document.getElementById('stat-lessons').textContent = all.filter(i=>i.type==='lesson_plan').length;
  document.getElementById('stat-ai').textContent = all.filter(i=>i.type==='ai_chat').length;

  if (items.length === 0) {
    grid.innerHTML = `<div class="lib-empty" style="grid-column:1/-1">
      <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/></svg>
      <h3>${search ? 'No results found' : 'Nothing here yet'}</h3>
      <p>${search ? 'Try a different search term.' : 'Add a lesson plan, quiz, or move an AI chat here.'}</p>
    </div>`;
    return;
  }
  grid.innerHTML = items.map(item => makeCard(item)).join('');
}

const TYPE_META = {
  lesson_plan:    { label: '📋 Lesson Plan',      color: '#f59e0b', bg: 'var(--amber-lt)', accent: '#f59e0b' },
  quiz:           { label: '✅ Quiz',              color: '#10b981', bg: 'var(--green-lt)', accent: '#10b981' },
  ai_chat:        { label: '🤖 AI Chat',           color: '#0ea5e9', bg: 'var(--sky-lt)',   accent: '#0ea5e9' },
  student_archive:{ label: '🎓 Archived Student',  color: '#a78bfa', bg: 'rgba(167,139,250,0.14)', accent: '#a78bfa' },
};

function makeCard(item) {
  const m = TYPE_META[item.type] || TYPE_META.lesson_plan;
  const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'}) : '';
  const preview = (item.content || 'No content yet.').substring(0, 120);
  const tags = (item.tags || []).slice(0, 3).map(t => `<span class="card-tag">${escHtml(t)}</span>`).join('');
  const filesBadge = (item.files && item.files.length)
    ? `<span class="card-tag" style="background:var(--sky-lt);color:var(--sky)">📎 ${item.files.length} file${item.files.length>1?'s':''}</span>` : '';
  return `
  <div class="lib-card" style="--card-accent:${m.accent}" onclick="openViewModal('${item.id}')">
    <div class="card-top">
      <span class="card-type-badge" style="background:${m.bg};color:${m.color}">${m.label}</span>
      <button class="card-menu-btn" onclick="event.stopPropagation();cardMenu('${item.id}',this)" title="Options">
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
      </button>
    </div>
    <div>
      <div class="card-title">${escHtml(item.title||'Untitled')}</div>
      <div class="card-meta">${item.subject ? item.subject + ' · ' : ''}${item.grade ? item.grade + ' · ' : ''}${date}</div>
    </div>
    <div class="card-preview">${escHtml(preview)}</div>
    <div class="card-footer">
      <div class="card-tags">${tags}${filesBadge}</div>
      <div class="card-actions">
        <button class="card-action-btn" onclick="event.stopPropagation();exportItemPDF('${item.id}')">PDF</button>
        <button class="card-action-btn primary" onclick="event.stopPropagation();openViewModal('${item.id}')">Open</button>
      </div>
    </div>
  </div>`;
}

/* ── CARD CONTEXT MENU ── */
let _cardMenuId = null;
function cardMenu(id, btn) {
  closeCardMenu();
  const item = getItems().find(i=>i.id===id);
  if (!item) return;
  const menu = document.createElement('div');
  menu.id = 'card-ctx-menu';
  menu.innerHTML = `
    <button onclick="openViewModal('${id}');closeCardMenu()">
      <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
      View
    </button>
    <button onclick="openEditMode('${id}');closeCardMenu()">
      <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
      Edit
    </button>
    <button onclick="exportItemPDF('${id}');closeCardMenu()">
      <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
      Export PDF
    </button>
    <div style="height:0.5px;background:var(--border);margin:4px 6px"></div>
    <button style="color:#ef4444" onclick="confirmDelete('${id}');closeCardMenu()">
      <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      Delete
    </button>`;
  menu.style.cssText = `position:fixed;z-index:9999;background:var(--card-bg);border:0.5px solid var(--card-border);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.18);padding:5px;min-width:170px;font-family:inherit;`;
  menu.querySelectorAll('button').forEach(b => {
    b.style.cssText = 'display:flex;align-items:center;gap:9px;width:100%;background:none;border:none;border-radius:7px;padding:8px 10px;font-size:0.78rem;font-weight:500;cursor:pointer;font-family:inherit;text-align:left;transition:background 0.12s;color:inherit;';
    b.onmouseenter = () => { if (!b.style.color.includes('4444')) b.style.background='rgba(108,99,255,0.08)'; };
    b.onmouseleave = () => { b.style.background=''; };
  });
  document.body.appendChild(menu);
  _cardMenuId = menu;
  const rect = btn.getBoundingClientRect();
  let left = rect.left;
  if (left + 180 > window.innerWidth - 8) left = window.innerWidth - 180 - 8;
  let top = rect.bottom + 4;
  if (top + 160 > window.innerHeight - 8) top = rect.top - 164;
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
  setTimeout(()=>document.addEventListener('click', closeCardMenuOnClick), 10);
}
function closeCardMenu() {
  if (_cardMenuId) { _cardMenuId.remove(); _cardMenuId = null; }
  document.removeEventListener('click', closeCardMenuOnClick);
}
function closeCardMenuOnClick(e) {
  if (_cardMenuId && !_cardMenuId.contains(e.target)) closeCardMenu();
}

/* ── FILE HANDLING ── */
let pendingFiles = []; // { name, size, type, dataUrl }

function fileIcon(type) {
  if (type.includes('pdf')) return '📄';
  if (type.includes('word') || type.includes('doc')) return '📝';
  if (type.includes('sheet') || type.includes('excel') || type.includes('xls')) return '📊';
  if (type.startsWith('image/')) return '🖼️';
  return '📁';
}
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1048576).toFixed(1) + ' MB';
}

function handleFileSelect(files) {
  Array.from(files).forEach(f => processFile(f));
  document.getElementById('fileInput').value = '';
}
function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('fileDropZone').classList.remove('drag-over');
  handleFileSelect(e.dataTransfer.files);
}
function processFile(file) {
  if (file.size > 10 * 1024 * 1024) { showToast(`"${file.name}" is too large (max 10 MB).`, 'error'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    pendingFiles.push({ name: file.name, size: file.size, type: file.type, dataUrl: ev.target.result });
    renderAttachedFiles();
  };
  reader.readAsDataURL(file);
}
function renderAttachedFiles() {
  const list = document.getElementById('attachedFilesList');
  if (!pendingFiles.length) { list.innerHTML = ''; return; }
  list.innerHTML = pendingFiles.map((f, i) => `
    <div class="file-attached-item">
      <span class="file-icon">${fileIcon(f.type)}</span>
      <span class="file-name">${escHtml(f.name)}</span>
      <span class="file-size">${formatSize(f.size)}</span>
      <button class="file-remove-btn" onclick="removeAttachedFile(${i})">✕</button>
    </div>`).join('');
}
function removeAttachedFile(idx) {
  pendingFiles.splice(idx, 1);
  renderAttachedFiles();
}
function clearPendingFiles() {
  pendingFiles = [];
  renderAttachedFiles();
}

/* ── ADD MODAL ── */
let editingItemId = null;

function openAddModal() {
  editingItemId = null;
  clearPendingFiles();
  document.getElementById('modalTitle').textContent = 'Add Resource';
  document.getElementById('modalSubtitle').textContent = 'Add a lesson plan, quiz, or teaching material';
  document.getElementById('itemTitle').value = '';
  document.getElementById('itemContent').value = '';
  document.getElementById('itemTags').value = '';
  document.getElementById('itemType').value = 'lesson_plan';
  document.getElementById('itemGrade').value = '';
  populateSubjectDropdown();
  document.getElementById('itemSubject').value = 'General';
  updateModalIcon();
  document.getElementById('addModal').classList.add('open');
}

function openAddModalWithData(data) {
  editingItemId = null;
  clearPendingFiles();
  populateSubjectDropdown();
  document.getElementById('itemTitle').value = data.title || '';
  document.getElementById('itemContent').value = data.content || '';
  document.getElementById('itemTags').value = (data.tags||[]).join(', ');
  document.getElementById('itemType').value = data.type || 'ai_chat';
  document.getElementById('itemSubject').value = data.subject || 'General';
  document.getElementById('itemGrade').value = data.grade || '';
  document.getElementById('modalTitle').textContent = 'Save to Library';
  document.getElementById('modalSubtitle').textContent = 'Review and save this AI chat resource';
  updateModalIcon();
  document.getElementById('addModal').classList.add('open');
}

function updateModalIcon() {
  const type = document.getElementById('itemType').value;
  const m = TYPE_META[type] || TYPE_META.lesson_plan;
  document.getElementById('modalIcon').style.background = m.bg;
}

function closeModal() {
  document.getElementById('addModal').classList.remove('open');
}

function saveItem() {
  const title = document.getElementById('itemTitle').value.trim();
  if (!title) { showToast('Please enter a title.', 'error'); return; }
  const items = getItems();
  const item = {
    id: editingItemId || generateId(),
    type: document.getElementById('itemType').value,
    subject: document.getElementById('itemSubject').value,
    grade: document.getElementById('itemGrade').value,
    title,
    content: document.getElementById('itemContent').value.trim(),
    tags: document.getElementById('itemTags').value.split(',').map(t=>t.trim()).filter(Boolean),
    files: pendingFiles.map(f => ({ name: f.name, size: f.size, type: f.type, dataUrl: f.dataUrl })),
    createdAt: editingItemId ? (items.find(i=>i.id===editingItemId)||{}).createdAt || new Date().toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (editingItemId) {
    const idx = items.findIndex(i=>i.id===editingItemId);
    if (idx >= 0) items[idx] = item; else items.unshift(item);
  } else {
    items.unshift(item);
  }
  saveItems(items);
  closeModal();
  renderGrid();
  showToast(editingItemId ? 'Resource updated ✓' : 'Saved to Library ✓');
}

/* ── VIEW MODAL ── */
function openViewModal(id) {
  const item = getItems().find(i=>i.id===id);
  if (!item) return;
  currentViewId = id;
  isEditing = false;
  const m = TYPE_META[item.type] || TYPE_META.lesson_plan;
  document.getElementById('viewTitle').textContent = item.title || 'Untitled';
  document.getElementById('viewMeta').textContent = [item.subject, item.grade, item.type.replace('_',' ')].filter(Boolean).join(' · ');
  // Show content + attached files
  let contentHtml = `<div style="padding:14px;background:var(--input-bg);border-radius:10px;border:0.5px solid var(--input-border);font-size:0.875rem;line-height:1.7;color:var(--text-primary);white-space:pre-wrap;max-height:260px;overflow-y:auto" id="viewContent">${escHtml(item.content || '(No content)')}</div>`;
  if (item.files && item.files.length) {
    contentHtml += `<div style="margin-top:12px">
      <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);margin-bottom:8px">Attached Files</div>
      <div class="file-attached-list">
        ${item.files.map(f => `
          <div class="file-attached-item">
            <span class="file-icon">${fileIcon(f.type)}</span>
            <span class="file-name">${escHtml(f.name)}</span>
            <span class="file-size">${formatSize(f.size)}</span>
            <a href="${escHtml(f.dataUrl)}" download="${escHtml(f.name)}" style="color:var(--purple);font-size:0.72rem;font-weight:600;text-decoration:none;flex-shrink:0">↓ Download</a>
          </div>`).join('')}
      </div>
    </div>`;
  }
  document.getElementById('readView').innerHTML = contentHtml;
  document.getElementById('editArea').value = item.content || '';
  document.getElementById('viewModalIcon').style.background = m.bg;
  document.getElementById('readView').style.display = '';
  document.getElementById('editView').classList.remove('visible');
  document.getElementById('editToggleBtn').innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Edit`;
  document.getElementById('saveEditBtn').style.display = 'none';
  document.getElementById('viewModal').classList.add('open');
}

function openEditMode(id) {
  openViewModal(id);
  setTimeout(toggleEditMode, 100);
}

function closeViewModal() {
  document.getElementById('viewModal').classList.remove('open');
  currentViewId = null;
  isEditing = false;
}

function toggleEditMode() {
  isEditing = !isEditing;
  document.getElementById('readView').style.display = isEditing ? 'none' : '';
  document.getElementById('editView').classList.toggle('visible', isEditing);
  document.getElementById('editToggleBtn').innerHTML = isEditing
    ? `<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg> Preview`
    : `<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Edit`;
  document.getElementById('saveEditBtn').style.display = isEditing ? '' : 'none';
  if (isEditing) document.getElementById('editArea').focus();
}

function saveEdit() {
  if (!currentViewId) return;
  const items = getItems();
  const idx = items.findIndex(i=>i.id===currentViewId);
  if (idx<0) return;
  items[idx].content = document.getElementById('editArea').value;
  items[idx].updatedAt = new Date().toISOString();
  saveItems(items);
  toggleEditMode();
  openViewModal(currentViewId);
  renderGrid();
  showToast('Changes saved ✓');
}

/* ── EDITOR HELPERS ── */
function wrapText(before, after) {
  const ta = document.getElementById('editArea');
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.substring(s, e);
  ta.value = ta.value.substring(0, s) + before + sel + after + ta.value.substring(e);
  ta.focus(); ta.setSelectionRange(s + before.length, e + before.length);
}
function insertText(text) {
  const ta = document.getElementById('editArea');
  const s = ta.selectionStart;
  ta.value = ta.value.substring(0,s) + text + ta.value.substring(s);
  ta.focus(); ta.setSelectionRange(s+text.length, s+text.length);
}

/* ── DELETE ── */
function deleteItem() {
  if (!currentViewId) return;
  confirmDelete(currentViewId, true);
}
function confirmDelete(id, closeView=false) {
  if (!confirm('Delete this resource from your library? This cannot be undone.')) return;
  const items = getItems().filter(i=>i.id!==id);
  saveItems(items);
  if (closeView) closeViewModal();
  renderGrid();
  showToast('Deleted.');
}

/* ── EXPORT PDF ── */
function exportItemPDF(id) {
  const item = getItems().find(i=>i.id===id);
  if (!item) return;
  showToast('Generating PDF…');
  setTimeout(() => {
    const win = window.open('', '_blank');
    if (!win) { showToast('Allow pop-ups to export PDF.','error'); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>${escHtml(item.title)}</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;max-width:700px;margin:40px auto;color:#1e1a4a;line-height:1.7}
      h1{font-size:1.6rem;margin-bottom:4px;color:#1e1a4a}
      .meta{font-size:0.8rem;color:#6b6597;margin-bottom:24px;border-bottom:1px solid #e2e8f0;padding-bottom:12px}
      pre{white-space:pre-wrap;font-family:inherit;font-size:0.9rem;color:#1e1a4a}
      .footer{margin-top:40px;font-size:0.72rem;color:#a099cc;border-top:1px solid #e2e8f0;padding-top:10px}
    </style></head><body>
    <h1>${escHtml(item.title)}</h1>
    <div class="meta">${[item.subject,item.grade,item.type.replace('_',' ')].filter(Boolean).join(' · ')} · ${new Date(item.createdAt||Date.now()).toLocaleDateString()}</div>
    <pre>${escHtml(item.content||'(No content)')}</pre>
    <div class="footer">Generated by ClassInstruct AI · ${new Date().toLocaleString()}</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(()=>{ win.print(); win.close(); }, 400);
    showToast('PDF ready!');
  }, 300);
}

function downloadPDF() { if (currentViewId) exportItemPDF(currentViewId); }

/* ── EXPORT PPT ── */
function downloadPPT() {
  if (!currentViewId) return;
  const item = getItems().find(i=>i.id===currentViewId);
  if (!item) return;
  showToast('Generating PPT…');
  const lines = (item.content||'').split('\n').filter(Boolean);
  const slides = [];
  let current = [];
  lines.forEach(l => {
    if (l.startsWith('##') || l.startsWith('#')) {
      if (current.length) slides.push(current);
      current = [l];
    } else {
      current.push(l);
      if (current.length >= 8) { slides.push(current); current = []; }
    }
  });
  if (current.length) slides.push(current);
  if (slides.length === 0) slides.push([item.title, item.content||'No content']);
  const slideHtml = slides.map((s, i) => `
    <div class="slide">
      <div class="slide-num">${i+1} / ${slides.length}</div>
      <div class="slide-content">
        ${s.map((l,li) => li===0 ? `<h2>${escHtml(l.replace(/^#+\s*/,''))}</h2>` : `<p>${escHtml(l)}</p>`).join('')}
      </div>
      <div class="slide-footer">ClassInstruct AI · ${escHtml(item.title)}</div>
    </div>`).join('');
  const win = window.open('','_blank');
  if (!win) { showToast('Allow pop-ups to export.','error'); return; }
  win.document.write(`<!DOCTYPE html><html><head><title>${escHtml(item.title)}</title>
  <style>
    body{margin:0;padding:20px;background:#0b0b15;font-family:'Segoe UI',sans-serif;display:flex;flex-direction:column;gap:20px;align-items:center}
    .slide{width:800px;min-height:460px;background:#17172a;border-radius:16px;padding:40px 48px;position:relative;display:flex;flex-direction:column;justify-content:center;border:1px solid rgba(108,99,255,0.2);box-shadow:0 8px 30px rgba(0,0,0,0.4)}
    .slide-num{position:absolute;top:16px;right:20px;font-size:12px;color:#55556e;font-weight:600}
    .slide-footer{position:absolute;bottom:14px;left:48px;font-size:11px;color:#55556e}
    h2{font-size:1.8rem;color:#e8e8f4;margin-bottom:16px;line-height:1.2}
    p{font-size:1rem;color:#8888aa;line-height:1.7;margin:4px 0}
    @media print{body{background:white}.slide{box-shadow:none;border-color:#e2e8f0;background:white}h2{color:#1e1a4a}p{color:#6b6597}}
  </style></head><body>${slideHtml}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(()=>win.print(), 400);
  showToast('PPT export ready!');
}

/* ── VIEW TOGGLE ── */
function setView(v) {
  const grid = document.getElementById('libGrid');
  document.getElementById('gridViewBtn').classList.toggle('active', v==='grid');
  document.getElementById('listViewBtn').classList.toggle('active', v==='list');
  grid.classList.toggle('list-view', v==='list');
}

/* ── UTILITIES ── */
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showToast(msg, type='') {
  const t = document.getElementById('libToast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' toast-'+type : '') + ' visible';
  setTimeout(() => t.classList.remove('visible'), 3000);
}

/* ── CLOSE MODALS ON BACKDROP CLICK ── */
document.getElementById('addModal').addEventListener('click', e => { if (e.target===e.currentTarget) closeModal(); });
document.getElementById('viewModal').addEventListener('click', e => { if (e.target===e.currentTarget) closeViewModal(); });

/* ── ACCEPT ITEMS FROM AI PAGE (postMessage) ── */
window.addEventListener('message', e => {
  if (e.data && e.data.type === 'CI_MOVE_TO_LIBRARY') {
    const d = e.data.payload || {};
    openAddModalWithData(d);
  }
  if (e.data && e.data.type === 'CI_SET_THEME') {
    document.documentElement.setAttribute('data-theme', e.data.theme);
  }
});

/* ── INIT ── */
function init() {
  renderSubjectFilters();
  populateSubjectDropdown();
  renderGrid();

  const params = new URLSearchParams(window.location.search);
  if (params.get('add') === '1') {
    openAddModalWithData({
      title: params.get('title') || '',
      type: params.get('itemType') || 'ai_chat',
      content: params.get('content') || '',
      subject: params.get('subject') || 'General',
    });
  }

  try {
    const pending = localStorage.getItem('ci_lib_pending');
    if (pending) {
      localStorage.removeItem('ci_lib_pending');
      const data = JSON.parse(pending);
      setTimeout(() => openAddModalWithData(data), 300);
    }
  } catch {}
}

document.addEventListener('DOMContentLoaded', init);