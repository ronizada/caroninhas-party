'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { readRecords, importRecords } = require('./importer');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForDatabase(pool, attempts=10, intervalMs=3000) {
  for (let i=1; i<=attempts; i++) {
    try { await pool.query('SELECT 1'); return; }
    catch (error) {
      if (i === attempts) throw new Error(`PostgreSQL indisponível após ${attempts} tentativas: ${error.message}`);
      console.warn(`[TRIVIA] Banco indisponível (${i}/${attempts}); nova tentativa em ${intervalMs/1000}s.`);
      await sleep(intervalMs);
    }
  }
}

async function assertIsolatedRole(pool) {
  const r = await pool.query(`
    SELECT current_user AS db_user,
           (SELECT rolsuper OR rolcreatedb OR rolcreaterole
              FROM pg_roles WHERE rolname = current_user) AS privileged,
           (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='trivia') AS schema_owner,
           has_schema_privilege(current_user, 'public', 'CREATE') AS public_ddl
  `);
  const row = r.rows[0];
  if (!row || row.privileged || row.public_ddl || row.schema_owner !== row.db_user) {
    throw new Error('Conexão recusada: use o usuário PostgreSQL restrito que é dono do schema trivia e NÃO pode criar objetos no schema public. Consulte CONFIGURAR_BANCO.md.');
  }
  return row.db_user;
}

async function initializeDatabase(pool, options={}) {
  await assertIsolatedRole(pool);
  const root = options.root || path.join(__dirname, '..');
  const importMode = options.importMode || 'if_empty';
  if (!['if_empty','always','off'].includes(importMode)) throw new Error('AUTO_IMPORT deve ser if_empty, always ou off');
  const migration = fs.readFileSync(path.join(root, 'sql', '001_init.sql'), 'utf8');
  await pool.query(migration);
  console.log('[TRIVIA] Tabelas PostgreSQL verificadas.');
  const countResult = await pool.query('SELECT COUNT(*)::integer AS total FROM trivia.questions');
  const count = Number(countResult.rows[0].total);
  if (importMode === 'off' || (importMode === 'if_empty' && count>0)) {
    console.log(`[TRIVIA] ${count} perguntas existentes; importação automática dispensada (${importMode}).`);
    return { imported:0, countBefore:count };
  }
  const records = await readRecords(path.join(root,'data','questions.jsonl'));
  const client = await pool.connect();
  try { await importRecords(client,records); }
  finally { client.release(); }
  console.log(`[TRIVIA] Importação OK: ${records.length} registros processados.`);
  return { imported:records.length, countBefore:count };
}
module.exports = { waitForDatabase, assertIsolatedRole, initializeDatabase };
