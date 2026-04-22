<#
.SYNOPSIS
    Launcher for the EcijaComarca API. Registered as a Windows Scheduled
    Task by setup.ps1 and invoked at system startup by SYSTEM.

.DESCRIPTION
    This wrapper:
      * Waits until MySQL is reachable (up to 2 minutes). SYSTEM-triggered
        tasks often start before mysqld is ready.
      * Locates node.exe even when SYSTEM's PATH is narrower than a user's.
      * Launches 'node main.js' and keeps it alive (restart on crash).
      * Logs everything to api\logs\service.log.

.NOTES
    Called with no arguments. All state comes from api\.env.
#>

$ErrorActionPreference = 'Continue'
$apiRoot = $PSScriptRoot
$logDir  = Join-Path $apiRoot 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir 'service.log'

function Log($msg) {
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    "[${ts}] $msg" | Out-File -FilePath $logFile -Append -Encoding UTF8
}

Log "=== start-api.ps1 launched ==="
Log "apiRoot: $apiRoot"
Log "User: $env:USERNAME  /  Domain: $env:USERDOMAIN"

# ---- 1. Wait for MySQL ----------------------------------------------------
# Parse DB_HOST from .env (default: localhost). Port is fixed at 3306 for now.
$envFile = Join-Path $apiRoot '.env'
$dbHost  = 'localhost'
if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^\s*DB_HOST\s*=' } | Select-Object -First 1
    if ($line -match '=\s*(.+)$') { $dbHost = $Matches[1].Trim() }
}
$dbPort = 3306

Log "Waiting for MySQL at ${dbHost}:${dbPort}..."
$deadline = (Get-Date).AddMinutes(2)
$dbReady  = $false
while ((Get-Date) -lt $deadline) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect($dbHost, $dbPort)
        $tcp.Close()
        $dbReady = $true
        break
    } catch {
        Start-Sleep -Seconds 2
    }
}
if (-not $dbReady) {
    Log "WARN: MySQL not reachable after 2 minutes. Starting API anyway."
} else {
    Log "MySQL is up."
}

# ---- 2. Locate Node.js ----------------------------------------------------
# SYSTEM's PATH is narrower than an interactive user's. Try several known
# install locations before giving up.
$pfX86 = [System.Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
$rawPaths = @(
    (Get-Command node -ErrorAction SilentlyContinue | ForEach-Object { $_.Source }),
    (Join-Path $env:ProgramFiles 'nodejs\node.exe')
)
if ($pfX86)            { $rawPaths += (Join-Path $pfX86 'nodejs\node.exe') }
if ($env:LOCALAPPDATA) { $rawPaths += (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe') }
$nodeCandidates = $rawPaths | Where-Object { $_ -and (Test-Path $_) }

if (-not $nodeCandidates -or $nodeCandidates.Count -eq 0) {
    Log "FATAL: node.exe not found. Aborting."
    exit 1
}
$nodeExe = $nodeCandidates[0]
Log "Using node: $nodeExe"

# ---- 3. Launch Node, restart on exit --------------------------------------
$mainJs      = Join-Path $apiRoot 'main.js'
$maxAttempts = 10
$attempt     = 0

while ($attempt -lt $maxAttempts) {
    $attempt++
    Log "Launch attempt $attempt of $maxAttempts..."

    $p = Start-Process -FilePath $nodeExe -ArgumentList $mainJs `
        -WorkingDirectory $apiRoot `
        -RedirectStandardOutput (Join-Path $logDir 'api.stdout.log') `
        -RedirectStandardError  (Join-Path $logDir 'api.stderr.log') `
        -NoNewWindow -PassThru -Wait

    $code = $p.ExitCode
    Log "Node exited with code $code."

    if ($code -eq 0) {
        Log "Clean exit. Not restarting."
        break
    }

    Start-Sleep -Seconds 5
}

Log "=== start-api.ps1 finished ==="
