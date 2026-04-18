/**
 * One-shot script to set correct bcrypt hashes for seed users.
 * Run once from the api/ folder: node fix-passwords.js
 * Delete this file afterwards.
 */
const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const db = await mysql.createPool({
    host:     process.env.HOST     || 'localhost',
    user:     process.env.USER     || 'root',
    password: process.env.PASSWORD || 'root',
    database: process.env.DATABASE || 'ecijacomarca',
  });

  const COST = 12;
  const users = [
    { username: '_ecijaowner', password: 'Ec1jaOwner!2024' },
    { username: 'admin',       password: 'admin'           },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, COST);
    const [result] = await db.query(
      'UPDATE users SET password = ? WHERE username = ?',
      [hash, u.username]
    );
    if (result.affectedRows === 0) {
      console.warn(`⚠️  User "${u.username}" not found — skipped`);
    } else {
      console.log(`✅  Password updated for "${u.username}"`);
    }
  }

  await db.end();
  console.log('\nDone. You can delete this file now.');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
