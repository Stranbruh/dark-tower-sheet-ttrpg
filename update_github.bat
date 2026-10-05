@echo off
cd /d "%~dp0"

echo ========================================================
echo   Dark Tower Sheet - Push to GitHub Pages
echo ========================================================
echo.

git add index.html style.css data.js app.js favicon.ico README.md .gitignore

set "msg="
set /p "msg=Commit message (press Enter for default): "
if not defined msg set "msg=Update character sheet"

git commit -m "%msg%"
git push -u origin main

echo.
echo ========================================================
echo   Done!
echo   GitHub Pages will update in 30-60 seconds.
echo   Press Ctrl + F5 in your browser to see changes.
echo ========================================================
echo.
pause
