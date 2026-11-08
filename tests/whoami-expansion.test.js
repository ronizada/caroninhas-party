const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const seed = fs.readFileSync(path.join(root, 'database', 'seed.sql'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'database', 'migrations', '005_whoami_expansion_1008.sql'), 'utf8');
const originalSql = seed.slice(seed.indexOf('INSERT INTO characters (name, category_id, difficulty_id)'));
const quote = String.raw`(?:[^']|'')*`;
const pattern = new RegExp(String.raw`\('(${quote})', '(brasil|cinema-series|animes-desenhos|jogos|famosos|historia-cultura)', '(facil|medio|dificil)'\)`, 'g');
const original = [...originalSql.matchAll(pattern)].map((m) => [m[1].replace(/''/g, "'"), m[2], m[3]]);
const added = [...migration.matchAll(pattern)].map((m) => [m[1].replace(/''/g, "'"), m[2], m[3]]);
const clean = (value) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

const categories = ['brasil', 'cinema-series', 'animes-desenhos', 'jogos', 'famosos', 'historia-cultura'];
const levels = ['facil', 'medio', 'dificil'];

test('base original mantém 216 personagens', () => assert.equal(original.length, 216));
test('migração contém 1008 personagens novos', () => assert.equal(added.length, 1008));
test('banco planejado soma 1224', () => assert.equal(original.length + added.length, 1224));
test('não há duplicatas normalizadas', () => {
  const names = original.concat(added).map((item) => clean(item[0]));
  assert.equal(new Set(names).size, names.length);
});
test('todas as categorias têm 204 personagens e dificuldades equilibradas', () => {
  for (const category of categories) {
    for (const level of levels) {
      const amount = original.concat(added).filter((v) => v[1] === category && v[2] === level).length;
      assert.equal(amount, 68, `${category}/${level}`);
    }
  }
});
test('migração não substitui nem apaga personagens existentes', () => {
  assert.match(migration, /ON CONFLICT \(name, category_id\) DO NOTHING/i);
  assert.doesNotMatch(migration, /\b(?:DELETE|TRUNCATE|DROP|UPDATE)\b\s+(?:FROM\s+)?(?:TABLE\s+)?(?:characters|character_categories)\b/i);
});
test('acervo antigo de perguntas do Quiz permanece no pacote', () => {
  const questions = fs.readFileSync(path.join(root, 'database', 'data', 'quiz_questions.jsonl'), 'utf8').trim().split(/\r?\n/);
  assert.equal(questions.length, 1000);
});
