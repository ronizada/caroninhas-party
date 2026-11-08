CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  slug VARCHAR(80) NOT NULL UNIQUE,
  emoji VARCHAR(16),
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS difficulties (
  id SMALLSERIAL PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE,
  slug VARCHAR(30) NOT NULL UNIQUE,
  level SMALLINT NOT NULL UNIQUE CHECK (level BETWEEN 1 AND 3)
);

CREATE TABLE IF NOT EXISTS words (
  id BIGSERIAL PRIMARY KEY,
  word VARCHAR(100) NOT NULL,
  hint VARCHAR(60) NOT NULL CHECK (hint !~ '\s'),
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  difficulty_id SMALLINT NOT NULL REFERENCES difficulties(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  times_used INTEGER NOT NULL DEFAULT 0 CHECK (times_used >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (word, category_id)
);

CREATE INDEX IF NOT EXISTS idx_words_category
  ON words(category_id);

CREATE INDEX IF NOT EXISTS idx_words_difficulty
  ON words(difficulty_id);

CREATE INDEX IF NOT EXISTS idx_words_active_category_difficulty
  ON words(active, category_id, difficulty_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_words_updated_at ON words;

CREATE TRIGGER trg_words_updated_at
BEFORE UPDATE ON words
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS character_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  slug VARCHAR(80) NOT NULL UNIQUE,
  emoji VARCHAR(16),
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS characters (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  image_url TEXT,
  category_id INTEGER NOT NULL REFERENCES character_categories(id) ON DELETE RESTRICT,
  difficulty_id SMALLINT NOT NULL REFERENCES difficulties(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  times_used INTEGER NOT NULL DEFAULT 0 CHECK (times_used >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, category_id)
);


ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_characters_category
  ON characters(category_id);

CREATE INDEX IF NOT EXISTS idx_characters_difficulty
  ON characters(difficulty_id);

CREATE INDEX IF NOT EXISTS idx_characters_active_category_difficulty
  ON characters(active, category_id, difficulty_id);

DROP TRIGGER IF EXISTS trg_characters_updated_at ON characters;

CREATE TRIGGER trg_characters_updated_at
BEFORE UPDATE ON characters
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- V19 — CONTAS, PERFIL, SESSÕES E ESTATÍSTICAS
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  nickname VARCHAR(20) NOT NULL,
  nickname_key VARCHAR(20) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  birth_date DATE NOT NULL,
  avatar_type VARCHAR(12) NOT NULL DEFAULT 'preset'
    CHECK (avatar_type IN ('preset', 'upload')),
  avatar_id VARCHAR(20) NOT NULL DEFAULT 'dog',
  profile_image BYTEA,
  profile_image_mime VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_nickname_key
  ON users(nickname_key);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at
  ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS match_history (
  id BIGSERIAL PRIMARY KEY,
  round_key VARCHAR(120) NOT NULL UNIQUE,
  game_type VARCHAR(30) NOT NULL,
  room_code VARCHAR(12),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  winner_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  winner_side VARCHAR(40),
  result_reason VARCHAR(80)
);

CREATE INDEX IF NOT EXISTS idx_match_history_game_type
  ON match_history(game_type);
CREATE INDEX IF NOT EXISTS idx_match_history_finished_at
  ON match_history(finished_at DESC);

CREATE TABLE IF NOT EXISTS match_players (
  match_id BIGINT NOT NULL REFERENCES match_history(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_type VARCHAR(30) NOT NULL,
  won BOOLEAN NOT NULL DEFAULT FALSE,
  role VARCHAR(40),
  eliminated BOOLEAN NOT NULL DEFAULT FALSE,
  attempts_used SMALLINT,
  character_name VARCHAR(160),
  PRIMARY KEY (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_players_user
  ON match_players(user_id, game_type);
CREATE INDEX IF NOT EXISTS idx_match_players_won
  ON match_players(user_id, won);
