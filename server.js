const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");
const { makeRace } = require("./trivia-race");
const db = require("./db");
const { makeImageResolver } = require("./whoami-images");
const whoamiImageResolver = makeImageResolver();
const { bootstrapDatabase } = require("./scripts/bootstrap-db");
const { runMigrations } = require("./scripts/run-migrations");
const { loadQuizQuestions } = require("./scripts/load-quiz-questions");
const {
  setupAuthRoutes,
  getUserFromSocket,
  avatarKeyForUser,
  recordMatch
} = require("./auth");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = Number(process.env.PORT || 8080);
const RECONNECT_GRACE_MS = 30000;

app.set("trust proxy", 1);
app.use(express.json({ limit: "3mb" }));
setupAuthRoutes(app, db);
app.use(express.static(path.join(__dirname, "public")));
// SPA deep links: /impostor/ABCD, /quem-sou-eu/ABCD
app.get(/^\/(impostor|quem-sou-eu|corrida-do-conhecimento)(?:\/[A-Z0-9]{4})?\/?$/i,
  (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));


// Legacy links of the removed game do not expose an active room.
app.get(/^\/quiz-e-caos(?:\/[A-Z0-9]{4})?\/?$/i, (req, res) => res.redirect(302, "/"));

const rooms = new Map();
const disconnectTimers = new Map();
const ROOM_PASSWORD_MIN_LENGTH = 4;
const PRIVATE_JOIN_ATTEMPTS = new Map();
function roomSecret() { return crypto.randomBytes(32).toString("hex"); }
function makeRoomPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") };
}
function verifyRoomPassword(password, config) {
  if (!config) return true;
  if (typeof password !== "string") return false;
  const got = crypto.scryptSync(password, config.salt, 64);
  return crypto.timingSafeEqual(got, Buffer.from(config.hash, "hex"));
}
function privateJoinAllowed(socket, room, password) {
  if (!room.isPrivate) return { ok: true };
  const key = socket.handshake.address || socket.id;
  const now = Date.now();
  const recent = (PRIVATE_JOIN_ATTEMPTS.get(key) || []).filter(t => now - t < 60000);
  if (recent.length >= 8) return { ok: false, error: "Muitas tentativas. Aguarde um minuto para tentar novamente." };
  if (!verifyRoomPassword(password, room.passwordConfig)) {
    recent.push(now);
    PRIVATE_JOIN_ATTEMPTS.set(key, recent);
    return { ok: false, error: "Senha da sala incorreta.", passwordRequired: true };
  }
  PRIVATE_JOIN_ATTEMPTS.delete(key);
  return { ok: true };
}
function resolvePrivateSettings(isPrivate, roomPassword) {
  if (!isPrivate) return { isPrivate: false, passwordConfig: null };
  const password = String(roomPassword || "");
  if (password.length < ROOM_PASSWORD_MIN_LENGTH || password.length > 64)
    throw new Error("A senha da sala privada precisa ter entre 4 e 64 caracteres.");
  return { isPrivate: true, passwordConfig: makeRoomPassword(password) };
}
function spectatorChannel(code) { return `spectators:${code}`; }
function findParticipantByToken(token) {
  for (const room of rooms.values()) {
    const player = room.players.find(item => item.token === token);
    if (player) return { room, participant: player, role: "player" };
    const spectator = (room.spectators || []).find(item => item.token === token);
    if (spectator) return { room, participant: spectator, role: "spectator" };
  }
  return null;
}


function createRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;

  do {
    code = Array.from(
      { length: 4 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  } while (rooms.has(code));

  return code;
}

function sanitizeToken(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 120);
}

const AVATAR_IDS = new Set([
  "cat", "dog", "fox", "bear", "panda",
  "frog", "penguin", "owl", "tiger", "pig"
]);

function sanitizeAvatar(value) {
  const avatar = String(value || "").trim().toLowerCase();
  return AVATAR_IDS.has(avatar) ? avatar : "cat";
}

async function resolvePlayerIdentity(socket, requestedName, requestedAvatar) {
  const account = await getUserFromSocket(db, socket);

  if (account) {
    return {
      name: String(account.nickname || "Jogador").slice(0, 20),
      avatar: avatarKeyForUser(account),
      userId: Number(account.id),
      registered: true
    };
  }

  return {
    name: String(requestedName || "").trim().slice(0, 20),
    avatar: sanitizeAvatar(requestedAvatar),
    userId: null,
    registered: false
  };
}

function publicRoom(room) {
  const host = room.players.find(
    (player) => player.token === room.hostToken
  );

  return {
    code: room.code,
    gameType: room.gameType || "impostor",
    hostToken: room.hostToken,
    isPrivate: Boolean(room.isPrivate),
    spectatorCount: (room.spectators || []).filter(item => item.connected).length,
    hostName: host?.name || "Host",
    hostAvatar: host?.avatar || "cat",
    players: room.players.map((player) => ({
      token: player.token,
      id: player.socketId,
      name: player.name,
      avatar: player.avatar || "cat",
      registered: Boolean(player.userId),
      ready: Boolean(player.ready),
      connected: Boolean(player.connected),
      eliminated: Boolean(
        room.gameType === "impostor" &&
        room.currentRound &&
        isImpostorPlayerEliminated(room.currentRound, player.token)
      )
    })),
    playersCount: room.players.length,
    connectedCount: room.players.filter(
      (player) => player.connected
    ).length,
    readyCount: room.players.filter(
      (player) => player.ready
    ).length,
    allReady:
      (room.gameType === "trivia" ? room.players.length >= 2 : room.players.length >= 3) &&
      room.players.every(
        (player) => player.ready && player.connected
      ),
    started: room.started,
    roundPhase: room.currentRound?.phase || null,
    createdAt: room.createdAt,
    category: room.category,
    difficulty: room.difficulty,
    allFinish: room.gameType === "whoami" && Boolean(room.allFinish),
    triviaSettings: room.gameType === "trivia" ? room.triviaSettings : undefined
  };
}

function roomsList() {
  return Array.from(rooms.values())
    .map(publicRoom)
    .sort((a, b) => {
      if (a.started !== b.started) {
        return Number(a.started) - Number(b.started);
      }

      return b.createdAt - a.createdAt;
    });
}

function broadcastRooms() {
  io.emit("rooms-list", roomsList());
}

function updateRoom(code) {
  const room = rooms.get(code);

  if (room) {
    io.to(code).emit("room-updated", publicRoom(room));
    emitSpectatorState(room);
  }

  broadcastRooms();
}

function buildSpectatorState(room) {
  const round = room.currentRound || {};
  const gameType = room.gameType;
  const state = {
    code: room.code, gameType, started: Boolean(room.started),
    phase: round.phase || (room.started ? "partida" : "lobby"),
    players: room.players.map(p => ({
      token: p.token, name: p.name, avatar: p.avatar,
      connected: Boolean(p.connected),
      eliminated: gameType === "impostor" ? isImpostorPlayerEliminated(round, p.token) : Boolean(round.playerStates?.[p.token]?.eliminated),
          })),
    speakingOrder: (round.speakingOrder || []).map(p => ({ name: p.name, token: p.token })),
    spectatorCount: (room.spectators || []).filter(p => p.connected).length
  };
  if (gameType === "trivia") {
    const stateRace = triviaRace.stateFor(room);
    state.scores = stateRace ? room.players.map(p => ({token:p.token, score:stateRace.scores[p.token] || 0})) : [];
    state.roundNumber = stateRace?.roundNumber || 0;
    state.phase = stateRace?.phase || state.phase;
  } else if (gameType === "impostor") {
    state.voteCount = Object.keys(round.vote?.votes || {}).length;
    state.totalVoters = room.players.length;
    if (round.phase === "finished") state.winnerSide = round.winnerSide || null;
  } else if (gameType === "whoami") {
    state.attempts = room.players.map(p => ({
      name: p.name, attempts: Number(round.playerStates?.[p.token]?.attemptsUsed || 0),
      eliminated: Boolean(round.playerStates?.[p.token]?.eliminated),
      status: round.playerStates?.[p.token]?.status || "playing"
    }));
  }
  return state;
}
function emitSpectatorState(room) {
  if ((room.spectators || []).some(p => p.connected)) {
    io.to(spectatorChannel(room.code)).emit("spectator-state", buildSpectatorState(room));
  }
}
function promoteSpectators(room) {
  const maxPlayers = 99;
  for (const viewer of [...(room.spectators || [])]) {
    if (!viewer.connected || room.players.length >= maxPlayers) continue;
    if (room.players.some(p => p.name.toLowerCase() === viewer.name.toLowerCase())) continue;
    room.spectators = room.spectators.filter(p => p.token !== viewer.token);
    const player = { ...viewer, ready: false };
    room.players.push(player);
    const socket = io.sockets.sockets.get(viewer.socketId);
    if (socket) {
      socket.leave(spectatorChannel(room.code));
      socket.join(room.code);
      socket.data.role = "player";
      socket.emit("spectator-promoted", { room: publicRoom(room) });
    }
  }
}
function clearDisconnectTimer(token) {
  const timer = disconnectTimers.get(token);

  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(token);
  }
}

function findPlayerByToken(token) {
  for (const room of rooms.values()) {
    const player = room.players.find(
      (item) => item.token === token
    );

    if (player) {
      return { room, player };
    }
  }

  return null;
}

function resetReadyForRoom(room) {
  room.players.forEach((player) => {
    player.ready = false;
  });
}

function shuffleArray(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
}

function buildSpeakingOrder(room, players = room.players) {
  return shuffleArray(players).map((player, index) => ({
    token: player.token,
    name: player.name,
    avatar: player.avatar || "cat",
    position: index + 1
  }));
}

function getImpostorEliminatedTokens(round) {
  if (!Array.isArray(round?.eliminatedTokens)) {
    if (round) round.eliminatedTokens = [];
  }
  return round?.eliminatedTokens || [];
}

function isImpostorPlayerEliminated(round, token) {
  return getImpostorEliminatedTokens(round).includes(token);
}

