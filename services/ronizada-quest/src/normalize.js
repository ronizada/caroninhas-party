const crypto = require('node:crypto');

const STATUS = new Set(['pending', 'blocked', 'rejected']);
const DIFFICULTY = new Set(['easy', 'medium', 'hard']);
const TYPES = new Set(['multiple', 'boolean']);

function nonempty(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Campo inválido: ${name}`);
  return value.trim();
}

function choices(value, len, name) {
  if (!Array.isArray(value) || value.length !== len || value.some(v => typeof v !== 'string' || !v.trim())) {
    throw new Error(`Alternativas inválidas: ${name}; esperado ${len}`);
  }
  return value.map(v => v.trim());
}

function normalizeQuestion(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Registro JSON inválido');
  const type = nonempty(item.type_en, 'type_en');
  if (!TYPES.has(type)) throw new Error(`Tipo desconhecido: ${type}`);
  const difficulty = nonempty(item.difficulty_en, 'difficulty_en');
  if (!DIFFICULTY.has(difficulty)) throw new Error(`Dificuldade desconhecida: ${difficulty}`);
  const sourceStatus = nonempty(item.review_status, 'review_status');
  if (!STATUS.has(sourceStatus)) throw new Error(`Status de origem desconhecido: ${sourceStatus}`);
  const count = type === 'multiple' ? 3 : 1;
  const flags = Array.isArray(item.quality_flags) && item.quality_flags.every(x => typeof x === 'string')
    ? item.quality_flags : (() => { throw new Error('quality_flags inválido'); })();
  const normalized = {
    id: nonempty(item.id, 'id'),
    source: nonempty(item.source, 'source'),
    source_review_status: sourceStatus,
    review_status: sourceStatus,
    category_en: nonempty(item.category_en, 'category_en'),
    category_pt: nonempty(item.category_pt, 'category_pt'),
    difficulty,
    question_type: type,
    question_en: nonempty(item.question_en, 'question_en'),
    question_pt: nonempty(item.question_pt, 'question_pt'),
    correct_answer_en: nonempty(item.correct_answer_en, 'correct_answer_en'),
    correct_answer_pt: nonempty(item.correct_answer_pt, 'correct_answer_pt'),
    incorrect_answers_en: choices(item.incorrect_answers_en, count, 'incorrect_answers_en'),
    incorrect_answers_pt: choices(item.incorrect_answers_pt, count, 'incorrect_answers_pt'),
    translation_status: nonempty(item.translation_status, 'translation_status'),
    quality_flags: flags,
    original_record: item
  };
  const hashObject = { ...normalized };
  delete hashObject.original_record;
  delete hashObject.review_status;
  normalized.content_hash = crypto.createHash('sha256').update(JSON.stringify(hashObject)).digest('hex');
  return normalized;
}

function uniqueOptions(q) {
  const all = [q.correct_answer_pt, ...q.incorrect_answers_pt];
  return new Set(all.map(v => v.trim().normalize('NFKC').toLocaleLowerCase('pt-BR'))).size === all.length;
}

function makeRoundOptions(question, randomInt = crypto.randomInt) {
  const choices = [
    { text: question.correct_answer_pt, correct: true },
    ...question.incorrect_answers_pt.map(text => ({ text, correct: false }))
  ];
  if (!uniqueOptions(question)) throw new Error('Pergunta com alternativas equivalentes: não disponível');
  for (let i = choices.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  const letters = ['A', 'B', 'C', 'D'];
  const correctOptionId = letters[choices.findIndex(x => x.correct)];
  return {
    options: choices.map((c, i) => ({ id: letters[i], text: c.text })),
    correctOptionId
  };
}

module.exports = { normalizeQuestion, uniqueOptions, makeRoundOptions };
