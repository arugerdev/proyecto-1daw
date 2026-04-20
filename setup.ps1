#Requires -Version 5.1
<#
.SYNOPSIS
    EcijaComarca Media Manager — Windows Setup Script
.DESCRIPTION
    Installs all dependencies, configures the database, builds the frontend,
    and registers a Windows Scheduled Task for auto-start.
    Run once from an elevated (Administrator) PowerShell prompt.
.PARAMETER SkipBuild
    Skip Angular frontend build.
.PARAMETER SkipService
    Do not create a Windows Scheduled Task.
.PARAMETER Unattended
    Use all defaults without prompting (for CI/test environments).
.PARAMETER Mode
    'production' (default): builds frontend, registers scheduled task, starts API.
    'development': skips build and scheduled task, starts API in a visible window.
.EXAMPLE
    .\setup.ps1
    .\setup.ps1 -Mode development
    .\setup.ps1 -SkipBuild -SkipService
#>
param(
    [switch]$SkipBuild,
    [switch]$SkipService,
    [switch]$Unattended,
    [ValidateSet('production','development')]
    [string]$Mode = 'production'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

# ── Script root ──────────────────────────────────────────────────────────────
$ROOT = $PSScriptRoot

# ── Colour helpers ───────────────────────────────────────────────────────────
function Write-Banner {
    Clear-Host
    Write-Host ''
    Write-Host '  +======================================================+' -ForegroundColor Cyan
    Write-Host '  |   EcijaComarca Media Manager - Setup (Windows)       |' -ForegroundColor Cyan
    Write-Host '  +======================================================+' -ForegroundColor Cyan
    Write-Host ''
}

function Write-Step([string]$n, [string]$msg) {
    Write-Host "  [$n] $msg" -ForegroundColor Cyan
}
function Write-OK([string]$msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "  !!  $msg" -ForegroundColor Yellow }
function Write-Fail([string]$msg) { Write-Host "  XX  $msg" -ForegroundColor Red }
function Write-Info([string]$msg) { Write-Host "      $msg" -ForegroundColor DarkGray }

# ── Admin check ──────────────────────────────────────────────────────────────
function Assert-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = [Security.Principal.WindowsPrincipal]$id
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Fail 'Este script necesita ejecutarse como Administrador.'
        Write-Info 'Haz clic derecho en PowerShell -> "Ejecutar como administrador".'
        exit 1
    }
}

# ── Command existence ────────────────────────────────────────────────────────
function Test-Cmd([string]$cmd) {
    return ($null -ne (Get-Command $cmd -ErrorAction SilentlyContinue))
}

# ── Prompt helpers ───────────────────────────────────────────────────────────
function Read-Cfg([string]$Prompt, [string]$Default = '') {
    if ($Unattended) {
        return $Default
    }
    $hint = ''
    if ($Default) { $hint = " [$Default]" }
    $val = Read-Host "  -> $Prompt$hint"
    if ($val.Trim()) {
        return $val.Trim()
    }
    return $Default
}

function Read-Secret([string]$Prompt, [string]$Default = '') {
    if ($Unattended) {
        return $Default
    }
    $hint = ''
    if ($Default) { $hint = ' [ENTER = valor generado automaticamente]' }
    $sec   = Read-Host "  -> $Prompt$hint" -AsSecureString
    $bstr  = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    if ($plain.Trim()) {
        return $plain.Trim()
    }
    return $Default
}

# ── Random secret (URL-safe base64, no +/=/chars) ────────────────────────────
function New-Secret([int]$Bytes = 64) {
    $buf = New-Object byte[] $Bytes
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    $b64 = [Convert]::ToBase64String($buf)
    $safe = $b64.Replace('+', '-').Replace('/', '_').TrimEnd('=')
    return $safe
}

# ── winget wrapper ───────────────────────────────────────────────────────────
function Install-Winget([string]$Id, [string]$Name) {
    Write-Info "Instalando $Name via winget..."
    & winget install --id $Id -e --accept-package-agreements --accept-source-agreements --silent 2>&1 | Out-Null
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')
}

