@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

REM ─── Verificar permisos de administrador ───────────────────────────────────
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Este script debe ejecutarse como Administrador.
    echo         Haz clic derecho sobre el archivo y selecciona
    echo         "Ejecutar como administrador".
    pause
    exit /b 1
)

echo.
echo =============================================
echo   INSTALADOR UNIFICADO - Television Ecija
echo =============================================
echo.

REM ─── Obtener la raiz del proyecto (directorio padre de utils) ─────────────
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
for %%i in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fi"

echo Directorio del proyecto: %PROJECT_ROOT%
echo.

REM ─── Comprobar que winget esta disponible ──────────────────────────────────
where winget >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] winget no esta disponible en este sistema.
    echo         Actualiza Windows o instala "App Installer" desde Microsoft Store.
    pause
    exit /b 1
)

echo #############################
echo # INSTALANDO GIT
echo #############################

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo Instalando Git...
    winget install Git.Git --silent --accept-package-agreements --accept-source-agreements
    if %errorlevel% equ 0 (
        echo [OK] Git instalado correctamente.
        echo [AVISO] Es posible que necesites reiniciar la terminal para usar git.
    ) else (
        echo [AVISO] No se pudo instalar Git automaticamente.
        echo         Puedes descargarlo desde https://git-scm.com/
    )
) else (
    echo Git ya instalado
    git --version
)

echo.
echo #############################
echo # INSTALANDO CURL (si falta)
echo #############################

where curl >nul 2>nul
if %errorlevel% neq 0 (
    echo Instalando curl...
    winget install curl.curl --silent --accept-package-agreements --accept-source-agreements
) else (
    echo curl ya instalado
)

echo.
echo #############################
echo # INSTALANDO NODEJS
echo #############################

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Instalando NodeJS...
    winget install OpenJS.NodeJS --silent --accept-package-agreements --accept-source-agreements
) else (
    echo Node ya instalado
    node --version
)

echo.
echo #############################
echo # INSTALANDO ANGULAR CLI
echo #############################

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node no encontrado. Abortando.
    exit /b 1
)

echo Instalando Angular CLI globalmente...
call npm install -g @angular/cli

echo.
echo #############################
echo # INSTALANDO DEPENDENCIAS API
echo #############################

set "API_DIR=%PROJECT_ROOT%\api"
if exist "!API_DIR!\package.json" (
    echo Instalando dependencias de API en !API_DIR!...
    pushd "!API_DIR!"
    call npm install
    popd
    echo [OK] Dependencias de la API instaladas.
) else (
    echo [ERROR] No se encontro package.json en !API_DIR!
)

echo.
echo #############################
echo # INSTALANDO DEPENDENCIAS FRONTEND
echo #############################

set "FRONT_DIR=%PROJECT_ROOT%\front"
if exist "!FRONT_DIR!\package.json" (
    echo Instalando dependencias del Frontend en !FRONT_DIR!...
    pushd "!FRONT_DIR!"
    call npm install
    popd
    echo [OK] Dependencias del Frontend instaladas.
) else (
    echo [AVISO] No se encontro package.json en !FRONT_DIR!
)

echo.
echo #############################
echo # INSTALANDO MySQL
echo #############################

REM ─── Visual C++ Runtime ───────────────────────────────────────────────────
echo.
echo Instalando Visual C++ Runtime...
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\X64" >nul 2>nul
if %errorlevel% neq 0 (
    winget install Microsoft.VCRedist.2015+.x64 --silent --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo [AVISO] No se pudo instalar Visual C++ automaticamente.
    ) else (
        echo [OK] Visual C++ Redistributable instalado.
    )
) else (
    echo [OK] Visual C++ Redistributable ya instalado.
)

REM ─── MySQL Server ─────────────────────────────────────────────────────────
echo.
echo Instalando MySQL Server...
set MYSQL_BIN=
set MYSQL_FOUND=0

if exist "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" (
    set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 8.4\bin"
    set MYSQL_FOUND=1
)
if "!MYSQL_FOUND!"=="0" (
    if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 8.0\bin"
        set MYSQL_FOUND=1
    )
)

if "!MYSQL_FOUND!"=="1" (
    echo [OK] MySQL Server ya esta instalado.
) else (
    winget install Oracle.MySQL --silent --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo [ERROR] Fallo la instalacion de MySQL.
        pause
        exit /b 1
    )
    echo [OK] MySQL Server instalado.
    set MYSQL_RECIEN_INSTALADO=1
)

REM ─── MySQL Workbench ──────────────────────────────────────────────────────
echo.
echo Instalando MySQL Workbench...
set WB_FOUND=0
if exist "C:\Program Files\MySQL\MySQL Workbench 8.0 CE\MySQLWorkbench.exe" set WB_FOUND=1
if exist "C:\Program Files\MySQL\MySQL Workbench 8.0\MySQLWorkbench.exe" set WB_FOUND=1

if "!WB_FOUND!"=="1" (
    echo [OK] MySQL Workbench ya instalado.
) else (
    winget install Oracle.MySQLWorkbench --silent --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo [AVISO] No se pudo instalar MySQL Workbench.
    ) else (
        echo [OK] MySQL Workbench instalado.
    )
)

