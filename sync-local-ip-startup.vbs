' Starts sync-local-ip tag overlay without a console window.
Option Explicit

Dim fso, shell, scriptDir, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & scriptDir & "\sync-local-ip-tag.ps1"""
shell.Run cmd, 0, False
