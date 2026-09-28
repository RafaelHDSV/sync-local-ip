#Requires -Version 5.1
<#
.SYNOPSIS
  Mini tag de IP local (estilo workday): mostra IP + check/x, sync automatico.
#>

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeScript = Join-Path $ScriptDir 'sync-local-ip.mjs'
$UiStatePath = Join-Path $ScriptDir 'ui-state.json'
$PollHours = 1

# Default: a esquerda do workday (workday usa ~215px da direita).
$script:TrayOffsetPx = 340
$script:MarginBottom = -35
$script:HiddenUntil = $null
$script:Dragging = $false
$script:DragMoved = $false
$script:Syncing = $false
$script:WindowHandle = [IntPtr]::Zero
$script:DisplayIp = '...'
$script:Match = $true
$script:HasIp = $true
$script:ErrorText = $null

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

# Detach/hide any console so only the WPF tag is visible (Startup VBS or accidental .ps1 open).
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class SyncIpConsole {
    [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
    [DllImport("kernel32.dll")] public static extern bool FreeConsole();
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    public const int SW_HIDE = 0;
    public static void Hide() {
        IntPtr hwnd = GetConsoleWindow();
        if (hwnd != IntPtr.Zero) { ShowWindow(hwnd, SW_HIDE); }
        FreeConsole();
    }
}
"@
[SyncIpConsole]::Hide() | Out-Null

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class SyncIpWin32 {
    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_NOMOVE = 0x0002;
    public const uint SWP_NOACTIVATE = 0x0010;
    public const uint SWP_SHOWWINDOW = 0x0040;
    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_TOOLWINDOW = 0x00000080;
    public const int WS_EX_NOACTIVATE = 0x08000000;

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(
        IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    public static void ApplyAlwaysOnTop(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero) { return; }
        int exStyle = GetWindowLong(hwnd, GWL_EXSTYLE);
        SetWindowLong(hwnd, GWL_EXSTYLE, exStyle | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE);
        SetWindowPos(
            hwnd, HWND_TOPMOST, 0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
    }
}
"@

function Read-UiState {
    if (-not (Test-Path -LiteralPath $UiStatePath)) { return }
    try {
        $j = Get-Content -Raw -LiteralPath $UiStatePath | ConvertFrom-Json
        if ($null -ne $j.trayOffsetPx) { $script:TrayOffsetPx = [int]$j.trayOffsetPx }
        if ($null -ne $j.marginBottom) { $script:MarginBottom = [int]$j.marginBottom }
        if ($j.hiddenUntil) {
            $dt = [datetime]::Parse($j.hiddenUntil)
            if ($dt -gt (Get-Date)) { $script:HiddenUntil = $dt }
        }
    }
    catch { }
}

function Save-UiState {
    $payload = [ordered]@{
        trayOffsetPx = $script:TrayOffsetPx
        marginBottom = $script:MarginBottom
        hiddenUntil  = if ($script:HiddenUntil) { $script:HiddenUntil.ToString('o') } else { $null }
    }
    ($payload | ConvertTo-Json) | Set-Content -LiteralPath $UiStatePath -Encoding UTF8
}

function Invoke-NodeJson {
    param([string[]]$NodeArgs)

    $nodeInfo = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeInfo) {
        return @{ ok = $false; code = -1; error = 'Node.js nao encontrado no PATH.' }
    }
    $nodeCmd = $nodeInfo.Source
    $argLine = @($NodeScript) + $NodeArgs | ForEach-Object {
        if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
    }
    $argLine = $argLine -join ' '

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $nodeCmd
    $psi.Arguments = $argLine
    $psi.WorkingDirectory = $ScriptDir
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $psi.StandardErrorEncoding = [System.Text.UTF8Encoding]::new($false)

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()
    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()
    $code = $proc.ExitCode

    $text = $stdout.Trim()
    $errText = $stderr.Trim()
    if (-not $text) {
        if (-not $errText) { $errText = "sync-local-ip.mjs saiu com codigo $code sem saida." }
        return @{ ok = $false; code = $code; error = $errText }
    }
    try {
        $obj = $text | ConvertFrom-Json
        $obj | Add-Member -NotePropertyName code -NotePropertyValue $code -Force
        return $obj
    }
    catch {
        return @{ ok = $false; code = $code; raw = $text; error = "Saida invalida: $text" }
    }
}

function Set-OverlayAlwaysOnTop {
    if ($script:WindowHandle -eq [IntPtr]::Zero) { return }
    [SyncIpWin32]::ApplyAlwaysOnTop($script:WindowHandle) | Out-Null
}

function Update-OverlayPosition {
    if ($script:Dragging) { return }
    $workArea = [System.Windows.SystemParameters]::WorkArea
    $window.UpdateLayout()
    $width = if ($window.ActualWidth -gt 0) { $window.ActualWidth } else { 120 }
    $height = if ($window.ActualHeight -gt 0) { $window.ActualHeight } else { 24 }
    $window.Left = $workArea.Right - $width - $script:TrayOffsetPx
    $window.Top = $workArea.Bottom - $height - $script:MarginBottom
    Set-OverlayAlwaysOnTop
}

function Save-PositionFromWindow {
    $workArea = [System.Windows.SystemParameters]::WorkArea
    $width = if ($window.ActualWidth -gt 0) { $window.ActualWidth } else { 120 }
    $height = if ($window.ActualHeight -gt 0) { $window.ActualHeight } else { 24 }
    $script:TrayOffsetPx = [int][Math]::Round($workArea.Right - $width - $window.Left)
    $script:MarginBottom = [int][Math]::Round($workArea.Bottom - $height - $window.Top)
    Save-UiState
}

function Update-OverlayDisplay {
    $now = Get-Date
    if ($script:HiddenUntil -and $now -lt $script:HiddenUntil) {
        $window.Visibility = [System.Windows.Visibility]::Hidden
        return
    }
    if ($script:HiddenUntil -and $now -ge $script:HiddenUntil) {
        $script:HiddenUntil = $null
        Save-UiState
    }

    $window.Visibility = [System.Windows.Visibility]::Visible

    if ($script:Syncing) {
        $textBlock.Text = 'IP ...'
        $textBlock.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#FFF2C94C')
        Update-OverlayPosition
        return
    }

    $border.ToolTip = $script:ErrorText

    if (-not $script:HasIp) {
        $textBlock.Text = if ($script:ErrorText) { 'erro (passe o mouse)' } else { 'sem IP' }
        $textBlock.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#FF9E9E9E')
        Update-OverlayPosition
        return
    }

    if ($script:Match) {
        $mark = [string][char]0x2713
        $textBlock.Text = ('{0}  {1}' -f $script:DisplayIp, $mark)
        $textBlock.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#FF6FCF97')
    }
    else {
        $mark = [string][char]0x2717
        $textBlock.Text = ('{0}  {1}' -f $script:DisplayIp, $mark)
        $textBlock.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#FFEB5757')
    }
    Update-OverlayPosition
    Set-OverlayAlwaysOnTop
}

function Apply-CheckResult {
    param($Result)
    $script:ErrorText = if ($Result -and $Result.error) { [string]$Result.error } else { $null }
    if (-not $Result -or -not $Result.detected) {
        $script:HasIp = $false
        $script:Match = $false
        $script:DisplayIp = 'sem IP'
        return
    }
    # Com erro de config o IP ainda aparece, em vermelho, e o motivo fica no tooltip.
    $script:HasIp = $true
    $script:DisplayIp = [string]$Result.detected
    $script:Match = [bool]$Result.ok -and [bool]$Result.match
}

function Invoke-IpCheck {
    $r = Invoke-NodeJson -NodeArgs @('--check-only', '--json')
    Apply-CheckResult $r
    Update-OverlayDisplay
    return $r
}

function Invoke-IpSync {
    if ($script:Syncing) { return }
    $script:Syncing = $true
    Update-OverlayDisplay
    try {
        $null = Invoke-NodeJson -NodeArgs @('--json')
        $null = Invoke-IpCheck
    }
    finally {
        $script:Syncing = $false
        Update-OverlayDisplay
    }
}

function Start-InitialSyncAndCheck {
    $script:Syncing = $true
    Update-OverlayDisplay
    try {
        $null = Invoke-NodeJson -NodeArgs @('--json')
        $null = Invoke-IpCheck
    }
    finally {
        $script:Syncing = $false
        Update-OverlayDisplay
    }
}

Read-UiState

$window = New-Object System.Windows.Window
$window.WindowStyle = [System.Windows.WindowStyle]::None
$window.AllowsTransparency = $true
$window.Background = [System.Windows.Media.Brushes]::Transparent
$window.Topmost = $true
$window.ShowInTaskbar = $false
$window.ShowActivated = $false
$window.Focusable = $false
$window.ResizeMode = [System.Windows.ResizeMode]::NoResize
$window.SizeToContent = [System.Windows.SizeToContent]::WidthAndHeight
$window.Title = 'sync-local-ip'

$border = New-Object System.Windows.Controls.Border
$border.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#FF2D2D30')
$border.CornerRadius = [System.Windows.CornerRadius]::new(4)
$border.Padding = [System.Windows.Thickness]::new(8, 2, 8, 2)
$border.Cursor = [System.Windows.Input.Cursors]::Hand

$textBlock = New-Object System.Windows.Controls.TextBlock
$textBlock.FontFamily = New-Object System.Windows.Media.FontFamily('Segoe UI')
$textBlock.FontSize = 12
$textBlock.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#FFE8E8E8')
$textBlock.Text = 'IP ...'

$border.Child = $textBlock
$window.Content = $border

$contextMenu = New-Object System.Windows.Controls.ContextMenu

$syncItem = New-Object System.Windows.Controls.MenuItem
$syncItem.Header = 'Sincronizar agora'
$syncItem.Add_Click({ Invoke-IpSync })
[void]$contextMenu.Items.Add($syncItem)

$openItem = New-Object System.Windows.Controls.MenuItem
$openItem.Header = 'Abrir pasta'
$openItem.Add_Click({ Invoke-Item -LiteralPath $ScriptDir })
[void]$contextMenu.Items.Add($openItem)

$exitItem = New-Object System.Windows.Controls.MenuItem
$exitItem.Header = 'Sair'
$exitItem.Add_Click({ [System.Windows.Application]::Current.Shutdown() })
[void]$contextMenu.Items.Add($exitItem)
$border.ContextMenu = $contextMenu

$border.Add_MouseLeftButtonDown({
        param($sender, $e)
        if ($e.ClickCount -ge 2) {
            $script:HiddenUntil = (Get-Date).Date.AddDays(1)
            Save-UiState
            $window.Visibility = [System.Windows.Visibility]::Hidden
            $e.Handled = $true
            return
        }
        if ($e.ChangedButton -eq [System.Windows.Input.MouseButton]::Left) {
            $beforeLeft = $window.Left
            $beforeTop = $window.Top
            $script:Dragging = $true
            $script:DragMoved = $false
            try {
                $window.DragMove()
            }
            catch { }
            finally {
                $script:Dragging = $false
                $dx = [Math]::Abs($window.Left - $beforeLeft)
                $dy = [Math]::Abs($window.Top - $beforeTop)
                if ($dx -gt 4 -or $dy -gt 4) {
                    $script:DragMoved = $true
                    Save-PositionFromWindow
                }
                Update-OverlayPosition
            }
            if (-not $script:DragMoved) {
                Invoke-IpSync
            }
            $e.Handled = $true
        }
    })

$pollTimer = New-Object System.Windows.Threading.DispatcherTimer
$pollTimer.Interval = [TimeSpan]::FromHours($PollHours)
$pollTimer.Add_Tick({
        $r = Invoke-IpCheck
        if ($r -and $r.ok -and -not $r.match -and $r.detected) {
            Invoke-IpSync
        }
    })

$layoutTimer = New-Object System.Windows.Threading.DispatcherTimer
$layoutTimer.Interval = [TimeSpan]::FromSeconds(5)
$layoutTimer.Add_Tick({ Update-OverlayPosition })

$window.Add_Loaded({
        $helper = New-Object System.Windows.Interop.WindowInteropHelper($window)
        $script:WindowHandle = $helper.Handle
        Set-OverlayAlwaysOnTop
        Start-InitialSyncAndCheck
        if (-not $script:Match -and $script:HasIp) {
            # Initial sync already ran; refresh UI only
        }
        $pollTimer.Start()
        $layoutTimer.Start()
    })

$window.Add_Deactivated({
        if ($window.Visibility -eq [System.Windows.Visibility]::Visible) {
            Set-OverlayAlwaysOnTop
        }
    })

$app = New-Object System.Windows.Application
$app.Run($window)
