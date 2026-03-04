@echo off
setlocal enabledelayedexpansion

REM Script para convertir CSV de Zotero a inserts SQL
REM Uso: script.bat archivo.csv

REM Verificar que se proporcionó un archivo CSV
if "%1"=="" (
    echo Error: Debes proporcionar un archivo CSV
    echo Uso: %0 archivo.csv
    exit /b 1
)

set "CSV_FILE=%1"

REM Verificar que el archivo existe
if not exist "%CSV_FILE%" (
    echo Error: El archivo %CSV_FILE% no existe
    exit /b 1
)

REM Archivo de salida SQL
set "OUTPUT_FILE=inserts.sql"

REM Crear el archivo SQL con la cabecera
(
    echo DROP DATABASE IF EXISTS administradorMultimedia;
    echo CREATE DATABASE administradorMultimedia;
    echo USE administradorMultimedia;
    echo.
    echo CREATE TABLE users ^(
    echo     id_user INT AUTO_INCREMENT PRIMARY KEY,
    echo     nombre VARCHAR(50) UNIQUE,
    echo     contrasena VARCHAR(255),
    echo     CHECK ^(CHAR_LENGTH(contrasena^) ^>= 4^),
    echo     rol VARCHAR(30^) DEFAULT "viewer",
    echo     CHECK ^(rol IN ^("admin", "moderator", "viewer"^)^)
    echo ^);
    echo.
    echo CREATE TABLE sessions ^(
    echo     id_sesion INT AUTO_INCREMENT PRIMARY KEY,
    echo     id_user INT,
    echo     key_session VARCHAR(512^),
    echo     fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    echo     FOREIGN KEY ^(id_user^) REFERENCES users(id_user^) ON DELETE CASCADE
    echo ^);
    echo.
    echo CREATE TABLE author ^(
    echo     id INT AUTO_INCREMENT PRIMARY KEY,
    echo     name VARCHAR(255^),
    echo     role VARCHAR(100^)
    echo ^);
    echo.
    echo CREATE TABLE media_types ^(
    echo     id INT AUTO_INCREMENT PRIMARY KEY,
    echo     name VARCHAR(100^) UNIQUE
    echo ^);
    echo.
    echo CREATE TABLE media_locations ^(
    echo     id INT AUTO_INCREMENT PRIMARY KEY,
    echo     path TEXT
    echo ^);
    echo.
    echo CREATE TABLE media_items ^(
    echo     id INT AUTO_INCREMENT PRIMARY KEY,
    echo     title VARCHAR(255^),
    echo     description TEXT,
    echo     publication_year INT,
    echo     media_path TEXT,
    echo     filename VARCHAR(255^),
    echo     content_type_id INT,
    echo     media_location_id INT,
    echo     tags TEXT,
    echo     date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    echo     date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    echo     FOREIGN KEY ^(media_location_id^) REFERENCES media_locations(id^),
    echo     FOREIGN KEY ^(content_type_id^) REFERENCES media_types(id^)
    echo ^);
    echo.
    echo CREATE TABLE media_author ^(
    echo     media_id INT,
    echo     author_id INT,
    echo     PRIMARY KEY ^(media_id, author_id^),
    echo     FOREIGN KEY ^(media_id^) REFERENCES media_items(id^) ON DELETE CASCADE,
    echo     FOREIGN KEY ^(author_id^) REFERENCES author(id^) ON DELETE CASCADE
    echo ^);
    echo.
    echo -- #################### DEFAULT USERS ####################
    echo INSERT INTO users ^(nombre, contrasena, rol^) 
    echo VALUES ^(
    echo     "admin", 
    echo     "$2b$12$vbj7TFESQuAcFTBXgacpuu7GGewrfmuOVN8vxQxE2DIaoqSHFi69e", 
    echo     "admin"
    echo ^);
    echo INSERT INTO users ^(nombre, contrasena, rol^) 
    echo VALUES ^(
    echo     "viewer", 
    echo     "$2a$12$RCCN9wh0S27yBoUkYaUb4us6m9J8IO6UC/rtpeKLlxXPJ/luoJZE6", 
    echo     "viewer"
    echo ^);
    echo.
    echo -- #################### DATOS DEL CSV ####################
    echo.
) > "%OUTPUT_FILE%"

REM Contadores para IDs
set "media_type_id=1"
set "location_id=1"
set "author_id=1"
set "media_count=0"

