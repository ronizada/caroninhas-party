-- =========================================================
-- V19 — CONTAS, PERFIL, SESSÕES E ESTATÍSTICAS
-- =========================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