function getImpostorActivePlayers(room) {
  const round = room.currentRound;
  if (!round) return [];
  return room.players.filter(
    (player) => !isImpostorPlayerEliminated(round, player.token)
  );
}

function buildImpostorStatuses(room) {
  const round = room.currentRound;
  return room.players.map((player) => ({
    token: player.token,
    eliminated: isImpostorPlayerEliminated(round, player.token)
  }));
}

function normalizeGuess(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const NAME_CONNECTORS = new Set([
  "de", "da", "do", "das", "dos", "e"
]);

function canonicalGuess(value) {
  return normalizeGuess(value)
    .split(" ")
    .filter((part) => part && !NAME_CONNECTORS.has(part))
    .join(" ");
}

function levenshteinDistance(a, b) {
  const left = String(a || "");
  const right = String(b || "");

  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }

    previous = current;
  }

  return previous[right.length];
}

function isOrderedSubset(guess, target) {
  const guessParts = canonicalGuess(guess).split(" ").filter(Boolean);
  const targetParts = canonicalGuess(target).split(" ").filter(Boolean);

  if (guessParts.length === 0 || guessParts.length >= targetParts.length) {
    return false;
  }

  let cursor = 0;
  for (const part of targetParts) {
    if (part === guessParts[cursor]) cursor += 1;
    if (cursor === guessParts.length) return true;
  }

  return false;
}

function classifyWhoAmIGuess(guess, character) {
  const cleanGuess = normalizeGuess(guess);
  const cleanTarget = normalizeGuess(character);
  const canonicalInput = canonicalGuess(guess);
  const canonicalTarget = canonicalGuess(character);

  if (!cleanGuess || !canonicalInput) {
    return { result: "invalid", reason: "empty" };
  }

  if (cleanGuess === cleanTarget || canonicalInput === canonicalTarget) {
    return { result: "correct", reason: "exact" };
  }

  if (isOrderedSubset(guess, character)) {
    return { result: "close", reason: "incomplete" };
  }

  const distance = levenshteinDistance(canonicalInput, canonicalTarget);
  const maxLength = Math.max(canonicalInput.length, canonicalTarget.length, 1);
  const similarity = 1 - distance / maxLength;
  const allowedDistance = maxLength <= 7 ? 1 : maxLength <= 16 ? 2 : 3;

  if (distance <= allowedDistance || similarity >= 0.88) {
    return { result: "close", reason: "spelling", similarity, distance };
  }

  return { result: "wrong", reason: "different", similarity, distance };
}

function impostorPublicPlayer(player) {
  return {
    token: player.token,
    name: player.name,
    avatar: player.avatar || "cat",
    registered: Boolean(player.userId),
    connected: Boolean(player.connected)
  };
}

function buildImpostorVotePayload(room) {
  const round = room.currentRound || {};
  const vote = round.vote || {};
  const candidateTokens = vote.candidateTokens || [];
  const candidates = candidateTokens
    .map((token) => room.players.find((player) => player.token === token))
    .filter(Boolean)
    .map(impostorPublicPlayer);

  return {
    phase: round.phase || "discussion",
    voteRound: Number(round.voteRound || 0),
    candidates,
    votedCount: Object.keys(vote.votes || {}).length,
    // Na partida única, todos os participantes votam até haver um desempate.
    totalVoters: room.players.length,
    tiebreak: Boolean(vote.tiebreak),
    speakingOrder: round.speakingOrder || [],
    eliminatedTokens: getImpostorEliminatedTokens(round)
  };
}

function buildImpostorFinishedPayload(room) {
  const round = room.currentRound || {};
  const selected = room.players.find((player) => player.token === round.votedOutToken);
  const impostor = room.players.find((player) => player.token === round.impostorToken);
  const winner = room.players.find((player) => player.token === round.winnerToken);

  const counts = Object.entries(round.lastVoteCounts || {})
    .map(([token, votes]) => {
      const player = room.players.find((item) => item.token === token);
      return player ? { ...impostorPublicPlayer(player), votes } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "pt-BR"));

  const impostorFound =
    round.resultReason === "impostor_descoberto" ||
    Boolean(selected && selected.token === round.impostorToken);
  const winnerSide = round.winnerSide || (impostorFound ? "investigadores" : "impostor");

  return {
    selected: selected ? impostorPublicPlayer(selected) : null,
    impostor: impostor ? impostorPublicPlayer(impostor) : null,
    winner: winner ? impostorPublicPlayer(winner) : null,
    impostorFound,
    winnerSide,
    resultReason: round.resultReason || (impostorFound ? "impostor_descoberto" : "acusacao_errada"),
    word: round.word,
    hint: round.hint,
    counts,
    voteRound: Number(round.voteRound || 0),
    eliminatedTokens: getImpostorEliminatedTokens(round)
  };
}

function finishImpostorRound(room, {
  winnerSide,
  resultReason,
  winnerToken = null,
  votedOutToken = null
}) {
  const round = room.currentRound;
  if (!round || round.phase === "finished") return;

  round.phase = "finished";
  round.vote = null;
  round.tiebreakCandidates = null;
  round.winnerSide = winnerSide;
  round.resultReason = resultReason;
  round.winnerToken = winnerToken;
  round.votedOutToken = votedOutToken;

  recordImpostorResult(room);
  io.to(room.code).emit("impostor-vote-finished", buildImpostorFinishedPayload(room));
  updateRoom(room.code);
}

function startImpostorVote(room, tiebreak = false) {
  const round = room.currentRound;
  const activePlayers = getImpostorActivePlayers(room);

  if (!tiebreak && activePlayers.length <= 1) {
    const lastPlayer = activePlayers[0] || null;
    finishImpostorRound(room, {
      winnerSide: lastPlayer?.token === round.impostorToken ? "impostor" : "investigadores",
      resultReason: "ultimo_restante",
      winnerToken: lastPlayer?.token || null,
      votedOutToken: round.votedOutToken || null
    });
    return;
  }

  const candidateTokens = tiebreak
    ? (round.tiebreakCandidates || []).filter((token) =>
        room.players.some((player) => player.token === token) &&
        !isImpostorPlayerEliminated(round, token)
      )
    : activePlayers.map((player) => player.token);

  round.phase = "voting";
  round.voteRound = Number(round.voteRound || 0) + 1;
  round.vote = {
    candidateTokens,
    votes: {},
    tiebreak
  };

  io.to(room.code).emit("impostor-vote-started", buildImpostorVotePayload(room));
  updateRoom(room.code);
}

function resolveImpostorVoteIfReady(room) {
  const round = room.currentRound;
  if (!round || round.phase !== "voting" || !round.vote) return;

  // Todos os participantes votam até que um candidato vença a apuração.
  // Ninguém é eliminado antes da conclusão dos desempates.
  const eligibleVoters = room.players.map((player) => player.token);
  const votes = round.vote.votes || {};
  const allVoted = eligibleVoters.every((token) => Boolean(votes[token]));

  if (!allVoted) {
    io.to(room.code).emit("impostor-vote-progress", {
      votedCount: Object.keys(votes).length,
      totalVoters: eligibleVoters.length
    });
    return;
  }

  const counts = {};
  for (const candidate of round.vote.candidateTokens || []) {
    counts[candidate] = 0;
  }

  Object.values(votes).forEach((candidate) => {
    if (Object.prototype.hasOwnProperty.call(counts, candidate)) {
      counts[candidate] += 1;
    }
  });

  const entries = Object.entries(counts);
  const maxVotes = entries.length
    ? Math.max(...entries.map(([, count]) => count))
    : 0;
  const tiedTokens = entries
    .filter(([, count]) => count === maxVotes)
    .map(([token]) => token);

  round.lastVoteCounts = counts;
  round.vote = null;

  if (tiedTokens.length > 1) {
    round.phase = "tiebreak";
    round.tiebreakCandidates = tiedTokens;
    const tiedPlayers = tiedTokens
      .map((token) => room.players.find((player) => player.token === token))
      .filter(Boolean);
    round.speakingOrder = buildSpeakingOrder(room, tiedPlayers);

    io.to(room.code).emit("impostor-tiebreak-started", {
      candidates: tiedPlayers.map(impostorPublicPlayer),
      speakingOrder: round.speakingOrder,
      statuses: buildImpostorStatuses(room),
      voteRound: Number(round.voteRound || 0)
    });
    updateRoom(room.code);
    return;
  }

  const selectedToken = tiedTokens[0] || null;
  const selectedPlayer = room.players.find((player) => player.token === selectedToken);

  if (!selectedToken || !selectedPlayer) {
    return;
  }

  // Regra de partida única: após o desempate (se houver), o primeiro
  // participante escolhido encerra a partida, independentemente do papel.
  // A fase de discussão só pode voltar a acontecer em caso de EMPATE.
  const eliminatedTokens = getImpostorEliminatedTokens(round);
  if (!eliminatedTokens.includes(selectedToken)) {
    eliminatedTokens.push(selectedToken);
  }

  const foundImpostor = selectedToken === round.impostorToken;
  finishImpostorRound(room, {
    winnerSide: foundImpostor ? "investigadores" : "impostor",
    resultReason: foundImpostor ? "impostor_descoberto" : "acusacao_errada",
    winnerToken: foundImpostor ? null : round.impostorToken,
    votedOutToken: selectedToken
  });
}

