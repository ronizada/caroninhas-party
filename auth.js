const crypto = require("crypto");
const { promisify } = require("util");

const scryptAsync = promisify(crypto.scrypt);

const SESSION_COOKIE = "caroninhas_session";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_MAX_AGE_MS = 10 * 60 * 1000;
const RESERVED_NICKNAMES = new Set([
  "admin",
  "moderador",
  "sistema",
  "caroninhas"
]);

const recoveryTokens = new Map();
const recoveryAttempts = new Map();



async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(String(password), salt, 64);
  return `scrypt$${salt.toString("base64")}$${Buffer.from(derived).toString("base64")}`;
}

async function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const derived = Buffer.from(await scryptAsync(String(password), salt, expected.length));
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

function parseCookies(header = "") {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf("=");
      if (index === -1) return acc;
      const key = decodeURIComponent(part.slice(0, index));
      const value = decodeURIComponent(part.slice(index + 1));
      acc[key] = value;
      return acc;
    }, {});
}

function hashToken(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

function normalizeNickname(value) {
  return String(value || "")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("pt-BR");
}

function validateNickname(value) {
  const nickname = String(value || "").trim();
  const key = normalizeNickname(nickname);

  if (nickname.length < 3 || nickname.length > 20) {
    return { ok: false, error: "O nickname deve ter entre 3 e 20 caracteres." };
  }

  if (!/^[A-Za-z0-9_.]+$/.test(nickname)) {
    return {
      ok: false,
      error: "Use apenas letras, números, ponto e underline no nickname."
    };
  }

  if (RESERVED_NICKNAMES.has(key)) {
    return { ok: false, error: "Esse nickname não pode ser utilizado." };
  }

  return { ok: true, nickname, key };
}

function validatePassword(value) {
  const password = String(value || "");

  if (password.length < 6 || password.length > 72) {
    return { ok: false, error: "A senha deve ter entre 6 e 72 caracteres." };
  }

  return { ok: true, password };
}

function validateBirthDate(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, error: "Informe uma data de nascimento válida." };
  }

  const date = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "Informe uma data de nascimento válida." };
  }

  const year = date.getUTCFullYear();
  const today = new Date();
  if (year < 1900 || date > today) {
    return { ok: false, error: "Informe uma data de nascimento válida." };
  }

  return { ok: true, birthDate: raw };
}

function getRequestIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || "unknown";
}

function setSessionCookie(req, res, rawToken) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "");
  const isHttps = req.secure || forwardedProto === "https";
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(rawToken)}`,
    "Path=/",
    `Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`,
    "HttpOnly",
    "SameSite=Lax"
  ];

  if (isHttps) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(req, res) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "");
  const isHttps = req.secure || forwardedProto === "https";
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (isHttps) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function avatarKeyForUser(user) {
  if (!user) return "dog";

  if (user.avatar_type === "upload" && user.has_profile_image) {
    const version = user.updated_at
      ? new Date(user.updated_at).getTime()
      : Date.now();
    return `profile:${user.id}:${version}`;
  }

  return user.avatar_id || "dog";
}

function publicUser(user) {
  if (!user) return null;
  const avatarKey = avatarKeyForUser(user);

  return {
    id: Number(user.id),
    nickname: user.nickname,
    avatarKey,
    avatarType: user.avatar_type || "preset",
    avatarId: user.avatar_id || "dog",
    avatarUrl: avatarKey.startsWith("profile:")
      ? `/api/profile/image/${user.id}?v=${encodeURIComponent(avatarKey.split(":")[2] || "")}`
      : `/avatars/${user.avatar_id || "dog"}.png`,
    createdAt: user.created_at
  };
}

async function lookupSessionUser(db, rawToken) {
  if (!rawToken) return null;

  const result = await db.query(
    `SELECT
       u.id,
       u.nickname,
       u.nickname_key,
       u.password_hash,
       u.birth_date,
       u.avatar_type,
       u.avatar_id,
       (u.profile_image IS NOT NULL) AS has_profile_image,
       u.created_at,
       u.updated_at,
       s.expires_at
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.expires_at > NOW()
     LIMIT 1`,
    [hashToken(rawToken)]
  );

  return result.rows[0] || null;
}

async function getUserFromRequest(db, req) {
  const cookies = parseCookies(req.headers.cookie);
  return lookupSessionUser(db, cookies[SESSION_COOKIE]);
}

async function getUserFromSocket(db, socket) {
  const cookies = parseCookies(socket.handshake?.headers?.cookie || socket.request?.headers?.cookie);
  return lookupSessionUser(db, cookies[SESSION_COOKIE]);
}

async function createSession(db, req, res, userId) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  await db.query(
    `INSERT INTO user_sessions (token_hash, user_id, expires_at, last_seen_at)
     VALUES ($1, $2, $3, NOW())`,
    [tokenHash, userId, expiresAt]
  );

  setSessionCookie(req, res, rawToken);
  return rawToken;
}

async function refreshSession(db, req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const rawToken = cookies[SESSION_COOKIE];
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  const result = await db.query(
    `UPDATE user_sessions
     SET expires_at = $2, last_seen_at = NOW()
     WHERE token_hash = $1
       AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash, expiresAt]
  );

  if (result.rowCount) setSessionCookie(req, res, rawToken);
  return result.rows[0]?.user_id || null;
}

