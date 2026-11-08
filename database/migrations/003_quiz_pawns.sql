-- =========================================================
-- V20.10 — PEÃO PREFERIDO DO QUIZ & CAOS
-- =========================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pawn_id VARCHAR(40) NOT NULL DEFAULT 'classic_green';

UPDATE users
SET pawn_id = 'classic_green'
WHERE pawn_id IS NULL OR pawn_id = '';