function permanentlyRemovePlayer(room, token) {
  const leavingPlayer = room.players.find(
    (player) => player.token === token
  );

  const wasHost = room.hostToken === token;

  room.players = room.players.filter(
    (player) => player.token !== token
  );

  clearDisconnectTimer(token);

  if (room.players.length === 0) {
    closeRoomForEveryone(room, "Sala encerrada: todos os jogadores saíram.");
    return;
  }

  let newHost = null;

  if (wasHost) {
    newHost =
      room.players.find((player) => player.connected) ||
      room.players[0];

    room.hostToken = newHost.token;
  }

  resetReadyForRoom(room);
  if (room.gameType === "trivia") triviaRace.onPlayerRemoved(room, token);

  if (room.gameType === "whoami" && room.currentRound) {
    const round = room.currentRound;
    if (round.allFinish && round.phase === "playing") {
      const state = round.playerStates?.[token];
      if (state && !state.eliminated) {
        state.status = "abandoned";
        state.eliminated = true;
      }
    } else if (!round.allFinish) {
      delete round.assignments?.[token];
      delete round.assignmentIds?.[token];
      delete round.assignmentImages?.[token];
      delete round.playerStates?.[token];
    }
    round.speakingOrder = (round.speakingOrder || []).filter(
      (item) => item.token !== token
    ).map((item, index) => ({ ...item, position: index + 1 }));
  }

  if (room.gameType === "whoami" && room.currentRound?.allFinish && room.currentRound?.phase === "playing") {
    broadcastWhoAmIStatuses(room);
    finishWhoAmIIfReady(room);
  }

  if (
    room.gameType === "whoami" &&
    room.currentRound?.phase === "review"
  ) {
    const round = room.currentRound;

    // Como a composição da sala mudou, a conferência recomeça
    // para os jogadores restantes, sem trocar os personagens.
    round.reviewVotes = {};
    round.approvedTargets = {};
  }

  

  if (room.gameType === "impostor" && room.currentRound) {
    const round = room.currentRound;
    round.speakingOrder = (round.speakingOrder || [])
      .filter((item) => item.token !== token)
      .map((item, index) => ({ ...item, position: index + 1 }));

    if (round.vote) {
      delete round.vote.votes?.[token];
      round.vote.candidateTokens = (round.vote.candidateTokens || [])
        .filter((candidateToken) => candidateToken !== token);

      Object.entries(round.vote.votes || {}).forEach(([voterToken, candidateToken]) => {
        if (candidateToken === token) {
          delete round.vote.votes[voterToken];
        }
      });
    }

    round.tiebreakCandidates = (round.tiebreakCandidates || [])
      .filter((candidateToken) => candidateToken !== token);
    round.eliminatedTokens = getImpostorEliminatedTokens(round)
      .filter((eliminatedToken) => eliminatedToken !== token);
  }

  updateRoom(room.code);

  if (room.gameType === "impostor" && room.currentRound?.phase === "voting") {
    resolveImpostorVoteIfReady(room);
  }

  if (
    room.gameType === "whoami" &&
    room.currentRound?.phase === "review"
  ) {
    sendWhoAmIReviewStateToAll(
      room,
      "whoami-review-updated"
    );
  }

  if (wasHost && newHost) {
    io.to(room.code).emit("host-transferred", {
      oldHostName: leavingPlayer?.name || "Host anterior",
      newHostName: newHost.name,
      newHostToken: newHost.token
    });
  }
}

function scheduleDisconnectRemoval(room, player) {
  clearDisconnectTimer(player.token);

  const timer = setTimeout(() => {
    const current = findPlayerByToken(player.token);

    if (!current) {
      disconnectTimers.delete(player.token);
      return;
    }

    if (current.player.connected) {
      disconnectTimers.delete(player.token);
      return;
    }

    permanentlyRemovePlayer(
      current.room,
      current.player.token
    );
  }, RECONNECT_GRACE_MS);

  disconnectTimers.set(player.token, timer);
}

async function resolveRoomSettings(categoryId, difficultyId) {
  const settings = {
    category: {
      id: null,
      name: "Todas",
      emoji: "🎲"
    },
    difficulty: {
      id: null,
      name: "Aleatória"
    }
  };

  if (categoryId && categoryId !== "all") {
    const result = await db.query(
      `SELECT id, name, emoji
       FROM categories
       WHERE id = $1 AND active = TRUE`,
      [Number(categoryId)]
    );

    if (result.rowCount === 0) {
      throw new Error("Categoria inválida.");
    }

    settings.category = result.rows[0];
  }

  if (difficultyId && difficultyId !== "all") {
    const result = await db.query(
      `SELECT id, name
       FROM difficulties
       WHERE id = $1`,
      [Number(difficultyId)]
    );

    if (result.rowCount === 0) {
      throw new Error("Dificuldade inválida.");
    }

    settings.difficulty = result.rows[0];
  }

  return settings;
}


async function resolveWhoAmISettings(categoryId, difficultyId) {
  const settings = {
    category: {
      id: null,
      name: "Todas",
      emoji: "🎲"
    },
    difficulty: {
      id: null,
      name: "Aleatória"
    }
  };

  if (categoryId && categoryId !== "all") {
    const result = await db.query(
      `SELECT id, name, emoji
       FROM character_categories
       WHERE id = $1 AND active = TRUE`,
      [Number(categoryId)]
    );

    if (result.rowCount === 0) {
      throw new Error("Categoria inválida.");
    }

    settings.category = result.rows[0];
  }

  if (difficultyId && difficultyId !== "all") {
    const result = await db.query(
      `SELECT id, name
       FROM difficulties
       WHERE id = $1`,
      [Number(difficultyId)]
    );

    if (result.rowCount === 0) {
      throw new Error("Dificuldade inválida.");
    }

    settings.difficulty = result.rows[0];
  }

  return settings;
}

async function getRandomCharacters(room, quantity) {
  const where = ["ch.active = TRUE"];
  const params = [];

  if (room.category.id) {
    params.push(room.category.id);
    where.push(`ch.category_id = $${params.length}`);
  }

  if (room.difficulty.id) {
    params.push(room.difficulty.id);
    where.push(`ch.difficulty_id = $${params.length}`);
  }

  params.push(quantity);

  const result = await db.query(
    `
      SELECT
        ch.id,
        ch.name,
        ch.image_url,
        cc.name AS category_name,
        cc.emoji AS category_emoji,
        d.name AS difficulty_name
      FROM characters ch
      JOIN character_categories cc
        ON cc.id = ch.category_id
      JOIN difficulties d
        ON d.id = ch.difficulty_id
      WHERE ${where.join(" AND ")}
      ORDER BY RANDOM()
      LIMIT $${params.length}
    `,
    params
  );

  if (result.rowCount < quantity) {
    return null;
  }

  const ids = result.rows.map((row) => row.id);

  await db.query(
    `UPDATE characters
     SET times_used = times_used + 1
     WHERE id = ANY($1::bigint[])`,
    [ids]
  );

  return result.rows;
}


async function getRandomCharacterExcluding(room, excludedIds = []) {
  const where = ["ch.active = TRUE"];
  const params = [];

  if (room.category.id) {
    params.push(room.category.id);
    where.push(`ch.category_id = $${params.length}`);
  }

  if (room.difficulty.id) {
    params.push(room.difficulty.id);
    where.push(`ch.difficulty_id = $${params.length}`);
  }

  if (excludedIds.length > 0) {
    params.push(excludedIds);
    where.push(`NOT (ch.id = ANY($${params.length}::bigint[]))`);
  }

  const result = await db.query(
    `
      SELECT
        ch.id,
        ch.name,
        ch.image_url,
        cc.name AS category_name,
        d.name AS difficulty_name
      FROM characters ch
      JOIN character_categories cc
        ON cc.id = ch.category_id
      JOIN difficulties d
        ON d.id = ch.difficulty_id
      WHERE ${where.join(" AND ")}
      ORDER BY RANDOM()
      LIMIT 1
    `,
    params
  );

  if (result.rowCount === 0) {
    return null;
  }

  const selected = result.rows[0];

  await db.query(
    `UPDATE characters
     SET times_used = times_used + 1
     WHERE id = $1`,
    [selected.id]
  );

  return selected;
}

function getWhoAmIEligibleVoters(room, targetToken) {
  return room.players.filter(
    (player) => player.token !== targetToken
  );
}

function getWhoAmITargetReview(room, targetToken) {
  const round = room.currentRound;
  const votes = round.reviewVotes[targetToken] || {};
  const eligible = getWhoAmIEligibleVoters(
    room,
    targetToken
  );

  const approveCount = eligible.filter(
    (player) => votes[player.token] === "approve"
  ).length;

  const rerollCount = eligible.filter(
    (player) => votes[player.token] === "reroll"
  ).length;

  return {
    eligible,
    votes,
    approveCount,
    rerollCount,
    eligibleCount: eligible.length,
    approved: Boolean(
      round.approvedTargets[targetToken]
    )
  };
}

function buildWhoAmIReviewState(room, viewerToken) {
  const round = room.currentRound;

  const cards = room.players
    .filter((player) => player.token !== viewerToken)
    .map((target) => {
      const review = getWhoAmITargetReview(
        room,
        target.token
      );

      return {
        targetToken: target.token,
        name: target.name,
        avatar: target.avatar || "cat",
        character: round.assignments[target.token],
        imageUrl: round.assignmentImages?.[target.token] || null,
        viewerVote:
          review.votes[viewerToken] || null,
        approveCount: review.approveCount,
        rerollCount: review.rerollCount,
        eligibleCount: review.eligibleCount,
        approved: review.approved
      };
    });

  const selfReview = getWhoAmITargetReview(
    room,
    viewerToken
  );

  const approvedCount = room.players.filter(
    (player) =>
      Boolean(round.approvedTargets[player.token])
  ).length;

  return {
    code: room.code,
    phase: round.phase,
    cards,
    self: {
      approved: selfReview.approved,
      approveCount: selfReview.approveCount,
      rerollCount: selfReview.rerollCount,
      eligibleCount: selfReview.eligibleCount
    },
    approvedCount,
    totalCount: room.players.length,
    category: round.category,
    difficulty: round.difficulty
  };
}

function sendWhoAmIReviewState(
  room,
  player,
  eventName = "whoami-review-updated",
  resumed = false
) {
  if (!player.connected || !player.socketId) {
    return;
  }

  const payload = buildWhoAmIReviewState(
    room,
    player.token
  );

  io.to(player.socketId).emit(eventName, {
    ...payload,
    resumed
  });
}

function sendWhoAmIReviewStateToAll(
  room,
  eventName = "whoami-review-updated",
  resumed = false
) {
  room.players.forEach((player) => {
    sendWhoAmIReviewState(
      room,
      player,
      eventName,
      resumed
    );
  });
}

