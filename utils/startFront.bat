@echo off
SETLOCAL

REM Obtener la ruta del script
SET SCRIPT_DIR=%~dp0

REM Ir a ../../front
cd /d "%SCRIPT_DIR%..\front"

echo Instalando dependencias...
CMD /C npm install

echo Iniciando Angular...
cd /d "%SCRIPT_DIR%..\front"
CMD /C ng serve

ENDLOCAL
pause
