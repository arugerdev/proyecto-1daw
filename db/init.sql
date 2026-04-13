DROP DATABASE IF EXISTS administradorMultimedia;
CREATE DATABASE administradorMultimedia;
USE administradorMultimedia;

CREATE TABLE IF NOT EXISTS users (
    id_user INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE,
    contrasena VARCHAR(255),
    CHECK (CHAR_LENGTH(contrasena) >= 4),
    rol VARCHAR(30) DEFAULT "viewer",
    CHECK (rol IN ("admin", "moderator", "viewer"))
);

CREATE TABLE IF NOT EXISTS sessions (
    id_sesion INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT,
    key_session VARCHAR(512),
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user) REFERENCES users(id_user) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(512) UNIQUE
);

CREATE TABLE IF NOT EXISTS media_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    path TEXT
);

CREATE TABLE IF NOT EXISTS media_items (
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
    FOREIGN KEY (media_location_id) REFERENCES media_locations(id) ON DELETE CASCADE,
    FOREIGN KEY (media_type_id) REFERENCES media_types(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS media_author (
    media_id INT,
    user_id INT,
    PRIMARY KEY (media_id, user_id),
    FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id_user) ON DELETE CASCADE
);

-- #################### DEFAULT USERS ####################
INSERT INTO users (id_user, nombre, contrasena, rol) 
VALUES (
    1,
    "owner", 
    "$2a$12$fuMNGmEML8OKjv4/S2Fg9O9WwztFRFrQoZncVjFtb7LgE.XK031Cu", 
    "admin"
);
INSERT INTO users (id_user, nombre, contrasena, rol) 
VALUES (
    2,
    "admin", 
    "$2b$12$vbj7TFESQuAcFTBXgacpuu7GGewrfmuOVN8vxQxE2DIaoqSHFi69e", 
    "admin"
);
/*
INSERT INTO users (nombre, contrasena, rol) 
VALUES (
    "viewer", 
    "$2a$12$RCCN9wh0S27yBoUkYaUb4us6m9J8IO6UC/rtpeKLlxXPJ/luoJZE6", 
    "viewer"
);*/