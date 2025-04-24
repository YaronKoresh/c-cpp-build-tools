@echo off
setlocal ENABLEDELAYEDEXPANSION

set "dp=%~dp0"
cd !dp!

set /p "pth=File name: "

call .\build_tools\VC\Auxiliary\Build\vcvars64.bat
call .\build_tools\VC\Tools\MSVC\14.43.34808\bin\Hostx64\x64\cl.exe /Tp"%pth%" -DUNICODE -DCONST -DWIN32_LEAN_AND_MEAN -DWIN32 -DWIN64 -D_CRT_SECURE_NO_WARNINGS -D_ENABLE_EXTENDED_ALIGNED_STORAGE -D_UNICODE -D_WIN64 /Zc:__cplusplus /std:c++latest /I"%dp%include\windows" /EHsc /I"%dp%include\windows" /fpcvt:BC /homeparams /Qspectre /GA /arch:AVX /O2 /favor:INTEL64 /options:strict /ZH:SHA_256 /guard:ehcont /fp:fast /utf-8 /bigobj /MT /jumptablerdata /nologo /link /subsystem:windows /machine:x64 /ERRORREPORT:none /DEBUG:none /RELEASE /LARGEADDRESSAWARE:NO /FIXED /LIBPATH:"%dp%build_tools/VC/Tools/MSVC/14.43.34808/lib/x64" libomp.lib kernel32.lib user32.lib gdi32.lib comctl32.lib shell32.lib advapi32.lib gdiplus.lib d2d1.lib d3d11.lib ole32.lib oleaut32.lib uuid.lib uxtheme.lib dwmapi.lib comdlg32.lib imm32.lib rpcrt4.lib libcmt.lib bufferoverflowu.lib Msimg32.lib

pause
