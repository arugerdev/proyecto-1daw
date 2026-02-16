@echo off
SETLOCAL

SET SCRIPT_DIR=%~dp0

cd /d "%SCRIPT_DIR%\..\api"

echo Instalando dependencias...
CMD /C npm install

echo Iniciando API...
node main.js

ENDLOCAL
pause