# ── MySQL helper ─────────────────────────────────────────────────────────────
# Uses --defaults-extra-file to pass password without exposing it on the command
# line (avoids the "Warning: Using a password on the command line..." message
# that MySQL captures on stderr and that would pollute error output).
function Invoke-MySQL([string]$Sql, [string]$DbUser = 'root', [string]$DbPass = '', [string]$DbHost = 'localhost') {
    $cnfFile   = $null
    $mysqlArgs = New-Object System.Collections.Generic.List[string]
    if ($DbPass) {
        $cnfFile = [IO.Path]::Combine([IO.Path]::GetTempPath(), "mysql_ec_$(Get-Random).cnf")
        "[client]`npassword=$DbPass" | Set-Content -Path $cnfFile -Encoding ASCII
        $mysqlArgs.Add("--defaults-extra-file=$cnfFile")   # MUST be first arg
    }
    $mysqlArgs.Add('-u');   $mysqlArgs.Add($DbUser)
    $mysqlArgs.Add("-h$DbHost")
    $mysqlArgs.Add('--batch'); $mysqlArgs.Add('--silent')
    $mysqlArgs.Add('-e');   $mysqlArgs.Add($Sql)
    try {
        $out = & mysql @mysqlArgs 2>&1
        if ($LASTEXITCODE -ne 0) {
            $errText = ($out | ForEach-Object { "$_" }) -join "`n"
            throw "MySQL error:`n$errText"
        }
        return $out
    } finally {
        if ($cnfFile -and (Test-Path $cnfFile)) { Remove-Item $cnfFile -Force -ErrorAction SilentlyContinue }
    }
}

# ── MySQL file helper (pipes a SQL file) ─────────────────────────────────────
function Invoke-MySQLFile([string]$FilePath, [string]$DbUser = 'root', [string]$DbPass = '', [string]$DbHost = 'localhost', [string]$Database = '') {
    $cnfFile   = $null
    $mysqlArgs = New-Object System.Collections.Generic.List[string]
    if ($DbPass) {
        $cnfFile = [IO.Path]::Combine([IO.Path]::GetTempPath(), "mysql_ec_$(Get-Random).cnf")
        "[client]`npassword=$DbPass" | Set-Content -Path $cnfFile -Encoding ASCII
        $mysqlArgs.Add("--defaults-extra-file=$cnfFile")   # MUST be first arg
    }
    $mysqlArgs.Add('-u');   $mysqlArgs.Add($DbUser)
    $mysqlArgs.Add("-h$DbHost")
    if ($Database) { $mysqlArgs.Add("--database=$Database") }
    try {
        Get-Content $FilePath | & mysql @mysqlArgs
        if ($LASTEXITCODE -ne 0) {
            throw "MySQL error applying file: $FilePath"
        }
    } finally {
        if ($cnfFile -and (Test-Path $cnfFile)) { Remove-Item $cnfFile -Force -ErrorAction SilentlyContinue }
    }
}

# =============================================================================
Write-Banner
Assert-Admin

# =============================================================================
#  STEP 1 - Node.js
# =============================================================================
Write-Step '1/7' 'Verificando Node.js...'

if (-not (Test-Cmd 'node')) {
    Write-Warn 'Node.js no encontrado. Intentando instalar via winget...'
    if (Test-Cmd 'winget') {
        Install-Winget 'OpenJS.NodeJS.LTS' 'Node.js LTS'
    } else {
        Write-Fail 'winget no disponible. Descarga Node.js LTS desde https://nodejs.org'
        exit 1
    }
}

if (-not (Test-Cmd 'node')) {
    Write-Fail 'Node.js sigue sin estar disponible. Instalalo manualmente y reinicia el script.'
    exit 1
}

$nodeVer = & node --version
$npmVer  = & npm  --version
Write-OK "Node.js $nodeVer"
Write-OK "npm $npmVer"

