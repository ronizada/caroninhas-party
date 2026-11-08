"use strict";

// Consultas SOB DEMANDA, apenas para os personagens exibidos na partida.
// Nenhuma coleta em massa, nenhuma credencial entregue ao navegador.
const TV_SHOWS = Object.freeze({
  "Walter White": "Breaking Bad",
  "Jesse Pinkman": "Breaking Bad",
  "Saul Goodman": "Better Call Saul",
  "Eleven": "Stranger Things",
  "Michael Scott": "The Office",
  "Jim Halpert": "The Office",
  "Dwight Schrute": "The Office",
  "Sheldon Cooper": "The Big Bang Theory",
  "Barney Stinson": "How I Met Your Mother",
  "Rachel Green": "Friends",
  "Chandler Bing": "Friends",
  "Phoebe Buffay": "Friends",
  "Monica Geller": "Friends",
  "Ross Geller": "Friends",
  "Joey Tribbiani": "Friends",
  "Daenerys Targaryen": "Game of Thrones",
  "Jon Snow": "Game of Thrones",
  "Tyrion Lannister": "Game of Thrones",
  "Cersei Lannister": "Game of Thrones",
  "Arya Stark": "Game of Thrones",
  "Rick Grimes": "The Walking Dead",
  "Daryl Dixon": "The Walking Dead",
  "Thomas Shelby": "Peaky Blinders",
  "Meredith Grey": "Grey's Anatomy",
  "Damon Salvatore": "The Vampire Diaries",
  "Stefan Salvatore": "The Vampire Diaries",
  "Dexter Morgan": "Dexter",
  "Sydney Adamu": "The Bear",
  "Carmen Berzatto": "The Bear",
  "Carmy Berzatto": "The Bear",
  "Richie Jerimovich": "The Bear",
  "Joel Miller": "The Last of Us",
  "Ellie Williams": "The Last of Us"
});

// Referências explícitas evitam resolver um homônimo incorreto.
// São IDs de entidades, nunca links de imagens inseridos sem validação.
const WIKIDATA_IDS = Object.freeze({
  "Sócrates": "Q913",
  "Franklin D. Roosevelt": "Q8007"
});

// Personagens de filmes: usa somente atores identificados por papel exato
// no elenco do filme, evitando escolher atores homônimos.
const MOVIE_ROLES = Object.freeze({
  "Lydia Tár": "Tár"
});

const ANILIST_ALIASES = Object.freeze({
  "Goku": "Son Goku",
  "Naruto": "Naruto Uzumaki",
  "Luffy": "Monkey D. Luffy",
  "Tanjiro": "Tanjirou Kamado",
  "Kakashi": "Kakashi Hatake",
  "Jotaro Kujo": "Jotarou Kuujou"
});

const WIKI_ALIASES = Object.freeze({
  "Homem de Ferro": "Iron Man",
  "Homem-Aranha": "Spider-Man",
  "Mulher-Maravilha": "Wonder Woman",
  "Batman": "Batman",
  "Eleven": "Eleven (Stranger Things)"
});

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function exact(a, b) { return Boolean(normalize(a) && normalize(a) === normalize(b)); }
function imageFrom(source, url, sourceUrl) {
  if (typeof url !== "string" || url.length > 1400) return null;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
  const hosts = {
    anilist: ["s4.anilist.co", "s3.anilist.co"],
    tmdb: ["image.tmdb.org"],
    tvmaze: ["static.tvmaze.com"],
    wikipedia: ["upload.wikimedia.org"],
    commons: ["upload.wikimedia.org"],
    igdb: ["images.igdb.com"]
  };
  if (!hosts[source]?.includes(parsed.hostname.toLowerCase())) return null;
  return { imageUrl: parsed.href, source, sourceUrl: sourceUrl || null };
}