function whoAmIParticipants(room) {
  // Mantém o histórico da rodada, inclusive quem saiu depois de jogar.
  return room.currentRound?.allFinish
    ? (room.currentRound.participants || room.players)
    : room.players;
}

function whoAmIProgress(room) {
  const round = room.currentRound;
  return (whoAmIParticipants(room) || []).map(player => ({
    ...player,
    state: round?.playerStates?.[player.token] || {}
  }));
}

// Cada palpite válido é um acontecimento público da partida.
// O evento vai para os jogadores E para o canal separado dos espectadores;
// não envia a resposta secreta nem dados de autenticação.
function broadcastWhoAmIGuess(room, player, guess, result, details = {}) {
  const round = room.currentRound;
  if (!round) return;
  round.guessEventIndex = (round.guessEventIndex || 0) + 1;
  const event = {
    code: room.code,
    roundId: round.id,
    eventIndex: round.guessEventIndex,
    playerName: player.name,
    avatar: player.avatar || "cat",
    guess: String(guess || "").trim().slice(0, 120),
    result,
    allFinish: Boolean(round.allFinish),
    attemptsLeft: details.attemptsLeft == null ? null : Number(details.attemptsLeft),
    eliminated: Boolean(details.eliminated),
    placement: details.placement == null ? null : Number(details.placement)
  };
  io.to(room.code).emit("whoami-guess-announced", event);
  io.to(spectatorChannel(room.code)).emit("whoami-guess-announced", event);
}

function finishWhoAmIIfReady(room) {
  const round = room.currentRound;
  if (!round || round.phase !== "playing") return false;
  const participants = whoAmIProgress(room);
  if (!participants.length || participants.some(player => !player.state.eliminated)) return false;
  round.phase = "finished";
  const first = participants.find(player => player.state.placement === 1);
  round.winnerToken = first?.token || null;
  recordWhoAmIResult(room);
  io.to(room.code).emit("whoami-game-finished", buildWhoAmIFinishedPayload(room));
  updateRoom(room.code);
  return true;
}

function buildWhoAmIStatusState(room) {
  const round = room.currentRound;

  return whoAmIParticipants(room).map((player) => {
    const state = round.playerStates?.[player.token] || {};

    return {
      token: player.token,
      name: player.name,
      avatar: player.avatar || "cat",
      status: state.status || (state.eliminated ? "out_of_attempts" : "playing"),
      placement: state.placement || null,
      attemptsUsed: Number(state.attemptsUsed || 0),
      attemptsLeft: Math.max(0, 3 - Number(state.attemptsUsed || 0)),
      eliminated: Boolean(state.eliminated),
      winner: round.winnerToken === player.token
    };
  });
}

function buildWhoAmIGamePayload(room, player) {
  const round = room.currentRound;

  const others = room.players
    .filter((item) => item.token !== player.token)
    .map((item) => ({
      token: item.token,
      name: item.name,
      avatar: item.avatar || "cat",
      character: round.assignments[item.token],
      imageUrl: round.assignmentImages?.[item.token] || null,
      eliminated: Boolean(round.playerStates?.[item.token]?.eliminated)
    }));

  const selfState = round.playerStates?.[player.token] || {};

  return {
    others,
    category: round.category,
    difficulty: round.difficulty,
    speakingOrder: round.speakingOrder || [],
    statuses: buildWhoAmIStatusState(room),
    attemptsUsed: Number(selfState.attemptsUsed || 0),
    attemptsLeft: Math.max(0, 3 - Number(selfState.attemptsUsed || 0)),
    eliminated: Boolean(selfState.eliminated),
    allFinish: Boolean(round.allFinish),
    selfStatus: selfState.status || "playing",
    selfPlacement: selfState.placement || null,
    selfCharacter: selfState.eliminated
      ? round.assignments[player.token]
      : null,
    selfImageUrl: selfState.eliminated
      ? (round.assignmentImages?.[player.token] || null)
      : null,
    roundId: round.id
  };
}

function buildWhoAmIFinishedPayload(room) {
  const round = room.currentRound;
  const participants = whoAmIParticipants(room);
  const winner = participants.find(player => player.token === round.winnerToken);
  const results = participants.map(player => {
    const state = round.playerStates?.[player.token] || {};
    return {
      token: player.token,
      name: player.name,
      avatar: player.avatar || "cat",
      character: round.assignments?.[player.token] || null,
      imageUrl: round.assignmentImages?.[player.token] || null,
      eliminated: Boolean(state.eliminated),
      winner: player.token === round.winnerToken,
      status: state.status || (state.eliminated ? "out_of_attempts" : "playing"),
      placement: state.placement || null,
      attemptsUsed: Number(state.attemptsUsed || 0)
    };
  });
  return {
    allFinish: Boolean(round.allFinish),
    winner: winner ? {
      token: winner.token, name: winner.name,
      avatar: winner.avatar || "cat", character: round.assignments[winner.token],
      imageUrl: round.assignmentImages?.[winner.token] || null
    } : null,
    results,
    roundId: round.id
  };
}

function recordWhoAmIResult(room) {
  const round = room.currentRound;
  if (!round?.id || round.statsRecorded) return;
  round.statsRecorded = true;
  const participants = whoAmIParticipants(room);
  const winner = participants.find(player => player.token === round.winnerToken);
  const playerDetails = {};
  participants.forEach(player => {
    const state = round.playerStates?.[player.token] || {};
    playerDetails[player.token] = {
      won: player.token === round.winnerToken,
      role: state.status === "correct" ? "acertou" : (state.status || "jogador"),
      eliminated: state.status !== "correct" && Boolean(state.eliminated),
      attemptsUsed: Number(state.attemptsUsed || 0),
      characterName: round.assignments?.[player.token] || null
    };
  });
  recordMatch(db, { ...room, players: participants }, {
    winnerUserId: winner?.userId || null,
    winnerSide: winner ? "jogador" : null,
    resultReason: round.allFinish ? "todos_ate_o_fim" : (winner ? "acerto" : "todos_eliminados"),
    playerDetails
  }).catch(error => console.error(error));
}

function recordImpostorResult(room) {
  const round = room.currentRound;
  if (!round?.id || round.statsRecorded) return;
  round.statsRecorded = true;

  const winnerSide = round.winnerSide ||
    (round.votedOutToken === round.impostorToken ? "investigadores" : "impostor");
  const impostorWon = winnerSide === "impostor";
  const impostor = room.players.find((player) => player.token === round.impostorToken);
  const winner = room.players.find((player) => player.token === round.winnerToken);
  const eliminatedTokens = getImpostorEliminatedTokens(round);
  const playerDetails = {};

  room.players.forEach((player) => {
    const isImpostor = player.token === round.impostorToken;
    playerDetails[player.token] = {
      role: isImpostor ? "impostor" : "investigador",
      won: isImpostor ? impostorWon : !impostorWon,
      eliminated: eliminatedTokens.includes(player.token) ||
        (round.resultReason === "impostor_descoberto" && isImpostor)
    };
  });

  recordMatch(db, room, {
    winnerUserId: impostorWon
      ? (winner?.userId || impostor?.userId || null)
      : null,
    winnerSide,
    resultReason: round.resultReason ||
      (winnerSide === "investigadores" ? "impostor_descoberto" : "acusacao_errada"),
    playerDetails
  }).catch((error) => console.error(error));
}

function broadcastWhoAmIStatuses(room) {
  io.to(room.code).emit("whoami-status-updated", {
    statuses: buildWhoAmIStatusState(room)
  });
}

function allWhoAmITargetsApproved(room) {
  return room.players.every(
    (player) =>
      Boolean(
        room.currentRound.approvedTargets[player.token]
      )
  );
}

function launchWhoAmIGame(room) {
  room.currentRound.phase = "playing";

  room.players.forEach((player) => {
    if (!player.connected || !player.socketId) {
      return;
    }

    io.to(player.socketId).emit(
      "whoami-review-complete",
      buildWhoAmIGamePayload(room, player)
    );
  });

  updateRoom(room.code);
}

async function getRandomWord(room) {
  const where = ["w.active = TRUE"];
  const params = [];

  if (room.category.id) {
    params.push(room.category.id);
    where.push(`w.category_id = $${params.length}`);
  }

  if (room.difficulty.id) {
    params.push(room.difficulty.id);
    where.push(`w.difficulty_id = $${params.length}`);
  }

  const result = await db.query(
    `
      SELECT
        w.id,
        w.word,
        w.hint,
        c.name AS category_name,
        c.emoji AS category_emoji,
        d.name AS difficulty_name
      FROM words w
      JOIN categories c ON c.id = w.category_id
      JOIN difficulties d ON d.id = w.difficulty_id
      WHERE ${where.join(" AND ")}
      ORDER BY RANDOM()
      LIMIT 1
    `,
    params
  );

  if (result.rowCount === 0) {
    return null;
  }

  const selected = result.rows[0];

  await db.query(
    "UPDATE words SET times_used = times_used + 1 WHERE id = $1",
    [selected.id]
  );

  return selected;
}


