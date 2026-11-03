@echo off
echo Mo start-cafe.cmd truoc. Trong cua so overlay, bam Bat am thanh.
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "--user-data-dir=%~dp0.browser-overlay" --no-first-run --no-default-browser-check --disable-backgrounding-occluded-windows --disable-background-timer-throttling --app=http://localhost:3000/live/overlay.html --window-size=720,1080
  exit /b
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
  start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "--user-data-dir=%~dp0.browser-overlay" --no-first-run --no-default-browser-check --disable-backgrounding-occluded-windows --disable-background-timer-throttling --app=http://localhost:3000/live/overlay.html --window-size=720,1080
  exit /b
)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "--user-data-dir=%~dp0.browser-overlay" --no-first-run --no-default-browser-check --disable-backgrounding-occluded-windows --disable-background-timer-throttling --app=http://localhost:3000/live/overlay.html --window-size=720,1080
  exit /b
)
start "" http://localhost:3000/live/overlay.html
