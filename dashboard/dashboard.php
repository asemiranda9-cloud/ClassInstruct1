<?php
// Use shared session with homepage
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_path', '/');
    session_name('CI_SESSION');
    session_start();
}
?>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta charset="utf-8" />
  <title>ClassInstruct - Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="sidebar.css">
  <link rel="stylesheet" href="dashboard.css">
  <script>
    // Apply saved theme INSTANTLY before CSS renders — prevents white flash
    (function(){ document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'light'); })();
    // PHP session → JS globals (used by renderGreeting as fallback)
    // Read from ci_user array (set by verify_otp.php login flow)
    window.CI_FIRST_NAME = "<?php echo isset($_SESSION['ci_user']['first_name']) ? addslashes($_SESSION['ci_user']['first_name']) : ''; ?>";
    window.CI_LAST_NAME  = "<?php echo isset($_SESSION['ci_user']['last_name'])  ? addslashes($_SESSION['ci_user']['last_name'])  : ''; ?>";
    window.CI_GENDER     = "<?php echo isset($_SESSION['ci_user']['gender'])     ? addslashes($_SESSION['ci_user']['gender'])     : ''; ?>";
  </script>
  <script src="shared.js"></script>
</head>
<body data-page="dashboard">
<div class="dashboard">

  <!-- ══ MAIN ══ -->
  <main class="main-content">

    <!-- ══ HERO GREETING BANNER ══ -->
    <div class="hero-banner">

      <!-- TOP ROW: Search + Avatars + Button -->
      <div class="hero-top-row">
        <div class="search-container">
          <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <label for="search-input" class="visually-hidden">Search</label>
          <input type="search" id="search-input" placeholder="Search students, lessons, resources…"/>
        </div>
        <div class="hero-team-row">
          <button class="hero-manage-btn" onclick="sidebarNav('Student/Student.html')">Manage Class</button>
        </div>
      </div>

      <!-- BOTTOM ROW: Greeting + Stat Cards -->
      <div class="hero-bottom-row">

        <!-- Greeting -->
        <div class="hero-left">
          <h1 class="hero-title" id="dashGreeting">Good morning!</h1>
          <p class="hero-subtitle" id="dashGreetingSub">You have 3 pending tasks reaching deadlines today.</p>
        </div>

        <!-- Stat Metric Cards -->
        <div class="hero-stats">
          <div class="hero-stat-card">
            <div class="hero-stat-icon hero-stat-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="hero-stat-body">
              <span class="hero-stat-change hero-stat-change--up">+2.1%</span>
              <span class="hero-stat-label">Total Students</span>
              <span class="hero-stat-val" id="heroTotalStudents">—</span>
            </div>
          </div>

          <div class="hero-stat-card">
            <div class="hero-stat-icon hero-stat-icon--pink">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div class="hero-stat-body">
              <span class="hero-stat-change hero-stat-change--up">+8.2%</span>
              <span class="hero-stat-label">Avg Attendance</span>
              <span class="hero-stat-val" id="heroAvgAtt">—</span>
            </div>
          </div>

          <div class="hero-stat-card">
            <div class="hero-stat-icon hero-stat-icon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </div>
            <div class="hero-stat-body">
              <span class="hero-stat-change" style="color:var(--primary)">Active</span>
              <span class="hero-stat-label">Sections</span>
              <span class="hero-stat-val" id="heroSections">—</span>
            </div>
          </div>

          <div class="hero-stat-card">
            <div class="hero-stat-icon hero-stat-icon--purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div class="hero-stat-body">
              <span class="hero-stat-change hero-stat-change--down">-1.3%</span>
              <span class="hero-stat-label">Passing Rate</span>
              <span class="hero-stat-val" id="heroPassRate">—</span>
            </div>
          </div>

          <!-- ── NEW STATUS CARDS ── -->
          <div class="hero-stat-card">
            <div class="hero-stat-icon hero-stat-icon--teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div class="hero-stat-body">
              <span class="hero-stat-change" id="heroActiveChange" style="color:var(--green)">Enrolled</span>
              <span class="hero-stat-label">Active Students</span>
              <span class="hero-stat-val" id="heroActiveStudents">—</span>
            </div>
          </div>

          <div class="hero-stat-card">
            <div class="hero-stat-icon hero-stat-icon--indigo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <div class="hero-stat-body">
              <span class="hero-stat-change" id="heroPassingChange" style="color:var(--green)">≥75 avg</span>
              <span class="hero-stat-label">Passing</span>
              <span class="hero-stat-val" id="heroPassingCount">—</span>
            </div>
          </div>

          <div class="hero-stat-card">
            <div class="hero-stat-icon hero-stat-icon--orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <div class="hero-stat-body">
              <span class="hero-stat-change hero-stat-change--down" id="heroAtRiskChange">Needs Help</span>
              <span class="hero-stat-label">At Risk</span>
              <span class="hero-stat-val" id="heroAtRisk">—</span>
            </div>
          </div>

          <div class="hero-stat-card">
            <div class="hero-stat-icon hero-stat-icon--red">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <div class="hero-stat-body">
              <span class="hero-stat-change hero-stat-change--down" id="heroDropoutChange">Inactive</span>
              <span class="hero-stat-label">Dropouts</span>
              <span class="hero-stat-val" id="heroDropouts">—</span>
            </div>
          </div>
        </div>

      </div><!-- /hero-bottom-row -->

    </div><!-- /hero-banner -->

    <section class="content-grid" style="grid-template-columns: 1fr 1fr;">

      <!-- LEFT COLUMN -->
      <div style="display:flex;flex-direction:column;gap:20px">

        <!-- Students by Gender -->
        <article class="card">
          <div class="section-header">
            <h2>Enrolled Student</h2>
            <select class="filter" id="genderSectionFilter" onchange="updateGenderBySection()">
              <option value="">All Sections</option>
            </select>
          </div>
          <div class="gender-chart-container">
            <div class="gender-pie-chart" id="genderPie">
              <div class="pie-center">
                <span class="total-label">Total</span>
                <span class="total-count" id="genderTotal">—</span>
              </div>
            </div>
            <div class="gender-legend">
              <div class="legend-item">
                <span class="legend-color boys"></span>
                <span class="legend-label">Boys</span>
                <span class="legend-count" id="boysCount">—</span>
                <span class="legend-percent" id="boysPct">—</span>
              </div>
              <div class="legend-item">
                <span class="legend-color girls"></span>
                <span class="legend-label">Girls</span>
                <span class="legend-count" id="girlsCount">—</span>
                <span class="legend-percent" id="girlsPct">—</span>
              </div>
            </div>
          </div>
        </article>

        <!-- Student Attendance -->
        <article class="card">
          <div class="section-header">
            <h2>Student Attendance</h2>
            <div class="att-controls">
              <select class="filter" id="attSectionFilter" onchange="loadAttendanceCal()">
                <option value="">All Sections</option>
              </select>
              <select class="filter" id="attMonthFilter" onchange="loadAttendanceCal()"></select>
            </div>
          </div>
          <div class="att-summary-row">
            <div class="att-stat-pill"><span class="att-stat-label">Present</span><span class="att-stat-val green"  id="attPresent">—</span></div>
            <div class="att-stat-pill"><span class="att-stat-label">Late</span>   <span class="att-stat-val orange" id="attLate">—</span></div>
            <div class="att-stat-pill"><span class="att-stat-label">Absent</span> <span class="att-stat-val red"    id="attAbsent">—</span></div>
            <div class="att-stat-pill"><span class="att-stat-label">Avg Rate</span><span class="att-stat-val"      id="attAvg">—</span></div>
          </div>
          <div class="att-cal-wrap">
            <div class="att-cal-grid" id="attCalGrid">
              <div class="att-cal-weekday">Sun</div>
              <div class="att-cal-weekday">Mon</div>
              <div class="att-cal-weekday">Tue</div>
              <div class="att-cal-weekday">Wed</div>
              <div class="att-cal-weekday">Thu</div>
              <div class="att-cal-weekday">Fri</div>
              <div class="att-cal-weekday">Sat</div>
            </div>
          </div>
          <div class="att-legend">
            <div class="att-legend-item"><div class="att-legend-dot" style="background:#10b981"></div>High ≥80%</div>
            <div class="att-legend-item"><div class="att-legend-dot" style="background:#f59e0b"></div>Mid 60–79%</div>
            <div class="att-legend-item"><div class="att-legend-dot" style="background:#ef4444"></div>Low &lt;60%</div>
            <div class="att-legend-item"><div class="att-legend-dot" style="background:#e2e8f0;border:1px solid #cbd5e1"></div>No data</div>
            <a href="#" onclick="sidebarNav('attendance/attendance.html');return false;" style="margin-left:auto;font-size:.75rem;color:var(--primary);font-weight:600;text-decoration:none">View full →</a>
          </div>
        </article>

        <!-- Student Performance -->
        <article class="card performance">
          <div class="section-header">
            <h2>Student Performance</h2>
            <a href="#" onclick="sidebarNav('Grades/Grades.php');return false;" style="font-size:.75rem;color:var(--primary);font-weight:600;text-decoration:none;white-space:nowrap">View all →</a>
          </div>
          <!-- Filter row matching image 2 style -->
          <div class="perf-filter-row" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;align-items:center;">
            <select class="filter perf-filter" id="perfGradingTypeFilter" onchange="onPerfGradingTypeChange()" style="font-size:.73rem;padding:5px 10px;">
              <option value="quarterly">Quarterly (Q1-Q4)</option>
              <option value="sem2">2 Semesters</option>
              <option value="sem3">3 Semesters</option>
            </select>
            <select class="filter perf-filter" id="perfQuarterFilter" onchange="onPerfSemesterChange()" style="font-size:.73rem;padding:5px 10px;">
              <option value="Q1">Q1 — First Quarter</option>
              <option value="Q2">Q2 — Second Quarter</option>
              <option value="Q3">Q3 — Third Quarter</option>
              <option value="Q4">Q4 — Fourth Quarter</option>
            </select>
            <select class="filter perf-filter" id="perfPeriodFilter" onchange="loadPerformanceChart()" style="font-size:.73rem;padding:5px 10px;display:none;">
              <option value="Prelim">Prelim</option>
              <option value="Midterm">Midterm</option>
              <option value="Prefinals">Pre-Finals</option>
              <option value="Finals">Finals</option>
            </select>
            <select class="filter perf-filter" id="perfGradeFilter" onchange="loadPerformanceChart()" style="font-size:.73rem;padding:5px 10px;">
              <option value="">All Grades</option>
            </select>
            <select class="filter perf-filter" id="perfSectionFilter" onchange="loadPerformanceChart()" style="font-size:.73rem;padding:5px 10px;">
              <option value="">All Sections</option>
            </select>
            <select class="filter perf-filter" id="perfSubjectFilter" onchange="loadPerformanceChart()" style="font-size:.73rem;padding:5px 10px;">
              <option value="">All Subjects</option>
            </select>
          </div>
          <div class="performance-chart bar-chart-container" id="perfChartWrap">
            <div class="bar-chart" id="perfBarChart">
              <div style="width:100%;display:flex;align-items:center;justify-content:center;height:130px;color:var(--text-3);font-size:.82rem">Loading...</div>
            </div>
            <div class="grade-distribution" id="perfDistBars"></div>
            <div class="perf-stats-row" id="perfStatsRow"></div>
          </div>
        </article>

        <!-- Recently Added Students -->
        <article class="card">
          <div class="section-header" style="margin-bottom:10px">
            <h2>Recently Added Students</h2>
            <a href="#" onclick="sidebarNav('Student/Student.html');return false;" style="font-size:.75rem;color:var(--primary);font-weight:600;text-decoration:none">View all →</a>
          </div>
          <div id="recentStudents" style="display:flex;flex-direction:column;gap:6px">
            <div style="color:var(--text-3);font-size:13px;text-align:center;padding:20px 0">Loading student data…</div>
          </div>
        </article>
      </div>

      <!-- RIGHT COLUMN -->
      <div style="display:flex;flex-direction:column;gap:20px">

        <!-- Mini Calendar -->
        <article class="card calendar" style="grid-column: span 2;">
          <div class="cal-card-header">
            <h2>Calendar</h2>
            <span class="cal-year-badge" id="calYearBadge">2026</span>
          </div>
          <div class="single-month-calendar">
            <div class="calendar-nav-container">
              <button class="calendar-nav-btn" onclick="changeMonth(-1)">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>Prev
              </button>
              <span class="current-month" id="currentMonthDisplay">—</span>
              <button class="calendar-nav-btn" onclick="changeMonth(1)">
                Next<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
            <div class="month-weekdays">
              <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
            </div>
            <div class="month-days" id="miniCalDays"></div>
          </div>
        </article>

        <!-- Upcoming Events -->
        <article class="card events">
          <div class="section-header">
            <h2>Upcoming Events</h2>
            <span id="eventsMonthLabel" style="font-size:.75rem;color:var(--text-3);font-weight:600"></span>
          </div>
          <div class="events-content" id="eventsContent">
            <div class="no-events-msg"><span>🗓️</span>No upcoming events.<br>Add some in the Calendar!</div>
          </div>
        </article>

        <!-- Recent Activity -->
        <article class="card">
          <div class="section-header">
            <h2>Recent Activity</h2>
          </div>
          <div id="recentActivity" style="display:flex;flex-direction:column;gap:10px"></div>
        </article>
      </div>

    </section>
  </main>
</div>

<script src="activity_log.js"></script>
<script src="dashboard.js"></script>
</body>
</html>