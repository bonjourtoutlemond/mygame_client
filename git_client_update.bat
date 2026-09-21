@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

set "PAUSE_ON_EXIT=1"
echo %* | findstr /I /C:"--no-pause" >nul && set "PAUSE_ON_EXIT=0"
if not exist "logs" mkdir "logs"

if not defined GIT_CLIENT_UPDATE_BAT_LOGGING (
    for /f %%I in ('powershell -NoProfile -Command "[datetime]::Now.ToString('yyyyMMdd_HHmmss_fff') + '_' + $PID + '_' + [guid]::NewGuid().ToString('N').Substring(0,8)"') do set "LOG_STAMP=%%I"
    if not defined LOG_STAMP set "LOG_STAMP=%RANDOM%"
    set "LOG_FILE=%CD%\logs\git_client_update_!LOG_STAMP!.log"
    set "GIT_CLIENT_UPDATE_BAT_LOGGING=1"

    echo [INFO] Writing log to "!LOG_FILE!"
    call "%~f0" %* > "!LOG_FILE!" 2>&1
    set "EXIT_CODE=!ERRORLEVEL!"

    type "!LOG_FILE!"
    echo.
    echo [INFO] Persistent log: "!LOG_FILE!"
    if "!PAUSE_ON_EXIT!"=="1" pause
    exit /b !EXIT_CODE!
)

set "DEFAULT_BRANCH=main"
set "DEFAULT_REMOTE_URL=https://github.com/bonjourtoutlemond/mygame_client.git"
set "REMOTE_URL=%DEFAULT_REMOTE_URL%"
set "BRANCH=%DEFAULT_BRANCH%"
set "DRY_RUN=0"
set "STATUS_ONLY=0"

:parse_args
if "%~1"=="" goto :after_args
if /i "%~1"=="--help" goto :usage
if /i "%~1"=="-h" goto :usage
if /i "%~1"=="/?" goto :usage
if /i "%~1"=="--remote" (
    if "%~2"=="" (
        echo [ERROR] --remote requires a URL.
        exit /b 2
    )
    set "REMOTE_URL=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--branch" (
    if "%~2"=="" (
        echo [ERROR] --branch requires a branch name.
        exit /b 2
    )
    set "BRANCH=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--dry-run" (
    set "DRY_RUN=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--status-only" (
    set "STATUS_ONLY=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--no-pause" (
    shift
    goto :parse_args
)
echo [ERROR] Unknown option: %~1
exit /b 2

:after_args
call :find_git
if errorlevel 1 exit /b 1

echo ============================================================
echo client git update started at %DATE% %TIME%
echo Workdir : %CD%
echo Remote  : %REMOTE_URL%
echo Branch  : %BRANCH%
echo Dry run : %DRY_RUN%
echo ============================================================
echo.

if "%STATUS_ONLY%"=="1" goto :status_only
if "%DRY_RUN%"=="1" goto :dry_run

call :ensure_repo
if errorlevel 1 goto :fail

call :configure_remote
if errorlevel 1 goto :fail

call :pull_remote
if errorlevel 1 goto :fail

echo.
echo [OK] Client repository updated from git.
exit /b 0

:find_git
set "GIT_EXE="
for /f "delims=" %%G in ('where git.exe 2^>nul') do if not defined GIT_EXE set "GIT_EXE=%%G"
if not defined GIT_EXE if exist "C:\Program Files\Git\cmd\git.exe" set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
if not defined GIT_EXE if exist "C:\Program Files\Git\bin\git.exe" set "GIT_EXE=C:\Program Files\Git\bin\git.exe"

if not defined GIT_EXE (
    echo [ERROR] git.exe was not found in PATH.
    exit /b 1
)
exit /b 0

:ensure_repo
if not exist ".git" (
    echo [INFO] Initializing independent client repository...
    "!GIT_EXE!" init
    if errorlevel 1 exit /b 1
) else (
    echo [INFO] Existing client repository found.
)

"!GIT_EXE!" branch -M "%BRANCH%"
exit /b !ERRORLEVEL!

:configure_remote
"!GIT_EXE!" remote get-url origin >nul 2>nul
if errorlevel 1 (
    if "%REMOTE_URL%"=="" (
        echo [ERROR] No origin remote yet. Use --remote URL first.
        exit /b 1
    )
    echo [INFO] Adding remote origin...
    "!GIT_EXE!" remote add origin "%REMOTE_URL%"
    exit /b !ERRORLEVEL!
)
if not "%REMOTE_URL%"=="" (
    echo [INFO] Updating remote origin...
    "!GIT_EXE!" remote set-url origin "%REMOTE_URL%"
    exit /b !ERRORLEVEL!
)
exit /b 0

:pull_remote
echo [INFO] Pulling origin/%BRANCH% if it exists...
"!GIT_EXE!" ls-remote --exit-code --heads origin "%BRANCH%" >nul 2>nul
if errorlevel 1 (
    echo [INFO] Remote branch not found or origin unavailable. Nothing was pulled.
    exit /b 0
)
"!GIT_EXE!" pull origin "%BRANCH%" --allow-unrelated-histories --no-edit
exit /b !ERRORLEVEL!

:status_only
if not exist ".git" (
    echo [INFO] No independent client .git directory found in %CD%.
    exit /b 0
)
"!GIT_EXE!" status --short --branch
"!GIT_EXE!" remote -v
exit /b 0

:dry_run
echo [INFO] Dry run: checking remote branch only; no git state will be changed.
if exist ".git" (
    "!GIT_EXE!" status --short --branch
    echo.
    "!GIT_EXE!" remote -v
)
echo.
"!GIT_EXE!" ls-remote --heads "%REMOTE_URL%" "%BRANCH%"
exit /b 0

:fail
echo.
echo [ERROR] Client git update failed.
if exist ".git" "!GIT_EXE!" status --short --branch
exit /b 1

:usage
echo Usage:
echo   git_client_update.bat
echo   git_client_update.bat --branch main --remote URL
echo.
echo Options:
echo   --remote URL       Override origin URL. Default: %DEFAULT_REMOTE_URL%
echo   --branch NAME      Set branch name. Default: %DEFAULT_BRANCH%
echo   --dry-run          Check remote branch without changing git state.
echo   --status-only      Print status and remote information only.
echo   --no-pause         Do not pause before the window closes.
exit /b 0
