@echo off
echo Creating DB...
"c:\xampp\mysql\bin\mysql.exe" -u root < setup-db.sql
if %ERRORLEVEL% == 0 (
  echo SUCCESS: DB ready!
) else (
  echo ERROR: Check XAMPP MySQL running
)
pause
