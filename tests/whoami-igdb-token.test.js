"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { makeImageResolver } = require("../whoami-images");

const ok = (data) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => data });
const unauthorized = () => ({ ok: false, status: 401, headers: { get: () => null } });
const ENV = { IGDB_CLIENT_ID: "example-client", IGDB_CLIENT_SECRET: "example-secret" };
function fixture(handler, { now = Date.now, env = ENV } = {}) {
  const calls = [];
  const resolver = makeImageResolver({
    env, now,
    fetchFn: async (url, options) => {
      calls.push({ url: String(url), options });
      return handler(String(url), options, calls);
    }
  });
  return { resolver, calls };
}
function igdbImage(url, options) {
  if (url.endsWith("/characters")) return ok([{ id: 8, name: "Gengar", mug_shot: 25, url: "https://www.igdb.com/characters/gengar" }]);
  if (url.endsWith("/character_mug_shots")) return ok([{ image_id: "gengar001" }]);
  throw new Error(`Unexpected ${url}`);
}

test("IGDB: gera token de aplicação no servidor e não expõe Client Secret ao navegador", async () => {
  const { resolver, calls } = fixture((url, options) => {
    if (url.includes("id.twitch.tv")) return ok({ access_token: "issued-1", expires_in: 3600, token_type: "bearer" });
    return igdbImage(url, options);
  });
  const image = await resolver.lookup("Gengar", "jogos");
  assert.equal(image.source, "igdb");
  assert.match(image.imageUrl, /gengar001/);
  const auth = calls.filter(c => c.url.includes("id.twitch.tv"));
  assert.equal(auth.length, 1);
  assert.equal(auth[0].options.method, "POST");
  assert.equal(auth[0].options.headers["Content-Type"], "application/x-www-form-urlencoded");
  assert.equal(new URLSearchParams(auth[0].options.body).get("grant_type"), "client_credentials");
  assert.equal(new URLSearchParams(auth[0].options.body).get("client_secret"), "example-secret");
  assert.ok(calls.filter(c => c.url.includes("api.igdb.com")).every(c => c.options.headers.Authorization === "Bearer issued-1"));
  assert.ok(!JSON.stringify(image).includes("example-secret"));
  assert.ok(!JSON.stringify(image).includes("issued-1"));
});

test("IGDB: reutiliza token válido entre personagens e renova antes do vencimento", async () => {
  let time = 0;
  let issued = 0;
  const { resolver, calls } = fixture((url, options) => {
    if (url.includes("id.twitch.tv")) return ok({ access_token: `issued-${++issued}`, expires_in: 100 });
    if (url.endsWith("/characters")) {
      const name = options.body.includes("Gengar") ? "Gengar" : "Pikachu";
      return ok([{ id: 8, name, mug_shot: 25 }]);
    }
    return ok([{ image_id: "mug001" }]);
  }, { now: () => time });
  await resolver.lookup("Gengar", "jogos");
  time = 20_000;
  await resolver.lookup("Pikachu", "jogos");
  assert.equal(issued, 1);
  time = 91_000; // expires_in=100s, margem 10s => novo token
  await resolver.lookup("Link", "jogos");
  assert.equal(issued, 2);
  assert.ok(calls.filter(c => c.url.endsWith("/characters")).some(c => c.options.headers.Authorization === "Bearer issued-2"));
});

test("IGDB: em 401 invalida token, solicita outro e repete uma vez", async () => {
  let issued = 0;
  let oldRequests = 0;
  const { resolver, calls } = fixture((url, options) => {
    if (url.includes("id.twitch.tv")) return ok({ access_token: `issued-${++issued}`, expires_in: 3600 });
    if (url.endsWith("/characters") && options.headers.Authorization === "Bearer issued-1") {
      oldRequests++;
      return unauthorized();
    }
    return igdbImage(url, options);
  });
  assert.equal((await resolver.lookup("Gengar", "jogos")).source, "igdb");
  assert.equal(issued, 2);
  assert.equal(oldRequests, 1);
  assert.equal(calls.filter(c => c.url.endsWith("/characters")).length, 2);
});

