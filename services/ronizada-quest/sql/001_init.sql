-- Banco independente: NÃO altera quiz_questions do Caroninhas Party V20.19.
-- Schema is provisioned outside this application by its restricted owner.
CREATE TABLE IF NOT EXISTS trivia.questions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  original_record JSONB NOT NULL,
  source_review_status TEXT NOT NULL CHECK (source_review_status IN ('pending','blocked','rejected')),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','blocked','rejected')),
  review_note TEXT,
  approved_at TIMESTAMPTZ,
  category_en TEXT NOT NULL,
  category_pt TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple','boolean')),
  question_en TEXT NOT NULL,
  question_pt TEXT NOT NULL,
  correct_answer_en TEXT NOT NULL,
  correct_answer_pt TEXT NOT NULL,
  incorrect_answers_en JSONB NOT NULL CHECK (jsonb_typeof(incorrect_answers_en) = 'array'),
  incorrect_answers_pt JSONB NOT NULL CHECK (jsonb_typeof(incorrect_answers_pt) = 'array'),
  translation_status TEXT NOT NULL,
  quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash CHAR(64) NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trivia_questions_available ON trivia.questions(review_status, difficulty, question_type);
CREATE INDEX IF NOT EXISTS idx_trivia_questions_category ON trivia.questions(category_pt, review_status);

CREATE TABLE IF NOT EXISTS trivia.rounds (
  id UUID PRIMARY KEY,
  room_id TEXT NOT NULL,
  question_id TEXT NOT NULL REFERENCES trivia.questions(id),
  shuffled_options JSONB NOT NULL,
  correct_option_id TEXT NOT NULL,
  duration_seconds SMALLINT NOT NULL CHECK (duration_seconds BETWEEN 0 AND 30),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  UNIQUE (room_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_trivia_rounds_room ON trivia.rounds(room_id);


-- V1.3: somente schema trivia; não modifica tabelas do jogo principal.
CREATE TABLE IF NOT EXISTS trivia.round_answers (
  round_id UUID NOT NULL REFERENCES trivia.rounds(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL CHECK (length(player_id) BETWEEN 1 AND 120),
  option_id TEXT NOT NULL CHECK (option_id IN ('A','B','C','D')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (round_id,player_id)
);
CREATE INDEX IF NOT EXISTS idx_trivia_round_answers_round ON trivia.round_answers(round_id);