# =============================================================================
#  STEP 2 - MySQL / MariaDB
# =============================================================================
Write-Step '2/7' 'Verificando MySQL / MariaDB...'

if (-not (Test-Cmd 'mysql')) {
    Write-Warn 'mysql no encontrado en el PATH.'
    if (Test-Cmd 'winget') {
        Write-Host ''
        $choice = Read-Cfg 'Instalar MariaDB (recomendado) via winget? (s/n)' 's'
        if ($choice -ieq 's') {
            Install-Winget 'MariaDB.Server' 'MariaDB'
            Start-Service -Name 'MySQL' -ErrorAction SilentlyContinue
        }
    }
    if (-not (Test-Cmd 'mysql')) {
        Write-Fail 'mysql no disponible. Opciones:'
        Write-Info '  MariaDB: https://mariadb.org/download'
        Write-Info '  MySQL:   https://dev.mysql.com/downloads/installer'
        Write-Info 'Anadelo al PATH y vuelve a ejecutar el script.'
        exit 1
    }
}

$mysqlVer = & mysql --version
Write-OK "MySQL/MariaDB: $mysqlVer"

# =============================================================================
#  STEP 3 - Configuration
# =============================================================================
Write-Step '3/7' 'Configuracion...'
Write-Host ''
Write-Info 'Responde las preguntas. Pulsa ENTER para usar el valor por defecto.'
Write-Host ''

# Database
$DB_HOST = Read-Cfg  'Host MySQL'                  'localhost'
$DB_PORT = Read-Cfg  'Puerto MySQL'                 '3306'
$DB_ROOT = Read-Secret 'Contrasena root MySQL (vacio si no tiene)' ''
$DB_NAME = Read-Cfg  'Nombre de la base de datos'  'ecijacomarca'
$DB_USER = Read-Cfg    'Usuario MySQL para la API (ENTER = root)'   'root'
$DB_PASS = Read-Secret 'Contrasena del usuario API (ENTER = igual que root)' $DB_ROOT
if (-not $DB_PASS) { $DB_PASS = $DB_ROOT }

# Application
$API_PORT   = Read-Cfg 'Puerto de la API'              '3000'
$MEDIA_PATH = Read-Cfg 'Ruta de almacenamiento de medios' 'C:\EcijaComarca\Media'

# Accounts
Write-Host ''
Write-Info 'Cuentas de usuario:'
Write-Host ''
$OWNER_USER = Read-Cfg    'Nombre de usuario owner (oculto)'   'owner'
$OWNER_PASS = Read-Secret 'Contrasena owner'                    'FeZsS1BkAfuXGaESiSVs3pd0'
$ADMIN_USER = Read-Cfg    'Nombre de usuario admin'             'admin'
$ADMIN_PASS = Read-Secret 'Contrasena admin'                    'admin'

$SECRET_KEY = New-Secret 64

# =============================================================================
#  STEP 4 - Write configuration files
# =============================================================================
Write-Step '4/7' 'Escribiendo archivos de configuracion...'

$envDate = Get-Date -Format 'yyyy-MM-dd HH:mm'
$envContent = "# Auto-generated by setup.ps1 on $envDate`n" +
              "DB_HOST=$DB_HOST`n" +
              "DB_USER=$DB_USER`n" +
              "DB_PASSWORD=$DB_PASS`n" +
              "DB_NAME=$DB_NAME`n" +
              "# Legacy aliases (kept for backward compatibility)`n" +
              "HOST=$DB_HOST`n" +
              "USER=$DB_USER`n" +
              "PASSWORD=$DB_PASS`n" +
              "DATABASE=$DB_NAME`n" +
              "`n" +
              "SECRET_KEY=$SECRET_KEY`n" +
              "`n" +
              "MEDIA_PATH=$MEDIA_PATH`n" +
              "MAX_FILE_SIZE=53687091200`n" +
              "`n" +
              "PORT=$API_PORT`n" +
              "NODE_ENV=production`n" +
              "`n" +
              "UPDATE_MANIFEST_URL=`n"