function sendCurrentGameState(room, player) {
  if (!room.started || !room.currentRound) {
    return;
  }

  const round = room.currentRound;

  if (room.gameType === "trivia") {
    triviaRace.sendCurrent(room, player);
    return;
  }
  if (room.gameType === "whoami") {
    if (round.phase === "finished") {
      io.to(player.socketId).emit(
        "whoami-game-finished",
        {
          ...buildWhoAmIFinishedPayload(room),
          resumed: true
        }
      );
      return;
    }

    if (round.phase === "review") {
      sendWhoAmIReviewState(
        room,
        player,
        "whoami-review-started",
        true
      );
      return;
    }

    io.to(player.socketId).emit(
      "whoami-game-started",
      {
        ...buildWhoAmIGamePayload(room, player),
        resumed: true
      }
    );

    return;
  }

  const basePayload = {
    category: round.category,
    difficulty: round.difficulty,
    speakingOrder: round.speakingOrder || [],
    statuses: buildImpostorStatuses(room),
    phase: round.phase || "discussion",
    resumed: true
  };

  if (player.token === round.impostorToken) {
    io.to(player.socketId).emit("game-started", {
      ...basePayload,
      role: "impostor",
      hint: round.hint
    });
  } else {
    io.to(player.socketId).emit("game-started", {
      ...basePayload,
      role: "civil",
      word: round.word
    });
  }

  if (round.phase === "voting") {
    io.to(player.socketId).emit("impostor-vote-started", {
      ...buildImpostorVotePayload(room),
      resumed: true,
      alreadyVoted: Boolean(round.vote?.votes?.[player.token])
    });
  } else if (round.phase === "tiebreak") {
    const candidates = (round.tiebreakCandidates || [])
      .map((token) => room.players.find((item) => item.token === token))
      .filter(Boolean)
      .map(impostorPublicPlayer);

    io.to(player.socketId).emit("impostor-tiebreak-started", {
      candidates,
      speakingOrder: round.speakingOrder || [],
      statuses: buildImpostorStatuses(room),
      voteRound: Number(round.voteRound || 0),
      resumed: true
    });
  } else if (round.phase === "finished") {
    io.to(player.socketId).emit(
      "impostor-vote-finished",
      { ...buildImpostorFinishedPayload(room), resumed: true }
    );
  }
}

function removeSpectator(room, token) {
  clearDisconnectTimer(token);
  room.spectators = (room.spectators || []).filter(p => p.token !== token);
  updateRoom(room.code);
}
function bindPlayerToSocket(room, player, socket, role = "player") {
  clearDisconnectTimer(player.token);
  if (player.socketId && player.socketId !== socket.id) {
    const previous = io.sockets.sockets.get(player.socketId);
    if (previous) {
      previous.leave(room.code);
      previous.leave(spectatorChannel(room.code));
      previous.data.playerToken = null;
      previous.data.roomCode = null;
      previous.data.role = null;
      previous.emit("session-transferred", { reason: "Sessão restaurada em outra aba." });
    }
  }

  player.socketId = socket.id;
  player.connected = true;

  socket.join(role === "spectator" ? spectatorChannel(room.code) : room.code);
  socket.data.roomCode = room.code;
  socket.data.playerToken = player.token;
  socket.data.role = role;

  updateRoom(room.code);
}

function leaveCurrentRoomImmediately(socket) {
  const token = socket.data.playerToken;

  if (!token) {
    return;
  }

  const found = findParticipantByToken(token);
  if (found && found.participant.socketId === socket.id) {
    socket.leave(found.role === "spectator" ? spectatorChannel(found.room.code) : found.room.code);
    if (found.role === "spectator") removeSpectator(found.room, token);
    else permanentlyRemovePlayer(found.room, token);
  }
  socket.data.roomCode = null;
  socket.data.playerToken = null;
  socket.data.role = null;
}


function closeRoomForEveryone(room, reason = "Sala encerrada pelo host.") {
  if (room.gameType === "trivia") triviaRace.cleanup(room.code);
  room.players.concat(room.spectators || []).forEach((player) => {
    clearDisconnectTimer(player.token);
  });
  io.to(spectatorChannel(room.code)).emit("room-closed", {
    code: room.code, gameType: room.gameType || "impostor", reason
  });

  io.to(room.code).emit("room-closed", {
    code: room.code,
    gameType: room.gameType || "impostor",
    reason
  });

  room.players.concat(room.spectators || []).forEach((player) => {
    if (!player.socketId) {
      return;
    }

    const playerSocket =
      io.sockets.sockets.get(player.socketId);

    if (playerSocket) {
      playerSocket.leave(room.code);
      playerSocket.leave(spectatorChannel(room.code));
      playerSocket.data.roomCode = null;
      playerSocket.data.playerToken = null;
      playerSocket.data.role = null;
    }
  });

  rooms.delete(room.code);
  broadcastRooms();
}

/* ---------------- API ---------------- */

app.get("/api/game-config", async (req, res) => {
  try {
    const [categories, difficulties, count] = await Promise.all([
      db.query(
        `SELECT id, name, slug, emoji
         FROM categories
         WHERE active = TRUE
         ORDER BY display_order, name`
      ),
      db.query(
        `SELECT id, name, slug, level
         FROM difficulties
         ORDER BY level`
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
         FROM words
         WHERE active = TRUE`
      )
    ]);

    res.json({
      categories: categories.rows,
      difficulties: difficulties.rows,
      totalWords: count.rows[0].total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Não foi possível carregar as configurações."
    });
  }
});


app.get("/api/whoami-config", async (req, res) => {
  try {
    const [categories, difficulties, count] = await Promise.all([
      db.query(
        `SELECT id, name, slug, emoji
         FROM character_categories
         WHERE active = TRUE
         ORDER BY display_order, name`
      ),
      db.query(
        `SELECT id, name, slug, level
         FROM difficulties
         ORDER BY level`
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
         FROM characters
         WHERE active = TRUE`
      )
    ]);

    res.json({
      categories: categories.rows,
      difficulties: difficulties.rows,
      totalCharacters: count.rows[0].total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Não foi possível carregar os personagens."
    });
  }
});

// Fotos de personagens: consulta validada no cadastro, sem expor chaves privadas.
// As respostas não contêm nomes de outros personagens ou dados de partidas.
const imageLookupsByIp = new Map();
app.get("/api/whoami-image", async (req, res) => {
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  if (name.length < 2 || name.length > 120) return res.status(400).json({ error: "Nome inválido." });
  const ip = req.ip || "unknown";
  const now = Date.now();
  const attempts = (imageLookupsByIp.get(ip) || []).filter(time => now - time < 60_000);
  if (attempts.length >= 50) return res.status(429).json({ error: "Aguarde para buscar mais fotos." });
  attempts.push(now);
  imageLookupsByIp.set(ip, attempts);
  if (imageLookupsByIp.size > 2000) imageLookupsByIp.clear();
  try {
    const record = await db.query(
      `SELECT ch.name, ch.image_url, cc.slug AS category
         FROM characters ch
         JOIN character_categories cc ON cc.id = ch.category_id
        WHERE LOWER(ch.name) = LOWER($1) AND ch.active = TRUE
        LIMIT 1`, [name]
    );
    if (!record.rowCount) return res.status(404).json({ imageUrl: null, source: null });
    const character = record.rows[0];
    // O image_url do acervo é uma fonte manual aprovada e tem precedência.
    const manual = String(character.image_url || "").trim();
    if (manual) {
      try {
        const url = new URL(manual);
        if (url.protocol === "https:" && !url.username && !url.password) {
          return res.json({ imageUrl: url.href, source: "acervo", sourceUrl: null });
        }
      } catch { /* Imagem inválida: tentar provedores. */ }
    }
    const result = await whoamiImageResolver.lookup(character.name, character.category);
    return res.json(result || { imageUrl: null, source: null, sourceUrl: null });
  } catch (error) {
    console.error("whoami image lookup:", error.message);
    return res.status(503).json({ imageUrl: null, source: null, error: "Foto indisponível." });
  }
});

app.get("/api/rooms", (req, res) => {
  res.json({
    rooms: roomsList()
  });
});

const triviaRace = makeRace({ app, io, rooms, publicRoom, updateRoom, createRoomCode,
  resolvePlayerIdentity, sanitizeToken, roomSecret, resolvePrivateSettings,
  leaveCurrentRoomImmediately, findParticipantByToken, resetReadyForRoom, promoteSpectators });

/* ---------------- SOCKETS ---------------- */

