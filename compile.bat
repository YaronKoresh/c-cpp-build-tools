@echo off
setlocal ENABLEDELAYEDEXPANSION

set "dp=%~dp0"
cd !dp!

set /p "pth=File name: "
set "obj=%pth:~0,-2%.obj"

call .\build_tools\VC\Auxiliary\Build\vcvars64.bat
call .\build_tools\VC\Tools\MSVC\14.43.34808\bin\Hostx64\x64\cl.exe "%pth%" -I "include\windows" /showIncludes /O2 /favor:blend /options:strict /guard:cf /guard:ehcont /fp:precise /Qspectre /vlen /std:c++20 /ZH:SHA_256 /openmp:llvm /utf-8 /bigobj /MT /sdl /analyze:WX- /analyze:quiet /nologo /w /EHsc /link /subsystem:windows /machine:x64 /ERRORREPORT:none /APPCONTAINER /ALLOWISOLATION /DEBUG:none /RELEASE /LARGEADDRESSAWARE:NO /FIXED /LIBPATH:"build_tools/VC/Tools/MSVC/14.43.34808/lib/x64" libomp.lib kernel32.lib user32.lib gdi32.lib comctl32.lib shell32.lib advapi32.lib gdiplus.lib d2d1.lib d3d11.lib ole32.lib oleaut32.lib uuid.lib uxtheme.lib dwmapi.lib comdlg32.lib imm32.lib rpcrt4.lib libcmt.lib bufferoverflowu.lib Msimg32.lib
pause
