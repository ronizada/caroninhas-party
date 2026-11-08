const fs = require('node:fs');
const readline = require('node:readline');
const { normalizeQuestion } = require('./normalize');

const UPSERT = `
INSERT INTO trivia.questions AS stored (
  id, source, original_record, source_review_status, review_status, category_en, category_pt,
  difficulty, question_type, question_en, question_pt, correct_answer_en, correct_answer_pt,
  incorrect_answers_en, incorrect_answers_pt, translation_status, quality_flags, content_hash
)
SELECT x.id, x.source, x.original_record, x.source_review_status, x.review_status, x.category_en,
       x.category_pt, x.difficulty, x.question_type, x.question_en, x.question_pt,
       x.correct_answer_en, x.correct_answer_pt, x.incorrect_answers_en, x.incorrect_answers_pt,
       x.translation_status, x.quality_flags, x.content_hash
FROM jsonb_to_recordset($1::jsonb) AS x(
  id TEXT, source TEXT, original_record JSONB, source_review_status TEXT, review_status TEXT,
  category_en TEXT, category_pt TEXT, difficulty TEXT, question_type TEXT, question_en TEXT,
  question_pt TEXT, correct_answer_en TEXT, correct_answer_pt TEXT,
  incorrect_answers_en JSONB, incorrect_answers_pt JSONB,
  translation_status TEXT, quality_flags JSONB, content_hash CHAR(64)
)
ON CONFLICT (id) DO UPDATE SET
  source = EXCLUDED.source,
  original_record = EXCLUDED.original_record,
  source_review_status = EXCLUDED.source_review_status,
  category_en = EXCLUDED.category_en, category_pt = EXCLUDED.category_pt,
  difficulty = EXCLUDED.difficulty, question_type = EXCLUDED.question_type,
  question_en = EXCLUDED.question_en, question_pt = EXCLUDED.question_pt,
  correct_answer_en = EXCLUDED.correct_answer_en, correct_answer_pt = EXCLUDED.correct_answer_pt,
  incorrect_answers_en = EXCLUDED.incorrect_answers_en,
  incorrect_answers_pt = EXCLUDED.incorrect_answers_pt,
  translation_status = EXCLUDED.translation_status, quality_flags = EXCLUDED.quality_flags,
  content_hash = EXCLUDED.content_hash, imported_at = NOW(), updated_at = NOW(),
  review_status = CASE
    WHEN EXCLUDED.source_review_status IN ('blocked','rejected') THEN EXCLUDED.source_review_status
    WHEN stored.review_status IN ('blocked','rejected') THEN stored.review_status
    WHEN stored.content_hash = EXCLUDED.content_hash THEN stored.review_status
    ELSE 'pending'
  END,
  approved_at = CASE
    WHEN EXCLUDED.source_review_status IN ('blocked','rejected') THEN NULL
    WHEN stored.review_status IN ('blocked','rejected') THEN NULL
    WHEN stored.content_hash = EXCLUDED.content_hash THEN stored.approved_at
    ELSE NULL
  END
`;

async function readRecords(filename) {
  const records = [];
  const ids = new Set();
  let lineNumber = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(filename, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    lineNumber++;
    if (!line.trim()) continue;
    try {
      const question = normalizeQuestion(JSON.parse(line));
      if (ids.has(question.id)) throw new Error(`id duplicado: ${question.id}`);
      ids.add(question.id);
      records.push(question);
    } catch (error) {
      throw new Error(`Linha ${lineNumber}: ${error.message}`);
    }
  }
  return records;
}

async function importRecords(client, records, batchSize = 100) {
  await client.query('BEGIN');
  try {
    for (let i = 0; i < records.length; i += batchSize) {
      await client.query(UPSERT, [JSON.stringify(records.slice(i, i + batchSize))]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  return records.length;
}

module.exports = { readRecords, importRecords, UPSERT };