REM Procesar el CSV línea por línea (saltando la primera línea)
set "line_num=0"
for /f "usebackq tokens=* delims=" %%a in ("%CSV_FILE%") do (
    set /a "line_num+=1"
    if !line_num! gtr 1 (
        set "line=%%a"
        
        REM Extraer campos (simplificado - para CSV complejo se necesitaría un parser más robusto)
        REM Esto es una versión simplificada, asume que no hay comas dentro de los campos
        for /f "tokens=1-47 delims=," %%b in ("!line!") do (
            set "key=%%b"
            set "item_type=%%c"
            set "pub_year=%%d"
            set "author=%%e"
            set "title=%%f"
            set "url=%%k"
            set "description=%%l"
            set "date_added=%%n"
            
            REM Limpiar comillas
            set "key=!key:"=!"
            set "item_type=!item_type:"=!"
            set "pub_year=!pub_year:"=!"
            set "author=!author:"=!"
            set "title=!title:"=!"
            set "url=!url:"=!"
            set "description=!description:"=!"
            set "date_added=!date_added:"=!"
            
            REM Eliminar tags HTML de la descripción (simplificado)
            set "description=!description:<= !"
            set "description=!description:>= !"
            
            REM Mapeo de CSV a SQL
            REM CSV(Title) -^> SQL(title)
            REM CSV(Abstract Note) -^> SQL(description)
            REM CSV(Publication Year) -^> SQL(publication_year)
            REM CSV(Url) -^> SQL(media_path)
            REM CSV(Item Type) -^> SQL(content_type_id)
            
            REM Procesar año
            if "!pub_year!"=="" (
                set "pub_year_sql=NULL"
            ) else (
                set "pub_year_sql=!pub_year!"
            )
            
            REM Procesar item_type (media_types)
            if not "!item_type!"=="" (
                REM Verificar si ya existe (esto es un chequeo simple - en Batch real se necesitaría un archivo temporal)
                set "type_exists=0"
                set "content_type_id=!media_type_id!"
                set /a "media_type_id+=1"
                
                REM Insertar media_type
                echo INSERT INTO media_types ^(id, name^) VALUES ^(!content_type_id!, '!item_type!'^); >> "%OUTPUT_FILE%"
            ) else (
                set "content_type_id=NULL"
            )
            
            REM Procesar URL para obtener filename y location
            if not "!url!"=="" (
                REM Extraer filename (simplificado)
                for %%f in ("!url!") do set "filename=%%~nxf"
                set "filename=!filename:?=!"
                
                REM Extraer location (simplificado)
                if "!url:~0,4!"=="http" (
                    for /f "tokens=1-3 delims=/" %%i in ("!url!") do set "location=%%i//%%j"
                ) else (
                    for %%g in ("!url!") do set "location=%%~dpg"
                )
                
                if not "!location!"=="" (
                    set "media_location_id=!location_id!"
                    set /a "location_id+=1"
                    echo INSERT INTO media_locations ^(id, path^) VALUES ^(!media_location_id!, '!location!'^); >> "%OUTPUT_FILE%"
                ) else (
                    set "media_location_id=NULL"
                )
            ) else (
                set "url="
                set "filename="
                set "media_location_id=NULL"
            )
            
            REM Escapar comillas simples
            set "title=!title:'=''!"
            set "description=!description:'=''!"
            
            REM Insertar media_item
            set /a "media_count+=1"
            (
                echo INSERT INTO media_items ^(title, description, publication_year, media_path, filename, content_type_id, media_location_id, date_added^) VALUES ^(
                echo     '!title!',
                echo     '!description!',
                echo     !pub_year_sql!,
                echo     '!url!',
                echo     '!filename!',
                echo     !content_type_id!,
                echo     !media_location_id!,
                
                if not "!date_added!"=="" (
                    echo     '!date_added!'
                ) else (
                    echo     CURRENT_TIMESTAMP
                )
                echo ^);
                echo.
            ) >> "%OUTPUT_FILE%"
            
            REM Procesar autor
            if not "!author!"=="" (
                REM Dividir autores por punto y coma
                set "author_list=!author:;= !"
                for %%x in (!author_list!) do (
                    set "clean_author=%%x"
                    set "clean_author=!clean_author:"=!"
                    
                    if not "!clean_author!"=="" (
                        set "current_author_id=!author_id!"
                        set /a "author_id+=1"
                        echo INSERT INTO author ^(id, name, role^) VALUES ^(!current_author_id!, '!clean_author!', NULL^); >> "%OUTPUT_FILE%"
                        
                        REM Insertar relación media_author
                        echo INSERT INTO media_author ^(media_id, author_id^) VALUES ^(!media_count!, !current_author_id!^); >> "%OUTPUT_FILE%"
                    )
                )
            )
            echo. >> "%OUTPUT_FILE%"
        )
    )
)

echo Procesamiento completado. Archivo SQL generado: %OUTPUT_FILE%

echo.
echo Estadísticas:
echo - Media Types insertados: %media_type_id%
echo - Locations insertadas: %location_id%
echo - Autores insertados: %author_id%