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
    name TEXT,
    role VARCHAR(100)
);

CREATE TABLE media_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name TEXT UNIQUE
);

CREATE TABLE media_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    path TEXT
);

CREATE TABLE media_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title TEXT,
    description TEXT,
    publication_year INT /* -> 2023 */,
    media_path TEXT, /* -> /disk0/2023/grabacion.mp4 */
    filename TEXT, /* -> grabacion.mp4 */
    media_type_id INT, /* -> id:1 -> Cortometraje */
    media_location_id INT, /* -> id:3 -> /disk0/2023/ */
    tags TEXT, /* -> "tag1,tag2,tag3" */
    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (media_location_id) REFERENCES media_locations(id),
    FOREIGN KEY (media_type_id) REFERENCES media_types(id)
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