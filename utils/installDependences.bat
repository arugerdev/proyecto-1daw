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
echo # CREANDO SERVICIOS DE WINDOWS
echo #############################
echo.

echo Directorio de instalacion: %SCRIPT_DIR%
echo Directorio del proyecto: %PROJECT_ROOT%
echo.

REM ─── Verificar/crear startApi.bat ─────────────────────────────────────────
if not exist "%SCRIPT_DIR%startApi.bat" (
    echo Creando startApi.bat...
    (
        echo @echo off
        echo cd /d "%PROJECT_ROOT%\api"
        echo echo Iniciando API en %PROJECT_ROOT%\api...
        echo npm start
    ) > "%SCRIPT_DIR%startApi.bat"
    echo [OK] Creado startApi.bat
)

REM ─── Verificar/crear startFront.bat ───────────────────────────────────────
if not exist "%SCRIPT_DIR%startFront.bat" (
    echo Creando startFront.bat...
    (
        echo @echo off
        echo cd /d "%PROJECT_ROOT%\front"
        echo echo Iniciando Frontend en %PROJECT_ROOT%\front...
        echo npm start
    ) > "%SCRIPT_DIR%startFront.bat"
    echo [OK] Creado startFront.bat
)

REM ─── Forzar eliminación completa de servicios existentes ──────────────────
echo Limpiando servicios existentes...

REM Detener servicios si están corriendo
net stop "TelevisionApiService" >nul 2>nul
net stop "TelevisionFrontendService" >nul 2>nul

REM Eliminar servicios (puede requerir múltiples intentos)
for /L %%i in (1,1,3) do (
    sc delete "TelevisionApiService" >nul 2>nul
    sc delete "TelevisionFrontendService" >nul 2>nul
    timeout /t 2 /nobreak >nul
)

REM Esperar a que Windows libere los servicios
echo Esperando liberacion de servicios...
timeout /t 5 /nobreak >nul

REM ─── Eliminar scripts wrapper antiguos si existen ─────────────────────────
if exist "%SCRIPT_DIR%api_service_wrapper.bat" (
    attrib -r "%SCRIPT_DIR%api_service_wrapper.bat" >nul 2>nul
    del /f "%SCRIPT_DIR%api_service_wrapper.bat" 2>nul
)
if exist "%SCRIPT_DIR%frontend_service_wrapper.bat" (
    attrib -r "%SCRIPT_DIR%frontend_service_wrapper.bat" >nul 2>nul
    del /f "%SCRIPT_DIR%frontend_service_wrapper.bat" 2>nul
)

REM ─── Crear scripts wrapper para servicios ─────────────────────────────────
echo Creando scripts wrapper para servicios...

(
    echo @echo off
    echo cd /d "%PROJECT_ROOT%"
    echo echo %%date%% %%time%% - Iniciando servicio API >> "%SCRIPT_DIR%api_service.log"
    echo start /b "" cmd /c "%SCRIPT_DIR%startApi.bat" ^>^> "%SCRIPT_DIR%api_service.log" 2^>^&1
    echo echo %%date%% %%time%% - Servicio API iniciado >> "%SCRIPT_DIR%api_service.log"
) > "%SCRIPT_DIR%api_service_wrapper.bat"

(
    echo @echo off
    echo cd /d "%PROJECT_ROOT%"
    echo echo %%date%% %%time%% - Iniciando servicio Frontend >> "%SCRIPT_DIR%frontend_service.log"
    echo start /b "" cmd /c "%SCRIPT_DIR%startFront.bat" ^>^> "%SCRIPT_DIR%frontend_service.log" 2^>^&1
    echo echo %%date%% %%time%% - Servicio Frontend iniciado >> "%SCRIPT_DIR%frontend_service.log"
) > "%SCRIPT_DIR%frontend_service_wrapper.bat"

echo [OK] Scripts wrapper creados

REM ─── Crear servicio para la API ───────────────────────────────────────────
echo.
echo Creando servicio: TelevisionApiService

set "WRAPPER_PATH=%SCRIPT_DIR%api_service_wrapper.bat"

sc create "TelevisionApiService" binPath= "C:\Windows\system32\cmd.exe /c \"%WRAPPER_PATH%\"" start= auto DisplayName= "Television API Service"

if %errorlevel% equ 0 (
    echo [OK] Servicio TelevisionApiService creado correctamente
    
    sc failure "TelevisionApiService" reset= 86400 actions= restart/5000/restart/5000/restart/5000
    sc config "TelevisionApiService" obj= "LocalSystem" password= ""
    sc description "TelevisionApiService" "Servicio para la API del sistema Television Ecija"
    
    echo Configurado para reinicio automatico
) else (
    echo [ERROR] No se pudo crear el servicio TelevisionApiService
    echo Intentando de nuevo con nombre diferente...
    
    sc create "TelevisionApiService2" binPath= "C:\Windows\system32\cmd.exe /c \"%WRAPPER_PATH%\"" start= auto DisplayName= "Television API Service"
    if %errorlevel% equ 0 (
        echo [OK] Servicio creado como TelevisionApiService2
    )
)

echo.

REM ─── Crear servicio para el Frontend ──────────────────────────────────────
echo Creando servicio: TelevisionFrontendService

set "WRAPPER_FRONT_PATH=%SCRIPT_DIR%frontend_service_wrapper.bat"

sc create "TelevisionFrontendService" binPath= "C:\Windows\system32\cmd.exe /c \"%WRAPPER_FRONT_PATH%\"" start= auto DisplayName= "Television Frontend Service"

if %errorlevel% equ 0 (
    echo [OK] Servicio TelevisionFrontendService creado correctamente
    
    sc failure "TelevisionFrontendService" reset= 86400 actions= restart/5000/restart/5000/restart/5000
    sc config "TelevisionFrontendService" obj= "LocalSystem" password= ""
    sc description "TelevisionFrontendService" "Servicio para el Frontend del sistema Television Ecija"
    
    echo Configurado para reinicio automatico
) else (
    echo [ERROR] No se pudo crear el servicio TelevisionFrontendService
)

echo.

REM ─── Iniciar servicios ────────────────────────────────────────────────────
echo Iniciando servicios...

sc start "TelevisionApiService" >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Servicio API iniciado
) else (
    echo [AVISO] El servicio API no se inicio. Prueba: sc start TelevisionApiService2
)

sc start "TelevisionFrontendService" >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Servicio Frontend iniciado
) else (
    echo [AVISO] El servicio Frontend no se inicio. Reinicia el equipo o inicia manualmente
)

echo.
echo =============================================
echo   RESUMEN FINAL
echo =============================================
echo.

echo  [OK]  Node.js instalado
echo  [OK]  curl instalado
echo  [OK]  Dependencias instaladas
echo  [OK]  Scripts configurados
echo.
echo  Logs disponibles en:
echo    - %SCRIPT_DIR%api_service.log
echo    - %SCRIPT_DIR%frontend_service.log
echo.
echo  Gestion de servicios:
echo    net start TelevisionApiService
echo    net stop TelevisionApiService
echo    sc query TelevisionApiService
echo.
echo  Si el servicio API no se creo correctamente, usa:
echo    sc create TelevisionApiService binPath= "C:\Windows\system32\cmd.exe /c \"%SCRIPT_DIR%api_service_wrapper.bat\"" start= auto

echo.
echo INSTALACION COMPLETADA
echo.
echo NOTA: Es recomendable REINICIAR EL EQUIPO para que los servicios
echo       funcionen correctamente con inicio automatico.
echo.
pause
ENDLOCAL