-- EcijaComarca Media Manager v2 — Database Schema
-- Drops and recreates the database

DROP DATABASE IF EXISTS ecijacomarca;
CREATE DATABASE ecijacomarca CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ecijacomarca;

-- ── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(50) UNIQUE NOT NULL,
    email       VARCHAR(100),
    password    VARCHAR(255) NOT NULL,
    role        ENUM('owner', 'admin', 'moderator', 'viewer') DEFAULT 'viewer',
    is_hidden   BOOLEAN DEFAULT FALSE,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Sessions ─────────────────────────────────────────────────────────────────
CREATE TABLE sessions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    token       VARCHAR(512) NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token(64)),
    INDEX idx_user (user_id)
);

-- ── Categories ───────────────────────────────────────────────────────────────
CREATE TABLE categories (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    color       VARCHAR(7)  DEFAULT '#6366f1',
    icon        VARCHAR(50) DEFAULT 'folder',
    parent_id   INT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ── Tags ─────────────────────────────────────────────────────────────────────
CREATE TABLE tags (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(50) UNIQUE NOT NULL,
    color       VARCHAR(7) DEFAULT '#6366f1',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Storage Locations ─────────────────────────────────────────────────────────
-- Supports local paths, UNC (\\server\share), SMB, FTP, HTTP/HTTPS URLs
CREATE TABLE storage_locations (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    base_path    TEXT NOT NULL,
    storage_type ENUM('local', 'url', 'smb', 'ftp', 'nfs') DEFAULT 'local',
    description  TEXT,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Media Items ───────────────────────────────────────────────────────────────
CREATE TABLE media_items (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    title                TEXT NOT NULL,
    description          TEXT,
    -- Storage
    file_path            TEXT NOT NULL,
    filename             TEXT NOT NULL,
    storage_location_id  INT,
    -- File metadata
    mime_type            VARCHAR(100),
    file_size            BIGINT DEFAULT 0,
    file_extension       VARCHAR(20),
    media_kind           ENUM('video','audio','image','document','text','other') DEFAULT 'other',
    -- Media properties
    duration             INT,        -- seconds for video/audio
    width                INT,        -- pixels for video/image
    height               INT,        -- pixels for video/image
    thumbnail_path       TEXT,
    -- Content metadata
    publication_year     INT,
    category_id          INT,
    -- Tracking
    created_by           INT,
    view_count           INT DEFAULT 0,
    download_count       INT DEFAULT 0,
    is_public            BOOLEAN DEFAULT TRUE,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (storage_location_id) REFERENCES storage_locations(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id)         REFERENCES categories(id)         ON DELETE SET NULL,
    FOREIGN KEY (created_by)          REFERENCES users(id)              ON DELETE SET NULL,
    FULLTEXT INDEX ft_search (title(500), description(500)),
    INDEX idx_kind    (media_kind),
    INDEX idx_year    (publication_year),
    INDEX idx_created (created_at)
);

-- ── Media Tags ────────────────────────────────────────────────────────────────
CREATE TABLE media_tags (
    media_id INT NOT NULL,
    tag_id   INT NOT NULL,
    PRIMARY KEY (media_id, tag_id),
    FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)   REFERENCES tags(id)        ON DELETE CASCADE
);

-- ── Media Authors (optional, junction) ────────────────────────────────────────
CREATE TABLE media_authors (
    media_id INT NOT NULL,
    user_id  INT NOT NULL,
    PRIMARY KEY (media_id, user_id),
    FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(id)       ON DELETE CASCADE
);

-- ── Seed Data ─────────────────────────────────────────────────────────────────

-- Owner account (hidden — password: Ec1jaOwner!2024 bcrypt hash)
INSERT INTO users (username, password, role, is_hidden)
VALUES ('_ecijaowner', '$2b$12$vbj7TFESQuAcFTBXgacpuu7GGewrfmuOVN8vxQxE2DIaoqSHFi69e', 'owner', TRUE);

-- Default admin account (password: admin — CHANGE IN PRODUCTION)
INSERT INTO users (username, password, role)
VALUES ('admin', '$2b$12$vbj7TFESQuAcFTBXgacpuu7GGewrfmuOVN8vxQxE2DIaoqSHFi69e', 'admin');

-- Default categories
INSERT INTO categories (name, description, color, icon) VALUES
    ('Noticias',      'Cobertura de noticias locales',     '#ef4444', 'newspaper'),
    ('Política',      'Actos y eventos políticos',          '#f59e0b', 'landmark'),
    ('Cultura',       'Arte, fiestas y cultura local',      '#8b5cf6', 'music'),
    ('Deporte',       'Eventos deportivos locales',          '#10b981', 'trophy'),
    ('Sociedad',      'Eventos sociales y comunitarios',    '#3b82f6', 'users'),
    ('Economía',      'Economía y empresa local',            '#f97316', 'trending-up'),
    ('Historia',      'Patrimonio e historia de Écija',     '#6b7280', 'book-open'),
    ('Institucional', 'Actos institucionales y oficiales',  '#0ea5e9', 'building');

-- Default storage location
INSERT INTO storage_locations (name, base_path, storage_type, description)
VALUES ('Subidas locales', '/uploads', 'local', 'Directorio de subidas por defecto');