async function destroyCurrentSession(db, req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const rawToken = cookies[SESSION_COOKIE];
  if (rawToken) {
    await db.query("DELETE FROM user_sessions WHERE token_hash = $1", [hashToken(rawToken)]);
  }
  clearSessionCookie(req, res);
}

async function getStats(db, userId) {
  const result = await db.query(
    `SELECT
       COUNT(*)::int AS total_games,
       COUNT(*) FILTER (WHERE won)::int AS total_wins,
       COUNT(*) FILTER (WHERE NOT won)::int AS total_losses,

       COUNT(*) FILTER (WHERE game_type = 'impostor')::int AS impostor_games,
       COUNT(*) FILTER (WHERE game_type = 'impostor' AND won)::int AS impostor_wins,
       COUNT(*) FILTER (WHERE game_type = 'impostor' AND role = 'impostor')::int AS times_impostor,
       COUNT(*) FILTER (WHERE game_type = 'impostor' AND role = 'impostor' AND won)::int AS wins_as_impostor,
       COUNT(*) FILTER (WHERE game_type = 'impostor' AND role = 'investigador' AND won)::int AS wins_as_investigator,

       COUNT(*) FILTER (WHERE game_type = 'whoami')::int AS whoami_games,
       COUNT(*) FILTER (WHERE game_type = 'whoami' AND won)::int AS whoami_wins,
       COUNT(*) FILTER (WHERE game_type = 'whoami' AND (role = 'acertou' OR won))::int AS whoami_correct,
       COUNT(*) FILTER (WHERE game_type = 'whoami' AND eliminated)::int AS whoami_eliminations,
       COALESCE(ROUND(AVG(attempts_used) FILTER (WHERE game_type = 'whoami' AND won), 2), 0) AS whoami_avg_attempts
     FROM match_players
     WHERE user_id = $1 AND game_type IN ('impostor', 'whoami')`,
    [userId]
  );

  const row = result.rows[0] || {};
  const totalGames = Number(row.total_games || 0);
  const totalWins = Number(row.total_wins || 0);

  return {
    totalGames,
    totalWins,
    totalLosses: Number(row.total_losses || 0),
    winRate: totalGames ? Math.round((totalWins / totalGames) * 1000) / 10 : 0,
    impostor: {
      games: Number(row.impostor_games || 0),
      wins: Number(row.impostor_wins || 0),
      timesImpostor: Number(row.times_impostor || 0),
      winsAsImpostor: Number(row.wins_as_impostor || 0),
      winsAsInvestigator: Number(row.wins_as_investigator || 0)
    },
    whoami: {
      games: Number(row.whoami_games || 0),
      wins: Number(row.whoami_wins || 0),
      eliminations: Number(row.whoami_eliminations || 0),
      correct: Number(row.whoami_correct || 0),
      avgAttemptsToWin: Number(row.whoami_avg_attempts || 0)
    }
  };
}

function cleanupRecoveryTokens() {
  const now = Date.now();
  for (const [token, data] of recoveryTokens.entries()) {
    if (data.expiresAt <= now) recoveryTokens.delete(token);
  }
}

function allowRecoveryAttempt(key) {
  const now = Date.now();
  const current = recoveryAttempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };

  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + 15 * 60 * 1000;
  }

  current.count += 1;
  recoveryAttempts.set(key, current);
  return current.count <= 8;
}

