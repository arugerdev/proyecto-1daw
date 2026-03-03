SET GLOBAL local_infile = 1;

DROP DATABASE IF EXISTS administradorMultimedia;
CREATE DATABASE administradorMultimedia;
USE administradorMultimedia;

CREATE TABLE users (
    id_user INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE,
    contrasena VARCHAR(255),
    rol ENUM('admin', 'moderator', 'viewer') DEFAULT 'viewer'
);

CREATE TABLE sessions (
    id_sesion INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT,
    key_session VARCHAR(512),
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user)
        REFERENCES users (id_user)
        ON DELETE CASCADE
);

CREATE TABLE content_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE
);

CREATE TABLE publishers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE
);

CREATE TABLE media_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    zotero_key VARCHAR(50) UNIQUE,
    title TEXT,
    publication_title TEXT,
    abstract_note TEXT,
    publication_year TEXT,
    date TEXT,
    date_added DATETIME,
    date_modified DATETIME,
    access_date TEXT,
    url TEXT,
    doi VARCHAR(255),
    isbn VARCHAR(50),
    issn VARCHAR(50),
    pages VARCHAR(50),
    num_pages TEXT,
    issue VARCHAR(50),
    volume VARCHAR(50),
    edition VARCHAR(50),
    running_time VARCHAR(50),
    language VARCHAR(100),
    place VARCHAR(255),
    country VARCHAR(255),
    content_type_id INT,
    publisher_id INT,
    FOREIGN KEY (content_type_id)
        REFERENCES content_types (id),
    FOREIGN KEY (publisher_id)
        REFERENCES publishers (id)
);

CREATE TABLE persons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE
);

CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE
);

CREATE TABLE media_persons (
    media_id INT,
    person_id INT,
    role_id INT,
    PRIMARY KEY (media_id , person_id , role_id),
    FOREIGN KEY (media_id)
        REFERENCES media_items (id)
        ON DELETE CASCADE,
    FOREIGN KEY (person_id)
        REFERENCES persons (id)
        ON DELETE CASCADE,
    FOREIGN KEY (role_id)
        REFERENCES roles (id)
        ON DELETE CASCADE
);

CREATE TABLE tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE
);

CREATE TABLE media_tags (
    media_id INT,
    tag_id INT,
    PRIMARY KEY (media_id , tag_id),
    FOREIGN KEY (media_id)
        REFERENCES media_items (id)
        ON DELETE CASCADE,
    FOREIGN KEY (tag_id)
        REFERENCES tags (id)
        ON DELETE CASCADE
);

CREATE TABLE attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    media_id INT,
    file_path TEXT,
    link TEXT,
    FOREIGN KEY (media_id)
        REFERENCES media_items (id)
        ON DELETE CASCADE
);

CREATE TABLE media_metadata (
    id INT AUTO_INCREMENT PRIMARY KEY,
    media_id INT,
    meta_key VARCHAR(255),
    meta_value TEXT,
    FOREIGN KEY (media_id)
        REFERENCES media_items (id)
        ON DELETE CASCADE
);

