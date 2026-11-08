"use strict";

// Regression tests for the live server vote logic, without a database connection.
// The functions below are loaded from server.js so the assertions exercise
// the same code that runs in production (rather than a reimplementation).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

function sliceSource(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a !== -1 && b !== -1, `Cannot locate source range: ${start}`);
  return source.slice(a, b);
}

const voteFunctions = [
  sliceSource("function getImpostorEliminatedTokens(round)", "function normalizeGuess(value)"),
  sliceSource("function impostorPublicPlayer(player)", "function permanentlyRemovePlayer(room, token)")
].join("\n");

function fixture(impostorToken = "D") {
  const emitted = [];
  const saved = [];
  const updates = [];
  const room = {
    code: "ABCD",
    players: ["A", "B", "C", "D"].map(token => ({
      token,
      name: `Player ${token}`,
      avatar: "cat",
      connected: true
    })),
    currentRound: {
      phase: "discussion",
      voteRound: 0,
      impostorToken,
      eliminatedTokens: [],
      speakingOrder: [],
      vote: null,
      tiebreakCandidates: null,
      id: "round123",
      word: "sorvete",
      hint: "gelado"
    }
  };
  const sandbox = {
    io: { to: (channel) => ({ emit: (event, payload) => emitted.push({ channel, event, payload }) }) },
    recordImpostorResult: (currentRoom) => saved.push({ phase: currentRoom.currentRound.phase }),
    updateRoom: (code) => updates.push(code),
    buildSpeakingOrder: (currentRoom, tiedPlayers) => tiedPlayers.map((p, index) => ({ ...p, position: index + 1 }))
  };
  vm.createContext(sandbox);
  vm.runInContext(voteFunctions, sandbox);
  return { room, sandbox, emitted, saved, updates };
}

function setVotes(room, assignments) {
  room.currentRound.vote.votes = { ...assignments };
}

function events(f, name) {
  return f.emitted.filter((item) => item.event === name);
}

test("normal vote, impostor eliminated: investigators win and game finishes", () => {
  const f = fixture("D");
  f.sandbox.startImpostorVote(f.room);
  setVotes(f.room, { A: "D", B: "D", C: "D", D: "A" });
  f.sandbox.resolveImpostorVoteIfReady(f.room);
  const round = f.room.currentRound;
  assert.equal(round.phase, "finished");
  assert.equal(round.winnerSide, "investigadores");
  assert.equal(round.resultReason, "impostor_descoberto");
  assert.equal(round.votedOutToken, "D");
  assert.equal(events(f, "impostor-vote-finished").length, 1);
  assert.equal(events(f, "impostor-player-eliminated").length, 0);
  assert.equal(f.saved.length, 1);
});

test("normal vote, innocent eliminated: impostor wins IMMEDIATELY", () => {
  const f = fixture("D");
  f.sandbox.startImpostorVote(f.room);
  setVotes(f.room, { A: "B", B: "A", C: "B", D: "B" });
  f.sandbox.resolveImpostorVoteIfReady(f.room);
  const round = f.room.currentRound;
  assert.equal(round.phase, "finished");
  assert.equal(round.winnerSide, "impostor");
  assert.equal(round.resultReason, "acusacao_errada");
  assert.equal(round.votedOutToken, "B");
  assert.equal(round.winnerToken, "D");
  assert.equal(events(f, "impostor-vote-finished").length, 1);
  assert.equal(events(f, "impostor-player-eliminated").length, 0);
  assert.equal(f.saved.length, 1);
});

test("tie, repeated tie, then innocent voted: end after first elimination", () => {
  const f = fixture("D");
  f.sandbox.startImpostorVote(f.room);
  setVotes(f.room, { A: "B", B: "A", C: "B", D: "A" });
  f.sandbox.resolveImpostorVoteIfReady(f.room);
  assert.equal(f.room.currentRound.phase, "tiebreak");
  assert.deepEqual(Array.from(f.room.currentRound.tiebreakCandidates), ["A", "B"]);
  assert.equal(events(f, "impostor-vote-finished").length, 0);

  f.sandbox.startImpostorVote(f.room, true);
  assert.deepEqual(Array.from(f.room.currentRound.vote.candidateTokens), ["A", "B"]);
  setVotes(f.room, { A: "B", B: "A", C: "B", D: "A" });
  f.sandbox.resolveImpostorVoteIfReady(f.room);
  assert.equal(f.room.currentRound.phase, "tiebreak");
  assert.equal(events(f, "impostor-vote-finished").length, 0);

  f.sandbox.startImpostorVote(f.room, true);
  setVotes(f.room, { A: "B", B: "A", C: "A", D: "A" });
  f.sandbox.resolveImpostorVoteIfReady(f.room);
  assert.equal(f.room.currentRound.phase, "finished");
  assert.equal(f.room.currentRound.voteRound, 3);
  assert.equal(f.room.currentRound.votedOutToken, "A");
  assert.equal(f.room.currentRound.winnerSide, "impostor");
  assert.equal(events(f, "impostor-vote-finished").length, 1);
  assert.equal(events(f, "impostor-player-eliminated").length, 0);
  assert.equal(f.saved.length, 1);
});

test("tie followed by impostor elimination: investigators win", () => {
  const f = fixture("B");
  f.sandbox.startImpostorVote(f.room);
  setVotes(f.room, { A: "B", B: "A", C: "B", D: "A" });
  f.sandbox.resolveImpostorVoteIfReady(f.room);
  f.sandbox.startImpostorVote(f.room, true);
  setVotes(f.room, { A: "B", B: "A", C: "B", D: "B" });
  f.sandbox.resolveImpostorVoteIfReady(f.room);
  assert.equal(f.room.currentRound.phase, "finished");
  assert.equal(f.room.currentRound.votedOutToken, "B");
  assert.equal(f.room.currentRound.winnerSide, "investigadores");
  assert.equal(events(f, "impostor-vote-finished").length, 1);
});

test("an incomplete ballot cannot eliminate anybody", () => {
  const f = fixture();
  f.sandbox.startImpostorVote(f.room);
  setVotes(f.room, { A: "B", B: "A", C: "B" });
  f.sandbox.resolveImpostorVoteIfReady(f.room);
  assert.equal(f.room.currentRound.phase, "voting");
  assert.equal(events(f, "impostor-vote-finished").length, 0);
  assert.equal(f.saved.length, 0);
});

test("finishing an already finished game cannot emit two results", () => {
  const f = fixture();
  f.sandbox.startImpostorVote(f.room);
  setVotes(f.room, { A: "B", B: "A", C: "B", D: "B" });
  f.sandbox.resolveImpostorVoteIfReady(f.room);
  f.sandbox.finishImpostorRound(f.room, { winnerSide: "investigadores", resultReason: "impostor_descoberto" });
  assert.equal(f.room.currentRound.winnerSide, "impostor");
  assert.equal(events(f, "impostor-vote-finished").length, 1);
  assert.equal(f.saved.length, 1);
});
