-- EcijaComarca v2 Migration Script
-- Run this ONLY when migrating from the old schema (administradorMultimedia → ecijacomarca)
-- Safe to re-run: uses IF NOT EXISTS / IGNORE

-- Note: run init.sql for a clean install. This file handles partial upgrades.

USE ecijacomarca;

-- Add missing columns if upgrading from v1
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email      VARCHAR(100)   AFTER username,
    ADD COLUMN IF NOT EXISTS is_hidden  BOOLEAN DEFAULT FALSE AFTER role,
    ADD COLUMN IF NOT EXISTS is_active  BOOLEAN DEFAULT TRUE  AFTER is_hidden,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

ALTER TABLE storage_locations
    ADD COLUMN IF NOT EXISTS storage_type ENUM('local','url','smb','ftp','nfs') DEFAULT 'local' AFTER base_path,
    ADD COLUMN IF NOT EXISTS description  TEXT AFTER storage_type,
    ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT TRUE AFTER description;

ALTER TABLE media_items
    ADD COLUMN IF NOT EXISTS media_kind      ENUM('video','audio','image','document','text','other') DEFAULT 'other' AFTER file_extension,
    ADD COLUMN IF NOT EXISTS duration        INT AFTER media_kind,
    ADD COLUMN IF NOT EXISTS width           INT AFTER duration,
    ADD COLUMN IF NOT EXISTS height          INT AFTER width,
    ADD COLUMN IF NOT EXISTS view_count      INT DEFAULT 0 AFTER created_by,
    ADD COLUMN IF NOT EXISTS download_count  INT DEFAULT 0 AFTER view_count,
    ADD COLUMN IF NOT EXISTS is_public       BOOLEAN DEFAULT TRUE AFTER download_count;
