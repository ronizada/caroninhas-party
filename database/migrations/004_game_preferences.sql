-- Preferências universais por jogo. Não armazenar senha de sala nem segredos.
CREATE TABLE IF NOT EXISTS user_game_preferences (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_type VARCHAR(32) NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, game_type)
);