io.on("connection", (socket) => {
  triviaRace.registerSocket(socket);
  console.log("Jogador conectado:", socket.id);

  socket.emit("rooms-list", roomsList());

  socket.on("resume-session", (
    { playerToken, roomCode, sessionSecret },
    callback
  ) => {
    const token = sanitizeToken(playerToken);
    const code = String(roomCode || "")
      .trim()
      .toUpperCase();

    if (!token || !code) {
      return callback({
        ok: false,
        error: "Sessão incompleta."
      });
    }

    const room = rooms.get(code);

    if (!room) {
      return callback({
        ok: false,
        error: "A sala não existe mais."
      });
    }

    const found = findParticipantByToken(token);
    if (!found || found.room !== room || !sessionSecret || found.participant.sessionSecret !== sessionSecret) {
      return callback({ ok: false, error: "Sessão inválida ou expirada." });
    }
    const player = found.participant;
    bindPlayerToSocket(room, player, socket, found.role);
    callback({
      ok: true, room: publicRoom(room), playerToken: player.token,
      sessionSecret: player.sessionSecret, spectator: found.role === "spectator", started: room.started
    });
    if (found.role === "spectator") {
      socket.emit("spectator-state", buildSpectatorState(room));
    } else if (room.started) {
      sendCurrentGameState(room, player);
    }
  });

  socket.on("abandon-session", (
    { playerToken, roomCode, sessionSecret },
    callback
  ) => {
    const token = sanitizeToken(playerToken);
    const code = String(roomCode || "")
      .trim()
      .toUpperCase();

    const room = rooms.get(code);

    if (room && token) {
      const found = findParticipantByToken(token);
      if (found && found.room === room && (found.participant.sessionSecret === sessionSecret || socket.data.playerToken === token)) {
        if (found.role === "spectator") removeSpectator(room, token);
        else permanentlyRemovePlayer(room, token);
      }
    }

    if (typeof callback === "function") {
      callback({ ok: true });
    }
  });

  socket.on("room-preview", ({ code, gameType }, callback) => {
    const room = rooms.get(String(code || "").trim().toUpperCase());
    if (!room || (gameType && room.gameType !== gameType))
      return callback({ ok: false, error: "Sala não encontrada." });
    callback({ ok: true, room: { code: room.code, gameType: room.gameType,
      isPrivate: Boolean(room.isPrivate), started: Boolean(room.started),
      hostName: room.players.find(p => p.token === room.hostToken)?.name || "Host" } });
  });
  socket.on("spectator-get-state", ({ code }, callback) => {
    const room = rooms.get(String(code || "").trim().toUpperCase());
    if (!room || socket.data.roomCode !== room.code || socket.data.role !== "spectator")
      return callback({ ok: false, error: "Acesso negado." });
    callback({ ok: true, state: buildSpectatorState(room) });
  });
  socket.on("get-rooms", (callback) => {
    if (typeof callback === "function") {
      callback({
        ok: true,
        rooms: roomsList()
      });
    }
  });

  socket.on("create-room", async (
    {
      name,
      categoryId,
      difficultyId,
      playerToken,
      avatar, isPrivate, roomPassword
    },
    callback
  ) => {
    try {
      const identity = await resolvePlayerIdentity(socket, name, avatar);
      const playerName = identity.name;
      const token = sanitizeToken(playerToken);
      const playerAvatar = identity.avatar;

      if (!playerName) {
        return callback({
          ok: false,
          error: "Digite seu nome."
        });
      }

      if (!token) {
        return callback({
          ok: false,
          error: "Identificação do jogador inválida."
        });
      }

      leaveCurrentRoomImmediately(socket);

      const existing = findParticipantByToken(token);
      if (existing) return callback({ ok: false, error: "Já existe uma sessão ativa com essa identificação. Volte para ela antes de criar outra sala." });

      const settings = await resolveRoomSettings(
        categoryId,
        difficultyId
      );

      const code = createRoomCode();
      const privacy = resolvePrivateSettings(isPrivate, roomPassword);

      const room = {
        code,
        gameType: "impostor",
        hostToken: token,
        ...privacy,
        spectators: [],
        players: [
          {
            token,
            sessionSecret: roomSecret(),
            socketId: socket.id,
            name: playerName,
            avatar: playerAvatar,
            userId: identity.userId,
            ready: false,
            connected: true
          }
        ],
        started: false,
        currentRound: null,
        createdAt: Date.now(),
        category: settings.category,
        difficulty: settings.difficulty
      };

      rooms.set(code, room);

      socket.join(code);
      socket.data.roomCode = code;
      socket.data.playerToken = token;
      socket.data.role = "player";

      callback({
        ok: true,
        room: publicRoom(room),
        playerToken: token,
        sessionSecret: room.players[0].sessionSecret
      });

      updateRoom(code);
    } catch (error) {
      console.error(error);

      callback({
        ok: false,
        error:
          error.message ||
          "Não foi possível criar a sala."
      });
    }
  });

  socket.on("create-whoami-room", async (
    {
      name,
      categoryId,
      difficultyId,
      playerToken,
      avatar, isPrivate, roomPassword, allFinish
    },
    callback
  ) => {
    try {
      const identity = await resolvePlayerIdentity(socket, name, avatar);
      const playerName = identity.name;
      const token = sanitizeToken(playerToken);
      const playerAvatar = identity.avatar;

      if (!playerName) {
        return callback({
          ok: false,
          error: "Digite seu nome."
        });
      }

      if (!token) {
        return callback({
          ok: false,
          error: "Identificação do jogador inválida."
        });
      }

      leaveCurrentRoomImmediately(socket);

      const existing = findParticipantByToken(token);
      if (existing) return callback({ ok: false, error: "Já existe uma sessão ativa com essa identificação. Volte para ela antes de criar outra sala." });

      const settings = await resolveWhoAmISettings(
        categoryId,
        difficultyId
      );

      const code = createRoomCode();
      const privacy = resolvePrivateSettings(isPrivate, roomPassword);

      const room = {
        code,
        gameType: "whoami",
        allFinish: Boolean(allFinish),
        hostToken: token,
        ...privacy,
        spectators: [],
        players: [
          {
            token,
            sessionSecret: roomSecret(),
            socketId: socket.id,
            name: playerName,
            avatar: playerAvatar,
            userId: identity.userId,
            ready: false,
            connected: true
          }
        ],
        started: false,
        currentRound: null,
        createdAt: Date.now(),
        category: settings.category,
        difficulty: settings.difficulty
      };

      rooms.set(code, room);

      socket.join(code);
      socket.data.roomCode = code;
      socket.data.playerToken = token;
      socket.data.role = "player";

      callback({
        ok: true,
        room: publicRoom(room),
        playerToken: token,
        sessionSecret: room.players[0].sessionSecret
      });

      updateRoom(code);
    } catch (error) {
      console.error(error);

      callback({
        ok: false,
        error:
          error.message ||
          "Não foi possível criar a sala."
      });
    }
  });

  socket.on("join-room", async (
    { name, code, playerToken, avatar, gameType, roomPassword, sessionSecret },
    callback
  ) => {
    const identity = await resolvePlayerIdentity(socket, name, avatar);
    const playerName = identity.name;

    const roomCode = String(code || "")
      .trim()
      .toUpperCase();

    const token = sanitizeToken(playerToken);
    const playerAvatar = identity.avatar;

    if (!playerName) {
      return callback({
        ok: false,
        error: "Digite seu nome."
      });
    }

    if (!token) {
      return callback({
        ok: false,
        error: "Identificação do jogador inválida."
      });
    }

    const room = rooms.get(roomCode);

    if (!room) {
      return callback({
        ok: false,
        error: "Sala não encontrada."
      });
    }

    if (gameType && room.gameType !== gameType) {
      const labels = {
        impostor: "Impostor",
        whoami: "Quem Sou Eu",
        trivia: "Corrida do Conhecimento"
      };
      return callback({
        ok: false,
        error: `Esse código pertence a uma sala de ${labels[room.gameType] || "outro jogo"}.`
      });
    }

    const returningPlayer = room.players.find(
      (player) => player.token === token
    );

    if (returningPlayer) {
      if (!sessionSecret || returningPlayer.sessionSecret !== sessionSecret) {
        return callback({ ok: false, error: "Identificação inválida para reconectar. Entre com outro perfil." });
      }
      returningPlayer.name = playerName;
      returningPlayer.avatar = playerAvatar;
      returningPlayer.userId = identity.userId || returningPlayer.userId || null;

      bindPlayerToSocket(
        room,
        returningPlayer,
        socket
      );

      callback({
        ok: true,
        room: publicRoom(room),
        playerToken: token,
        sessionSecret: returningPlayer.sessionSecret,
        resumed: true
      });
      if (room.started) sendCurrentGameState(room, returningPlayer);
      return;
    }

    const existingSpectator = (room.spectators || []).find(p => p.token === token);
    if (existingSpectator) {
      if (!sessionSecret || existingSpectator.sessionSecret !== sessionSecret)
        return callback({ ok: false, error: "Identificação de espectador inválida." });
      bindPlayerToSocket(room, existingSpectator, socket, "spectator");
      callback({ ok: true, room: publicRoom(room), playerToken: token,
        sessionSecret: existingSpectator.sessionSecret, spectator: true, resumed: true });
      socket.emit("spectator-state", buildSpectatorState(room));
      return;
    }

    const duplicate = findParticipantByToken(token);
    if (duplicate && duplicate.room !== room)
      return callback({ ok: false, error: "Esta sessão já está em outra sala. Saia dela antes de entrar aqui." });

    const permission = privateJoinAllowed(socket, room, roomPassword);
    if (!permission.ok) return callback(permission);

    if (room.started) {
      if ((room.spectators || []).length >= 30) {
        return callback({ ok: false, error: "Limite de espectadores atingido." });
      }
      if (room.players.concat(room.spectators || []).some(p => p.name.toLowerCase() === playerName.toLowerCase()))
        return callback({ ok: false, error: "Esse nome já está sendo usado na sala." });
      leaveCurrentRoomImmediately(socket);
      const spectator = {
        token, sessionSecret: roomSecret(), socketId: socket.id, name: playerName,
        avatar: playerAvatar, userId: identity.userId,
        ready: false, connected: true
      };
      room.spectators = room.spectators || [];
      room.spectators.push(spectator);
      bindPlayerToSocket(room, spectator, socket, "spectator");
      callback({ ok: true, room: publicRoom(room), playerToken: token,
        sessionSecret: spectator.sessionSecret, spectator: true });
      socket.emit("spectator-state", buildSpectatorState(room));
      return;
    }


    if (
      room.players.some(
        (player) =>
          player.name.toLowerCase() ===
          playerName.toLowerCase()
      )
    ) {
      return callback({
        ok: false,
        error:
          "Já existe alguém com esse nome na sala."
      });
    }

    leaveCurrentRoomImmediately(socket);

    const newSecret = roomSecret();
    room.players.push({
      token,
      sessionSecret: newSecret,
      socketId: socket.id,
      name: playerName,
      avatar: playerAvatar,
      userId: identity.userId,
      ready: false,
      connected: true
    });

    // Mudou a composição da sala:
    // todos precisam confirmar novamente.
    resetReadyForRoom(room);

    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.playerToken = token;
    socket.data.role = "player";

    callback({
      ok: true,
      room: publicRoom(room),
      playerToken: token,
      sessionSecret: newSecret
    });

    updateRoom(roomCode);
  });

  socket.on("set-ready", (
    { code, ready },
    callback
  ) => {
    const roomCode = String(code || "")
      .trim()
      .toUpperCase();

    const room = rooms.get(roomCode);

    if (!room) {
      return callback({
        ok: false,
        error: "Sala não encontrada."
      });
    }

    if (room.started) {
      return callback({
        ok: false,
        error: "A partida já começou."
      });
    }

    const token = socket.data.playerToken;

    const player = room.players.find(
      (item) => item.token === token
    );

    if (!player) {
      return callback({
        ok: false,
        error: "Você não está nessa sala."
      });
    }

    player.ready = Boolean(ready);

    updateRoom(roomCode);

    callback({
      ok: true,
      ready: player.ready
    });
  });

  socket.on("start-game", async (
    { code },
    callback
  ) => {
    try {
      const roomCode = String(code || "")
        .trim()
        .toUpperCase();

      const room = rooms.get(roomCode);

      if (!room) {
        return callback({
          ok: false,
          error: "Sala não encontrada."
        });
      }

      if (room.gameType !== "impostor") {
        return callback({
          ok: false,
          error: "Essa sala não é do jogo Impostor."
        });
      }

      if (
        room.hostToken !==
        socket.data.playerToken
      ) {
        return callback({
          ok: false,
          error:
            "Apenas o host pode iniciar a partida."
        });
      }

      if (room.players.length < 3) {
        return callback({
          ok: false,
          error:
            "São necessários pelo menos 3 jogadores."
        });
      }

      const notReady = room.players.filter(
        (player) =>
          !player.ready || !player.connected
      );

      if (notReady.length > 0) {
        return callback({
          ok: false,
          error:
            "Todos precisam estar conectados e PRONTOS. " +
            `Faltam: ${notReady
              .map((player) => player.name)
              .join(", ")}.`
        });
      }

      const selected = await getRandomWord(room);

      if (!selected) {
        return callback({
          ok: false,
          error:
            "Não existem palavras para essa configuração."
        });
      }

      const impostor =
        room.players[
          Math.floor(
            Math.random() * room.players.length
          )
        ];

      room.started = true;

      room.currentRound = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startedAt: Date.now(),
        word: selected.word,
        hint: selected.hint,
        impostorToken: impostor.token,
        category: selected.category_name,
        difficulty: selected.difficulty_name,
        phase: "discussion",
        speakingOrder: buildSpeakingOrder(room),
        voteRound: 0,
        vote: null,
        tiebreakCandidates: null,
        lastVoteCounts: {},
        votedOutToken: null,
        eliminatedTokens: [],
        winnerSide: null,
        resultReason: null,
        winnerToken: null
      };

      broadcastRooms();

      room.players.forEach((player) => {
        sendCurrentGameState(room, player);
      });

      console.log(
        `[${roomCode}] Palavra: ${selected.word} | ` +
        `Dica: ${selected.hint} | ` +
        `Impostor: ${impostor.name}`
      );

      callback({ ok: true });
    } catch (error) {
      console.error(error);

      callback({
        ok: false,
        error: "Erro ao sortear a palavra."
      });
    }
  });

  socket.on("start-impostor-vote", (
    { code },
    callback
  ) => {
    const roomCode = String(code || "")
      .trim()
      .toUpperCase();
    const room = rooms.get(roomCode);

    if (!room || room.gameType !== "impostor" || !room.started || !room.currentRound) {
      return callback({
        ok: false,
        error: "Nenhuma rodada do Impostor está ativa."
      });
    }

    if (room.hostToken !== socket.data.playerToken) {
      return callback({
        ok: false,
        error: "Apenas o host pode iniciar a votação."
      });
    }

    if (!["discussion", "tiebreak"].includes(room.currentRound.phase)) {
      return callback({
        ok: false,
        error: "A votação não pode ser iniciada agora."
      });
    }

    const disconnected = room.players.filter((player) => !player.connected);
    if (disconnected.length > 0) {
      return callback({
        ok: false,
        error: "Aguarde todos se reconectarem antes de votar."
      });
    }

    const isTiebreak = room.currentRound.phase === "tiebreak";
    startImpostorVote(room, isTiebreak);
    callback({ ok: true });
  });

  socket.on("cast-impostor-vote", (
    { code, targetToken },
    callback
  ) => {
    const roomCode = String(code || "")
      .trim()
      .toUpperCase();
    const room = rooms.get(roomCode);
    const voterToken = socket.data.playerToken;
    const cleanTarget = sanitizeToken(targetToken);

    if (
      !room ||
      room.gameType !== "impostor" ||
      !room.started ||
      room.currentRound?.phase !== "voting" ||
      !room.currentRound?.vote
    ) {
      return callback({
        ok: false,
        error: "A votação não está ativa."
      });
    }

    const voter = room.players.find((player) => player.token === voterToken);
    const target = room.players.find((player) => player.token === cleanTarget);
    const vote = room.currentRound.vote;

    if (!voter || !target) {
      return callback({
        ok: false,
        error: "Jogador não encontrado."
      });
    }

    if (!vote.candidateTokens.includes(cleanTarget)) {
      return callback({
        ok: false,
        error: "Esse jogador não participa desta votação."
      });
    }

    if (cleanTarget === voterToken) {
      return callback({
        ok: false,
        error: "Você não pode votar em si mesmo."
      });
    }

    if (vote.votes[voterToken]) {
      return callback({
        ok: false,
        error: "Seu voto já foi confirmado."
      });
    }

    vote.votes[voterToken] = cleanTarget;

    callback({
      ok: true,
      targetName: target.name
    });

    resolveImpostorVoteIfReady(room);
  });

  socket.on("start-whoami-game", async (
    { code },
    callback
  ) => {
    try {
      const roomCode = String(code || "")
        .trim()
        .toUpperCase();

      const room = rooms.get(roomCode);

      if (!room) {
        return callback({
          ok: false,
          error: "Sala não encontrada."
        });
      }

      if (room.gameType !== "whoami") {
        return callback({
          ok: false,
          error: "Essa sala não é do jogo Quem Sou Eu."
        });
      }

      if (
        room.hostToken !==
        socket.data.playerToken
      ) {
        return callback({
          ok: false,
          error:
            "Apenas o host pode iniciar a partida."
        });
      }

      if (room.players.length < 2) {
        return callback({
          ok: false,
          error:
            "São necessários pelo menos 2 jogadores."
        });
      }

      const notReady = room.players.filter(
        (player) =>
          !player.ready || !player.connected
      );

      if (notReady.length > 0) {
        return callback({
          ok: false,
          error:
            "Todos precisam estar conectados e PRONTOS. " +
            `Faltam: ${notReady
              .map((player) => player.name)
              .join(", ")}.`
        });
      }

      const selected = await getRandomCharacters(
        room,
        room.players.length
      );

      if (!selected) {
        return callback({
          ok: false,
          error:
            "Não há personagens suficientes para essa configuração."
        });
      }

      const assignments = {};
      const assignmentIds = {};
      const assignmentImages = {};
      const playerStates = {};

      room.players.forEach((player, index) => {
        assignments[player.token] = selected[index].name;
        assignmentIds[player.token] = selected[index].id;
        assignmentImages[player.token] = selected[index].image_url || null;
        playerStates[player.token] = {
          attemptsUsed: 0,
          eliminated: false,
          status: "playing",
          placement: null
        };
      });

      room.started = true;
      room.currentRound = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startedAt: Date.now(),
        phase: "review",
        allFinish: Boolean(room.allFinish),
        participants: room.players.map(({ token, name, avatar, userId }) => ({ token, name, avatar, userId })),
        nextPlacement: 1,
        assignments,
        assignmentIds,
        assignmentImages,
        playerStates,
        speakingOrder: buildSpeakingOrder(room),
        reviewVotes: {},
        approvedTargets: {},
        winnerToken: null,
        category:
          room.category.name || "Todas",
        difficulty:
          room.difficulty.name || "Aleatória"
      };

      broadcastRooms();

      sendWhoAmIReviewStateToAll(
        room,
        "whoami-review-started",
        false
      );

      console.log(
        `[${roomCode}] Quem Sou Eu: sorteio concluído, ` +
        `aguardando conferência.`
      );

      callback({ ok: true });
    } catch (error) {
      console.error(error);

      callback({
        ok: false,
        error:
          "Erro ao sortear os personagens."
      });
    }
  });

  socket.on("whoami-review-vote", async (
    { code, targetToken, vote },
    callback
  ) => {
    try {
      const roomCode = String(code || "")
        .trim()
        .toUpperCase();

      const room = rooms.get(roomCode);
      const voterToken = socket.data.playerToken;
      const cleanTarget = sanitizeToken(targetToken);

      if (
        !room ||
        room.gameType !== "whoami" ||
        room.currentRound?.phase !== "review"
      ) {
        return callback({
          ok: false,
          error: "A conferência não está ativa."
        });
      }

      if (!["approve", "reroll"].includes(vote)) {
        return callback({
          ok: false,
          error: "Voto inválido."
        });
      }

      if (cleanTarget === voterToken) {
        return callback({
          ok: false,
          error:
            "Você não pode avaliar seu próprio personagem."
        });
      }

      const target = room.players.find(
        (player) => player.token === cleanTarget
      );

      const voter = room.players.find(
        (player) => player.token === voterToken
      );

      if (!target || !voter) {
        return callback({
          ok: false,
          error: "Jogador não encontrado."
        });
      }

      const round = room.currentRound;

      if (round.approvedTargets[cleanTarget]) {
        return callback({
          ok: false,
          error: "Esse personagem já foi aprovado."
        });
      }

      if (!round.reviewVotes[cleanTarget]) {
        round.reviewVotes[cleanTarget] = {};
      }

      round.reviewVotes[cleanTarget][voterToken] = vote;

      const review = getWhoAmITargetReview(
        room,
        cleanTarget
      );

      const everyoneApproved =
        review.eligibleCount > 0 &&
        review.approveCount === review.eligibleCount;

      const everyoneWantsReroll =
        review.eligibleCount > 0 &&
        review.rerollCount === review.eligibleCount;

      if (everyoneApproved) {
        round.approvedTargets[cleanTarget] = true;
      } else if (everyoneWantsReroll) {
        const excludedIds = Object.values(
          round.assignmentIds
        );

        const replacement =
          await getRandomCharacterExcluding(
            room,
            excludedIds
          );

        if (!replacement) {
          return callback({
            ok: false,
            error:
              "Não há outro personagem disponível para esse filtro."
          });
        }

        round.assignments[cleanTarget] = replacement.name;
        round.assignmentIds[cleanTarget] = replacement.id;
        round.assignmentImages[cleanTarget] = replacement.image_url || null;
        round.reviewVotes[cleanTarget] = {};
        round.approvedTargets[cleanTarget] = false;

        io.to(room.code).emit(
          "whoami-character-rerolled",
          {
            targetToken: cleanTarget,
            targetName: target.name
          }
        );
      }

      if (allWhoAmITargetsApproved(room)) {
        launchWhoAmIGame(room);
      } else {
        sendWhoAmIReviewStateToAll(room);
      }

      callback({ ok: true });
    } catch (error) {
      console.error(error);

      callback({
        ok: false,
        error: "Não foi possível registrar seu voto."
      });
    }
  });

  socket.on("whoami-reveal-self", (
    { code },
    callback
  ) => {
    const roomCode = String(code || "")
      .trim()
      .toUpperCase();

    const room = rooms.get(roomCode);

    if (
      !room ||
      room.gameType !== "whoami" ||
      !room.started ||
      !room.currentRound ||
      room.currentRound.phase !== "playing"
    ) {
      return callback({
        ok: false,
        error: "Nenhuma rodada ativa."
      });
    }

    const token = socket.data.playerToken;
    const round = room.currentRound;
    const character = round.assignments[token];
    if (!room.players.some(player => player.token === token && player.socketId === socket.id)) {
      return callback({ ok: false, error: "Você não está jogando nesta sala." });
    }

    if (!character) {
      return callback({
        ok: false,
        error: "Seu personagem não foi encontrado."
      });
    }

    if (!round.playerStates[token]) {
      round.playerStates[token] = {
        attemptsUsed: 0,
        eliminated: false
      };
    }

    if (round.playerStates[token].eliminated) {
      return callback({ ok: false, error: "Você já concluiu sua participação." });
    }
    round.playerStates[token].eliminated = true;
    round.playerStates[token].status = "gave_up";
    broadcastWhoAmIGuess(
      room,
      room.players.find(player => player.token === token),
      "",
      "gave_up"
    );
    // Desistir não consome artificialmente as tentativas restantes.
    broadcastWhoAmIStatuses(room);
    finishWhoAmIIfReady(room);

    callback({
      ok: true,
      character,
      imageUrl: round.assignmentImages?.[token] || null,
      eliminated: true
    });
  });

  socket.on("whoami-guess", (
    { code, guess },
    callback
  ) => {
    const roomCode = String(code || "")
      .trim()
      .toUpperCase();

    const room = rooms.get(roomCode);
    const token = socket.data.playerToken;

    if (
      !room ||
      room.gameType !== "whoami" ||
      !room.started ||
      !room.currentRound ||
      room.currentRound.phase !== "playing"
    ) {
      return callback({
        ok: false,
        error: "Nenhuma rodada ativa."
      });
    }

    const round = room.currentRound;
    const character = round.assignments[token];
    if (!room.players.some(player => player.token === token && player.socketId === socket.id)) {
      return callback({ ok: false, error: "Você não está jogando nesta sala." });
    }
    const guessingPlayer = room.players.find(player => player.token === token);
    const playerState = round.playerStates[token] || {
      attemptsUsed: 0,
      eliminated: false
    };

    round.playerStates[token] = playerState;

    if (playerState.eliminated) {
      return callback({
        ok: false,
        error: "Você já foi eliminado desta rodada."
      });
    }

    const guessResult = classifyWhoAmIGuess(guess, character);

    if (guessResult.result === "invalid") {
      return callback({
        ok: false,
        error: "Digite um nome antes de tentar."
      });
    }

    if (guessResult.result === "correct") {
      playerState.status = "correct";
      // O modo clássico preserva o vencedor como não eliminado.
      playerState.eliminated = Boolean(round.allFinish);
      playerState.placement = round.nextPlacement++;
      if (!round.winnerToken) round.winnerToken = token;
      broadcastWhoAmIGuess(room, guessingPlayer, guess, "correct", {
        placement: playerState.placement,
        attemptsLeft: 3 - playerState.attemptsUsed
      });
      if (round.allFinish) {
        broadcastWhoAmIStatuses(room);
        finishWhoAmIIfReady(room);
      } else {
        round.phase = "finished";
        recordWhoAmIResult(room);
        io.to(room.code).emit("whoami-game-finished", buildWhoAmIFinishedPayload(room));
        updateRoom(room.code);
      }
      return callback({
        ok: true, correct: true, result: "correct",
        placement: playerState.placement,
        character, imageUrl: round.assignmentImages?.[token] || null
      });
    }

    if (guessResult.result === "close") {
      broadcastWhoAmIGuess(room, guessingPlayer, guess, "close", {
        attemptsLeft: 3 - playerState.attemptsUsed
      });
      return callback({
        ok: true,
        correct: false,
        close: true,
        result: "close",
        closeReason: guessResult.reason,
        attemptsLeft: Math.max(0, 3 - playerState.attemptsUsed),
        eliminated: false
      });
    }

    playerState.attemptsUsed += 1;
    const attemptsLeft = Math.max(0, 3 - playerState.attemptsUsed);

    if (attemptsLeft === 0) {
      playerState.eliminated = true;
      playerState.status = "out_of_attempts";
    }

    broadcastWhoAmIGuess(room, guessingPlayer, guess, "wrong", {
      attemptsLeft,
      eliminated: playerState.eliminated
    });
    broadcastWhoAmIStatuses(room);
    finishWhoAmIIfReady(room);

    callback({
      ok: true,
      correct: false,
      close: false,
      result: "wrong",
      attemptsLeft,
      eliminated: playerState.eliminated,
      character: playerState.eliminated ? character : null,
      imageUrl: playerState.eliminated
        ? (round.assignmentImages?.[token] || null)
        : null
    });
  });

  socket.on("new-whoami-round", (
    { code },
    callback
  ) => {
    const roomCode = String(code || "")
      .trim()
      .toUpperCase();

    const room = rooms.get(roomCode);

    if (!room) {
      return callback({
        ok: false,
        error: "Sala não encontrada."
      });
    }

    if (room.gameType !== "whoami") {
      return callback({
        ok: false,
        error: "Essa sala não é do Quem Sou Eu."
      });
    }

    if (
      room.hostToken !==
      socket.data.playerToken
    ) {
      return callback({
        ok: false,
        error:
          "Apenas o host pode iniciar uma nova rodada."
      });
    }

    room.started = false;
    room.currentRound = null;
    promoteSpectators(room);
    resetReadyForRoom(room);

    io.to(roomCode).emit("whoami-back-to-lobby");
    updateRoom(roomCode);

    callback({ ok: true });
  });

  socket.on("new-round", (
    { code },
    callback
  ) => {
    const roomCode = String(code || "")
      .trim()
      .toUpperCase();

    const room = rooms.get(roomCode);

    if (!room) {
      return callback({
        ok: false,
        error: "Sala não encontrada."
      });
    }

    if (room.gameType !== "impostor") {
      return callback({
        ok: false,
        error: "Essa sala não é do Impostor."
      });
    }

    if (
      room.hostToken !==
      socket.data.playerToken
    ) {
      return callback({
        ok: false,
        error:
          "Apenas o host pode iniciar uma nova rodada."
      });
    }

    room.started = false;
    room.currentRound = null;
    promoteSpectators(room);
    resetReadyForRoom(room);

    io.to(roomCode).emit("back-to-lobby");
    updateRoom(roomCode);

    callback({ ok: true });
  });

  socket.on("close-room", (
    { code },
    callback
  ) => {
    const roomCode = String(code || "")
      .trim()
      .toUpperCase();

    const room = rooms.get(roomCode);

    if (!room) {
      return callback({
        ok: false,
        error: "Sala não encontrada."
      });
    }

    if (
      room.hostToken !==
      socket.data.playerToken
    ) {
      return callback({
        ok: false,
        error: "Apenas o host pode encerrar a sala."
      });
    }

    closeRoomForEveryone(
      room,
      "O host encerrou a sala."
    );

    callback({ ok: true });
  });

  socket.on("leave-room", (callback) => {
    leaveCurrentRoomImmediately(socket);

    if (typeof callback === "function") {
      callback({ ok: true });
    }
  });

  socket.on("disconnect", () => {
    const token = socket.data.playerToken;

    if (!token) {
      return;
    }

    const found = findParticipantByToken(token);
    if (!found || found.participant.socketId !== socket.id) return;
    if (found.role === "spectator") {
      found.participant.connected = false;
      found.participant.socketId = null;
      updateRoom(found.room.code);
      clearDisconnectTimer(token);
      disconnectTimers.set(token, setTimeout(() => {
        const current = findParticipantByToken(token);
        if (current?.role === "spectator" && !current.participant.connected)
          removeSpectator(current.room, token);
      }, RECONNECT_GRACE_MS));
      return;
    }
    const player = found.participant;

    // Só marca como desconectado.
    // Não apaga imediatamente porque F5 gera disconnect.
    player.connected = false;
    player.socketId = null;

    updateRoom(found.room.code);
    if (found.room.gameType === "trivia") triviaRace.onConnectionChange(found.room);

    scheduleDisconnectRemoval(
      found.room,
      player
    );
  });
});

