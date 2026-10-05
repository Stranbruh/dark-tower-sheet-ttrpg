@echo off
cd /d "%~dp0"

echo ========================================================
echo   Dark Tower Sheet - Push to GitHub Pages
echo ========================================================
echo.

git add index.html style.css data.js app.js favicon.ico README.md AGENTS.md .gitignore update_github.bat

set "msg="
set /p "msg=Commit message (press Enter for default): "
if not defined msg set "msg=Update character sheet"

git commit -m "%msg%"
echo.
echo Pushing to GitHub...
git push -u origin main

if errorlevel 1 (
  echo.
  echo ========================================================
  echo   [ERROR] Git push failed!
  echo   Possible reasons:
  echo   1. The repository does not exist on GitHub yet.
  echo      Create it at: https://github.com/new
  echo      Name: dark-tower-sheet (Public)
  echo   2. Authentication failed in your browser / credentials.
  echo ========================================================
  echo.
  pause
  exit /b 1
)

echo.
echo ========================================================
echo   Done!
echo   GitHub Pages will update in 30-60 seconds.
echo   Press Ctrl + F5 in your browser to see changes.
echo ========================================================
echo.
pause
