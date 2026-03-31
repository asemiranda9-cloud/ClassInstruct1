<?php
/**
 * grades.php
 * ClassInstruct — Grades Page
 */
session_start();
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Grades — ClassInstruct</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --primary:#6c63ff;
  --primary-dark:#5a52e0;
  --primary-light:#ede9ff;
  --success:#10b981;
  --success-light:#d1fae5;
  --warning:#f59e0b;
  --warning-light:#fef3c7;
  --danger:#ef4444;
  --danger-light:#fee2e2;
  --sidebar-bg:#1a1d2e;
  --sidebar-hover:rgba(255,255,255,0.07);
  --sidebar-active:#6c63ff;
  --gray-50:#f8f9fc;
  --gray-100:#f1f3f9;
  --gray-200:#e4e8f0;
  --gray-300:#cdd3df;
  --gray-400:#9aa3b5;
  --gray-500:#6b7588;
  --gray-600:#4b5468;
  --gray-700:#353d52;
  --gray-800:#1e2435;
  --gray-900:#111827;
  --white:#ffffff;
  --radius-sm:6px;
  --radius:10px;
  --radius-lg:14px;
  --shadow-sm:0 1px 4px rgba(0,0,0,.06);
  --shadow:0 4px 16px rgba(0,0,0,.08);
  --transition:180ms ease;
}

body{
  font-family:'Inter',sans-serif;
  background:var(--gray-50);
  color:var(--gray-800);
  min-height:100vh;
  font-size:14px;
  line-height:1.5;
}

/* ── Layout ── */
.layout{display:flex;min-height:100vh;}

/* ── Sidebar ── */
.sidebar{
  width:210px;
  background:var(--sidebar-bg);
  padding:0;
  display:flex;
  flex-direction:column;
  flex-shrink:0;
  position:sticky;
  top:0;
  height:100vh;
  overflow-y:auto;
}

.sidebar-logo{
  display:flex;
  align-items:center;
  gap:10px;
  padding:1.25rem 1.25rem 1rem;
  border-bottom:1px solid rgba(255,255,255,0.07);
  margin-bottom:.5rem;
}
.logo-icon{
  width:32px;height:32px;
  background:var(--primary);
  border-radius:8px;
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;
}
.logo-text{
  font-size:15px;font-weight:700;color:#fff;
  letter-spacing:-0.3px;
}

