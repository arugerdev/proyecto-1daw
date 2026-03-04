#!/bin/bash

# Script para convertir CSV de Zotero a inserts SQL
# Uso: ./script.sh archivo.csv

# Verificar que se proporcionó un archivo CSV
if [ $# -eq 0 ]; then
    echo "Error: Debes proporcionar un archivo CSV"
    echo "Uso: $0 archivo.csv"
    exit 1
fi

CSV_FILE="$1"

# Verificar que el archivo existe
if [ ! -f "$CSV_FILE" ]; then
    echo "Error: El archivo $CSV_FILE no existe"
    exit 1
fi

# Archivo de salida SQL
OUTPUT_FILE="inserts.sql"

# Crear el archivo SQL con la cabecera
cat > "$OUTPUT_FILE" << 'EOF'
DROP DATABASE IF EXISTS administradorMultimedia;
CREATE DATABASE administradorMultimedia;
USE administradorMultimedia;

CREATE TABLE users (
    id_user INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE,
    contrasena VARCHAR(255),
    CHECK (CHAR_LENGTH(contrasena) >= 4),
    rol VARCHAR(30) DEFAULT "viewer",
    CHECK (rol IN ("admin", "moderator", "viewer"))
);

CREATE TABLE sessions (
    id_sesion INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT,
    key_session VARCHAR(512),
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user) REFERENCES users(id_user) ON DELETE CASCADE
);

CREATE TABLE author (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    role VARCHAR(100)
);

CREATE TABLE media_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE
);

CREATE TABLE media_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    path TEXT
);

CREATE TABLE media_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    publication_year INT,
    media_path TEXT,
    filename VARCHAR(255),
    content_type_id INT,
    media_location_id INT,
    tags TEXT,
    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (media_location_id) REFERENCES media_locations(id),
    FOREIGN KEY (content_type_id) REFERENCES media_types(id)
);

CREATE TABLE media_author (
    media_id INT,
    author_id INT,
    PRIMARY KEY (media_id, author_id),
    FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES author(id) ON DELETE CASCADE
);

-- #################### DEFAULT USERS ####################
INSERT INTO users (nombre, contrasena, rol) 
VALUES (
    "admin", 
    "$2b$12$vbj7TFESQuAcFTBXgacpuu7GGewrfmuOVN8vxQxE2DIaoqSHFi69e", 
    "admin"
);
INSERT INTO users (nombre, contrasena, rol) 
VALUES (
    "viewer", 
    "$2a$12$RCCN9wh0S27yBoUkYaUb4us6m9J8IO6UC/rtpeKLlxXPJ/luoJZE6", 
    "viewer"
);

-- #################### DATOS DEL CSV ####################

EOF

# Arrays asociativos para evitar duplicados
declare -A media_types_map
declare -A media_locations_map
declare -A authors_map

# Contadores para IDs
media_type_id=1
location_id=1
author_id=1

# Función para escapar comillas simples en strings SQL
escape_sql() {
    echo "$1" | sed "s/'/''/g"
}

# Función para extraer filename de una URL o path
extract_filename() {
    local path="$1"
    # Eliminar protocolo y dominio si es URL
    filename=$(basename "$path" | sed 's/?.*//')
    echo "$filename"
}