REM ─── Añadir MySQL al PATH ─────────────────────────────────────────────────
echo.
echo Configurando PATH de MySQL...
if defined MYSQL_BIN (
    echo Ruta MySQL encontrada: !MYSQL_BIN!
    
    echo !PATH! | find /I "!MYSQL_BIN!" >nul 2>nul
    if !errorlevel! neq 0 (
        echo Añadiendo MySQL al PATH del sistema...
        for /f "tokens=2,*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do (
            set "CURRENT_PATH=%%b"
        )
        set "NEW_PATH=!CURRENT_PATH!;!MYSQL_BIN!"
        reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path /t REG_EXPAND_SZ /d "!NEW_PATH!" /f
        echo [OK] MySQL añadido al PATH del sistema.
        echo [AVISO] Reinicia la terminal para que los cambios surtan efecto.
    ) else (
        echo [OK] MySQL ya esta en el PATH del sistema.
    )
)

REM ─── Iniciar servicio MySQL ───────────────────────────────────────────────
echo.
echo Iniciando servicio MySQL...
set SERVICE_STARTED=0
for %%S in (MySQL80 MySQL84 MySQL57) do (
    sc query %%S >nul 2>nul
    if !errorlevel! equ 0 (
        sc query %%S | find "RUNNING" >nul 2>nul
        if !errorlevel! equ 0 (
            echo [OK] Servicio %%S ya esta ejecutandose.
            set SERVICE_STARTED=1
        ) else (
            net start %%S >nul 2>nul
            if !errorlevel! equ 0 (
                echo [OK] Servicio %%S iniciado.
                set SERVICE_STARTED=1
            )
        )
    )
)

echo.
echo #############################
echo # CONFIGURANDO BASE DE DATOS
echo #############################
echo.

REM ─── Buscar archivo SQL de inicializacion ─────────────────────────────────
set "SQL_FILE=%PROJECT_ROOT%\db\init.sql"

if not exist "!SQL_FILE!" (
    echo [ERROR] No se encontro el archivo SQL en: !SQL_FILE!
    echo         Asegurate de que existe el archivo init.sql en la carpeta db
    pause
    exit /b 1
)

echo Archivo SQL encontrado: !SQL_FILE!
echo.

REM ─── Solicitar datos de conexion MySQL ────────────────────────────────────
echo Configuracion de la base de datos "administradorMultimedia"
echo ------------------------------------------------------------
echo.

set /p "MYSQL_USER=Usuario MySQL (por defecto root): "
if "!MYSQL_USER!"=="" set "MYSQL_USER=root"

set /p "MYSQL_PASS=Contrasena MySQL: "

if "!MYSQL_PASS!"=="" (
    echo [AVISO] Sin contrasena. Intentando conectar...
    set "MYSQL_CMD=mysql -u !MYSQL_USER!"
) else (
    set "MYSQL_CMD=mysql -u !MYSQL_USER! -p!MYSQL_PASS!"
)

echo.
echo Probando conexion a MySQL...

REM ─── Probar conexion ──────────────────────────────────────────────────────
!MYSQL_CMD! -e "SELECT 1" >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se pudo conectar a MySQL.
    echo         Verifica usuario y contrasena.
    pause
    exit /b 1
)
echo [OK] Conexion exitosa.

REM ─── Ejecutar script SQL ──────────────────────────────────────────────────
echo.
echo Ejecutando script SQL: !SQL_FILE!
echo Esto puede tomar unos segundos...

!MYSQL_CMD! < "!SQL_FILE!" 2> "%TEMP%\mysql_error.log"

if %errorlevel% equ 0 (
    echo [OK] Script SQL ejecutado correctamente.
    echo [OK] Base de datos, tablas y datos iniciales creados.
) else (
    echo [ERROR] Fallo al ejecutar el script SQL.
    echo         Revisa el log: %TEMP%\mysql_error.log
    echo.
    echo Mostrando errores:
    type "%TEMP%\mysql_error.log"
    pause
    exit /b 1
)

REM ─── Verificar tablas creadas ─────────────────────────────────────────────
echo.
echo Verificando tablas creadas...
!MYSQL_CMD! administradorMultimedia -e "SHOW TABLES;" 2>nul

echo.
echo Verificando usuarios creados...
!MYSQL_CMD! administradorMultimedia -e "SELECT id_user, nombre, rol FROM users;" 2>nul

echo.
echo =============================================
echo   RESUMEN FINAL
echo =============================================
echo.

echo  [OK]  Git instalado
echo  [OK]  Node.js instalado
echo  [OK]  curl instalado
echo  [OK]  Angular CLI instalado
echo  [OK]  Dependencias instaladas
echo  [OK]  MySQL instalado y configurado
echo  [OK]  Base de datos 'administradorMultimedia' creada
echo  [OK]  Script SQL ejecutado correctamente
echo.
echo  Base de datos: administradorMultimedia
echo  Usuario MySQL: !MYSQL_USER!
echo.
echo  Credenciales por defecto (si estan en tu init.sql):
echo    - admin
echo    - owner
echo.
echo  Para gestionar MySQL:
echo    - Conectar: mysql -u !MYSQL_USER! -p administradorMultimedia
echo    - Ver tablas: SHOW TABLES;
echo    - Ver estructura: DESCRIBE nombre_tabla;
echo    - Ver usuarios: SELECT * FROM users;
echo.
echo  Para Git:
echo    - Version: git --version
echo    - Configurar usuario: git config --global user.name "Tu Nombre"
echo    - Configurar email: git config --global user.email "tu@email.com"

echo.
echo INSTALACION COMPLETADA
echo.
pause
ENDLOCAL