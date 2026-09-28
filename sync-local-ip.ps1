# Propaga o IPv4 util para .env locais e Serveruler.
#
# Exemplos:
#   .\sync-local-ip.ps1
#   .\sync-local-ip.ps1 -DryRun
#   .\sync-local-ip.ps1 -CheckOnly
#   .\sync-local-ip.ps1 -Ip "10.10.0.66"

param(
  [string]$Ip = '',
  [switch]$DryRun,
  [switch]$Verbose,
  [switch]$CheckOnly,
  [switch]$Json
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeScript = Join-Path $ScriptDir 'sync-local-ip.mjs'

$argsList = @()

if ($Ip) { $argsList += @('--ip', $Ip) }
if ($DryRun) { $argsList += '--dry-run' }
if ($Verbose) { $argsList += '--verbose' }
if ($CheckOnly) { $argsList += '--check-only' }
if ($Json) { $argsList += '--json' }

& node $NodeScript @argsList
exit $LASTEXITCODE
