"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
function slice(a, b) {
  const start = source.indexOf(a), end = source.indexOf(b, start);
  assert.ok(start >= 0 && end > start, `range not found: ${a}`);
  return source.slice(start, end);
}
const participantHelpers = slice("function whoAmIParticipants(room)", "function recordImpostorResult(room)");
const removeHelper = slice("function permanentlyRemovePlayer(room, token)", "function scheduleDisconnectRemoval(room, player)");
function fixture(allFinish = true) {
  const emitted = [], saved = [], updated = [];
  const players = ["A", "B", "C"].map((token, i) => ({ token, name: `Pessoa ${token}`, avatar: "cat", userId: i + 1, connected: true }));
  const round = {
    phase: "playing", id: "test-match", allFinish,
    playerStates: Object.fromEntries(players.map(p => [p.token, { attemptsUsed: 0, eliminated: false, status: "playing" }])),
    participants: players.map(({ token, name, avatar, userId }) => ({ token, name, avatar, userId })),
    assignments: Object.fromEntries(players.map(p => [p.token, `Personagem ${p.token}`])),
    assignmentImages: {}, nextPlacement: 1, speakingOrder: [], winnerToken: null
  };
  const room = { code: "ABCD", gameType: "whoami", allFinish, currentRound: round, players, spectators: [] };
  const sandbox = {
    recordMatch: async (db, statsRoom, opts) => { saved.push({ statsRoom, opts }); },
    db: {},
    io: { to: () => ({ emit: (name, payload) => emitted.push({ name, payload }) }) },
    updateRoom: code => updated.push(code),
    clearDisconnectTimer: () => {},
    closeRoomForEveryone: () => {},
    resetReadyForRoom: () => {},
    broadcastWhoAmIStatuses: () => {},
    resolveImpostorVoteIfReady: () => {},
    sendWhoAmIReviewStateToAll: () => {},
    isImpostorPlayerEliminated: () => false,
    getImpostorEliminatedTokens: () => [],
    rooms: new Map([[room.code, room]])
  };
  vm.createContext(sandbox);
  vm.runInContext(participantHelpers + "\n" + removeHelper, sandbox);
  return { room, sandbox, emitted, saved, updated };
}

test("No modo Todos até o fim, o primeiro acerto não termina a rodada", () => {
  const f = fixture();
  f.room.currentRound.playerStates.A = { eliminated: true, status: "correct", placement: 1, attemptsUsed: 0 };
  f.room.currentRound.winnerToken = "A";
  assert.equal(f.sandbox.finishWhoAmIIfReady(f.room), false);
  assert.equal(f.room.currentRound.phase, "playing");
  assert.equal(f.emitted.length, 0);
});
test("A primeira colocação recebe a única vitória, os outros acertos ficam registrados", () => {
  const f = fixture();
  const s = f.room.currentRound.playerStates;
  s.A = { eliminated: true, status: "correct", placement: 1, attemptsUsed: 1 };
  s.B = { eliminated: true, status: "correct", placement: 2, attemptsUsed: 2 };
  s.C = { eliminated: true, status: "gave_up", attemptsUsed: 0 };
  f.room.currentRound.winnerToken = "A";
  assert.equal(f.sandbox.finishWhoAmIIfReady(f.room), true);
  assert.equal(f.room.currentRound.phase, "finished");
  assert.equal(f.saved.length, 1);
  assert.equal(f.saved[0].opts.playerDetails.A.won, true);
  assert.equal(f.saved[0].opts.playerDetails.B.won, false);
  assert.equal(f.saved[0].opts.playerDetails.B.role, "acertou");
  assert.equal(f.saved[0].opts.playerDetails.C.role, "gave_up");
  assert.equal(f.emitted.filter(x => x.name === "whoami-game-finished").length, 1);
  const results = f.emitted.find(x => x.name === "whoami-game-finished").payload.results;
  assert.equal(results.find(x => x.token === "B").placement, 2);
  assert.equal(f.sandbox.finishWhoAmIIfReady(f.room), false);
});
test("Após expirar a reconexão, o participante é abandono no resultado, sem travar a partida", () => {
  const f = fixture();
  const s = f.room.currentRound.playerStates;
  s.A = { eliminated: true, status: "correct", placement: 1 };
  s.B = { eliminated: true, status: "out_of_attempts", attemptsUsed: 3 };
  f.room.currentRound.winnerToken = "A";
  f.sandbox.permanentlyRemovePlayer(f.room, "C");
  assert.equal(f.room.currentRound.phase, "finished");
  assert.equal(s.C.status, "abandoned");
  assert.equal(f.saved[0].statsRoom.players.length, 3);
  assert.equal(f.saved[0].opts.playerDetails.C.role, "abandoned");
  const result = f.emitted.find(x => x.name === "whoami-game-finished").payload;
  assert.equal(result.results.find(x => x.token === "C").status, "abandoned");
});
test("Jogador que já acertou não vira abandono ao cair", () => {
  const f = fixture();
  f.room.currentRound.playerStates.A = { eliminated: true, status: "correct", placement: 1 };
  f.sandbox.permanentlyRemovePlayer(f.room, "A");
  assert.equal(f.room.currentRound.playerStates.A.status, "correct");
  assert.equal(f.room.currentRound.phase, "playing");
});
test("A tela clássica continua distinguível do modo Todos até o fim", () => {
  const f = fixture(false);
  assert.equal(f.sandbox.buildWhoAmIFinishedPayload(f.room).allFinish, false);
});