Set-Content -Path "$ROOT\api\.env" -Value $envContent -Encoding UTF8 -NoNewline
Write-OK 'api/.env creado'

Set-Content -Path "$ROOT\version.json" -Value '{"version":"2.0.0"}' -Encoding UTF8
Write-OK 'version.json -> 2.0.0'

if (-not (Test-Path $MEDIA_PATH)) {
    New-Item -ItemType Directory -Path $MEDIA_PATH -Force | Out-Null
    Write-OK "Directorio de medios creado: $MEDIA_PATH"
} else {
    Write-OK "Directorio de medios: $MEDIA_PATH (ya existia)"
}

New-Item -ItemType Directory -Path "$ROOT\logs"    -Force | Out-Null
New-Item -ItemType Directory -Path "$ROOT\updates" -Force | Out-Null
Write-OK 'Carpetas logs/ y updates/ listas'

# =============================================================================
#  STEP 5 - Install dependencies + build frontend
# =============================================================================
Write-Step '5/7' 'Instalando dependencias...'

Write-Info 'npm install (API)...'
Push-Location "$ROOT\api"
& npm install --prefer-offline 2>&1 | Out-Null
Pop-Location
Write-OK 'Dependencias de la API instaladas'

if ($Mode -eq 'development') {
    Write-Warn 'Modo desarrollo: build del frontend omitido.'
} elseif (-not $SkipBuild) {
    Write-Info 'npm install (Frontend)...'
    Push-Location "$ROOT\front"
    & npm install --prefer-offline 2>&1 | Out-Null

    # Update environment.ts so the built app points to the local API
    $envTsPath = "$ROOT\front\src\environments\environment.ts"
    if (Test-Path $envTsPath) {
        $envTsContent = Get-Content $envTsPath -Raw
        $envTsContent = $envTsContent -replace "API_URL:\s*'[^']*'", "API_URL: 'http://localhost:${API_PORT}/api'"
        Set-Content -Path $envTsPath -Value $envTsContent -Encoding UTF8 -NoNewline
        Write-Info "environment.ts actualizado -> http://localhost:${API_PORT}/api"
    }

    Write-Info 'Compilando Angular (puede tardar 1-2 minutos)...'
    & npm run build -- --configuration=production 2>&1 | Out-Null
    $buildCode = $LASTEXITCODE
    Pop-Location
    if ($buildCode -ne 0) {
        Write-Fail 'Error al compilar el frontend. Revisa los errores de Angular.'
        exit 1
    }
    Write-OK 'Frontend compilado en front/dist/'
} else {
    Write-Warn 'Build del frontend omitido (-SkipBuild)'
}

# =============================================================================
#  STEP 6 - Database setup
# =============================================================================
Write-Step '6/7' 'Configurando base de datos...'

# Test root connection
try {
    Invoke-MySQL 'SELECT 1;' 'root' $DB_ROOT $DB_HOST | Out-Null
    Write-OK 'Conexion MySQL con root OK'
} catch {
    Write-Fail "No se pudo conectar a MySQL como root: $_"
    Write-Info 'Verifica que MySQL este ejecutandose y que la contrasena sea correcta.'
    exit 1
}

# Create database and user
Write-Info "Creando base de datos '$DB_NAME'..."
Invoke-MySQL "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 'root' $DB_ROOT $DB_HOST

if ($DB_USER -ne 'root') {
    Write-Info "Creando usuario '$DB_USER'..."
    Invoke-MySQL "CREATE USER IF NOT EXISTS '${DB_USER}'@'${DB_HOST}' IDENTIFIED BY '${DB_PASS}';" 'root' $DB_ROOT $DB_HOST
    Invoke-MySQL "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'${DB_HOST}'; FLUSH PRIVILEGES;" 'root' $DB_ROOT $DB_HOST
} else {
    Write-Info "Usando root como usuario de la base de datos (sin crear usuario adicional)."
}

# Apply schema
Write-Info 'Aplicando esquema...'
Invoke-MySQLFile "$ROOT\db\schema.sql" 'root' $DB_ROOT $DB_HOST $DB_NAME
Write-OK 'Esquema aplicado'

