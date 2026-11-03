@echo off
cd /d "%~dp0live"
where node >nul 2>nul
if errorlevel 1 (
  echo Hay cai Node.js 20 tro len roi mo lai file nay.
  pause
  exit /b 1
)
if not exist "node_modules\ws\package.json" (
  call npm.cmd ci --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Mo http://localhost:3000 sau khi server san sang. Ctrl+C de tat quan.
call npm.cmd start
pause