# Función para extraer location de una URL o path
extract_location() {
    local path="$1"
    # Si es URL, obtener el directorio base
    if [[ "$path" =~ ^https?:// ]]; then
        # Para URLs, usamos el dominio como location
        location=$(echo "$path" | sed -E 's#(https?://[^/]+).*#\1#')
    else
        # Para paths de archivo, obtener el directorio
        location=$(dirname "$path")
    fi
    echo "$location"
}

# Procesar el CSV línea por línea (saltando la cabecera)
tail -n +2 "$CSV_FILE" | while IFS= read -r line; do
    # Usar un enfoque más robusto para parsear CSV
    # Extraer campos usando awk para manejar correctamente las comillas
    key=$(echo "$line" | awk -F',' '{print $1}' | sed 's/^"//;s/"$//')
    item_type=$(echo "$line" | awk -F',' '{print $2}' | sed 's/^"//;s/"$//')
    pub_year=$(echo "$line" | awk -F',' '{print $3}' | sed 's/^"//;s/"$//')
    
    # CAMBIO IMPORTANTE: Ahora la descripción viene de la columna Author (posición 4)
    description=$(echo "$line" | awk -F',' '{print $4}' | sed 's/^"//;s/"$//' | sed 's/<[^>]*>//g') # Eliminar tags HTML
    
    title=$(echo "$line" | awk -F',' '{print $5}' | sed 's/^"//;s/"$//')
    url=$(echo "$line" | awk -F',' '{print $10}' | sed 's/^"//;s/"$//')
    date_added=$(echo "$line" | awk -F',' '{print $13}' | sed 's/^"//;s/"$//')
    
    # Nota: La columna Author ahora se usa como descripción, por lo que no hay autores para insertar
    # Si en el futuro hubiera una columna específica para autores, habría que ajustarlo
    
    # Si el año está vacío, usar NULL
    if [ -z "$pub_year" ]; then
        pub_year="NULL"
    fi
    
    # Escapar comillas simples para SQL
    title_escaped=$(escape_sql "$title")
    description_escaped=$(escape_sql "$description")
    
    # Mapeo de CSV a SQL:
    # CSV(Title) -> SQL(title)
    # CSV(Author) -> SQL(description) [CAMBIO: ahora description viene de Author]
    # CSV(Publication Year) -> SQL(publication_year)
    # CSV(Url) -> SQL(media_path)
    # CSV(Item Type) -> SQL(content_type_id) [a través de media_types]
    
    # Procesar media_type (Item Type)
    if [ -n "$item_type" ]; then
        if [ -z "${media_types_map[$item_type]}" ]; then
            # Nuevo media type
            media_types_map[$item_type]=$media_type_id
            item_type_escaped=$(escape_sql "$item_type")
            echo "INSERT INTO media_types (id, name) VALUES ($media_type_id, '$item_type_escaped');" >> "$OUTPUT_FILE"
            ((media_type_id++))
        fi
        content_type_id=${media_types_map[$item_type]}
    else
        content_type_id="NULL"
    fi
    
    # Procesar location y filename desde URL
    if [ -n "$url" ]; then
        filename=$(extract_filename "$url")
        location=$(extract_location "$url")
        
        # Escapar para SQL
        filename_escaped=$(escape_sql "$filename")
        location_escaped=$(escape_sql "$location")
        url_escaped=$(escape_sql "$url")
        
        # Procesar media_location
        if [ -n "$location" ]; then
            if [ -z "${media_locations_map[$location]}" ]; then
                # Nueva location
                media_locations_map[$location]=$location_id
                echo "INSERT INTO media_locations (id, path) VALUES ($location_id, '$location_escaped');" >> "$OUTPUT_FILE"
                ((location_id++))
            fi
            media_location_id=${media_locations_map[$location]}
        else
            media_location_id="NULL"
            filename_escaped=""
        fi
    else
        url_escaped=""
        filename_escaped=""
        media_location_id="NULL"
    fi
    
    # Insertar media_item
    echo "INSERT INTO media_items (title, description, publication_year, media_path, filename, content_type_id, media_location_id, date_added) VALUES (" >> "$OUTPUT_FILE"
    echo "    '$title_escaped'," >> "$OUTPUT_FILE"
    echo "    '$description_escaped'," >> "$OUTPUT_FILE"  # Ahora description viene de Author
    echo "    $pub_year," >> "$OUTPUT_FILE"
    echo "    '$url_escaped'," >> "$OUTPUT_FILE"
    echo "    '$filename_escaped'," >> "$OUTPUT_FILE"
    echo "    $content_type_id," >> "$OUTPUT_FILE"
    echo "    $media_location_id," >> "$OUTPUT_FILE"
    
    # Procesar date_added si existe
    if [ -n "$date_added" ]; then
        # Convertir formato de fecha si es necesario (de YYYY-MM-DD HH:MM:SS a TIMESTAMP)
        date_added_sql=$(echo "$date_added" | sed 's/ / /')
        echo "    '$date_added_sql'" >> "$OUTPUT_FILE"
    else
        echo "    CURRENT_TIMESTAMP" >> "$OUTPUT_FILE"
    fi
    echo ");" >> "$OUTPUT_FILE"
    
    # Obtener el ID del último media_item insertado
    last_media_id=$(grep -c "INSERT INTO media_items" "$OUTPUT_FILE")
    
    # NOTA: Ya no insertamos autores porque la columna Author se usa como descripción
    # Si en el futuro hubiera una columna específica para autores, habría que añadirla aquí
    
    echo "" >> "$OUTPUT_FILE"
    
done

echo "Procesamiento completado. Archivo SQL generado: $OUTPUT_FILE"

# Mostrar estadísticas
echo ""
echo "Estadísticas:"
echo "- Media Types insertados: $((media_type_id - 1))"
echo "- Locations insertadas: $((location_id - 1))"
echo "- Descripciones extraídas de la columna Author"