# Generate bcrypt hashes via Node.js (temp file avoids quoting issues on Windows)
Write-Info 'Creando cuentas de usuario...'

# Place the temp file inside api/ so node can resolve require('bcryptjs') from
# api/node_modules — module resolution walks up from the *file* location, not CWD.
$hashFile = [IO.Path]::Combine("$ROOT\api", '_ecija_hash_tmp.js')
$hashJs   = 'const bcrypt = require("bcryptjs");' + [Environment]::NewLine +
             'bcrypt.hash(process.argv[1], 12).then(function(h1) {' + [Environment]::NewLine +
             '  return bcrypt.hash(process.argv[2], 12).then(function(h2) {' + [Environment]::NewLine +
             '    process.stdout.write(h1 + "\n" + h2 + "\n");' + [Environment]::NewLine +
             '  });' + [Environment]::NewLine +
             '});'
Set-Content -Path $hashFile -Value $hashJs -Encoding UTF8

Push-Location "$ROOT\api"
$hashes = & node $hashFile $OWNER_PASS $ADMIN_PASS
Pop-Location
Remove-Item $hashFile -ErrorAction SilentlyContinue

$hashLines  = $hashes -split '\r?\n' | Where-Object { $_.Trim() }
$ownerHash  = if ($hashLines.Count -ge 1) { $hashLines[0].Trim() } else { '' }
$adminHash  = if ($hashLines.Count -ge 2) { $hashLines[1].Trim() } else { '' }

if ((-not $ownerHash) -or (-not $adminHash)) {
    Write-Fail 'Error generando hashes de contrasena. Verifica que bcryptjs este instalado en api/.'
    exit 1
}

$sqlInsertOwner = "USE ${DB_NAME}; INSERT INTO users (id, username, password, role, is_hidden) VALUES (1, '${OWNER_USER}', '${ownerHash}', 'owner', 1) ON DUPLICATE KEY UPDATE username=VALUES(username), password=VALUES(password), role='owner', is_hidden=1;"
$sqlInsertAdmin = "USE ${DB_NAME}; INSERT INTO users (id, username, password, role, is_hidden) VALUES (2, '${ADMIN_USER}', '${adminHash}', 'admin', 0) ON DUPLICATE KEY UPDATE username=VALUES(username), password=VALUES(password), role='admin', is_hidden=0;"
$sqlFixAutoInc  = "USE ${DB_NAME}; ALTER TABLE users AUTO_INCREMENT = 3;"

Invoke-MySQL $sqlInsertOwner 'root' $DB_ROOT $DB_HOST
Invoke-MySQL $sqlInsertAdmin 'root' $DB_ROOT $DB_HOST
Invoke-MySQL $sqlFixAutoInc  'root' $DB_ROOT $DB_HOST
Write-OK "Usuarios creados: ${OWNER_USER} (id=1, owner, oculto), ${ADMIN_USER} (id=2, admin)"