CREATE TABLE import_csv (
    `Key` TEXT,
    `Item Type` TEXT,
    `Publication Year` TEXT,
    `Author` TEXT,
    `Title` TEXT,
    `Publication Title` TEXT,
    `ISBN` TEXT,
    `ISSN` TEXT,
    `DOI` TEXT,
    `Url` TEXT,
    `Abstract Note` TEXT,
    `Date` TEXT,
    `Date Added` TEXT,
    `Date Modified` TEXT,
    `Access Date` TEXT,
    `Pages` TEXT,
    `Num Pages` TEXT,
    `Issue` TEXT,
    `Volume` TEXT,
    `Number Of Volumes` TEXT,
    `Journal Abbreviation` TEXT,
    `Short Title` TEXT,
    `Series` TEXT,
    `Series Number` TEXT,
    `Series Text` TEXT,
    `Series Title` TEXT,
    `Publisher` TEXT,
    `Place` TEXT,
    `Language` TEXT,
    `Rights` TEXT,
    `Type` TEXT,
    `Archive` TEXT,
    `Archive Location` TEXT,
    `Library Catalog` TEXT,
    `Call Number` TEXT,
    `Extra` TEXT,
    `Notes` TEXT,
    `File Attachments` TEXT,
    `Link Attachments` TEXT,
    `Manual Tags` TEXT,
    `Automatic Tags` TEXT,
    `Editor` TEXT,
    `Series Editor` TEXT,
    `Translator` TEXT,
    `Contributor` TEXT,
    `Attorney Agent` TEXT,
    `Book Author` TEXT,
    `Cast Member` TEXT,
    `Commenter` TEXT,
    `Composer` TEXT,
    `Cosponsor` TEXT,
    `Counsel` TEXT,
    `Interviewer` TEXT,
    `Producer` TEXT,
    `Recipient` TEXT,
    `Reviewed Author` TEXT,
    `Scriptwriter` TEXT,
    `Words By` TEXT,
    `Guest` TEXT,
    `Number` TEXT,
    `Edition` TEXT,
    `Running Time` TEXT,
    `Scale` TEXT,
    `Medium` TEXT,
    `Artwork Size` TEXT,
    `Filing Date` TEXT,
    `Application Number` TEXT,
    `Assignee` TEXT,
    `Issuing Authority` TEXT,
    `Country` TEXT,
    `Meeting Name` TEXT,
    `Conference Name` TEXT,
    `Court` TEXT,
    `References` TEXT,
    `Reporter` TEXT,
    `Legal Status` TEXT,
    `Priority Numbers` TEXT,
    `Programming Language` TEXT,
    `Version` TEXT,
    `System` TEXT,
    `Code` TEXT,
    `Code Number` TEXT,
    `Section` TEXT,
    `Session` TEXT,
    `Committee` TEXT,
    `History` TEXT,
    `Legislative Body` TEXT
);

LOAD DATA LOCAL INFILE './bd.csv'
INTO TABLE import_csv
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(`Key`,
    `Item Type` ,
    `Publication Year` ,
    `Author` ,
    `Title` ,
    `Publication Title` ,
    `ISBN` ,
    `ISSN` ,
    `DOI` ,
    `Url` ,
    `Abstract Note` ,
    `Date` ,
    `Date Added` ,
    `Date Modified` ,
    `Access Date` ,
    `Pages` ,
    `Num Pages` ,
    `Issue` ,
    `Volume` ,
    `Number Of Volumes` ,
    `Journal Abbreviation` ,
    `Short Title` ,
    `Series` ,
    `Series Number` ,
    `Series Text` ,
    `Series Title` ,
    `Publisher` ,
    `Place` ,
    `Language` ,
    `Rights` ,
    `Type` ,
    `Archive` ,
    `Archive Location` ,
    `Library Catalog` ,
    `Call Number` ,
    `Extra` ,
    `Notes` ,
    `File Attachments` ,
    `Link Attachments` ,
    `Manual Tags` ,
    `Automatic Tags` ,
    `Editor` ,
    `Series Editor` ,
    `Translator` ,
    `Contributor` ,
    `Attorney Agent` ,
    `Book Author` ,
    `Cast Member` ,
    `Commenter` ,
    `Composer` ,
    `Cosponsor` ,
    `Counsel` ,
    `Interviewer` ,
    `Producer` ,
    `Recipient` ,
    `Reviewed Author` ,
    `Scriptwriter` ,
    `Words By` ,
    `Guest` ,
    `Number` ,
    `Edition` ,
    `Running Time` ,
    `Scale` ,
    `Medium` ,
    `Artwork Size` ,
    `Filing Date` ,
    `Application Number` ,
    `Assignee` ,
    `Issuing Authority` ,
    `Country` ,
    `Meeting Name` ,
    `Conference Name` ,
    `Court` ,
    `References` ,
    `Reporter` ,
    `Legal Status` ,
    `Priority Numbers` ,
    `Programming Language` ,
    `Version` ,
    `System` ,
    `Code` ,
    `Code Number` ,
    `Section` ,
    `Session` ,
    `Committee` ,
    `History` ,
    `Legislative Body` );

INSERT IGNORE INTO content_types (name)
SELECT DISTINCT TRIM(Type)
FROM import_csv
WHERE Type IS NOT NULL AND Type != '';

