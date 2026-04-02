<?php session_start(); ?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Grades — ClassInstruct</title>
<link rel="stylesheet" href="Grades.css" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
</head>
<body>
<div class="layout">
  <div class="main">

    <!-- Topbar -->
    <div class="topbar">
      <span class="page-title">Grades</span>
      <div class="topbar-search">
     
        <input type="text" id="topSearch" placeholder="Search students..." oninput="filterSearch(this.value)">
      </div>
      <div class="topbar-right">ClassInstruct</div>
    </div>

    <!-- Filters bar -->
    <div class="filters-bar">
      <div class="filters-left">
        <select id="subjectSel" onchange="refresh()"><option value="">Loading subjects...</option></select>
        <select id="quarterSel" onchange="refresh()">
          <option value="Q1">Q1 — First Quarter</option>
          <option value="Q2">Q2 — Second Quarter</option>
          <option value="Q3">Q3 — Third Quarter</option>
          <option value="Q4">Q4 — Fourth Quarter</option>
        </select>
        <select id="gradeSel" onchange="refresh()">
          <option value="">All Grades</option>
          <option>Grade 1</option><option>Grade 2</option><option>Grade 3</option>
          <option>Grade 4</option><option>Grade 5</option><option>Grade 6</option>
          <option>Grade 7</option><option>Grade 8</option><option>Grade 9</option>
          <option>Grade 10</option><option>Grade 11</option><option>Grade 12</option>
        </select>
        <select id="sectionSel" onchange="refresh()">
          <option value="">All Sections</option>
          <option>Section A</option><option>Section B</option>
          <option>Section C</option><option>Section D</option>
        </select>
      </div>
      <div class="filters-right">
        <button class="btn" onclick="toggleImport()">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Import Excel
        </button>
        <button class="btn btn-success" onclick="exportExcel()">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export Excel
        </button>
        <button class="btn btn-primary" onclick="saveGrades()">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Save Grades
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab active"  onclick="switchTab(this,'gradesheet')">Grade Sheet</button>
      <button class="tab"         onclick="switchTab(this,'components')">Grade Components</button>
      <button class="tab"         onclick="switchTab(this,'summary')">Class Summary</button>
      <button class="tab"         onclick="switchTab(this,'gpa')">GPA Scale</button>
      <button class="tab"         onclick="switchTab(this,'subjects')">Manage Subjects</button>
    </div>

    <!-- Content -->
    <div class="content">

      <!-- ══ GRADE SHEET ══ -->
      <div id="tab-gradesheet">
        <div class="import-zone" id="importZone">
          <div class="import-zone-icon">📊</div>
          <div class="import-zone-title">Import grade sheet from Excel</div>
          <div class="import-zone-sub">Upload an .xlsx or .csv file. Required columns: <strong>Name, Written Works, Performance Tasks, Quarterly Assessment, Attendance</strong></div>
          <div style="display:flex;gap:8px;justify-content:center;">
            <button class="btn btn-primary" onclick="document.getElementById('fileInput').click()">Choose File</button>
            <button class="btn" onclick="toggleImport()">Cancel</button>
          </div>
          <input type="file" id="fileInput" accept=".xlsx,.xls,.csv" onchange="handleImport(this)">
          <p style="font-size:11px;color:var(--gray-400);margin-top:12px;">Supported: .xlsx, .xls, .csv</p>
        </div>

        <div class="stat-grid" id="statGrid"></div>

        <div class="table-card">
          <div class="table-toolbar">
            <span class="table-toolbar-title" id="tableTitle">Loading students...</span>
            <div class="table-filters">
              <div class="search-wrap">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input type="text" placeholder="Search student..." oninput="filterSearch(this.value)">
              </div>
              <select onchange="filterDesc(this.value)" id="descFilter">
                <option value="">All descriptors</option>
              </select>
            </div>
          </div>
          <div id="loadingRow" style="text-align:center;padding:40px;color:var(--gray-400);font-size:13px;">
            Loading students...
          </div>
          <div style="overflow-x:auto;display:none;" id="tableWrap">
            <table>
              <thead>
                <tr>
                  <th style="width:36px;">#</th>
                  <th style="width:180px;">Student</th>
                  <th style="width:90px;">Written Works<br><small style="font-weight:400;color:var(--gray-400);text-transform:none;letter-spacing:0;" id="ww-pct-label">30%</small></th>
                  <th style="width:90px;">Perf. Tasks<br><small style="font-weight:400;color:var(--gray-400);text-transform:none;letter-spacing:0;" id="pt-pct-label">50%</small></th>
                  <th style="width:90px;">Assessment<br><small style="font-weight:400;color:var(--gray-400);text-transform:none;letter-spacing:0;" id="qa-pct-label">20%</small></th>
                  <th style="width:100px;">Attendance</th>
                  <th style="width:70px;">Final</th>
                  <th style="width:140px;">Descriptor</th>
                  <th style="width:65px;">GPA</th>
                  <th style="width:70px;">Letter</th>
                </tr>
              </thead>
              <tbody id="gradeBody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ══ COMPONENTS ══ -->
      <div id="tab-components" style="display:none;">
        <p style="font-size:13px;color:var(--gray-500);margin-bottom:1.25rem;">
          Set the weight for each grading component. The total must equal <strong>100%</strong>.
          Changes affect the Final Grade calculation.
        </p>
        <div class="weight-total" id="weightTotalBox"></div>
        <div class="weights-grid" id="weightsGrid"></div>
        <div style="display:flex;gap:8px;margin-bottom:2rem;">
          <button class="btn btn-primary" onclick="saveWeights()">Save Weights</button>
          <button class="btn" onclick="resetWeights()">Reset to DepEd Default</button>
        </div>

        <!-- Component Items Editor -->
        <div style="margin-bottom:.75rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--gray-900);margin-bottom:2px;">Component Items</div>
            <p style="font-size:13px;color:var(--gray-500);margin:0;">
              Add individual scored items to each component. Each item's score is averaged to produce the component score used in the Final Grade.
            </p>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary" onclick="saveComponentItems()">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save Items
            </button>
            <button class="btn" onclick="resetComponentItems()">Reset All</button>
          </div>
        </div>

        <div id="compItemsGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
          <!-- Rendered by JS -->
        </div>
      </div>

      <!-- ══ SUMMARY ══ -->
      <div id="tab-summary" style="display:none;">
        <div class="stat-grid" id="summaryStats"></div>
        <div class="table-card" style="margin-bottom:1.5rem;">
          <div class="table-toolbar"><span class="table-toolbar-title">Performance distribution</span></div>
          <div style="padding:1.25rem;" id="distBars"></div>
        </div>
        <div class="table-card">
          <div class="table-toolbar"><span class="table-toolbar-title">Grade component averages</span></div>
          <div style="padding:1.25rem;" id="compBars"></div>
        </div>
      </div>

      <!-- ══ GPA SCALE ══ -->
      <div id="tab-gpa" style="display:none;">
        <p style="font-size:13px;color:var(--gray-500);margin-bottom:1.25rem;">
          Configure your school's GPA scale. Each row maps a grade range to a GPA value, letter grade, and descriptor.
          <strong>Changes apply immediately to all grade calculations.</strong>
        </p>
        <div class="table-card" style="margin-bottom:1.5rem;">
          <div class="table-toolbar">
            <span class="table-toolbar-title">GPA Scale Rows</span>
            <button class="btn btn-primary" onclick="addGpaRow()">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Row
            </button>
          </div>
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>Min Grade</th>
                  <th>Max Grade</th>
                  <th>GPA Value</th>
                  <th>Letter</th>
                  <th>Descriptor</th>
                  <th>Scale Name</th>
                  <th style="width:80px;">Action</th>
                </tr>
              </thead>
              <tbody id="gpaBody"></tbody>
            </table>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" onclick="saveGpaScales()">Save GPA Scale</button>
          <button class="btn" onclick="resetGpaDefault()">Reset to DepEd Default</button>
        </div>
      </div>

      <!-- ══ SUBJECTS ══ -->
      <div id="tab-subjects" style="display:none;">
        <div class="table-card" style="margin-bottom:1.5rem;">
          <div class="table-toolbar"><span class="table-toolbar-title">Add New Subject</span></div>
          <div style="padding:1.25rem;">
            <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end;">
              <div>
                <label style="font-size:12px;color:var(--gray-500);display:block;margin-bottom:6px;font-weight:500;">Subject Name *</label>
                <input type="text" id="newSubjectName" placeholder="e.g. Mathematics" style="width:100%;">
              </div>
              <div>
                <label style="font-size:12px;color:var(--gray-500);display:block;margin-bottom:6px;font-weight:500;">Short Code</label>
                <input type="text" id="newSubjectCode" placeholder="e.g. MATH" maxlength="8" style="width:100%;">
              </div>
              <button class="btn btn-primary" onclick="addSubject()">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Subject
              </button>
            </div>
            <p id="subjectFormError" style="font-size:12px;color:var(--danger);margin-top:8px;display:none;"></p>
          </div>
        </div>
        <div class="table-card">
          <div class="table-toolbar">
            <span class="table-toolbar-title">All Subjects <span id="subjectCount" style="color:var(--gray-400);font-weight:400;"></span></span>
            <div class="search-wrap">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="text" placeholder="Search subjects..." oninput="filterSubjects(this.value)">
            </div>
          </div>
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th style="width:36px;">#</th>
                  <th>Subject Name</th>
                  <th style="width:100px;">Code</th>
                  <th style="width:100px;">Status</th>
                  <th style="width:160px;">Actions</th>
                </tr>
              </thead>
              <tbody id="subjectBody"></tbody>
            </table>
          </div>
        </div>

        <!-- Edit subject modal -->
        <div id="editOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;align-items:center;justify-content:center;">
          <div style="background:var(--white);border-radius:var(--radius-lg);padding:1.5rem;width:400px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,.2);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;">
              <span style="font-size:15px;font-weight:700;color:var(--gray-900);">Edit Subject</span>
              <button class="btn btn-icon" onclick="closeEditModal()">✕</button>
            </div>
            <div style="margin-bottom:12px;">
              <label style="font-size:12px;color:var(--gray-500);display:block;margin-bottom:6px;font-weight:500;">Subject Name *</label>
              <input type="text" id="editSubjectName" style="width:100%;">
            </div>
            <div style="margin-bottom:1.25rem;">
              <label style="font-size:12px;color:var(--gray-500);display:block;margin-bottom:6px;font-weight:500;">Short Code</label>
              <input type="text" id="editSubjectCode" maxlength="8" style="width:100%;">
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
              <button class="btn" onclick="closeEditModal()">Cancel</button>
              <button class="btn btn-primary" onclick="saveEdit()">Save Changes</button>
            </div>
          </div>
        </div>
      </div>

    </div><!-- /content -->
  </div><!-- /main -->
</div><!-- /layout -->

<div class="toast" id="toast"></div>
<script src="Grades.js"></script>
</body>
</html>