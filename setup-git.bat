@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "DEST_DIR=%SCRIPT_DIR:~0,-1%"
set "TEMP_PS1=%TEMP%\jimeng-image-downloader-setup-git.ps1"

copy /Y "%SCRIPT_DIR%setup-git.ps1" "%TEMP_PS1%" >nul
if errorlevel 1 (
  echo 无法准备 Git 安装脚本。
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP_PS1%" -DestinationPath "%DEST_DIR%"
set "EXIT_CODE=%ERRORLEVEL%"

del /Q "%TEMP_PS1%" >nul 2>nul

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Git 安装失败。
  pause
  exit /b %EXIT_CODE%
)

echo.
echo 内置 Git 安装完成。
pause
exit /b 0
