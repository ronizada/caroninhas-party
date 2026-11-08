"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeImageResolver, normalize, imageFrom } = require("../whoami-images");

function fakeJson(obj) {
  return { ok: true, headers: { get: () => null }, json: async () => obj };
}

test("normalizes accents and rejects unsafe image origins", () => {
  assert.equal(normalize("  Pelé - Jr. "), "pele jr");
  assert.equal(imageFrom("tmdb", "http://image.tmdb.org/t/p/w500/test.jpg"), null);
  assert.equal(imageFrom("tmdb", "https://not-tmdb.invalid/x.jpg"), null);
  assert.equal(imageFrom("anilist", "https://evil.invalid/character.jpg"), null);
});

test("AniList exact character match returns character art", async () => {
  let calls = 0;
  const resolver = makeImageResolver({
    env: {},
    fetchFn: async (url) => {
      calls += 1;
      assert.match(String(url), /graphql\.anilist\.co/);
      return fakeJson({ data: { Page: { characters: [{ id: 77, name: { full: "Naruto Uzumaki", native: "うずまきナルト", alternative: [] }, image: { large: "https://s4.anilist.co/file/anilistcdn/character/large/77.jpg" } }] } } });
    }
  });
  const a = await resolver.lookup("Naruto Uzumaki", "animes-desenhos");
  assert.equal(a.source, "anilist");
  assert.match(a.sourceUrl, /\/character\/77/);
  const b = await resolver.lookup("Naruto Uzumaki", "animes-desenhos");
  assert.equal(b.imageUrl, a.imageUrl);
  assert.equal(calls, 1, "cached lookup prevents extra API call");
});

test("AniList rejects unrelated result, falls through to wikipedia", async () => {
  const resolver = makeImageResolver({ env: {}, fetchFn: async (url) => {
    if (String(url).includes("anilist.co")) return fakeJson({ data: { Page: { characters: [{ id: 1, name: { full: "Completely Different", alternative: [] }, image: { large: "https://s4.anilist.co/other.jpg" } }] } } });
    return fakeJson({ query: { pages: { "-1": { missing: "" } } } });
  }});
  const result = await resolver.lookup("Naruto Uzumaki", "animes-desenhos");
  assert.equal(result, null);
});

test("TMDB actor search uses secret only on server side and exact match", async () => {
  const calls = [];
  const resolver = makeImageResolver({ env: { TMDB_READ_ACCESS_TOKEN: "TEST_SECRET" }, fetchFn: async (url, opts) => {
    calls.push({ url: String(url), opts });
    return fakeJson({ results: [
      { id: 1, name: "Tom Hanks Jr", profile_path: "/wrong.jpg" },
      { id: 2, name: "Tom Hanks", profile_path: "/right.jpg" }
    ] });
  }});
  const result = await resolver.lookup("Tom Hanks", "famosos");
  assert.equal(result?.source, "tmdb");
  assert.equal(result?.imageUrl, "https://image.tmdb.org/t/p/w500/right.jpg");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer TEST_SECRET");
  assert.ok(!result.imageUrl.includes("TEST_SECRET"));
});

test("TVmaze show cast exact match returns character portrait", async () => {
  const resolver = makeImageResolver({ env: {}, fetchFn: async (url) => {
    if (String(url).includes("singlesearch/shows")) return fakeJson({ id: 3, name: "Breaking Bad" });
    if (String(url).includes("/shows/3/cast")) return fakeJson([{ character: { name: "Walter White", image: { medium: "https://static.tvmaze.com/uploads/images/medium_portrait/1/1.jpg" } } }]);
    return fakeJson({});
  }});
  const result = await resolver.lookup("Walter White", "cinema-series");
  assert.equal(result.source, "tvmaze");
  assert.match(result.sourceUrl, /shows\/3/);
});

test("Wikipedia remains final fallback and can use English title", async () => {
  const resolver = makeImageResolver({ env: { WHOAMI_ANILIST_ENABLED: "false" }, fetchFn: async (url) => {
    const parsed = new URL(url);
    return parsed.hostname.startsWith("en.") ? fakeJson({ query: { pages: { "1": { title: "Iron Man", thumbnail: { source: "https://upload.wikimedia.org/wikipedia/en/a/ab/iron.jpg" } } } } }) : fakeJson({ query: { pages: {} } });
  }});
  const result = await resolver.lookup("Homem de Ferro", "jogos");
  assert.equal(result.source, "wikipedia");
});

test("Does not perform bulk fetching or create data for a missing character", async () => {
  let calls = 0;
  const resolver = makeImageResolver({ env: { WHOAMI_ANILIST_ENABLED: "false", WHOAMI_TVMAZE_ENABLED: "false" }, fetchFn: async () => {
    calls += 1;
    return fakeJson({ query: { pages: {} } });
  }});
  assert.equal(await resolver.lookup("Desconhecido Teste", "animes-desenhos"), null);
  assert.equal(await resolver.lookup("Desconhecido Teste", "animes-desenhos"), null);
  assert.equal(calls, 2);
});