async function startServer() {
  try {
    await db.testConnection();

    if (process.env.AUTO_INIT_DB === "true") {
      console.log("AUTO_INIT_DB=true: preparando tabelas e dados...");
      await bootstrapDatabase(db.pool);
    }

    const migrations = await runMigrations(db.pool);
    if (migrations.length) {
      console.log(`Migrações aplicadas: ${migrations.join(", ")}`);
    }

    const quizImported = await loadQuizQuestions(db.pool);

    const counts = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM words WHERE active = TRUE) AS words,
        (SELECT COUNT(*)::int FROM quiz_questions WHERE active = TRUE) AS quiz_questions
    `);

    console.log(
      `PostgreSQL conectado. ${counts.rows[0].words} palavras e ` +
      `${counts.rows[0].quiz_questions} perguntas preservadas no acervo.`
    );
    if (quizImported) {
      console.log(`Acervo de perguntas sincronizado: ${quizImported} perguntas do arquivo-fonte.`);
    }

    server.listen(PORT, "0.0.0.0", () => {
      console.log(
        `Servidor web iniciado na porta ${PORT}.`
      );
    });
  } catch (error) {
    console.error("");
    console.error(
      "Não foi possível iniciar o Caroninhas Party."
    );
    console.error(
      "Confira a conexão do PostgreSQL e as variáveis do .env."
    );
    console.error("Detalhes:", error.message);
    process.exit(1);
  }
}

startServer();
