const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.HOST || 'localhost',
    user: process.env.USER || 'root',
    password: process.env.PASSWORD || '',
    database: process.env.DATABASE || 'ecijacomarca',
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