function setupAuthRoutes(app, db) {
  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await getUserFromRequest(db, req);
      if (!user) return res.json({ authenticated: false });

      await refreshSession(db, req, res);
      const stats = await getStats(db, user.id);
      return res.json({ authenticated: true, user: publicUser(user), stats });
    } catch (error) {
      console.error("auth/me", error);
      return res.status(500).json({ error: "Não foi possível carregar sua conta." });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const nick = validateNickname(req.body?.nickname);
      if (!nick.ok) return res.status(400).json({ error: nick.error });

      const pass = validatePassword(req.body?.password);
      if (!pass.ok) return res.status(400).json({ error: pass.error });

      const birth = validateBirthDate(req.body?.birthDate);
      if (!birth.ok) return res.status(400).json({ error: birth.error });

      const passwordHash = await hashPassword(pass.password);
      const result = await db.query(
        `INSERT INTO users (nickname, nickname_key, password_hash, birth_date, avatar_type, avatar_id)
         VALUES ($1, $2, $3, $4, 'preset', 'dog')
         RETURNING id, nickname, nickname_key, avatar_type, avatar_id,
                   FALSE AS has_profile_image, created_at, updated_at`,
        [nick.nickname, nick.key, passwordHash, birth.birthDate]
      );

      await createSession(db, req, res, result.rows[0].id);
      return res.status(201).json({ ok: true, user: publicUser(result.rows[0]) });
    } catch (error) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "Esse nickname já está sendo usado." });
      }
      console.error("auth/register", error);
      return res.status(500).json({ error: "Não foi possível criar sua conta." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const nicknameKey = normalizeNickname(req.body?.nickname);
      const password = String(req.body?.password || "");

      const result = await db.query(
        `SELECT id, nickname, nickname_key, password_hash, birth_date,
                avatar_type, avatar_id,
                (profile_image IS NOT NULL) AS has_profile_image,
                created_at, updated_at
         FROM users
         WHERE nickname_key = $1
         LIMIT 1`,
        [nicknameKey]
      );

      const user = result.rows[0];
      const valid = user ? await verifyPassword(password, user.password_hash) : false;
      if (!valid) {
        return res.status(401).json({ error: "Nickname ou senha incorretos." });
      }

      await createSession(db, req, res, user.id);
      const stats = await getStats(db, user.id);
      return res.json({ ok: true, user: publicUser(user), stats });
    } catch (error) {
      console.error("auth/login", error);
      return res.status(500).json({ error: "Não foi possível entrar." });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      await destroyCurrentSession(db, req, res);
      return res.json({ ok: true });
    } catch (error) {
      console.error("auth/logout", error);
      clearSessionCookie(req, res);
      return res.json({ ok: true });
    }
  });

  app.post("/api/auth/recovery/verify", async (req, res) => {
    try {
      cleanupRecoveryTokens();
      const nicknameKey = normalizeNickname(req.body?.nickname);
      const birthDate = String(req.body?.birthDate || "");
      const attemptKey = `${getRequestIp(req)}:${nicknameKey}`;

      if (!allowRecoveryAttempt(attemptKey)) {
        return res.status(429).json({ error: "Muitas tentativas. Tente novamente mais tarde." });
      }

      const result = await db.query(
        `SELECT id
         FROM users
         WHERE nickname_key = $1
           AND birth_date = $2::date
         LIMIT 1`,
        [nicknameKey, birthDate]
      );

      const user = result.rows[0];
      if (!user) {
        return res.status(400).json({ error: "Não foi possível confirmar esses dados." });
      }

      const resetToken = crypto.randomBytes(24).toString("hex");
      recoveryTokens.set(resetToken, {
        userId: user.id,
        expiresAt: Date.now() + RESET_TOKEN_MAX_AGE_MS
      });

      return res.json({ ok: true, resetToken });
    } catch (error) {
      console.error("auth/recovery/verify", error);
      return res.status(400).json({ error: "Não foi possível confirmar esses dados." });
    }
  });

  app.post("/api/auth/recovery/reset", async (req, res) => {
    try {
      cleanupRecoveryTokens();
      const resetToken = String(req.body?.resetToken || "");
      const record = recoveryTokens.get(resetToken);
      if (!record || record.expiresAt <= Date.now()) {
        return res.status(400).json({ error: "A recuperação expirou. Comece novamente." });
      }

      const pass = validatePassword(req.body?.newPassword);
      if (!pass.ok) return res.status(400).json({ error: pass.error });

      const passwordHash = await hashPassword(pass.password);
      await db.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [
        passwordHash,
        record.userId
      ]);
      await db.query("DELETE FROM user_sessions WHERE user_id = $1", [record.userId]);
      recoveryTokens.delete(resetToken);

      return res.json({ ok: true });
    } catch (error) {
      console.error("auth/recovery/reset", error);
      return res.status(500).json({ error: "Não foi possível alterar a senha." });
    }
  });

  app.patch("/api/profile/nickname", async (req, res) => {
    try {
      const user = await getUserFromRequest(db, req);
      if (!user) return res.status(401).json({ error: "Entre na sua conta primeiro." });

      const nick = validateNickname(req.body?.nickname);
      if (!nick.ok) return res.status(400).json({ error: nick.error });

      const result = await db.query(
        `UPDATE users
         SET nickname = $1, nickname_key = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, nickname, nickname_key, avatar_type, avatar_id,
                   (profile_image IS NOT NULL) AS has_profile_image,
                   created_at, updated_at`,
        [nick.nickname, nick.key, user.id]
      );

      return res.json({ ok: true, user: publicUser(result.rows[0]) });
    } catch (error) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "Esse nickname já está sendo usado." });
      }
      console.error("profile/nickname", error);
      return res.status(500).json({ error: "Não foi possível alterar o nickname." });
    }
  });

  app.patch("/api/profile/password", async (req, res) => {
    try {
      const user = await getUserFromRequest(db, req);
      if (!user) return res.status(401).json({ error: "Entre na sua conta primeiro." });

      const currentPassword = String(req.body?.currentPassword || "");
      const valid = await verifyPassword(currentPassword, user.password_hash);
      if (!valid) return res.status(400).json({ error: "Sua senha atual está incorreta." });

      const pass = validatePassword(req.body?.newPassword);
      if (!pass.ok) return res.status(400).json({ error: pass.error });

      const passwordHash = await hashPassword(pass.password);
      await db.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [
        passwordHash,
        user.id
      ]);

      return res.json({ ok: true });
    } catch (error) {
      console.error("profile/password", error);
      return res.status(500).json({ error: "Não foi possível alterar sua senha." });
    }
  });

  app.patch("/api/profile/avatar", async (req, res) => {
    try {
      const user = await getUserFromRequest(db, req);
      if (!user) return res.status(401).json({ error: "Entre na sua conta primeiro." });

      const avatarId = String(req.body?.avatarId || "").trim().toLowerCase();
      const allowed = new Set(["cat", "dog", "fox", "bear", "panda", "frog", "penguin", "owl", "tiger", "pig"]);
      if (!allowed.has(avatarId)) {
        return res.status(400).json({ error: "Avatar inválido." });
      }

      const result = await db.query(
        `UPDATE users
         SET avatar_type = 'preset', avatar_id = $1,
             profile_image = NULL, profile_image_mime = NULL, updated_at = NOW()
         WHERE id = $2
         RETURNING id, nickname, nickname_key, avatar_type, avatar_id,
                   FALSE AS has_profile_image, created_at, updated_at`,
        [avatarId, user.id]
      );

      return res.json({ ok: true, user: publicUser(result.rows[0]) });
    } catch (error) {
      console.error("profile/avatar", error);
      return res.status(500).json({ error: "Não foi possível alterar o avatar." });
    }
  });

  app.post("/api/profile/photo", async (req, res) => {
    try {
      const user = await getUserFromRequest(db, req);
      if (!user) return res.status(401).json({ error: "Entre na sua conta primeiro." });

      const dataUrl = String(req.body?.imageData || "");
      const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) {
        return res.status(400).json({ error: "Use uma imagem JPG, PNG ou WEBP." });
      }

      const mime = match[1];
      const buffer = Buffer.from(match[2], "base64");
      if (!buffer.length || buffer.length > 2 * 1024 * 1024) {
        return res.status(400).json({ error: "A imagem pode ter no máximo 2 MB." });
      }

      const result = await db.query(
        `UPDATE users
         SET avatar_type = 'upload',
             profile_image = $1,
             profile_image_mime = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, nickname, nickname_key, avatar_type, avatar_id,
                   TRUE AS has_profile_image, created_at, updated_at`,
        [buffer, mime, user.id]
      );

      return res.json({ ok: true, user: publicUser(result.rows[0]) });
    } catch (error) {
      console.error("profile/photo", error);
      return res.status(500).json({ error: "Não foi possível enviar sua foto." });
    }
  });

  app.get("/api/profile/image/:id", async (req, res) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isInteger(userId) || userId <= 0) return res.sendStatus(404);

      const result = await db.query(
        `SELECT profile_image, profile_image_mime, updated_at
         FROM users
         WHERE id = $1 AND profile_image IS NOT NULL
         LIMIT 1`,
        [userId]
      );

      const row = result.rows[0];
      if (!row) return res.sendStatus(404);

      res.setHeader("Content-Type", row.profile_image_mime || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(row.profile_image);
    } catch (error) {
      console.error("profile/image", error);
      return res.sendStatus(404);
    }
  });

  // Preferências de partidas por jogo (funciona para jogos futuros também).
  // Nunca guardar senha de sala, token ou segredo nas preferências.
  function validGamePreferenceType(value) {
    return typeof value === "string" && /^[a-z][a-z0-9_-]{1,31}$/.test(value);
  }
  function cleanGamePreferences(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const serialized = JSON.stringify(value);
    if (serialized.length > 4096) return null;
    const unsafe = /(password|senha|token|secret|chave|cookie)/i;
    if (Object.keys(value).some(key => unsafe.test(key))) return null;
    if (Object.values(value).some(entry =>
      entry !== null && typeof entry !== "string" && typeof entry !== "number" && typeof entry !== "boolean"
    )) return null;
    return value;
  }

  app.get("/api/game-preferences/:gameType", async (req, res) => {
    try {
      const user = await getUserFromRequest(db, req);
      if (!user) return res.status(401).json({ error: "Faça login para sincronizar configurações." });
      if (!validGamePreferenceType(req.params.gameType)) return res.status(400).json({ error: "Jogo inválido." });
      const result = await db.query(
        "SELECT settings FROM user_game_preferences WHERE user_id = $1 AND game_type = $2",
        [user.id, req.params.gameType]
      );
      return res.json({ ok: true, settings: result.rows[0]?.settings || {} });
    } catch (error) {
      console.error("game-preferences GET", error);
      return res.status(500).json({ error: "Não foi possível buscar suas preferências." });
    }
  });

  app.put("/api/game-preferences/:gameType", async (req, res) => {
    try {
      const user = await getUserFromRequest(db, req);
      if (!user) return res.status(401).json({ error: "Faça login para salvar configurações." });
      if (!validGamePreferenceType(req.params.gameType)) return res.status(400).json({ error: "Jogo inválido." });
      const settings = cleanGamePreferences(req.body?.settings);
      if (!settings) return res.status(400).json({ error: "Configurações inválidas." });
      await db.query(
        `INSERT INTO user_game_preferences (user_id, game_type, settings)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (user_id, game_type)
         DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()`,
        [user.id, req.params.gameType, JSON.stringify(settings)]
      );
      return res.json({ ok: true });
    } catch (error) {
      console.error("game-preferences PUT", error);
      return res.status(500).json({ error: "Não foi possível salvar suas preferências." });
    }
  });

  app.get("/api/profile/stats", async (req, res) => {
    try {
      const user = await getUserFromRequest(db, req);
      if (!user) return res.status(401).json({ error: "Entre na sua conta primeiro." });
      return res.json({ ok: true, stats: await getStats(db, user.id) });
    } catch (error) {
      console.error("profile/stats", error);
      return res.status(500).json({ error: "Não foi possível carregar as estatísticas." });
    }
  });
}

