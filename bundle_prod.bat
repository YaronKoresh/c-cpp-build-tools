@echo off
setlocal ENABLEDELAYEDEXPANSION

set "dp=%~dp0"
cd !dp!

set /p "pth=File path: "
set /p "inc=Include path: "

call node.exe .\bundler\main.js "!pth!" "!pth!-prod-bundle.txt" "0" "include\windows,%inc%"

pause