const path = require('node:path');
const { readRecords, importRecords } = require('../src/importer');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const custom = process.argv.find(arg => arg.endsWith('.jsonl'));
  const filename = custom ? path.resolve(custom) : path.join(__dirname, '..', 'data', 'questions.jsonl');
  const records = await readRecords(filename);
  const counts = records.reduce((acc, x) => { acc[x.review_status] = (acc[x.review_status] || 0) + 1; return acc; }, {});
  console.log(`Arquivo OK: ${records.length} IDs únicos. Status na origem: ${JSON.stringify(counts)}.`);
  if (dryRun) {
    console.log('SIMULAÇÃO: banco não foi alterado.');
    return;
  }
  const { makePool } = require('../src/db');
  const pool = makePool();
  try {
    const client = await pool.connect();
    try { await importRecords(client, records); } finally { client.release(); }
    console.log(`Importação concluída: ${records.length} perguntas enviadas ao PostgreSQL. Apenas aprovadas ficam disponíveis nas partidas.`);
  } finally { await pool.end(); }
}
main().catch(err => { console.error('Falha na importação:', err.message); process.exitCode = 1; });
