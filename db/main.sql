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
    size BIGINT,
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


-- =====================================================
-- DATOS DE PRUEBA PARA ARCHIVOS
-- =====================================================

-- Primero, necesitamos algunos items para asociar los archivos
INSERT INTO ITEMS (zotero_key, item_type, title, publication_year, date_added, date_modified) VALUES
('ABC123', 'video', 'Tutorial de Angular - Introducción', 2024, NOW(), NOW()),
('DEF456', 'video', 'Documental: Historia de la Música', 2023, DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 15 DAY)),
('GHI789', 'imagen', 'Fotografía de Paisajes Naturales', 2024, DATE_SUB(NOW(), INTERVAL 45 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY)),
('JKL012', 'imagen', 'Galería de Arte Moderno', 2023, DATE_SUB(NOW(), INTERVAL 60 DAY), DATE_SUB(NOW(), INTERVAL 25 DAY)),
('MNO345', 'documento', 'Manual de Usuario - Sistema Multimedia', 2024, NOW(), NOW()),
('PQR678', 'documento', 'Tesis Doctoral - Inteligencia Artificial', 2023, DATE_SUB(NOW(), INTERVAL 90 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY)),
('STU901', 'audio', 'Podcast: Tecnología y Futuro', 2024, DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
('VWX234', 'audio', 'Álbum Musical - Rock Alternativo', 2023, DATE_SUB(NOW(), INTERVAL 120 DAY), DATE_SUB(NOW(), INTERVAL 45 DAY)),
('YZA567', 'video', 'Curso de Fotografía Profesional', 2024, DATE_SUB(NOW(), INTERVAL 10 DAY), NOW()),
('BCD890', 'imagen', 'Infografía Cambio Climático', 2023, DATE_SUB(NOW(), INTERVAL 200 DAY), DATE_SUB(NOW(), INTERVAL 150 DAY));

-- =====================================================
-- ARCHIVOS DE PRUEBA
-- =====================================================

-- VIDEOS (10 archivos)
INSERT INTO ARCHIVOS (id_item, nombre_archivo, tipo_archivo, extension, size, ruta_fisica, fecha_subida) VALUES
(1, 'tutorial_angular_parte1.mp4', 'video', '.mp4', 157286400, '/media/videos/tutorial_angular_parte1.mp4', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(1, 'tutorial_angular_parte2.mp4', 'video', '.mp4', 209715200, '/media/videos/tutorial_angular_parte2.mp4', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(2, 'documental_musica_completo.mp4', 'video', '.mp4', 524288000, '/media/videos/documental_musica_completo.mp4', DATE_SUB(NOW(), INTERVAL 30 DAY)),
(2, 'documental_musica_extras.mp4', 'video', '.mp4', 104857600, '/media/videos/documental_musica_extras.mp4', DATE_SUB(NOW(), INTERVAL 29 DAY)),
(9, 'curso_fotografia_modulo1.mp4', 'video', '.mp4', 314572800, '/media/videos/curso_fotografia_modulo1.mp4', DATE_SUB(NOW(), INTERVAL 10 DAY)),
(9, 'curso_fotografia_modulo2.mp4', 'video', '.mp4', 367001600, '/media/videos/curso_fotografia_modulo2.mp4', DATE_SUB(NOW(), INTERVAL 9 DAY)),
(9, 'curso_fotografia_modulo3.mp4', 'video', '.mp4', 283115520, '/media/videos/curso_fotografia_modulo3.mp4', DATE_SUB(NOW(), INTERVAL 8 DAY)),
(NULL, 'video_promocional_empresa.mp4', 'video', '.mp4', 52428800, '/media/videos/video_promocional_empresa.mp4', DATE_SUB(NOW(), INTERVAL 60 DAY)),
(NULL, 'entrevista_experto_ia.mp4', 'video', '.mp4', 188743680, '/media/videos/entrevista_experto_ia.mp4', DATE_SUB(NOW(), INTERVAL 45 DAY)),
(NULL, 'webinar_marketing_digital.mp4', 'video', '.mp4', 251658240, '/media/videos/webinar_marketing_digital.mp4', DATE_SUB(NOW(), INTERVAL 20 DAY));

-- IMÁGENES (10 archivos)
INSERT INTO ARCHIVOS (id_item, nombre_archivo, tipo_archivo, extension, size, ruta_fisica, fecha_subida) VALUES
(3, 'paisaje_montaña_atardecer.jpg', 'imagen', '.jpg', 5242880, '/media/imagenes/paisaje_montaña_atardecer.jpg', DATE_SUB(NOW(), INTERVAL 45 DAY)),
(3, 'playa_tropical_4k.png', 'imagen', '.png', 8388608, '/media/imagenes/playa_tropical_4k.png', DATE_SUB(NOW(), INTERVAL 44 DAY)),
(4, 'obra_arte_contemporaneo.jpg', 'imagen', '.jpg', 3145728, '/media/imagenes/obra_arte_contemporaneo.jpg', DATE_SUB(NOW(), INTERVAL 60 DAY)),
(4, 'escultura_moderna.png', 'imagen', '.png', 4194304, '/media/imagenes/escultura_moderna.png', DATE_SUB(NOW(), INTERVAL 59 DAY)),
(10, 'infografia_calentamiento_global.jpg', 'imagen', '.jpg', 2097152, '/media/imagenes/infografia_calentamiento_global.jpg', DATE_SUB(NOW(), INTERVAL 200 DAY)),
(10, 'grafico_emisiones_co2.png', 'imagen', '.png', 1572864, '/media/imagenes/grafico_emisiones_co2.png', DATE_SUB(NOW(), INTERVAL 199 DAY)),
(NULL, 'logo_empresa_vector.svg', 'imagen', '.svg', 524288, '/media/imagenes/logo_empresa_vector.svg', DATE_SUB(NOW(), INTERVAL 90 DAY)),
(NULL, 'foto_perfil_usuario.jpg', 'imagen', '.jpg', 1048576, '/media/imagenes/foto_perfil_usuario.jpg', DATE_SUB(NOW(), INTERVAL 120 DAY)),
(NULL, 'captura_pantalla_app.png', 'imagen', '.png', 7340032, '/media/imagenes/captura_pantalla_app.png', DATE_SUB(NOW(), INTERVAL 15 DAY)),
(NULL, 'diagrama_flujo_sistema.jpg', 'imagen', '.jpg', 2621440, '/media/imagenes/diagrama_flujo_sistema.jpg', DATE_SUB(NOW(), INTERVAL 75 DAY));

-- DOCUMENTOS (10 archivos)
INSERT INTO ARCHIVOS (id_item, nombre_archivo, tipo_archivo, extension, size, ruta_fisica, fecha_subida) VALUES
(5, 'manual_usuario_v1.0.pdf', 'documento', '.pdf', 5242880, '/media/documentos/manual_usuario_v1.0.pdf', NOW()),
(5, 'guia_instalacion_rapida.pdf', 'documento', '.pdf', 1048576, '/media/documentos/guia_instalacion_rapida.pdf', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(6, 'tesis_ia_completa.pdf', 'documento', '.pdf', 15728640, '/media/documentos/tesis_ia_completa.pdf', DATE_SUB(NOW(), INTERVAL 90 DAY)),
(6, 'anexos_tesis_ia.zip', 'documento', '.zip', 31457280, '/media/documentos/anexos_tesis_ia.zip', DATE_SUB(NOW(), INTERVAL 89 DAY)),
(NULL, 'informe_anual_2023.xlsx', 'documento', '.xlsx', 2097152, '/media/documentos/informe_anual_2023.xlsx', DATE_SUB(NOW(), INTERVAL 150 DAY)),
(NULL, 'presentacion_resultados.pptx', 'documento', '.pptx', 10485760, '/media/documentos/presentacion_resultados.pptx', DATE_SUB(NOW(), INTERVAL 130 DAY)),
(NULL, 'contrato_servicios.docx', 'documento', '.docx', 524288, '/media/documentos/contrato_servicios.docx', DATE_SUB(NOW(), INTERVAL 180 DAY)),
(NULL, 'base_datos_clientes.csv', 'documento', '.csv', 8388608, '/media/documentos/base_datos_clientes.csv', DATE_SUB(NOW(), INTERVAL 110 DAY)),
(NULL, 'manual_estilo_corporativo.pdf', 'documento', '.pdf', 3145728, '/media/documentos/manual_estilo_corporativo.pdf', DATE_SUB(NOW(), INTERVAL 200 DAY)),
(NULL, 'plan_negocio_2024.docx', 'documento', '.docx', 1572864, '/media/documentos/plan_negocio_2024.docx', DATE_SUB(NOW(), INTERVAL 20 DAY));

-- AUDIO (10 archivos)
INSERT INTO ARCHIVOS (id_item, nombre_archivo, tipo_archivo, extension, size, ruta_fisica, fecha_subida) VALUES
(7, 'podcast_tecnologia_episodio1.mp3', 'audio', '.mp3', 31457280, '/media/audio/podcast_tecnologia_episodio1.mp3', DATE_SUB(NOW(), INTERVAL 15 DAY)),
(7, 'podcast_tecnologia_episodio2.mp3', 'audio', '.mp3', 29360128, '/media/audio/podcast_tecnologia_episodio2.mp3', DATE_SUB(NOW(), INTERVAL 14 DAY)),
(7, 'podcast_tecnologia_episodio3.mp3', 'audio', '.mp3', 32505856, '/media/audio/podcast_tecnologia_episodio3.mp3', DATE_SUB(NOW(), INTERVAL 13 DAY)),
(8, 'album_rock_cancion1.mp3', 'audio', '.mp3', 8388608, '/media/audio/album_rock_cancion1.mp3', DATE_SUB(NOW(), INTERVAL 120 DAY)),
(8, 'album_rock_cancion2.mp3', 'audio', '.mp3', 7864320, '/media/audio/album_rock_cancion2.mp3', DATE_SUB(NOW(), INTERVAL 120 DAY)),
(8, 'album_rock_cancion3.mp3', 'audio', '.mp3', 7340032, '/media/audio/album_rock_cancion3.mp3', DATE_SUB(NOW(), INTERVAL 119 DAY)),
(8, 'album_rock_cancion4.mp3', 'audio', '.mp3', 8912896, '/media/audio/album_rock_cancion4.mp3', DATE_SUB(NOW(), INTERVAL 119 DAY)),
(NULL, 'entrevista_radio.mp3', 'audio', '.mp3', 41943040, '/media/audio/entrevista_radio.mp3', DATE_SUB(NOW(), INTERVAL 60 DAY)),
(NULL, 'efectos_sonido_biblioteca.zip', 'audio', '.zip', 52428800, '/media/audio/efectos_sonido_biblioteca.zip', DATE_SUB(NOW(), INTERVAL 80 DAY)),
(NULL, 'grabacion_reunion_equipo.wav', 'audio', '.wav', 73400320, '/media/audio/grabacion_reunion_equipo.wav', DATE_SUB(NOW(), INTERVAL 10 DAY));

-- OTROS (5 archivos para completar)
INSERT INTO ARCHIVOS (id_item, nombre_archivo, tipo_archivo, extension, size, ruta_fisica, fecha_subida) VALUES
(NULL, 'archivo_comprimido_datos.rar', 'otro', '.rar', 15728640, '/media/otros/archivo_comprimido_datos.rar', DATE_SUB(NOW(), INTERVAL 70 DAY)),
(NULL, 'ejecutable_instalador.exe', 'otro', '.exe', 31457280, '/media/otros/ejecutable_instalador.exe', DATE_SUB(NOW(), INTERVAL 85 DAY)),
(NULL, 'fuente_typografia.ttf', 'otro', '.ttf', 524288, '/media/otros/fuente_typografia.ttf', DATE_SUB(NOW(), INTERVAL 95 DAY)),
(NULL, 'modelo_3d_edificio.obj', 'otro', '.obj', 20971520, '/media/otros/modelo_3d_edificio.obj', DATE_SUB(NOW(), INTERVAL 40 DAY)),
(NULL, 'archivo_configuracion.config', 'otro', '.config', 262144, '/media/otros/archivo_configuracion.config', DATE_SUB(NOW(), INTERVAL 150 DAY));

-- =====================================================
-- DATOS ADICIONALES PARA PROBAR RELACIONES
-- =====================================================

-- Añadir algunos autores
INSERT INTO AUTORES (nombre) VALUES
('Juan Pérez García'),
('María López Martínez'),
('Carlos Rodríguez Sánchez'),
('Ana García Fernández'),
('Luis Martínez González');

-- Relacionar autores con items
INSERT INTO ITEM_AUTORES (id_item, id_autor) VALUES
(1, 1), (1, 2),  -- Tutorial Angular por Juan y María
(2, 3),          -- Documental Música por Carlos
(5, 4),          -- Manual Usuario por Ana
(6, 5);          -- Tesis IA por Luis

-- Añadir tags
INSERT INTO TAGS (nombre) VALUES
('angular'),
('programación'),
('música'),
('documental'),
('fotografía'),
('naturaleza'),
('inteligencia artificial'),
('podcast'),
('rock'),
('tutorial'),
('educativo'),
('ofimática'),
('diseño');

-- Relacionar items con tags
INSERT INTO ITEM_TAGS (id_item, id_tag) VALUES
(1, 1), (1, 2), (1, 10), (1, 11),    -- Tutorial Angular: angular, programación, tutorial, educativo
(2, 3), (2, 4), (2, 11),              -- Documental Música: música, documental, educativo
(3, 5), (3, 6), (3, 13),              -- Paisajes: fotografía, naturaleza, diseño
(4, 5), (4, 13),                       -- Arte Moderno: fotografía, diseño
(5, 12),                               -- Manual: ofimática
(6, 7), (6, 11),                       -- Tesis IA: inteligencia artificial, educativo
(7, 8), (7, 2),                        -- Podcast: podcast, música
(8, 9), (8, 3),                        -- Álbum Rock: rock, música
(9, 5), (9, 10), (9, 11);              -- Curso Fotografía: fotografía, tutorial, educativo

-- Añadir algunas notas
INSERT INTO NOTAS (id_item, contenido) VALUES
(1, 'Este tutorial necesita revisión en la parte de componentes.'),
(1, 'Añadir ejemplos de servicios en el próximo video.'),
(2, 'Documental aprobado para distribución internacional.'),
(3, 'Fotografía seleccionada para portada del calendario 2024.'),
(5, 'Revisar sección de configuración avanzada.'),
(6, 'Tesis premiada con mención honorífica.'),
(9, 'Curso muy bien valorado por los estudiantes.');

-- =====================================================
-- CONSULTAS DE VERIFICACIÓN
-- =====================================================

-- Verificar total de archivos por tipo
-- SELECT 
--     tipo_archivo,
--     COUNT(*) as cantidad,
--     SUM(size) as tamaño_total_bytes,
--     CONCAT(ROUND(SUM(size)/1024/1024, 2), ' MB') as tamaño_total
-- FROM ARCHIVOS
-- GROUP BY tipo_archivo
-- ORDER BY cantidad DESC;

-- -- Verificar distribución por fecha
-- SELECT 
--     DATE_FORMAT(fecha_subida, '%Y-%m') as mes,
--     COUNT(*) as archivos_subidos
-- FROM ARCHIVOS
-- GROUP BY mes
-- ORDER BY mes DESC;

-- -- Verificar archivos sin item asociado
-- SELECT COUNT(*) as archivos_huérfanos
-- FROM ARCHIVOS
-- WHERE id_item IS NULL;

-- -- Verificar items con múltiples archivos
-- SELECT 
--     i.title,
--     COUNT(a.id_archivo) as num_archivos
-- FROM ITEMS i
-- LEFT JOIN ARCHIVOS a ON i.id_item = a.id_item
-- GROUP BY i.id_item, i.title
-- HAVING num_archivos > 0
-- ORDER BY num_archivos DESC;