/* User profile block */
.user-profile{
  display:flex;
  align-items:center;
  gap:10px;
  padding:.75rem 1.25rem 1rem;
  margin-bottom:.5rem;
}
.user-avatar{
  width:38px;height:38px;
  background:rgba(108,99,255,0.25);
  border:2px solid rgba(108,99,255,0.5);
  border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:14px;font-weight:600;color:#a89fff;
  flex-shrink:0;
}
.user-name{font-size:13px;font-weight:600;color:#fff;}
.user-role{font-size:11px;color:var(--gray-400);}

.nav-menu{
  display:flex;
  flex-direction:column;
  gap:2px;
  padding:0 .75rem;
  flex:1;
}
.nav-btn{
  display:flex;
  align-items:center;
  gap:10px;
  padding:.6rem .75rem;
  border-radius:var(--radius-sm);
  color:var(--gray-400);
  font-size:13px;
  font-family:'Inter',sans-serif;
  font-weight:500;
  cursor:pointer;
  background:none;
  border:none;
  text-align:left;
  width:100%;
  transition:var(--transition);
  text-decoration:none;
}
.nav-btn:hover{background:var(--sidebar-hover);color:#fff;}
.nav-btn.active{background:var(--primary);color:#fff;}
.nav-btn svg{flex-shrink:0;opacity:.8;}
.nav-btn.active svg{opacity:1;}

/* ── Main ── */
.main{flex:1;display:flex;flex-direction:column;min-width:0;}

/* ── Topbar ── */
.topbar{
  background:var(--white);
  border-bottom:1px solid var(--gray-200);
  padding:.9rem 1.75rem;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
  position:sticky;
  top:0;
  z-index:100;
}
.topbar-left{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.page-title{
  font-size:20px;
  font-weight:700;
  color:var(--primary);
  letter-spacing:-0.4px;
}

/* Search bar */
.topbar-search{
  flex:1;
  max-width:380px;
  position:relative;
}
.topbar-search input{
  width:100%;
  padding:7px 14px 7px 36px;
  border-radius:20px;
  border:1px solid var(--gray-200);
  background:var(--gray-50);
  font-size:13px;
  font-family:'Inter',sans-serif;
  color:var(--gray-700);
  outline:none;
  transition:var(--transition);
}
.topbar-search input:focus{border-color:var(--primary);background:#fff;}
.topbar-search svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--gray-400);}

.topbar-right{
  font-size:13px;
  font-weight:600;
  color:var(--gray-700);
}

/* ── Buttons ── */
.btn{
  display:inline-flex;align-items:center;gap:6px;
  padding:7px 14px;border-radius:var(--radius-sm);
  border:1px solid var(--gray-200);background:var(--white);
  color:var(--gray-700);font-size:13px;font-family:'Inter',sans-serif;
  cursor:pointer;transition:var(--transition);white-space:nowrap;font-weight:500;
}
.btn:hover{background:var(--gray-50);border-color:var(--gray-300);}
.btn-primary{background:var(--primary);color:#fff;border-color:var(--primary);}
.btn-primary:hover{background:var(--primary-dark);border-color:var(--primary-dark);}
.btn-success{background:var(--success);color:#fff;border-color:var(--success);}
.btn-success:hover{background:#059669;border-color:#059669;}
.btn-sm{padding:4px 10px;font-size:12px;}
.btn-icon{padding:6px 8px;}

/* ── Selects / Inputs ── */
select,input[type=text],input[type=number]{
  padding:7px 10px;border-radius:var(--radius-sm);
  border:1px solid var(--gray-200);background:var(--white);
  color:var(--gray-800);font-size:13px;font-family:'Inter',sans-serif;
  transition:var(--transition);outline:none;
}
select:focus,input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(108,99,255,.1);}
select{cursor:pointer;padding-right:28px;appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 8px center;}

/* ── Tabs ── */
.tabs{
  display:flex;gap:0;
  border-bottom:1px solid var(--gray-200);
  background:var(--white);
  padding:0 1.75rem;
}
.tab{
  padding:.875rem 1.25rem;font-size:13px;font-weight:500;
  color:var(--gray-500);cursor:pointer;border:none;background:none;
  border-bottom:2px solid transparent;margin-bottom:-1px;
  transition:var(--transition);font-family:'Inter',sans-serif;
}
.tab:hover{color:var(--gray-800);}
.tab.active{color:var(--primary);border-bottom-color:var(--primary);}

/* ── Sub-topbar (filters bar) ── */
.filters-bar{
  background:var(--white);
  padding:.75rem 1.75rem;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  flex-wrap:wrap;
  border-bottom:1px solid var(--gray-200);
}
.filters-left{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.filters-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}

/* ── Content ── */
.content{padding:1.5rem 1.75rem;flex:1;}

/* ── Stat Cards ── */
.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:1.5rem;}
.stat-card{
  background:var(--white);
  border:1px solid var(--gray-200);
  border-radius:var(--radius-lg);
  padding:1.1rem 1.25rem;
  transition:box-shadow var(--transition);
}
.stat-card:hover{box-shadow:var(--shadow);}
.stat-label{font-size:12px;color:var(--gray-500);margin-bottom:6px;font-weight:500;text-transform:uppercase;letter-spacing:.4px;}
.stat-value{font-size:26px;font-weight:700;color:var(--gray-900);line-height:1.1;}
.stat-sub{font-size:11px;color:var(--gray-400);margin-top:5px;}

/* ── Import Zone ── */
.import-zone{
  border:2px dashed var(--gray-300);border-radius:var(--radius-lg);
  padding:2.5rem;text-align:center;margin-bottom:1.5rem;
  background:var(--white);display:none;
}
.import-zone.show{display:block;}
.import-zone-title{font-size:15px;font-weight:600;margin-bottom:6px;color:var(--gray-900);}
.import-zone-sub{font-size:13px;color:var(--gray-500);margin-bottom:1.25rem;}
.import-zone-icon{font-size:36px;margin-bottom:.75rem;}
#fileInput{display:none;}

/* ── Table ── */
.table-card{
  background:var(--white);
  border:1px solid var(--gray-200);
  border-radius:var(--radius-lg);
  overflow:hidden;
  box-shadow:var(--shadow-sm);
}
.table-toolbar{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 16px;border-bottom:1px solid var(--gray-200);
  flex-wrap:wrap;gap:10px;
}
.table-toolbar-title{font-size:14px;font-weight:600;color:var(--gray-900);}
.table-filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.search-wrap{position:relative;}
.search-wrap svg{position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--gray-400);}
.search-wrap input{padding-left:30px;width:200px;}

table{width:100%;border-collapse:collapse;font-size:13px;}
th{
  padding:10px 14px;text-align:left;
  color:var(--gray-500);font-weight:600;font-size:11px;
  background:var(--gray-50);border-bottom:1px solid var(--gray-200);
  white-space:nowrap;text-transform:uppercase;letter-spacing:.4px;
}
td{padding:10px 14px;border-bottom:1px solid var(--gray-100);color:var(--gray-700);}
tr:last-child td{border-bottom:none;}
tbody tr:hover td{background:var(--gray-50);}
.student-name{font-weight:600;color:var(--gray-900);}
.student-id{font-size:11px;color:var(--gray-400);margin-top:1px;}

/* ── Grade Cells ── */
.grade-input{
  width:64px;padding:4px 6px;text-align:center;
  border:1px solid var(--gray-200);border-radius:var(--radius-sm);
  font-size:13px;font-family:'DM Mono',monospace;
  transition:var(--transition);
}
.grade-input:focus{border-color:var(--primary);outline:none;box-shadow:0 0 0 3px rgba(108,99,255,.1);}

/* ── Badges ── */
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;}
.badge-outstanding{background:#dbeafe;color:#1d4ed8;}
.badge-vs{background:var(--success-light);color:#065f46;}
.badge-s{background:#d1fae5;color:#047857;}
.badge-fs{background:var(--warning-light);color:#92400e;}
.badge-dnm{background:var(--danger-light);color:#991b1b;}
.badge-active{background:#d1fae5;color:#065f46;}
.badge-inactive{background:var(--gray-100);color:var(--gray-500);}

/* ── Progress bar ── */
.prog-wrap{display:flex;align-items:center;gap:8px;}
.prog-bar{height:6px;background:var(--gray-200);border-radius:3px;flex:1;min-width:48px;overflow:hidden;}
.prog-fill{height:100%;border-radius:3px;transition:width .3s ease;}
.prog-label{font-size:11px;font-family:'DM Mono',monospace;color:var(--gray-600);min-width:32px;}

/* ── Final grade ── */
.final-grade{font-family:'DM Mono',monospace;font-weight:600;font-size:14px;}

/* ── Weight Sliders ── */
.weights-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:1.5rem;}
.weight-card{
  background:var(--white);border:1px solid var(--gray-200);
  border-radius:var(--radius-lg);padding:1.25rem;
}
.weight-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}
.weight-name{font-weight:600;font-size:13px;color:var(--gray-800);}
.weight-pct{font-size:20px;font-weight:700;color:var(--primary);font-family:'DM Mono',monospace;}
input[type=range]{
  width:100%;height:4px;appearance:none;
  background:var(--gray-200);border-radius:2px;outline:none;cursor:pointer;
}
input[type=range]::-webkit-slider-thumb{
  appearance:none;width:18px;height:18px;
  background:var(--primary);border-radius:50%;cursor:pointer;
  box-shadow:0 0 0 3px rgba(108,99,255,.15);
}
.weight-total{
  padding:12px 16px;border-radius:var(--radius);
  background:var(--gray-50);border:1px solid var(--gray-200);
  font-size:13px;margin-bottom:1rem;
}

/* ── Dist bars ── */
.dist-row{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
.dist-label{width:140px;font-size:12px;color:var(--gray-600);text-align:right;flex-shrink:0;}
.dist-bar-wrap{flex:1;height:22px;background:var(--gray-100);border-radius:4px;overflow:hidden;}
.dist-bar-fill{height:100%;border-radius:4px;transition:width .5s ease;}
.dist-count{font-size:12px;color:var(--gray-500);min-width:60px;font-family:'DM Mono',monospace;}

/* ── Toast ── */
.toast{
  position:fixed;bottom:24px;right:24px;
  background:var(--gray-900);color:#fff;
  padding:12px 20px;border-radius:var(--radius);
  font-size:13px;z-index:9999;
  transform:translateY(80px);opacity:0;transition:.3s ease;
  box-shadow:0 8px 24px rgba(0,0,0,.15);
}
.toast.show{transform:translateY(0);opacity:1;}

/* ── Edit overlay ── */
#editOverlay.show{display:flex !important;}

/* ── Responsive ── */
@media(max-width:900px){
  .sidebar{display:none;}
  .stat-grid{grid-template-columns:repeat(2,1fr);}
  .weights-grid{grid-template-columns:1fr;}
}
@media(max-width:600px){
  .stat-grid{grid-template-columns:1fr 1fr;}
  .topbar{padding:.75rem 1rem;}
  .content{padding:1rem;}
  .filters-bar{padding:.75rem 1rem;}
}
</style>
</head>
<body>
<div class="layout">

  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <span class="logo-text">ClassInstruct</span>
    </div>

    <div class="user-profile">
      <div class="user-avatar">T</div>
      <div>
        <div class="user-name">Teacher</div>
        <div class="user-role">Instructor</div>
      </div>
    </div>

    <nav class="nav-menu">
      <button class="nav-btn" onclick="window.location.href='../dashboard.html'">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" stroke-width="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke-width="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke-width="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke-width="2"/></svg>
        <span>Dashboard</span>
      </button>
      <button class="nav-btn" onclick="window.location.href='../ai/classinstruct-ai.html'">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        <span>ClassInstruct AI</span>
      </button>
      <button class="nav-btn" onclick="window.location.href='../Calendar/calendarPAGE.html'">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke-width="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke-width="2" stroke-linecap="round"/></svg>
        <span>Calendar</span>
      </button>
      <button class="nav-btn" onclick="window.location.href='students.html'">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
        <span>Students</span>
      </button>
      <button class="nav-btn" onclick="window.location.href='StudentInfo.html'">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span>Student Info</span>
      </button>
      <button class="nav-btn active" onclick="window.location.href='Grades.php'">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
        <span>Grades</span>
      </button>
      <button class="nav-btn" onclick="window.location.href='../attendance/attendance.html'">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
        <span>Attendance</span>
      </button>
    </nav>
  </aside>

  <!-- Main -->
  <div class="main">

    <!-- Topbar -->
    <div class="topbar">
      <span class="page-title">Grades</span>
      <div class="topbar-search">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="text" placeholder="Search students, lessons, resources...">
      </div>
      <div class="topbar-right">ClassInstruct</div>
    </div>

    <!-- Filters bar -->
    <div class="filters-bar">
      <div class="filters-left">
        <select id="subjectSel" onchange="refresh()"></select>
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
      <button class="tab active" onclick="switchTab(this,'gradesheet')">Grade Sheet</button>
      <button class="tab" onclick="switchTab(this,'components')">Grade Components</button>
      <button class="tab" onclick="switchTab(this,'summary')">Class Summary</button>
      <button class="tab" onclick="switchTab(this,'subjects')">Manage Subjects</button>
    </div>

    <!-- Content -->
    <div class="content">

      <!-- ══ GRADE SHEET TAB ══ -->
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
          <p style="font-size:11px;color:var(--gray-400);margin-top:12px;">Supported formats: .xlsx, .xls, .csv</p>
        </div>

        <div class="stat-grid" id="statGrid"></div>

        <div class="table-card">
          <div class="table-toolbar">
            <span class="table-toolbar-title" id="tableTitle"></span>
            <div class="table-filters">
              <div class="search-wrap">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input type="text" placeholder="Search student..." oninput="filterSearch(this.value)">
              </div>
              <select onchange="filterDesc(this.value)">
                <option value="">All descriptors</option>
                <option>Outstanding</option>
                <option>Very Satisfactory</option>
                <option>Satisfactory</option>
                <option>Fairly Satisfactory</option>
                <option>Did Not Meet</option>
              </select>
            </div>
          </div>
          <div style="overflow-x:auto;">
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

      <!-- ══ COMPONENTS TAB ══ -->
      <div id="tab-components" style="display:none;">
        <p style="font-size:13px;color:var(--gray-500);margin-bottom:1.25rem;">
          Set the weight for each grading component. The total must equal <strong>100%</strong>.
          Changes here affect the Final Grade calculation in the Grade Sheet.
        </p>
        <div class="weight-total" id="weightTotalBox"></div>
        <div class="weights-grid" id="weightsGrid"></div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" onclick="saveWeights()">Save Weights</button>
          <button class="btn" onclick="resetWeights()">Reset to DepEd Default</button>
        </div>
      </div>

      <!-- ══ SUMMARY TAB ══ -->
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

      <!-- ══ SUBJECTS TAB ══ -->
      <div id="tab-subjects" style="display:none;">
        <div class="table-card" style="margin-bottom:1.5rem;">
          <div class="table-toolbar">
            <span class="table-toolbar-title">Add New Subject</span>
          </div>
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
                  <th style="width:100px;">Short Code</th>
                  <th style="width:100px;">Status</th>
                  <th style="width:160px;">Actions</th>
                </tr>
              </thead>
              <tbody id="subjectBody"></tbody>
            </table>
          </div>
        </div>

        <!-- Edit modal overlay -->
        <div id="editOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;align-items:center;justify-content:center;">
          <div style="background:var(--white);border-radius:var(--radius-lg);padding:1.5rem;width:400px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,.2);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;">
              <span style="font-size:15px;font-weight:700;color:var(--gray-900);">Edit Subject</span>
              <button class="btn btn-icon" onclick="closeEditModal()">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
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

<script>
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
</script>
</body>
</html>