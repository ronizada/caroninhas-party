'use strict';
require('dotenv').config();
const { requireSecrets } = require('./config');
const { makePool } = require('./db');
const { createApp } = require('./app');
const { waitForDatabase, initializeDatabase } = require('./bootstrap');

async function main() {
  const secrets = requireSecrets();
  const databaseUrl = process.env.DATABASE_URL || '';
  if (process.env.DB_HOST?.includes('COLOQUE_') || process.env.DB_NAME?.includes('COLOQUE_') || process.env.DB_PASSWORD?.includes('COLOQUE_')) throw new Error('Preencha a .env com os dados do PostgreSQL e do usuario restrito antes do deploy.');
  const databaseHost = process.env.DB_HOST || 'localhost';
  if (!databaseUrl && (databaseHost === 'localhost' || databaseHost === '127.0.0.1')) {
    throw new Error('Configure DATABASE_URL ou DB_HOST de um PostgreSQL externo; localhost não é o banco na Discloud.');
  }
  if (databaseUrl.includes('SENHA_AQUI') || databaseUrl.includes('HOST_AQUI')) {
    throw new Error('Substitua os valores de exemplo em DATABASE_URL no .env antes do upload.');
  }
  if (!databaseUrl && process.env.DB_USER !== 'caroninhas_trivia_api') throw new Error('Use o usuario restrito caroninhas_trivia_api.');
  const pool = makePool();
  try {
    await waitForDatabase(pool);
    await initializeDatabase(pool, { importMode:process.env.AUTO_IMPORT || 'if_empty' });
    const port = Number(process.env.PORT || 8080);
    if (!Number.isInteger(port) || port<1 || port>65535) throw new Error('PORT inválida.');
    const host = process.env.HOST || '0.0.0.0';
    const server = createApp(pool, secrets).listen(port, host, () => {
      console.log(`[TRIVIA] API online em ${host}:${port}`);
    });
    server.on('error', error => console.error('[TRIVIA] Erro no servidor HTTP:', error.message));
    let closing = false;
    const shutdown = () => {
      if (closing) return;
      closing = true;
      server.close(async () => {
        try { await pool.end(); process.exit(0); }
        catch { process.exit(1); }
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    return server;
  } catch (error) {
    await pool.end().catch(()=>{});
    throw error;
  }
}
if (require.main === module) main().catch(error => { console.error('[TRIVIA] Falha ao iniciar:', error.message); process.exitCode=1; });
module.exports={main};
