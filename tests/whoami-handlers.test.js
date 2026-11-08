"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const start = source.indexOf('  socket.on("whoami-reveal-self", (');
const end = source.indexOf('  socket.on("new-whoami-round", (', start);
assert.ok(start >= 0 && end > start);
const handlerSource = source.slice(start, end);
const announceStart = source.indexOf("function broadcastWhoAmIGuess(room, player, guess, result, details = {}) {");
const announceEnd = source.indexOf("function finishWhoAmIIfReady(room) {", announceStart);
assert.ok(announceStart >= 0 && announceEnd > announceStart);
const announceSource = source.slice(announceStart, announceEnd);

function harness() {
  const handlers = new Map();
  const room = {
    code: "ABCD", gameType: "whoami", started: true,
    players: [
      { token: "A", name: "Ana", socketId: "sock-A" },
      { token: "B", name: "Bia", socketId: "sock-B" }
    ],
    currentRound: {
      phase: "playing", id: "rodada-1", nextPlacement: 1, allFinish: true,
      assignments: { A: "Ana personagem", B: "Bia personagem" },
      assignmentImages: {},
      playerStates: { A: { attemptsUsed: 0, eliminated: false, status: "playing" }, B: { attemptsUsed: 0, eliminated: false, status: "playing" } }
    }
  };
  const events = [];
  const notices = [];
  let finishCount = 0;
  const socket = {
    id: "sock-A", data: { playerToken: "A" },
    on: (name, fn) => handlers.set(name, fn)
  };
  const sandbox = {
    socket, rooms: new Map([["ABCD", room]]),
    sanitizeToken: x => x,
    classifyWhoAmIGuess: (guess, character) => ({
      result: !guess.trim() ? "invalid" : guess === character ? "correct" : guess === "Alexandre Morais" ? "close" : "wrong",
      reason: "spelling"
    }),
    spectatorChannel: code => `spectators:${code}`,
    broadcastWhoAmIStatuses: () => events.push("status"),
    finishWhoAmIIfReady: room => {
      if (Object.values(room.currentRound.playerStates).every(s => s.eliminated)) {
        room.currentRound.phase = "finished";
        finishCount++;
      }
    },
    io: { to: channel => ({ emit: (name, payload) => {
      events.push(name);
      if (name === "whoami-guess-announced") notices.push({ channel, ...payload });
    } }) }
  };
  vm.createContext(sandbox);
  vm.runInContext(announceSource + "\n" + handlerSource, sandbox);
  const action = (name, payload) => {
    let result;
    handlers.get(name)(payload, answer => result = answer);
    return result;
  };
  return { socket, room, handlers, events, notices, action, getFinishedCount: () => finishCount };
}

test("acertos sucessivos mantêm o jogo aberto até todos concluírem", () => {
  const f = harness();
  assert.equal(f.action("whoami-guess", { code: "ABCD", guess: "Ana personagem" }).placement, 1);
  assert.equal(f.room.currentRound.phase, "playing");
  f.socket.id = "sock-B"; f.socket.data.playerToken = "B";
  assert.equal(f.action("whoami-guess", { code: "ABCD", guess: "Bia personagem" }).placement, 2);
  assert.equal(f.getFinishedCount(), 1);
  assert.equal(f.room.currentRound.phase, "finished");
});
test("desistência encerra apenas se não houver ninguém tentando", () => {
  const f = harness();
  f.action("whoami-guess", { code: "ABCD", guess: "Ana personagem" });
  f.socket.id = "sock-B"; f.socket.data.playerToken = "B";
  const response = f.action("whoami-reveal-self", { code: "ABCD" });
  assert.equal(response.ok, true);
  assert.equal(f.room.currentRound.playerStates.B.status, "gave_up");
  assert.equal(f.room.currentRound.playerStates.B.attemptsUsed, 0);
  assert.equal(f.getFinishedCount(), 1);
});
test("três erros encerram só a participação daquele jogador", () => {
  const f = harness();
  for (let i = 1; i <= 3; i++) {
    const response = f.action("whoami-guess", { code: "ABCD", guess: "errado" });
    assert.equal(response.attemptsLeft, 3 - i);
  }
  assert.equal(f.room.currentRound.playerStates.A.status, "out_of_attempts");
  assert.equal(f.getFinishedCount(), 0);
  assert.equal(f.room.currentRound.phase, "playing");
});
test("jogador que concluiu não pode adivinhar outra vez", () => {
  const f = harness();
  f.action("whoami-guess", { code: "ABCD", guess: "Ana personagem" });
  const response = f.action("whoami-guess", { code: "ABCD", guess: "Ana personagem" });
  assert.equal(response.ok, false);
  assert.equal(f.room.currentRound.nextPlacement, 2);
});


test("palpite errado é comunicado a jogadores e espectadores com o texto original", () => {
  const f = harness();
  assert.equal(f.action("whoami-guess", { code: "ABCD", guess: "Homem-Aranha" }).result, "wrong");
  assert.equal(f.notices.length, 2);
  assert.deepEqual(f.notices.map(n => n.channel), ["ABCD", "spectators:ABCD"]);
  for (const n of f.notices) {
    assert.equal(n.guess, "Homem-Aranha");
    assert.equal(n.playerName, "Ana");
    assert.equal(n.result, "wrong");
    assert.equal(n.attemptsLeft, 2);
    assert.equal(n.allFinish, true);
    assert.equal(n.roundId, "rodada-1");
    assert.equal("character" in n, false);
    assert.equal("sessionSecret" in n, false);
  }
});

test("palpite quase correto aparece para todos sem gastar tentativa", () => {
  const f = harness();
  const response = f.action("whoami-guess", { code: "ABCD", guess: "Alexandre Morais" });
  assert.equal(response.result, "close");
  assert.equal(response.attemptsLeft, 3);
  assert.equal(f.notices.length, 2);
  assert.equal(f.notices[0].result, "close");
  assert.equal(f.notices[0].guess, "Alexandre Morais");
  assert.equal(f.notices[0].attemptsLeft, 3);
});

test("palpite correto anuncia colocação antes do encerramento", () => {
  const f = harness();
  f.action("whoami-guess", { code: "ABCD", guess: "Ana personagem" });
  assert.equal(f.notices[0].result, "correct");
  assert.equal(f.notices[0].placement, 1);
  assert.equal(f.events[0], "whoami-guess-announced");
  assert.equal(f.events[1], "whoami-guess-announced");
});

test("palpite vazio ou jogador concluído não gera anúncio", () => {
  const f = harness();
  const empty = f.action("whoami-guess", { code: "ABCD", guess: "  " });
  assert.equal(empty.ok, false);
  assert.equal(f.notices.length, 0);
  f.action("whoami-guess", { code: "ABCD", guess: "Ana personagem" });
  const before = f.notices.length;
  const invalidAgain = f.action("whoami-guess", { code: "ABCD", guess: "outra" });
  assert.equal(invalidAgain.ok, false);
  assert.equal(f.notices.length, before);
});

test("desistência também é notificada para espectadores", () => {
  const f = harness();
  assert.equal(f.action("whoami-reveal-self", { code: "ABCD" }).ok, true);
  assert.equal(f.notices.length, 2);
  assert.equal(f.notices[0].result, "gave_up");
  assert.equal(f.notices[1].channel, "spectators:ABCD");
  assert.equal(f.notices[0].guess, "");
});
