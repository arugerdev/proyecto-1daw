-- DROP DATABASE administradorMultimedia;
CREATE DATABASE administradorMultimedia;

USE administradorMultimedia;

CREATE TABLE
    USUARIOS (
        id_user INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(50) UNIQUE,
        contraseña VARCHAR(255) UNIQUE,
        CHECK (CHAR_LENGTH(contraseña) >= 4)
    );

CREATE TABLE
    SESIONES (
        id_sesion INT AUTO_INCREMENT PRIMARY KEY,
        id_user INT,
        key_session VARCHAR(512),
        FOREIGN KEY (id_user) REFERENCES USUARIOS (id_user)
    );