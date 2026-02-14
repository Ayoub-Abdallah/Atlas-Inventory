# ==============================================================================
# Atlas Inventory - Register Auto-Start on Windows Boot
# ==============================================================================
# Registers a scheduled task so the server runs in the background on boot.
#
# Run as Administrator:
#   Right-click PowerShell -> "Run as Administrator"
#   cd C:\Atlas-Inventory
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup-windows.ps1
#
# To remove:
#   .\setup-windows.ps1 -Uninstall
# ==============================================================================

param([switch]$Uninstall)

$TaskName = "Atlas Inventory Auto-Start"
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartScript = Join-Path $AppDir "start-atlas-silent.bat"

# --- Uninstall ---
if ($Uninstall) {
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "[OK] Scheduled task '$TaskName' removed." -ForegroundColor Green
    } else {
        Write-Host "[i] No scheduled task found." -ForegroundColor Yellow
    }
    exit 0
}

# --- Check admin ---
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] Run this script as Administrator." -ForegroundColor Red
    exit 1
}

# --- Remove old task if exists ---
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[i] Removed existing task." -ForegroundColor Yellow
}

# --- Create scheduled task ---
$action = New-ScheduledTaskAction -Execute $StartScript -WorkingDirectory $AppDir

$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = "PT30S"

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 0) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Starts Atlas Inventory server 30s after Windows boot." | Out-Null

Write-Host ""
Write-Host "[OK] Auto-start registered." -ForegroundColor Green
Write-Host "     Task: '$TaskName'" -ForegroundColor Cyan
Write-Host "     Runs: start-atlas-silent.bat (30s after boot)" -ForegroundColor Cyan
Write-Host "     Remove: .\setup-windows.ps1 -Uninstall" -ForegroundColor Gray
Write-Host ""
