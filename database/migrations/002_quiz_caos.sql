-- =========================================================
-- V20 — QUIZ & CAOS
-- Banco de perguntas e estatísticas específicas do jogo.
-- =========================================================

CREATE TABLE IF NOT EXISTS quiz_questions (
  id VARCHAR(120) PRIMARY KEY,
  category VARCHAR(80) NOT NULL,
  subcategory VARCHAR(100) NOT NULL,
  difficulty VARCHAR(16) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  answer TEXT NOT NULL,
  temporal BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  times_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_category
  ON quiz_questions(category, active);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_subcategory
  ON quiz_questions(subcategory, active);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_difficulty
  ON quiz_questions(difficulty, active);

CREATE TABLE IF NOT EXISTS quiz_match_players (
  match_id BIGINT NOT NULL REFERENCES match_history(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  final_position SMALLINT,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  wrong_answers INTEGER NOT NULL DEFAULT 0,
  answered_questions INTEGER NOT NULL DEFAULT 0,
  total_response_ms BIGINT NOT NULL DEFAULT 0,
  cards_used INTEGER NOT NULL DEFAULT 0,
  targeted_cards_used INTEGER NOT NULL DEFAULT 0,
  die_three_misses INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_match_players_user
  ON quiz_match_players(user_id);
