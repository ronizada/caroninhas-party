"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeImageResolver, imageFrom } = require("../whoami-images");
const response = (data) => ({ ok: true, headers: { get: () => null }, json: async () => data });

// A mesma personagem entra pela página e só depois consulta o elenco.
test("Sydney Adamu: encontra retrato de personagem no TVmaze", async () => {
  const calls = [];
  const resolver = makeImageResolver({ env: {}, fetchFn: async (url) => {
    calls.push(String(url));
    if (String(url).includes("singlesearch/shows")) return response({ id: 76, name: "The Bear" });
    if (String(url).includes("/shows/76/cast")) return response([
      { character: { name: "Sydney Adamu", image: { medium: "https://static.tvmaze.com/uploads/images/medium_portrait/33/11.jpg" } } }
    ]);
    throw Error(`Unexpected ${url}`);
  }});
  const found = await resolver.lookup("Sydney Adamu", "cinema-series");
  assert.equal(found.source, "tvmaze");
  assert.equal(calls.length, 2);
});

test("TVmaze: aceita foto da atriz quando personagem está identificado mas não possui foto própria", async () => {
  const resolver = makeImageResolver({ fetchFn: async (url) =>
    response(String(url).includes("cast")
      ? [{ character: { name: "Sydney Adamu", image: null }, person: { image: { medium: "https://static.tvmaze.com/uploads/images/medium_portrait/9/9.jpg" } } }]
      : { id: 76, name: "The Bear" }) });
  assert.equal((await resolver.lookup("Sydney Adamu", "cinema-series")).source, "tvmaze");
});

test("Lydia Tár: TMDB valida filme e papel antes de usar retrato da atriz", async () => {
  const resolver = makeImageResolver({ env: { TMDB_READ_ACCESS_TOKEN: "secret-token" }, fetchFn: async (url) => {
    if (String(url).includes("search/movie")) return response({ results: [{ id: 123, title: "Tár" }] });
    if (String(url).includes("movie/123/credits")) return response({ cast: [
      { id: 2, name: "Other", character: "Not Tár", profile_path: "/wrong.jpg" },
      { id: 3, name: "Cate Blanchett", character: "Lydia Tár", profile_path: "/right.jpg" }
    ] });
    throw new Error(String(url));
  }});
  const found = await resolver.lookup("Lydia Tár", "cinema-series");
  assert.equal(found.source, "tmdb");
  assert.match(found.imageUrl, /right\.jpg$/);
  assert.match(found.sourceUrl, /\/person\/3$/);
});

test("Socrates: Commons aceita P18 somente com licença livre e fonte da obra", async () => {
  const urls = [];
  const resolver = makeImageResolver({ fetchFn: async (url) => {
    urls.push(String(url));
    const parsed = new URL(url);
    if (parsed.hostname.endsWith("wikipedia.org")) return response({ query: { pages: {} } });
    if (parsed.searchParams.get("action") === "wbgetentities") {
      assert.equal(parsed.searchParams.get("ids"), "Q913");
      return response({ entities: { Q913: { claims: { P18: [{ mainsnak: { datavalue: { value: "Socrates marble.jpg" } } }] } } } });
    }
    if (parsed.hostname === "commons.wikimedia.org") return response({ query: { pages: { "1": { imageinfo: [{ thumburl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Socrates.jpg", extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" } } }] } } } });
    throw Error(`unexpected URL ${url}`);
  }});
  const image = await resolver.lookup("Sócrates", "historia-cultura");
  assert.equal(image.source, "commons");
  assert.ok(urls.some(url => url.includes("commons.wikimedia.org")));
});

test("Commons: recusa imagem sem licença reconhecida", async () => {
  const resolver = makeImageResolver({ fetchFn: async (url) => {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith("wikipedia.org")) return response({ query: { pages: {} } });
    if (parsed.searchParams.get("action") === "wbgetentities") return response({ entities: { Q913: { claims: { P18: [{ mainsnak: { datavalue: { value: "Socrates.jpg" } } }] } } } });
    return response({ query: { pages: { "1": { imageinfo: [{ thumburl: "https://upload.wikimedia.org/wikipedia/commons/a.jpg", extmetadata: { LicenseShortName: { value: "All rights reserved" } } }] } } } });
  }});
  assert.equal(await resolver.lookup("Sócrates", "historia-cultura"), null);
});

test("IGDB: usa retrato de personagem exato com credenciais no servidor", async () => {
  const requests = [];
  const resolver = makeImageResolver({ env: { IGDB_CLIENT_ID: "client-id", IGDB_ACCESS_TOKEN: "secret" }, fetchFn: async (url, options) => {
    requests.push([String(url), options]);
    if (String(url).endsWith("/characters")) return response([
      { id: 1, name: "Gengar X", mug_shot: 10 }, { id: 2, name: "Gengar", mug_shot: 42, url: "https://www.igdb.com/characters/gengar" }
    ]);
    if (String(url).endsWith("/character_mug_shots")) return response([{ image_id: "xyz123" }]);
    throw Error(String(url));
  }});
  const found = await resolver.lookup("Gengar", "jogos");
  assert.equal(found.source, "igdb");
  assert.match(found.imageUrl, /xyz123\.jpg$/);
  assert.equal(requests[0][1].headers.Authorization, "Bearer secret");
  assert.ok(!JSON.stringify(found).includes("secret"));
  assert.match(requests[1][1].body, /id = 42/);
});

test("IGDB: sem credenciais, mantém Wikipedia e não tenta usar API privada", async () => {
  const calls = [];
  const resolver = makeImageResolver({ env: {}, fetchFn: async (url) => {
    calls.push(String(url));
    return response({ query: { pages: {} } });
  }});
  assert.equal(await resolver.lookup("Gengar", "jogos"), null);
  assert.ok(calls.every(url => url.includes("wikipedia.org")));
});

test("Cache de misses expira; positivos preservados", async () => {
  let now = 0; let calls = 0;
  const resolver = makeImageResolver({ now: () => now, env: {}, fetchFn: async () => { calls++; return response({ query: { pages: {} } }); } });
  assert.equal(await resolver.lookup("Jogador Qualquer", "jogos"), null);
  assert.equal(calls, 2);
  await resolver.lookup("Jogador Qualquer", "jogos");
  assert.equal(calls, 2);
  now = 90_001;
  await resolver.lookup("Jogador Qualquer", "jogos");
  assert.equal(calls, 4);
});

test("Rejects other-domain IGDB URLs", () => {
  assert.equal(imageFrom("igdb", "https://evil.com/a.jpg"), null);
});