function makeImageResolver({ fetchFn = globalThis.fetch, env = process.env, now = Date.now, timeoutMs = 3000 } = {}) {
  const cache = new Map();
  const running = new Map();
  const TTL_FOUND = 6 * 60 * 60 * 1000;
  const TTL_MISSING = 90 * 1000;

  // Também devolve o código HTTP para permitir reagir ao 401 da IGDB.
  // Os demais provedores continuam usando jsonFrom, como antes.
  async function jsonResponseFrom(url, options = {}) {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetchFn(url, {
        ...options,
        signal,
        headers: {
          "User-Agent": "CaroninhasParty/20.19 (image lookup; https://caroninhas-party.discloud.dev/)",
          "Accept": "application/json",
          ...(options.headers || {})
        }
      });
      const status = Number(response.status || (response.ok ? 200 : 0));
      if (!response.ok) return { ok: false, status, data: null };
      const size = Number(response.headers?.get?.("content-length") || 0);
      if (size > 500_000) return { ok: false, status, data: null };
      return { ok: true, status, data: await response.json() };
    } catch {
      return { ok: false, status: 0, data: null };
    }
  }

  async function jsonFrom(url, options = {}) {
    const response = await jsonResponseFrom(url, options);
    return response.ok ? response.data : null;
  }

  // Um access token de aplicação da Twitch não tem refresh_token: quando
  // expira, é necessário solicitar OUTRO usando client_credentials.
  // Cache e requisições simultâneas são compartilhados somente no servidor.
  let igdbToken = null;
  let igdbTokenRequest = null;
  let igdbRetryAfter = 0;

  async function getIgdbAccessToken() {
    const clientId = String(env.IGDB_CLIENT_ID || "").trim();
    const clientSecret = String(env.IGDB_CLIENT_SECRET || "").trim();
    if (!clientId) return null;
    // Compatibilidade com V20.18: token fixo continua funcionando.
    if (!clientSecret) return String(env.IGDB_ACCESS_TOKEN || "").trim() || null;
    if (igdbToken && now() < igdbToken.expiresAt) return igdbToken.value;
    if (igdbTokenRequest) return igdbTokenRequest;
    if (now() < igdbRetryAfter) return null;

    igdbTokenRequest = (async () => {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials"
      });
      const response = await jsonResponseFrom("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });
      const value = response.data?.access_token;
      const seconds = Number(response.data?.expires_in);
      if (!response.ok || typeof value !== "string" || !value ||
          !Number.isFinite(seconds) || seconds <= 0) {
        igdbRetryAfter = now() + 30_000; // Evita sobrecarregar a Twitch em falhas.
        return null;
      }
      const lifetimeMs = Math.min(seconds, 100_000_000) * 1000;
      const safetyMs = Math.min(60_000, lifetimeMs * 0.1);
      igdbToken = { value, expiresAt: now() + lifetimeMs - safetyMs };
      igdbRetryAfter = 0;
      return value;
    })();
    try { return await igdbTokenRequest; }
    finally { igdbTokenRequest = null; }
  }

  async function igdbRequest(endpoint, body) {
    const clientId = String(env.IGDB_CLIENT_ID || "").trim();
    if (!clientId) return null;
    let token = await getIgdbAccessToken();
    if (!token) return null;

    const fetchWithToken = (value) => jsonResponseFrom(`https://api.igdb.com/v4/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${value}`,
        "Content-Type": "text/plain"
      },
      body
    });
    let response = await fetchWithToken(token);
    // Token revogado/expirado antes do prazo: novo token e UMA tentativa.
    // Não tentar renovar credenciais estáticas sem Client Secret.
    if (response.status === 401 && String(env.IGDB_CLIENT_SECRET || "").trim()) {
      if (igdbToken?.value === token) igdbToken = null;
      token = await getIgdbAccessToken();
      if (token) response = await fetchWithToken(token);
    }
    return response.ok ? response.data : null;
  }

  async function anilist(name) {
    if (env.WHOAMI_ANILIST_ENABLED === "false") return null;
    const lookup = ANILIST_ALIASES[name] || name;
    const query = `query ($name: String!) { Page(page: 1, perPage: 6) { characters(search: $name) { id name { full native alternative } image { large } } } }`;
    const data = await jsonFrom("https://graphql.anilist.co", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { name: lookup } })
    });
    const candidate = (data?.data?.Page?.characters || []).find(item =>
      [item.name?.full, item.name?.native, ...(item.name?.alternative || [])].some(variant => exact(variant, lookup))
    );
    return candidate ? imageFrom("anilist", candidate.image?.large, `https://anilist.co/character/${candidate.id}`) : null;
  }

  async function tmdb(name) {
    const token = String(env.TMDB_READ_ACCESS_TOKEN || "").trim();
    const key = String(env.TMDB_API_KEY || "").trim();
    if (!token && !key) return null;
    const url = new URL("https://api.themoviedb.org/3/search/person");
    url.searchParams.set("query", name);
    url.searchParams.set("language", "pt-BR");
    if (!token) url.searchParams.set("api_key", key);
    const data = await jsonFrom(url.href, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const candidate = (data?.results || []).find(person => exact(person.name, name) && person.profile_path);
    if (!candidate) return null;
    return imageFrom("tmdb", `https://image.tmdb.org/t/p/w500${candidate.profile_path}`, `https://www.themoviedb.org/person/${candidate.id}`);
  }

  async function movieRole(name) {
    if (!MOVIE_ROLES[name]) return null;
    const token = String(env.TMDB_READ_ACCESS_TOKEN || "").trim();
    const key = String(env.TMDB_API_KEY || "").trim();
    if (!token && !key) return null;
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    const search = new URL("https://api.themoviedb.org/3/search/movie");
    search.searchParams.set("query", MOVIE_ROLES[name]);
    if (!token) search.searchParams.set("api_key", key);
    const films = await jsonFrom(search.href, { headers: authHeaders });
    const film = (films?.results || []).find(item => exact(item.title, MOVIE_ROLES[name]) || exact(item.original_title, MOVIE_ROLES[name]));
    if (!film || !Number.isInteger(film.id)) return null;
    const creditsUrl = new URL(`https://api.themoviedb.org/3/movie/${film.id}/credits`);
    if (!token) creditsUrl.searchParams.set("api_key", key);
    const credits = await jsonFrom(creditsUrl.href, { headers: authHeaders });
    const actor = (credits?.cast || []).find(item => exact(item.character, name) && item.profile_path);
    return actor ? imageFrom("tmdb", `https://image.tmdb.org/t/p/w500${actor.profile_path}`, `https://www.themoviedb.org/person/${actor.id}`) : null;
  }

  // IGDB tem retratos INDIVIDUAIS de personagens, diferentemente de APIs de
  // capas de jogos. Exige token Twitch e client id apenas no backend.
  async function igdb(name) {
    if (env.WHOAMI_IGDB_ENABLED === "false") return null;
    const escapedName = name.replace(/[^\p{L}\p{N} '\-]/gu, " ").replace(/'/g, " ").trim();
    if (escapedName.length < 2) return null;
    const data = await igdbRequest("characters",
      `search "${escapedName}"; fields name,akas,mug_shot,url; limit 10;`);
    const character = (Array.isArray(data) ? data : []).find(item => item.mug_shot &&
      [item.name, ...(Array.isArray(item.akas) ? item.akas.map(a => typeof a === "string" ? a : a?.name) : [])].some(alias => exact(alias, name)));
    if (!character || !Number.isInteger(character.mug_shot)) return null;
    const images = await igdbRequest("character_mug_shots",
      `fields image_id; where id = ${character.mug_shot}; limit 1;`);
    const imageId = Array.isArray(images) ? images[0]?.image_id : null;
    if (typeof imageId !== "string" || !/^[a-z0-9_]+$/i.test(imageId)) return null;
    const sourceUrl = typeof character.url === "string" && /^https:\/\/(?:www\.)?igdb\.com\//.test(character.url)
      ? character.url : "https://www.igdb.com/";
    return imageFrom("igdb", `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`, sourceUrl);
  }

  async function tvmaze(name, category) {
    if (env.WHOAMI_TVMAZE_ENABLED === "false") return null;
    if (category === "cinema-series") {
      const showName = TV_SHOWS[name];
      if (!showName) return null; // Não adivinhar a série a partir do personagem.
      const show = await jsonFrom(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(showName)}`);
      if (!show?.id || !exact(show.name, showName)) return null;
      const cast = await jsonFrom(`https://api.tvmaze.com/shows/${show.id}/cast`);
      const match = Array.isArray(cast) ? cast.find(item => exact(item.character?.name, name)) : null;
      return match ? imageFrom("tvmaze", match.character?.image?.original || match.character?.image?.medium || match.person?.image?.original || match.person?.image?.medium, `https://www.tvmaze.com/shows/${show.id}`) : null;
    }
    if (!new Set(["famosos", "brasil"]).has(category)) return null;
    const people = await jsonFrom(`https://api.tvmaze.com/search/people?q=${encodeURIComponent(name)}`);
    const match = Array.isArray(people) ? people.find(item => exact(item.person?.name, name)) : null;
    return match ? imageFrom("tvmaze", match.person?.image?.original || match.person?.image?.medium, match.person?.url) : null;
  }

  async function wikipedia(name) {
    for (const language of ["pt", "en"]) {
      const choices = language === "en" && WIKI_ALIASES[name] ? [WIKI_ALIASES[name], name] : [name];
      for (const choice of choices) {
        const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
        for (const [k,v] of Object.entries({ action: "query", format: "json", redirects: "1", prop: "pageimages", piprop: "thumbnail", pithumbsize: "500", titles: choice })) url.searchParams.set(k, v);
        const data = await jsonFrom(url.href);
        const page = Object.values(data?.query?.pages || {}).find(item => item.thumbnail?.source && !item.missing);
        if (!page) continue;
        const image = imageFrom("wikipedia", page.thumbnail.source, `https://${language}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`);
        if (image) return image;
      }
    }
    return null;
  }

  async function wikidata(name, category) {
    if (env.WHOAMI_WIKIDATA_ENABLED === "false") return null;
    // Buscas gerais de personagens fictícios são ambíguas. Para eles, usar
    // uma fonte com identificação da obra (AniList, TVmaze, IGDB, etc.).
    if (!["historia-cultura", "brasil", "famosos"].includes(category)) return null;
    let entityId = WIKIDATA_IDS[name] || null;
    if (!entityId) {
      for (const language of ["pt", "en"]) {
        const url = new URL("https://www.wikidata.org/w/api.php");
        Object.entries({ action: "wbsearchentities", format: "json", language, search: name, limit: "8", type: "item" })
          .forEach(([key, value]) => url.searchParams.set(key, value));
        const data = await jsonFrom(url.href);
        const matches = (data?.search || []).filter(item => exact(item.label, name) ||
          (Array.isArray(item.aliases) && item.aliases.some(alias => exact(alias, name))));
        if (matches.length > 1) return null; // homônimos: não chutar uma foto
        if (matches.length === 1 && /^Q[1-9][0-9]*$/.test(matches[0].id)) {
          entityId = matches[0].id;
          break;
        }
      }
    }
    if (!entityId) return null;
    const url = new URL("https://www.wikidata.org/w/api.php");
    Object.entries({ action: "wbgetentities", format: "json", ids: entityId, props: "claims" })
      .forEach(([key, value]) => url.searchParams.set(key, value));
    const entity = await jsonFrom(url.href);
    const filename = entity?.entities?.[entityId]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (typeof filename !== "string" || filename.length > 180 || !/\.(?:png|jpe?g|webp)$/i.test(filename)) return null;
    const infoUrl = new URL("https://commons.wikimedia.org/w/api.php");
    Object.entries({ action: "query", format: "json", titles: `File:${filename}`, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "500" })
      .forEach(([key, value]) => infoUrl.searchParams.set(key, value));
    const info = await jsonFrom(infoUrl.href);
    const page = Object.values(info?.query?.pages || {})[0];
    const fileInfo = page?.imageinfo?.[0];
    const license = String(fileInfo?.extmetadata?.LicenseShortName?.value || "");
    // Apenas licenças potencialmente reutilizáveis; a página da imagem traz
    // autor e condições de atribuição, que devem ser verificadas pelo site.
    if (!/^(?:CC\s*(?:BY|0)|public domain|pd\b)/i.test(license)) return null;
    return imageFrom("commons", fileInfo.thumburl || fileInfo.url,
      `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename.replace(/ /g, "_"))}`);
  }

  async function lookup(name, category = "") {
    const cleaned = String(name || "").trim().slice(0, 120);
    if (!cleaned || cleaned.length < 2) return null;
    const key = `${normalize(category)}:${normalize(cleaned)}`;
    const known = cache.get(key);
    if (known && known.expiresAt > now()) return known.result;
    if (running.has(key)) return running.get(key);

    const task = (async () => {
      const order = category === "animes-desenhos"
        ? [anilist, wikipedia]
        : category === "cinema-series"
          ? [(n) => tvmaze(n, category), movieRole, wikipedia]
          : category === "jogos"
            ? [igdb, wikipedia]
            : ["famosos", "brasil"].includes(category)
              ? [tmdb, (n) => tvmaze(n, category), wikipedia, (n) => wikidata(n, category)]
              : category === "historia-cultura"
                ? [wikipedia, (n) => wikidata(n, category)]
                : [wikipedia];
      let result = null;
      for (const provider of order) {
        result = await provider(cleaned);
        if (result) break;
      }
      if (cache.size >= 500) cache.delete(cache.keys().next().value);
      cache.set(key, { result, expiresAt: now() + (result ? TTL_FOUND : TTL_MISSING) });
      return result;
    })();
    running.set(key, task);
    try { return await task; } finally { running.delete(key); }
  }

  return { lookup };
}

module.exports = { makeImageResolver, normalize, imageFrom, TV_SHOWS, WIKIDATA_IDS, MOVIE_ROLES };
