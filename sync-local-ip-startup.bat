@echo off
REM Optional helper - prefer the Startup .lnk to the .vbs (no CMD).
REM start /b so this bat does not stay open waiting.
start "" /b wscript.exe "%~dp0sync-local-ip-startup.vbs"
