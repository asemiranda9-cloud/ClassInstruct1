@echo off
echo Checking XAMPP MySQL...
"c:\xampp\mysql\bin\mysql.exe" -u root -e "SHOW DATABASES;"
pause