# Default storage location
$escapedPath = $MEDIA_PATH.Replace('\', '\\')
$sqlLocation = "USE ${DB_NAME}; INSERT IGNORE INTO storage_locations (name, base_path, storage_type, description) VALUES ('Subidas locales', '${escapedPath}', 'local', 'Directorio de subidas por defecto');"
try {
    Invoke-MySQL "USE ${DB_NAME}; UPDATE storage_locations SET base_path='${escapedPath}' WHERE name='Subidas locales';" 'root' $DB_ROOT $DB_HOST
} catch { }
Invoke-MySQL $sqlLocation 'root' $DB_ROOT $DB_HOST

Write-OK 'Base de datos lista'

# =============================================================================
#  STEP 7 - Windows Scheduled Task
# =============================================================================
Write-Step '7/7' 'Servicio de auto-inicio...'

if ($Mode -eq 'development') {
    Write-Warn 'Modo desarrollo: tarea programada omitida.'
    Write-Info 'Iniciando API en modo desarrollo...'
    $nodePath   = (Get-Command node).Source
    $scriptPath = "$ROOT\api\main.js"
    Start-Process -FilePath $nodePath -ArgumentList $scriptPath -WorkingDirectory "$ROOT\api" -WindowStyle Normal
    Write-OK 'API iniciada (proceso independiente). Cierra la ventana para detenerla.'
} elseif ($SkipService) {
    Write-Warn 'Tarea programada omitida (-SkipService)'
    Write-Info 'Iniciando API...'
    Push-Location "$ROOT\api"
    Start-Process -FilePath (Get-Command node).Source -ArgumentList main.js -WorkingDirectory "$ROOT\api" -WindowStyle Minimized
    Pop-Location
    Write-OK 'API iniciada'
} else {
    $taskName   = 'EcijaComarca_API'
    $nodePath   = (Get-Command node).Source
    $scriptPath = "$ROOT\api\main.js"
    $workDir    = "$ROOT\api"

    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

    $action   = New-ScheduledTaskAction -Execute $nodePath -Argument $scriptPath -WorkingDirectory $workDir
    $trigger  = New-ScheduledTaskTrigger -AtStartup
    $settings = New-ScheduledTaskSettingsSet `
        -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -RestartCount 10 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

    Register-ScheduledTask `
        -TaskName  $taskName `
        -Action    $action `
        -Trigger   $trigger `
        -Settings  $settings `
        -Principal $principal `
        -Description 'EcijaComarca API - auto-inicio con el sistema' | Out-Null

    Write-OK "Tarea programada registrada: '$taskName'"
    Write-Info "  Iniciar: Start-ScheduledTask -TaskName '$taskName'"
    Write-Info "  Detener: Stop-ScheduledTask  -TaskName '$taskName'"
    Write-Info "  Estado:  Get-ScheduledTask   -TaskName '$taskName' | Get-ScheduledTaskInfo"

    Start-ScheduledTask -TaskName $taskName
    Write-OK 'API iniciada'
}

# =============================================================================
#  SUMMARY
# =============================================================================
Write-Host ''
Write-Host '  +======================================================+' -ForegroundColor Green
Write-Host '  |           OK  Instalacion completada                 |' -ForegroundColor Green
Write-Host '  +======================================================+' -ForegroundColor Green
Write-Host ''
Write-Host "  API:           http://localhost:${API_PORT}" -ForegroundColor White
Write-Host "  Base de datos: ${DB_NAME}  (@  ${DB_HOST})" -ForegroundColor White
Write-Host "  Medios:        ${MEDIA_PATH}" -ForegroundColor White
Write-Host ''
Write-Host '  Credenciales de acceso:' -ForegroundColor DarkGray
Write-Host "    Admin  -> usuario: ${ADMIN_USER}  /  contrasena: ${ADMIN_PASS}" -ForegroundColor White
Write-Host "    Owner  -> usuario: ${OWNER_USER}  (oculto, guarda la contrasena)" -ForegroundColor White
Write-Host ''
Write-Host '  Guarda la contrasena del owner en un lugar seguro.' -ForegroundColor Yellow
Write-Host '  El archivo api/.env contiene la SECRET_KEY - no lo compartas.' -ForegroundColor Yellow
Write-Host ''
if ($Mode -eq 'production' -and -not $SkipBuild) {
    Write-Host '  Frontend:      El frontend se sirve desde la propia API.' -ForegroundColor DarkGray
    Write-Host "  Abre:          http://localhost:${API_PORT}" -ForegroundColor Cyan
    Write-Host ''
} elseif ($Mode -eq 'development') {
    Write-Host '  Modo desarrollo: ejecuta el frontend con:' -ForegroundColor DarkGray
    Write-Host '    cd front && npm start' -ForegroundColor White
    Write-Host ''
}
Write-Host '  Para iniciar la API manualmente:' -ForegroundColor DarkGray
Write-Host '    cd api' -ForegroundColor White
Write-Host '    node main.js' -ForegroundColor White
Write-Host ''
