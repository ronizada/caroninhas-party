const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeQuestion, makeRoundOptions, uniqueOptions } = require('../src/normalize');
const { requireSecrets } = require('../src/config');
const { secureMatch, validateFilters } = require('../src/validation');
const { readRecords, importRecords } = require('../src/importer');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function sample(extra = {}) {
  return {
    id: 'source-id-123', question_en: 'Capital?', question_pt: 'Qual é a capital?',
    correct_answer_en: 'Brasilia', correct_answer_pt: 'Brasília',
    incorrect_answers_en: ['Rio', 'Sao Paulo', 'Salvador'],
    incorrect_answers_pt: ['Rio de Janeiro','São Paulo','Salvador'],
    source: 'OpenTDB', review_status: 'pending', category_en: 'General', category_pt: 'Conhecimentos gerais',
    difficulty_en: 'easy', type_en: 'multiple', translation_status: 'pendente', quality_flags: [], ...extra
  };
}

test('normaliza uma questão de quatro alternativas com origem e hash', () => {
  const q = normalizeQuestion(sample());
  assert.equal(q.question_pt, 'Qual é a capital?');
  assert.equal(q.incorrect_answers_pt.length, 3);
  assert.match(q.content_hash, /^[a-f0-9]{64}$/);
  assert.equal(q.review_status, 'pending');
});

test('rejeita registro inválido e duplicação de opções antes de aprovar', () => {
  assert.throws(() => normalizeQuestion(sample({ difficulty_en: 'extreme' })), /Dificuldade/);
  const q = normalizeQuestion(sample({ incorrect_answers_pt: ['Brasília', 'São Paulo', 'Salvador'] }));
  assert.equal(uniqueOptions(q), false);
  assert.throws(() => makeRoundOptions(q), /equivalentes/);
});

test('sorteio de alternativas esconde o gabarito nos dados públicos', () => {
  const q = normalizeQuestion(sample());
  const options = makeRoundOptions(q, () => 0);
  assert.equal(options.options.length, 4);
  assert.equal(options.options.find(x => x.id === options.correctOptionId).text, 'Brasília');
  assert.ok(!options.options.some(x => Object.hasOwn(x, 'correct')));
});

test('chaves de serviço e administração obrigatoriamente diferentes', () => {
  assert.throws(() => requireSecrets({ TRIVIA_API_KEY: 'a'.repeat(30), TRIVIA_ADMIN_KEY: 'a'.repeat(30) }));
  assert.doesNotThrow(() => requireSecrets({ TRIVIA_API_KEY: 'a'.repeat(30), TRIVIA_ADMIN_KEY: 'b'.repeat(30) }));
  assert.equal(secureMatch('a'.repeat(30),'a'.repeat(30)),true);
  assert.equal(secureMatch('aaa','a'.repeat(30)),false);
});

test('não permite filtros inválidos', () => {
  assert.throws(() => validateFilters({difficulty:'very-hard'}), /Dificuldade/);
  assert.deepEqual(validateFilters({type:'boolean'}), { category:null, difficulty:null, type:'boolean' });
});

test('leitor rejeita ids duplicados', async () => {
  const filename = path.join(fs.mkdtempSync(path.join(os.tmpdir(),'trivia-')), 'sample.jsonl');
  fs.writeFileSync(filename, JSON.stringify(sample())+'\n'+JSON.stringify(sample())+'\n');
  await assert.rejects(readRecords(filename), /id duplicado/);
  fs.rmSync(path.dirname(filename), { recursive:true,force:true });
});

test('importação agrupa registros em uma transação; reverte em falhas', async () => {
  const commands = [];
  const conn = { query: async (sql, params) => { commands.push(sql); return { rows:[],rowCount:0 }; } };
  await importRecords(conn, Array.from({ length:205 },(_,i) => ({ ...normalizeQuestion(sample()), id:String(i) })), 100);
  assert.equal(commands.length,5); // BEGIN, 3 INSERTs, COMMIT
  assert.equal(commands[0],'BEGIN'); assert.equal(commands.at(-1),'COMMIT');
  const fail = [];
  const broken = { query:async sql => { fail.push(sql); if(sql.startsWith('\nINSERT')) throw Error('database'); } };
  await assert.rejects(importRecords(broken, [normalizeQuestion(sample())]));
  assert.equal(fail.at(-1),'ROLLBACK');
});
