#Requires -Version 5.1
<#
.SYNOPSIS
  One-shot local stack: case2 Web + Node adapter (stub NOT started).

.DESCRIPTION
  Windows equivalent of dev-web-server.sh.
  This file MUST be UTF-8 with BOM so Windows PowerShell 5.1 prints Chinese correctly.
  Prefer launching via dev-web-server.bat (sets chcp 65001 first).

.EXAMPLE
  .\code\scripts\dev-web-server.bat
  .\code\scripts\dev-web-server.ps1
#>

$ErrorActionPreference = 'Stop'

function Write-DevLog([string]$Message) {
  Write-Host "[dev-web-server] $Message"
}

function Resolve-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

$Root = Resolve-RepoRoot
$WebDir = Join-Path $Root 'web'
$ServerDir = Join-Path $Root 'server'

if ([string]::IsNullOrWhiteSpace($env:CASE2_SHARED_DIR)) {
  $SharedDir = Join-Path $Root 'comdatafiles'
} else {
  $SharedDir = $env:CASE2_SHARED_DIR
}

$WebPort = if ([string]::IsNullOrWhiteSpace($env:WEB_PORT)) { '5173' } else { $env:WEB_PORT }
$ServerHostName = if ([string]::IsNullOrWhiteSpace($env:CASE2_ADAPTER_HOST)) { '127.0.0.1' } else { $env:CASE2_ADAPTER_HOST }
$ServerPort = if ([string]::IsNullOrWhiteSpace($env:CASE2_ADAPTER_PORT)) { '3102' } else { $env:CASE2_ADAPTER_PORT }

if (-not (Test-Path -LiteralPath $SharedDir -PathType Container)) {
  Write-Error "[dev-web-server] ERROR: shared dir not found: $SharedDir"
  exit 1
}
$ControlFile = Join-Path $SharedDir 'case_control.json'
if (-not (Test-Path -LiteralPath $ControlFile -PathType Leaf)) {
  Write-Error "[dev-web-server] ERROR: missing control file: $ControlFile"
  exit 1
}
if (-not (Test-Path -LiteralPath $WebDir -PathType Container) -or
    -not (Test-Path -LiteralPath $ServerDir -PathType Container)) {
  Write-Error "[dev-web-server] ERROR: expected $WebDir and $ServerDir"
  exit 1
}

$npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCmd) {
  $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
}
if (-not $npmCmd) {
  Write-Error '[dev-web-server] ERROR: npm not found in PATH'
  exit 1
}
$NpmPath = $npmCmd.Source

$script:Children = @()
$script:Cleaned = $false

function Stop-ChildTree([System.Diagnostics.Process]$Proc) {
  if ($null -eq $Proc) { return }
  try {
    if (-not $Proc.HasExited) {
      # /T kills the whole tree (npm -> node), matching bash cleanup intent.
      & taskkill.exe /PID $Proc.Id /T /F 2>$null | Out-Null
    }
  } catch {
    # ignore
  }
}

function Invoke-Cleanup {
  if ($script:Cleaned) { return }
  $script:Cleaned = $true
  Write-Host ''
  Write-DevLog 'shutting down...'
  foreach ($proc in $script:Children) {
    Stop-ChildTree $proc
  }
  Start-Sleep -Milliseconds 400
  foreach ($proc in $script:Children) {
    Stop-ChildTree $proc
  }
  Write-DevLog 'stopped'
}

try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {
  # ignore hosts without console
}

Write-DevLog "sharedDir=$SharedDir"
Write-DevLog "adapter=http://${ServerHostName}:${ServerPort}"
Write-DevLog "web Local=http://127.0.0.1:${WebPort}  (proxy /api -> adapter)"
Write-DevLog 'web Network：见下方 Vite 打印的 Network 行（host 已开）'
Write-DevLog 'stub is NOT started; run code/back separately if needed'
Write-Host ''

# Pass env into child processes (same as bash export)
$env:CASE2_SHARED_DIR = $SharedDir
$env:CASE2_ADAPTER_HOST = $ServerHostName
$env:CASE2_ADAPTER_PORT = $ServerPort

try {
  $adapter = Start-Process -FilePath $NpmPath `
    -ArgumentList @('start') `
    -WorkingDirectory $ServerDir `
    -PassThru `
    -NoNewWindow
  $script:Children += $adapter

  $web = Start-Process -FilePath $NpmPath `
    -ArgumentList @('run', 'dev', '--', '--port', $WebPort) `
    -WorkingDirectory $WebDir `
    -PassThru `
    -NoNewWindow
  $script:Children += $web

  Write-DevLog ("pids={0}" -f (($script:Children | ForEach-Object { $_.Id }) -join ' '))
  Write-DevLog 'press Ctrl+C to stop both'

  while ($true) {
    foreach ($proc in $script:Children) {
      if ($null -eq $proc) { continue }
      $proc.Refresh()
      if ($proc.HasExited) {
        Write-DevLog ("child {0} exited; stopping the rest" -f $proc.Id)
        exit 1
      }
    }
    Start-Sleep -Seconds 1
  }
}
finally {
  Invoke-Cleanup
}
