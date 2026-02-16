@echo off
SETLOCAL

echo #############################
echo # INSTALANDO CURL (si falta)
echo #############################

where curl >nul 2>nul
if %errorlevel% neq 0 (
    echo Instalando curl...
    winget install curl.curl
) else (
    echo curl ya instalado
)

echo #############################
echo # INSTALANDO NODEJS
echo #############################

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Instalando NodeJS...
    winget install OpenJS.NodeJS
) else (
    echo Node ya instalado
)

echo #############################
echo # INSTALANDO ANGULAR CLI
echo #############################

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node no encontrado. Abortando.
    exit /b 1
)

CMD /C npm install -g @angular/cli

echo #############################
echo # INSTALANDO DEPENDENCIAS API
echo #############################

cd ../api
npm install
cd ..

echo.
echo ENTORNO INSTALADO CORRECTAMENTE
pause
ENDLOCAL
