DROP DATABASE IF EXISTS administradorMultimedia;
CREATE DATABASE administradorMultimedia;
USE administradorMultimedia;

CREATE TABLE USUARIOS (
    id_user INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE,
    contraseña VARCHAR(255),
    CHECK (CHAR_LENGTH(contraseña) >= 4),
    rol VARCHAR(30) DEFAULT "viewer",
    CHECK (rol IN ("admin", "moderator", "viewer"))
);

CREATE TABLE SESIONES (
    id_sesion INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT,
    key_session VARCHAR(512),
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user) REFERENCES USUARIOS(id_user) ON DELETE CASCADE
);

INSERT INTO USUARIOS (nombre, contraseña, rol) 
VALUES (
    "admin", 
    "$2b$12$vbj7TFESQuAcFTBXgacpuu7GGewrfmuOVN8vxQxE2DIaoqSHFi69e", 
    "admin"
);
INSERT INTO USUARIOS (nombre, contraseña, rol) 
VALUES (
    "viewer", 
    "$2a$12$RCCN9wh0S27yBoUkYaUb4us6m9J8IO6UC/rtpeKLlxXPJ/luoJZE6", 
    "viewer"
);
CREATE TABLE ITEMS (
    id_item INT AUTO_INCREMENT PRIMARY KEY,
    zotero_key VARCHAR(20) UNIQUE,
    item_type VARCHAR(100),
    title TEXT,
    publication_year INT,
    publication_title TEXT,
    isbn VARCHAR(50),
    issn VARCHAR(50),
    doi VARCHAR(255),
    url TEXT,
    abstract_note TEXT,
    publisher VARCHAR(255),
    place VARCHAR(255),
    language VARCHAR(100),
    date_added DATETIME,
    date_modified DATETIME
);

CREATE TABLE AUTORES (
    id_autor INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) UNIQUE
);

CREATE TABLE ITEM_AUTORES (
    id_item INT,
    id_autor INT,
    PRIMARY KEY (id_item, id_autor),
    FOREIGN KEY (id_item) REFERENCES ITEMS(id_item) ON DELETE CASCADE,
    FOREIGN KEY (id_autor) REFERENCES AUTORES(id_autor) ON DELETE CASCADE
);

CREATE TABLE ARCHIVOS (
    id_archivo INT AUTO_INCREMENT PRIMARY KEY,
    id_item INT,
    nombre_archivo VARCHAR(255),
    tipo_archivo ENUM("video","imagen","documento","audio","otro"),
    extension VARCHAR(20),
    tamaño BIGINT,
    ruta_fisica TEXT, -- Ruta real en disco
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_item) REFERENCES ITEMS(id_item) ON DELETE CASCADE
);

CREATE TABLE TAGS (
    id_tag INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE
);

CREATE TABLE ITEM_TAGS (
    id_item INT,
    id_tag INT,
    PRIMARY KEY (id_item, id_tag),
    FOREIGN KEY (id_item) REFERENCES ITEMS(id_item) ON DELETE CASCADE,
    FOREIGN KEY (id_tag) REFERENCES TAGS(id_tag) ON DELETE CASCADE
);

CREATE TABLE NOTAS (
    id_nota INT AUTO_INCREMENT PRIMARY KEY,
    id_item INT,
    contenido TEXT,
    FOREIGN KEY (id_item) REFERENCES ITEMS(id_item) ON DELETE CASCADE
);