async function recordMatch(db, room, {
  winnerUserId = null,
  winnerSide = null,
  resultReason = null,
  playerDetails = {}
} = {}) {
  const round = room.currentRound;
  if (!round?.id) return;

  try {
    const inserted = await db.query(
      `INSERT INTO match_history (
         round_key, game_type, room_code, started_at, finished_at,
         winner_user_id, winner_side, result_reason
       )
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7)
       ON CONFLICT (round_key) DO NOTHING
       RETURNING id`,
      [
        round.id,
        room.gameType,
        room.code,
        round.startedAt ? new Date(round.startedAt) : new Date(),
        winnerUserId,
        winnerSide,
        resultReason
      ]
    );

    let matchId = inserted.rows[0]?.id;
    if (!matchId) {
      const existing = await db.query("SELECT id FROM match_history WHERE round_key = $1", [round.id]);
      matchId = existing.rows[0]?.id;
    }
    if (!matchId) return;

    for (const player of room.players) {
      if (!player.userId) continue;
      const detail = playerDetails[player.token] || {};
      await db.query(
        `INSERT INTO match_players (
           match_id, user_id, game_type, won, role, eliminated,
           attempts_used, character_name
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (match_id, user_id) DO NOTHING`,
        [
          matchId,
          player.userId,
          room.gameType,
          Boolean(detail.won),
          detail.role || null,
          Boolean(detail.eliminated),
          Number.isFinite(Number(detail.attemptsUsed)) ? Number(detail.attemptsUsed) : null,
          detail.characterName || null
        ]
      );
    }

    return matchId;
  } catch (error) {
    console.error("Falha ao registrar estatísticas da partida:", error);
    return null;
  }
}

module.exports = {
  setupAuthRoutes,
  getUserFromRequest,
  getUserFromSocket,
  publicUser,
  avatarKeyForUser,
  recordMatch,
  normalizeNickname,
  validateNickname
};
