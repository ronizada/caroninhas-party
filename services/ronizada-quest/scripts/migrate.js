const fs = require('node:fs');
const path = require('node:path');
const { makePool } = require('../src/db');

async function main() {
  const pool = makePool();
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', '001_init.sql'), 'utf8');
    await pool.query(sql);
    console.log('Migração OK: tabelas trivia_questions e trivia_rounds criadas/verificadas.');
  } finally {
    await pool.end();
  }
}
main().catch(err => { console.error('Falha ao migrar:', err.message); process.exitCode = 1; });
