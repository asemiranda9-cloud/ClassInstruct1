<?php session_start(); ?>
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
    window.CI_FIRST_NAME = "<?php echo isset($_SESSION['first_name']) ? addslashes($_SESSION['first_name']) : ''; ?>";
    window.CI_LAST_NAME  = "<?php echo isset($_SESSION['last_name'])  ? addslashes($_SESSION['last_name'])  : ''; ?>";
    window.CI_GENDER     = "<?php echo isset($_SESSION['gender'])     ? addslashes($_SESSION['gender'])     : ''; ?>";
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
          <button class="hero-manage-btn" onclick="location.href='student/Student.html'">Manage Class</button>
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
            <a href="attendance/attendance.html" style="margin-left:auto;font-size:.75rem;color:var(--primary);font-weight:600;text-decoration:none">View full →</a>
          </div>
        </article>

        <!-- Student Performance -->
        <article class="card performance">
          <div class="section-header">
            <h2>Student Performance</h2>
            <div style="display:flex;align-items:center;gap:8px">
              <select class="filter" id="perfSubjectFilter" onchange="loadPerformanceChart()">
                <option value="">All Subjects</option>
              </select>
              <select class="filter" id="perfQuarterFilter" onchange="loadPerformanceChart()">
                <option value="Q1">First Quarter</option>
                <option value="Q2">Second Quarter</option>
                <option value="Q3">Third Quarter</option>
                <option value="Q4">Fourth Quarter</option>
              </select>
              <a href="Student/Grades.php" style="font-size:.75rem;color:var(--primary);font-weight:600;text-decoration:none;white-space:nowrap">View all →</a>
            </div>
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
            <a href="student/Student.html" style="font-size:.75rem;color:var(--primary);font-weight:600;text-decoration:none">View all →</a>
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