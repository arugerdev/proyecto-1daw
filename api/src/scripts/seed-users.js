#!/usr/bin/env node
/**
 * Seed the owner and admin accounts on a fresh install.
 *
 * Reads credentials from environment variables (set by setup.ps1 / setup.sh)
 * and inserts the two privileged accounts with bcrypt-hashed passwords
 * directly using mysql2 — this is much more reliable than shelling out to
 * the mysql CLI with an INSERT that embeds `$` characters from bcrypt hashes.
 *
 * Required env (all come from api/.env or from the invoking shell):
 *   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 *   OWNER_USERNAME, OWNER_PASSWORD
 *   ADMIN_USERNAME, ADMIN_PASSWORD
 *
 * Optional:
 *   SEED_FORCE_PASSWORD = "true"  → always overwrite existing passwords
 *                                  (default: only set password on insert)
 *
 * Exit codes:
 *   0  → both users present (created or updated)
 *   1  → invalid arguments / missing env
 *   2  → database connection / query failure
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');

const SALT_ROUNDS = 12;

function req(name) {
    const v = process.env[name];
    if (!v || !String(v).trim()) {
        console.error(`[seed-users] missing env: ${name}`);
        process.exit(1);
    }
    return String(v).trim();
}

async function upsertUser(conn, { id, username, password, role, isHidden, force }) {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    // If the row already exists and we're not forcing, keep its password.
    // Otherwise insert OR replace the hash on duplicate.
    if (force) {
        await conn.query(
            `INSERT INTO users (id, username, password, role, is_hidden, is_active)
             VALUES (?, ?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE
                username = VALUES(username),
                password = VALUES(password),
                role     = VALUES(role),
                is_hidden = VALUES(is_hidden),
                is_active = 1`,
            [id, username, hash, role, isHidden ? 1 : 0]
        );
    } else {
        await conn.query(
            `INSERT INTO users (id, username, password, role, is_hidden, is_active)
             VALUES (?, ?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE
                username = VALUES(username),
                role     = VALUES(role),
                is_hidden = VALUES(is_hidden),
                is_active = 1`,
            [id, username, hash, role, isHidden ? 1 : 0]
        );
    }

    console.log(`[seed-users] ${role} ready: ${username} (id=${id}, hidden=${!!isHidden})`);
}

(async () => {
    const dbConfig = {
        host:     req('DB_HOST'),
        user:     req('DB_USER'),
        password: process.env.DB_PASSWORD || '',
        database: req('DB_NAME'),
        multipleStatements: false
    };

    const ownerUser = req('OWNER_USERNAME');
    const ownerPass = req('OWNER_PASSWORD');
    const adminUser = req('ADMIN_USERNAME');
    const adminPass = req('ADMIN_PASSWORD');
    const force     = String(process.env.SEED_FORCE_PASSWORD || 'true').toLowerCase() === 'true';

    let conn;
    try {
        conn = await mysql.createConnection(dbConfig);
    } catch (err) {
        console.error('[seed-users] cannot connect to database:', err.message);
        process.exit(2);
    }

    try {
        await upsertUser(conn, {
            id: 1, username: ownerUser, password: ownerPass,
            role: 'owner', isHidden: true, force
        });
        await upsertUser(conn, {
            id: 2, username: adminUser, password: adminPass,
            role: 'admin', isHidden: false, force
        });
        // Reserve ids 1 and 2 for these accounts — subsequent registrations get id >= 3
        await conn.query('ALTER TABLE users AUTO_INCREMENT = 3');

        console.log('[seed-users] done.');
        process.exit(0);
    } catch (err) {
        console.error('[seed-users] query failed:', err.message);
        process.exit(2);
    } finally {
        try { await conn.end(); } catch {}
    }
})();
