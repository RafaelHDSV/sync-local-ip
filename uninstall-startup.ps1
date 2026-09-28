#Requires -Version 5.1
<#
.SYNOPSIS
  Removes the sync-local-ip Startup shortcut(s).
#>

$ErrorActionPreference = "Stop"

$StartupDir = [Environment]::GetFolderPath("Startup")
$removed = $false
foreach ($name in @(
        "sync-local-ip-startup.vbs.lnk",
        "sync-local-ip-startup.bat.lnk"
    )) {
    $path = Join-Path $StartupDir $name
    if (Test-Path $path) {
        Remove-Item -LiteralPath $path -Force
        Write-Host "Removed: $path"
        $removed = $true
    }
}

if (-not $removed) {
    Write-Host "Startup shortcut not found under: $StartupDir"
}
