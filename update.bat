@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "TEMP_PS1=%TEMP%\jimeng-image-downloader-update.ps1"

copy /Y "%SCRIPT_DIR%update.ps1" "%TEMP_PS1%" >nul
if errorlevel 1 (
  echo Failed to prepare updater script.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP_PS1%" -DestinationPath "%SCRIPT_DIR%"
set "EXIT_CODE=%ERRORLEVEL%"

del /Q "%TEMP_PS1%" >nul 2>nul

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Update failed.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo Update completed.
pause
exit /b 0
