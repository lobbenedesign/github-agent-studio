@echo off
REM Double-click this file in Explorer to start GitHub Agent Studio and open
REM it in your browser. Real checks below, not just a bare "bun server.ts".
cd /d "%~dp0"

where bun >nul 2>nul
if errorlevel 1 (
    echo Bun is not installed or not on PATH.
    echo Install it from https://bun.sh/docs/installation#windows
    echo   powershell -c "irm bun.sh/install.ps1 | iex"
    echo then re-run this file.
    pause
    exit /b 1
)

set GITHUB_TOKEN=
where gh >nul 2>nul
if not errorlevel 1 (
    for /f "delims=" %%T in ('gh auth token 2^>nul') do set GITHUB_TOKEN=%%T
)
if defined GITHUB_TOKEN (
    echo Using GitHub CLI token - real 5000 req/hour API limit instead of 60/hour.
) else (
    echo No 'gh' CLI auth found - running unauthenticated ^(real 60 req/hour GitHub API limit^).
    echo Run "gh auth login" first for the higher limit, especially for the Deep Crawler.
)

echo Starting GitHub Agent Studio on http://localhost:3011 ...
start "" /min cmd /c "timeout /t 2 >nul & start http://localhost:3011"
bun server.ts
pause