test("IGDB: 401 no segundo endpoint também renova e recupera foto", async () => {
  let issued = 0;
  const { resolver } = fixture((url, options) => {
    if (url.includes("id.twitch.tv")) return ok({ access_token: `issued-${++issued}`, expires_in: 3600 });
    if (url.endsWith("/character_mug_shots") && options.headers.Authorization === "Bearer issued-1") return unauthorized();
    return igdbImage(url, options);
  });
  assert.equal((await resolver.lookup("Gengar", "jogos")).source, "igdb");
  assert.equal(issued, 2);
});

test("IGDB: solicita apenas um token para pesquisas concorrentes", async () => {
  let issued = 0;
  const { resolver } = fixture(async (url, options) => {
    if (url.includes("id.twitch.tv")) {
      issued++;
      await Promise.resolve();
      return ok({ access_token: "issued-shared", expires_in: 3600 });
    }
    if (url.endsWith("/characters")) {
      const name = options.body.includes("Gengar") ? "Gengar" : "Pikachu";
      return ok([{ name, mug_shot: 25 }]);
    }
    return ok([{ image_id: "shared001" }]);
  });
  const images = await Promise.all([
    resolver.lookup("Gengar", "jogos"),
    resolver.lookup("Pikachu", "jogos")
  ]);
  assert.equal(issued, 1);
  assert.deepEqual(images.map(i => i?.source), ["igdb", "igdb"]);
});

test("IGDB: falha de credenciais faz fallback sem vazar segredo nem repetir login em sequência", async () => {
  let time = 0;
  let authAttempts = 0;
  const { resolver, calls } = fixture(url => {
    if (url.includes("id.twitch.tv")) { authAttempts++; return unauthorized(); }
    if (url.includes("wikipedia.org")) return ok({ query: { pages: {} } });
    throw Error(`IGDB should not have been called: ${url}`);
  }, { now: () => time });
  assert.equal(await resolver.lookup("Gengar", "jogos"), null);
  assert.equal(await resolver.lookup("Pikachu", "jogos"), null);
  assert.equal(authAttempts, 1);
  assert.ok(calls.some(c => c.url.includes("wikipedia.org")));
  time = 30_001;
  assert.equal(await resolver.lookup("Outro Personagem", "jogos"), null);
  assert.equal(authAttempts, 2);
});

test("IGDB: credencial manual antiga continua compatível sem renovação", async () => {
  const { resolver, calls } = fixture((url, options) => igdbImage(url, options), {
    env: { IGDB_CLIENT_ID: "example-client", IGDB_ACCESS_TOKEN: "legacy-access" }
  });
  assert.equal((await resolver.lookup("Gengar", "jogos")).source, "igdb");
  assert.ok(!calls.some(c => c.url.includes("id.twitch.tv")));
  assert.ok(calls.filter(c => c.url.includes("api.igdb.com")).every(c => c.options.headers.Authorization === "Bearer legacy-access"));
});

test("Interface: só a foto ampliada solicita e exibe créditos; miniaturas ocultas", () => {
  const js = fs.readFileSync(path.join(__dirname, "../public/script.js"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../public/style.css"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
  assert.match(js, /"game-character-photo", "small", "final-photo", "winner-photo"/);
  assert.match(js, /if \(!characterImageSources\.has\(character\)\) \{\s*resolveCharacterImage\(character\)/);
  assert.match(css, /\.character-photo-wrap\.game-character-photo \.character-image-source,/);
  assert.match(css, /\.whoami-character-floating-preview \.character-image-source/);
  assert.match(html, /\/style\.css\?v=20\.20/);
  assert.match(html, /\/script\.js\?v=20\.20/);
});