INSERT IGNORE INTO publishers (name)
SELECT DISTINCT TRIM(Publisher)
FROM import_csv
WHERE Publisher IS NOT NULL AND Publisher != '';



INSERT INTO media_items (
    zotero_key,
    title,
    publication_title,
    abstract_note,
    publication_year,
    date,
    date_added,
    date_modified,
    access_date,
    url,
    doi,
    isbn,
    issn,
    pages,
    num_pages,
    issue,
    volume,
    edition,
    running_time,
    language,
    place,
    country,
    content_type_id,
    publisher_id
)
SELECT
    i.Key,
    i.Title,
    i.`Publication Title`,
    i.`Abstract Note`,
    i.`Publication Year`,
    i.Date,
    i.`Date Added`,
    i.`Date Modified`,
    i.`Access Date`,
    i.Url,
    i.DOI,
    i.ISBN,
    i.ISSN,
    i.Pages,
    i.`Num Pages`,
    i.Issue,
    i.Volume,
    i.Edition,
    i.`Running Time`,
    i.Language,
    i.Place,
    i.Country,
    ct.id,
    p.id
FROM import_csv i
LEFT JOIN content_types ct ON ct.name = i.Type
LEFT JOIN publishers p ON p.name = i.Publisher;

INSERT IGNORE INTO roles (name) VALUES
('Author'),
('Editor'),
('Translator'),
('Producer'),
('Scriptwriter'),
('Contributor'),
('Guest'),
('Director'),
('Composer');

CREATE TEMPORARY TABLE numbers (n INT);
INSERT INTO numbers VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10);

INSERT IGNORE INTO persons (name)
SELECT DISTINCT TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(i.Author, ';', n.n), ';', -1))
FROM import_csv i
JOIN numbers n
  ON CHAR_LENGTH(i.Author) - CHAR_LENGTH(REPLACE(i.Author, ';', '')) >= n.n - 1
WHERE i.Author IS NOT NULL AND i.Author != '';

INSERT IGNORE INTO media_persons (media_id, person_id, role_id)
SELECT 
    m.id,
    p.id,
    r.id
FROM import_csv i
JOIN media_items m ON m.zotero_key = i.Key
JOIN numbers n
  ON CHAR_LENGTH(i.Author) - CHAR_LENGTH(REPLACE(i.Author, ';', '')) >= n.n - 1
JOIN persons p
  ON p.name = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(i.Author, ';', n.n), ';', -1))
JOIN roles r ON r.name = 'Author'
WHERE i.Author IS NOT NULL AND i.Author != '';

INSERT IGNORE INTO tags (name)
SELECT DISTINCT TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(i.Tags, ';', n.n), ';', -1))
FROM import_csv i
JOIN numbers n
  ON CHAR_LENGTH(i.Tags) - CHAR_LENGTH(REPLACE(i.Tags, ';', '')) >= n.n - 1
WHERE i.Tags IS NOT NULL AND i.Tags != '';

INSERT IGNORE INTO media_tags (media_id, tag_id)
SELECT
    m.id,
    t.id
FROM import_csv i
JOIN media_items m ON m.zotero_key = i.Key
JOIN numbers n
  ON CHAR_LENGTH(i.Tags) - CHAR_LENGTH(REPLACE(i.Tags, ';', '')) >= n.n - 1
JOIN tags t
  ON t.name = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(i.Tags, ';', n.n), ';', -1))
WHERE i.Tags IS NOT NULL AND i.Tags != '';

INSERT INTO media_metadata (media_id, meta_key, meta_value)
SELECT m.id, 'Archive', i.Archive
FROM import_csv i
JOIN media_items m ON m.zotero_key = i.Key
WHERE i.Archive IS NOT NULL AND i.Archive != '';

INSERT INTO media_metadata (media_id, meta_key, meta_value)
SELECT m.id, 'Call Number', i.Call_Number
FROM import_csv i
JOIN media_items m ON m.zotero_key = i.Key
WHERE i.Call_Number IS NOT NULL AND i.Call_Number != '';

DROP TEMPORARY TABLE numbers;