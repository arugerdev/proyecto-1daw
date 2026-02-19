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

CREATE TABLE content_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE
);

CREATE TABLE programs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE
);

CREATE TABLE staff (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    role VARCHAR(100)
);

CREATE TABLE media_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    recording_year INT,
    duration VARCHAR(50),
    file_path TEXT,
    content_type_id INT,
    program_id INT,
    FOREIGN KEY (content_type_id) REFERENCES content_types(id),
    FOREIGN KEY (program_id) REFERENCES programs(id)
);

CREATE TABLE media_staff (
    media_id INT,
    staff_id INT,
    PRIMARY KEY (media_id, staff_id),
    FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE TABLE import_csv (
    `Item Type` TEXT,
    `Title` TEXT,
    `Author` TEXT,
    `Date` TEXT,
    `Publication Year` TEXT,
    `Running Time` TEXT,
    `Publisher` TEXT,
    `Place` TEXT,
    `Url` TEXT,
    `Abstract Note` TEXT
);
/*
LOAD DATA LOCAL INFILE 'C:\Users\usuario\Desktop\Proyecto 1 DAW\proyecto-1daw\db\bdEcijaComarca.csv'
INTO TABLE import_csv
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(`Item Type`,`Title`,`Author`,`Date`,`Publication Year`,
 `Running Time`,`Publisher`,`Place`,`Url`,`Abstract Note`);

INSERT IGNORE INTO content_types (name)
SELECT DISTINCT `Item Type`
FROM import_csv
WHERE `Item Type` IS NOT NULL;

INSERT IGNORE INTO programs (name)
SELECT DISTINCT `Publisher`
FROM import_csv
WHERE `Publisher` IS NOT NULL;

INSERT IGNORE INTO staff (name, role)
SELECT DISTINCT `Author`, 'Autor'
FROM import_csv
WHERE `Author` IS NOT NULL;

INSERT INTO media_items (
    title,
    description,
    recording_year,
    duration,
    file_path,
    content_type_id,
    program_id
)
SELECT
    c.`Title`,
    c.`Abstract Note`,
    CASE
        WHEN c.`Publication Year` REGEXP '^[0-9]{4}$'
        THEN CAST(c.`Publication Year` AS UNSIGNED)
        ELSE NULL
    END,
    c.`Running Time`,
    c.`Url`,
    t.id,
    p.id
FROM import_csv c
LEFT JOIN content_types t ON t.name = c.`Item Type`
LEFT JOIN programs p ON p.name = c.`Publisher`;

INSERT IGNORE INTO media_staff (media_id, staff_id)
SELECT m.id, s.id 
FROM import_csv c 
JOIN media_items m ON m.title = c.Title 
JOIN staff s ON s.name = c.Author;
*/

INSERT INTO content_types (name) VALUES 
('Cortometraje'), ('Videoclip'), ('Streaming'), ('Telediario'), ('Publicidad'), ('Webinar');

INSERT INTO programs (name) VALUES 
('Cine de Barrio'), ('Deportes 360'), ('Naturaleza Viva'), ('TecnoMundo'), ('Cocina con Firma'), ('Debates Actuales');

INSERT INTO staff (name, role) VALUES 
('Laura Gil', 'Editora'), ('Roberto Soler', 'Cámara'), ('Marta Rivas', 'Presentadora'), 
('Juan Pardo', 'Director'), ('Lucía Sanz', 'Guionista'), ('Pedro Valls', 'Sonidista'),
('Elena Toro', 'Productora'), ('Diego Mas', 'Iluminador'), ('Sara Peñas', 'Actor'), ('Marc Font', 'Voz en Off');

INSERT INTO media_items (title, description, recording_year, duration, file_path, content_type_id, program_id) VALUES 
('Gran Final Tenis', 'Partido completo de la final.', 2023, '03:15:00', '/vod/deportes/tenis_final.mp4', 3, 2),
('Receta Gazpacho', 'Tutorial paso a paso.', 2024, '00:12:45', '/vod/cocina/gazpacho.mp4', 1, 5),
('Entrevista IA', 'Charla sobre el futuro de GPT.', 2024, '00:45:10', '/vod/tecno/ia_future.mp4', 2, 4),
('Bosques de España', 'Recorrido por los Pirineos.', 2021, '01:10:00', '/vod/nat/bosques.mp4', 3, 3),
('Debate Electoral', 'Edición especial elecciones.', 2023, '02:00:00', '/vod/news/debate_23.mp4', 4, 6),
('Anuncio Verano', 'Spot publicitario refresco.', 2022, '00:00:30', '/vod/ads/verano_01.mp4', 5, 1),
('Sinfonía No 5', 'Concierto filarmónica.', 2019, '01:05:00', '/vod/music/beethoven.mp4', 2, 1),
('Robotica en Casa', 'Nuevos gadgets 2024.', 2024, '00:25:00', '/vod/tecno/robots.mp4', 3, 4),
('Pesca en el Norte', 'Documental artesanal.', 2020, '00:40:00', '/vod/nat/pesca.mp4', 3, 3),
('Clase de Yoga', 'Sesión matutina.', 2023, '00:55:00', '/vod/health/yoga_01.mp4', 6, 5),
('Item 11', 'Desc 11', 2021, '00:30:00', '/path/11.mp4', 1, 1), ('Item 12', 'Desc 12', 2022, '00:30:00', '/path/12.mp4', 2, 2),
('Item 13', 'Desc 13', 2023, '00:30:00', '/path/13.mp4', 3, 3), ('Item 14', 'Desc 14', 2024, '00:30:00', '/path/14.mp4', 4, 4),
('Item 15', 'Desc 15', 2021, '00:30:00', '/path/15.mp4', 5, 5), ('Item 16', 'Desc 16', 2022, '00:30:00', '/path/16.mp4', 6, 6),
('Item 17', 'Desc 17', 2023, '00:30:00', '/path/17.mp4', 1, 2), ('Item 18', 'Desc 18', 2024, '00:30:00', '/path/18.mp4', 2, 3),
('Item 19', 'Desc 19', 2021, '00:30:00', '/path/19.mp4', 3, 4), ('Item 20', 'Desc 20', 2022, '00:30:00', '/path/20.mp4', 4, 5),
('Item 21', 'Desc 21', 2023, '00:30:00', '/path/21.mp4', 5, 6), ('Item 22', 'Desc 22', 2024, '00:30:00', '/path/22.mp4', 6, 1),
('Item 23', 'Desc 23', 2021, '00:30:00', '/path/23.mp4', 1, 3), ('Item 24', 'Desc 24', 2022, '00:30:00', '/path/24.mp4', 2, 4),
('Item 25', 'Desc 25', 2023, '00:30:00', '/path/25.mp4', 3, 5), ('Item 26', 'Desc 26', 2024, '00:30:00', '/path/26.mp4', 4, 6),
('Item 27', 'Desc 27', 2021, '00:30:00', '/path/27.mp4', 5, 1), ('Item 28', 'Desc 28', 2022, '00:30:00', '/path/28.mp4', 6, 2),
('Item 29', 'Desc 29', 2023, '00:30:00', '/path/29.mp4', 1, 4), ('Item 30', 'Desc 30', 2024, '00:30:00', '/path/30.mp4', 2, 5),
('Item 31', 'Desc 31', 2021, '00:30:00', '/path/31.mp4', 3, 6), ('Item 32', 'Desc 32', 2022, '00:30:00', '/path/32.mp4', 4, 1),
('Item 33', 'Desc 33', 2023, '00:30:00', '/path/33.mp4', 5, 2), ('Item 34', 'Desc 34', 2024, '00:30:00', '/path/34.mp4', 6, 3),
('Item 35', 'Desc 35', 2021, '00:30:00', '/path/35.mp4', 1, 5), ('Item 36', 'Desc 36', 2022, '00:30:00', '/path/36.mp4', 2, 6),
('Item 37', 'Desc 37', 2023, '00:30:00', '/path/37.mp4', 3, 1), ('Item 38', 'Desc 38', 2024, '00:30:00', '/path/38.mp4', 4, 2),
('Item 39', 'Desc 39', 2021, '00:30:00', '/path/39.mp4', 5, 3), ('Item 40', 'Desc 40', 2022, '00:30:00', '/path/40.mp4', 6, 4);

INSERT INTO media_staff (media_id, staff_id) VALUES 
(1,1),(1,2),(1,7), -- Item 1 con Editora, Cámara y Productora
(2,4),(2,1),(2,6), -- Item 2 con Director, Editora y Sonidista
(3,3),(3,5),(3,10),-- Item 3 con Presentadora, Guionista y Voz en Off
(4,2),(4,4),(4,8), -- Item 4 con Cámara, Director e Iluminador
(5,3),(5,1),(5,7), -- Item 5 con Presentadora, Editora y Productora
(6,9),(6,1),(6,8), -- Item 6 con Actor, Editora e Iluminador
(7,10),(7,6),(7,4),-- Item 7 con Voz en Off, Sonidista y Director
(8,2),(8,3),(8,1), -- Item 8 con Cámara, Presentadora y Editora
(9,2),(9,4),(9,7), -- Item 9...
(10,5),(10,1),(10,3),
(11,1),(11,2), (12,3),(12,4), (13,5),(13,6), (14,7),(14,8), (15,9),(15,10),
(16,1),(16,3), (17,2),(17,4), (18,5),(18,7), (19,6),(19,8), (20,9),(20,1),
(21,2),(21,3), (22,4),(22,5), (23,6),(23,7), (24,8),(24,9), (25,10),(25,1),
(26,2),(26,4), (27,3),(27,5), (28,6),(28,8), (29,7),(29,9), (30,10),(30,2),
(31,1),(31,5), (32,2),(32,6), (33,3),(33,7), (34,4),(34,8), (35,5),(35,9);


-- #################### DEFAULT USERS ####################
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