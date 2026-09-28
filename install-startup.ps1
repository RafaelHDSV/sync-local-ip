#Requires -Version 5.1
<#
.SYNOPSIS
  Installs sync-local-ip tag on Windows Startup (VBS only - no CMD window).
#>

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VbsPath = Join-Path $ScriptDir "sync-local-ip-startup.vbs"
$StartupDir = [Environment]::GetFolderPath("Startup")
$LnkPath = Join-Path $StartupDir "sync-local-ip-startup.vbs.lnk"
$LegacyBatLnk = Join-Path $StartupDir "sync-local-ip-startup.bat.lnk"

if (-not (Test-Path $VbsPath)) {
    throw "Missing launcher: $VbsPath"
}

if (Test-Path $LegacyBatLnk) {
    Remove-Item -LiteralPath $LegacyBatLnk -Force
    Write-Host "Removed legacy Startup shortcut: $LegacyBatLnk"
}

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($LnkPath)
$lnk.TargetPath = $VbsPath
$lnk.WorkingDirectory = $ScriptDir
$lnk.WindowStyle = 7
$lnk.Description = "AGX sync-local-ip tag - overlay only (no console)"
$lnk.Save()
Write-Host "Installed Startup shortcut: $LnkPath"
Write-Host "Manual (no console): wscript.exe .\sync-local-ip-startup.vbs"
Write-Host "Remove: .\uninstall-startup.ps1"
