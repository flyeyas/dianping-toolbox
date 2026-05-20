@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "DEST_DIR=%SCRIPT_DIR:~0,-1%"
set "TEMP_PS1=%TEMP%\jimeng-image-downloader-update.ps1"
set "SUCCESS_FLAG=%TEMP%\jimeng-image-downloader-update-success.txt"

del /Q "%SUCCESS_FLAG%" >nul 2>nul

copy /Y "%SCRIPT_DIR%update.ps1" "%TEMP_PS1%" >nul
if errorlevel 1 (
  echo 无法准备更新脚本。
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP_PS1%" -DestinationPath "%DEST_DIR%" -SuccessFlagPath "%SUCCESS_FLAG%"
set "EXIT_CODE=%ERRORLEVEL%"

del /Q "%TEMP_PS1%" >nul 2>nul

if exist "%SUCCESS_FLAG%" (
  del /Q "%SUCCESS_FLAG%" >nul 2>nul
  echo.
  echo 更新完成。
  pause
  exit /b 0
)

if not "%EXIT_CODE%"=="0" (
  echo.
  echo 更新失败。
  pause
  exit /b %EXIT_CODE%
)

echo.
echo 更新完成。
pause
exit /b 0
