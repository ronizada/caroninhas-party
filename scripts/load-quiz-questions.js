const fs = require("fs");
const path = require("path");

async function loadQuizQuestions(pool) {
  const file = path.join(__dirname, "..", "database", "data", "quiz_questions.jsonl");
  if (!fs.existsSync(file)) return 0;

  const rows = fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((item) => ({
      id: item.id,
      category: item.category,
      subcategory: item.subcategory,
      difficulty: item.difficulty,
      question: item.question,
      options: item.options,
      answer: item.answer,
      temporal: Boolean(item.temporal)
    }));

  if (!rows.length) return 0;

  await pool.query(
    `INSERT INTO quiz_questions (
       id, category, subcategory, difficulty, question,
       options, answer, temporal, active
     )
     SELECT
       x.id, x.category, x.subcategory, x.difficulty, x.question,
       x.options, x.answer, x.temporal, TRUE
     FROM jsonb_to_recordset($1::jsonb) AS x(
       id VARCHAR(120),
       category VARCHAR(80),
       subcategory VARCHAR(100),
       difficulty VARCHAR(16),
       question TEXT,
       options JSONB,
       answer TEXT,
       temporal BOOLEAN
     )
     ON CONFLICT (id) DO UPDATE SET
       category = EXCLUDED.category,
       subcategory = EXCLUDED.subcategory,
       difficulty = EXCLUDED.difficulty,
       question = EXCLUDED.question,
       options = EXCLUDED.options,
       answer = EXCLUDED.answer,
       temporal = EXCLUDED.temporal,
       active = TRUE`,
    [JSON.stringify(rows)]
  );

  return rows.length;
}

module.exports = { loadQuizQuestions };
