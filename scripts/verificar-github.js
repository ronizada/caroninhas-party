'use strict';
// Pre-flight conservador para um NOVO repositório GitHub.
// Nao imprime valores de .env, senhas ou chaves.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const excludedDirs = new Set(['.git','node_modules','.cache','coverage','.idea','.vscode']);
const flagged = [];
let count = 0;
function walk(dir) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory()) {
      if (!excludedDirs.has(d.name)) walk(path.join(dir, d.name));
      continue;
    }
    if (!d.isFile()) continue;
    count++;
    const rel = path.relative(root, path.join(dir, d.name)).replace(/\\/g, '/');
    const filename = d.name.toLowerCase();
    if (filename === '.env' || (filename.startsWith('.env.') && filename !== '.env.example')) {
      flagged.push([rel,'variáveis de ambiente privadas']);
    } else if (filename === 'discloud.config') {
      flagged.push([rel,'manifesto real de deploy']);
    } else if (/\.(?:dump|backup|p12|pfx|pem|key|sqlite|sqlite3|db|zip|7z|rar)$/.test(filename)) {
      flagged.push([rel,'possível backup ou material privado']);
    }
  }
}
walk(root);
if (flagged.length) {
  console.error('ERRO: encontrado(s) arquivo(s) que nao devem ser adicionados ao GitHub:');
  for (const [p,why] of flagged) console.error(` - ${p} (${why})`);
  console.error('Remova os arquivos privados da pasta publicada antes de continuar.');
  process.exitCode = 1;
} else {
  console.log(`Verificacao basica OK: ${count} arquivos, nenhum .env real ou dump conhecido detectado.`);
  console.log('Ainda e necessario conferir manualmente os segredos no conteudo e os direitos de redistribuicao.');
}
