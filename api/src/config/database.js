const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    // Prefer DB_* vars (safe on Linux where process.env.USER is the OS user).
    // Fall back to the old names for backward compatibility with existing .env files.
    host:     process.env.DB_HOST     || process.env.HOST     || 'localhost',
    user:     process.env.DB_USER     || process.env.USER     || 'root',
    password: process.env.DB_PASSWORD || process.env.PASSWORD || '',
    database: process.env.DB_NAME     || process.env.DATABASE || 'ecijacomarca',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+00:00',
    charset: 'utf8mb4'
});

pool.getConnection()
    .then(conn => { conn.release(); console.log('[DB] MySQL connected'); })
    .catch(err => console.error('[DB] Connection error:', err.message));

module.exports = pool;
