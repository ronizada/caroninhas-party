const socket = io();

function retroIcon(name, className = "") {
  const extra = className ? ` ${className}` : "";

  return `
    <svg class="site-icon${extra}" aria-hidden="true">
      <use href="#icon-${name}"></use>
    </svg>
  `;
}

const ICON_MAP = {
  "★": "star",
  "⚠": "warning",
  "!": "warning"
};



/* =========================================================
   V13.1 — Textos iniciando com letra maiúscula
   ========================================================= */

function capitalizeFirstLetter(text) {
  if (!text) return text;

  const index = text.search(/[A-Za-zÀ-ÖØ-öø-ÿ]/);

  if (index === -1) {
    return text;
  }

  return (
    text.slice(0, index) +
    text.charAt(index).toLocaleUpperCase("pt-BR") +
    text.slice(index + 1)
  );
}

function capitalizeTextNode(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE) {
    return;
  }

  const parent = node.parentElement;

  if (
    !parent ||
    parent.closest("script, style, code, pre") ||
    parent.matches(".window-title")
  ) {
    return;
  }

  const updated = capitalizeFirstLetter(node.nodeValue);

  if (updated !== node.nodeValue) {
    node.nodeValue = updated;
  }
}

function capitalizeUi(root = document.body) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT
  );

  const nodes = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  nodes.forEach(capitalizeTextNode);
}

const capitalizationObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === "characterData") {
      capitalizeTextNode(mutation.target);
      return;
    }

    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        capitalizeTextNode(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        capitalizeUi(node);
      }
    });
  });
});

capitalizeUi();
capitalizationObserver.observe(document.body, {
  subtree: true,
  childList: true,
  characterData: true
});

const firstPagePath = window.location.pathname;
const firstDeepLinkMatch = firstPagePath.match(/^\/(impostor|quem-sou-eu|corrida-do-conhecimento)(?:\/([A-Z0-9]{4}))?\/?$/i);
let pendingDeepLink = firstDeepLinkMatch ? { slug: firstDeepLinkMatch[1].toLowerCase(), code: firstDeepLinkMatch[2]?.toUpperCase() || null } : null;

const STORAGE_KEYS = {
  playerToken: "caroninhas_player_token",
  sessionSecret: "caroninhas_room_session_secret",
  roomCode: "caroninhas_room_code",
  playerName: "caroninhas_player_name",
  playerAvatar: "caroninhas_player_avatar"
};

function generatePlayerToken() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2) +
    "-" +
    Math.random().toString(36).slice(2)
  );
}

let playerToken =
  sessionStorage.getItem(STORAGE_KEYS.playerToken);

if (!playerToken) {
  playerToken = generatePlayerToken();
  sessionStorage.setItem(
    STORAGE_KEYS.playerToken,
    playerToken
  );
}


const AVATARS = [
  { id: "cat", name: "Gato", src: "/avatars/cat.png" },
  { id: "dog", name: "Cachorro", src: "/avatars/dog.png" },
  { id: "fox", name: "Raposa", src: "/avatars/fox.png" },
  { id: "bear", name: "Urso", src: "/avatars/bear.png" },
  { id: "panda", name: "Panda", src: "/avatars/panda.png" },
  { id: "frog", name: "Sapo", src: "/avatars/frog.png" },
  { id: "penguin", name: "Pinguim", src: "/avatars/penguin.png" },
  { id: "owl", name: "Coruja", src: "/avatars/owl.png" },
  { id: "tiger", name: "Tigre", src: "/avatars/tiger.png" },
  { id: "pig", name: "Porquinho", src: "/avatars/pig.png" }
];

function getAvatarDefinition(id) {
  const value = String(id || "");

  if (value.startsWith("profile:")) {
    const [, userId, version] = value.split(":");
    return {
      id: value,
      name: "Foto de perfil",
      src: `/api/profile/image/${encodeURIComponent(userId)}${version ? `?v=${encodeURIComponent(version)}` : ""}`
    };
  }

  return AVATARS.find((avatar) => avatar.id === value) ||
    AVATARS.find((avatar) => avatar.id === "dog") ||
    AVATARS[0];
}

function avatarImage(id, className = "") {
  const avatar = getAvatarDefinition(id);
  const extra = className ? ` ${className}` : "";

  return `<img class="player-avatar${extra}" src="${avatar.src}" alt="${avatar.name}" />`;
}

let selectedAvatar =
  sessionStorage.getItem(STORAGE_KEYS.playerAvatar) || "dog";

if (!AVATARS.some((avatar) => avatar.id === selectedAvatar)) {
  selectedAvatar = "dog";
}

sessionStorage.setItem(
  STORAGE_KEYS.playerAvatar,
  selectedAvatar
);

let currentUser = null;
let currentStats = null;
let avatarModalMode = "guest";
let recoveryResetToken = null;

let roomCode =
  sessionStorage.getItem(STORAGE_KEYS.roomCode);

let currentRoom = null;
let isSpectator = false;
let spectatorSnapshot = null;
let roomSessionSecret = sessionStorage.getItem(STORAGE_KEYS.sessionSecret) || null;
function saveAdmission(response) {
  if (!response?.ok) return;
  roomSessionSecret = response.sessionSecret || roomSessionSecret;
  if (roomSessionSecret) sessionStorage.setItem(STORAGE_KEYS.sessionSecret, roomSessionSecret);
  isSpectator = Boolean(response.spectator);
}
function gameSlug(type) {
  return { impostor: "impostor", whoami: "quem-sou-eu", trivia: "corrida-do-conhecimento" }[type] || "";
}

let activeRooms = [];
let resumingSession = Boolean(roomCode);

const games = [
  {
    id: "impostor",
    name: "Impostor",
    description: "Descubra quem não conhece a palavra secreta.",
    icon: "eye",
    status: "available"
  },
  {
    id: "whoami",
    name: "Quem Sou Eu?",
    description: "Descubra qual personagem foi escolhido para você.",
    icon: "question",
    status: "available"
  },
  {
    id: "trivia",
    name: "Corrida do Conhecimento",
    description: "Responda, suba sua torre até 10 e dispute o primeiro lugar!",
    icon: "star",
    status: "available"
  },
  {
    id: "bomba",
    name: "Bomba",
    description: "Responda rápido antes que a bomba estoure.",
    icon: "bomb",
    status: "soon"
  },
  {
    id: "provavel",
    name: "Mais provável",
    description: "Vote em quem mais combina com cada situação.",
    icon: "vote",
    status: "soon"
  },
  {
    id: "desafios",
    name: "Desafios",
    description: "Cartas, perguntas e desafios para a galera.",
    icon: "dice",
    status: "soon"
  },
  {
    id: "desenho",
    name: "Desenho",
    description: "Desenhe e tente fazer seus amigos adivinharem.",
    icon: "pencil",
    status: "soon"
  }
];

const menuScreen = document.querySelector("#menu-screen");
const impostorHomeScreen = document.querySelector("#impostor-home-screen");
const lobbyScreen = document.querySelector("#lobby-screen");
const gameScreen = document.querySelector("#game-screen");
const impostorVoteScreen = document.querySelector("#impostor-vote-screen");
const impostorResultScreen = document.querySelector("#impostor-result-screen");

const whoamiHomeScreen = document.querySelector("#whoami-home-screen");
const whoamiLobbyScreen = document.querySelector("#whoami-lobby-screen");
const whoamiReviewScreen = document.querySelector("#whoami-review-screen");
const whoamiGameScreen = document.querySelector("#whoami-game-screen");
const whoamiWinnerScreen = document.querySelector("#whoami-winner-screen");
const spectatorScreen = document.querySelector("#spectator-screen");
const triviaHomeScreen = document.querySelector("#trivia-home-screen");
const triviaLobbyScreen = document.querySelector("#trivia-lobby-screen");
const triviaGameScreen = document.querySelector("#trivia-game-screen");
const triviaWinnerScreen = document.querySelector("#trivia-winner-screen");

const allScreens = [
  menuScreen,
  impostorHomeScreen,
  lobbyScreen,
  gameScreen,
  impostorVoteScreen,
  impostorResultScreen,
  whoamiHomeScreen,
  whoamiLobbyScreen,
  whoamiReviewScreen,
  whoamiGameScreen,
  whoamiWinnerScreen,
  triviaHomeScreen, triviaLobbyScreen, triviaGameScreen, triviaWinnerScreen,
  spectatorScreen
];

function showScreen(screen) {
  allScreens.forEach((item) => item.classList.add("hidden"));
  screen.classList.remove("hidden");

  [...document.body.classList].forEach((className) => {
    if (className.startsWith("screen-mode-")) {
      document.body.classList.remove(className);
    }
  });

  document.body.classList.add(
    "app-screen-active",
    `screen-mode-${screen.id}`
  );

  document.body.classList.toggle(
    "whoami-game-active",
    screen === whoamiGameScreen
  );

  document.body.classList.toggle(
    "whoami-winner-active",
    screen === whoamiWinnerScreen
  );

  const inRoom = Boolean(currentRoom?.code) && (
    screen === spectatorScreen ||
    [lobbyScreen, gameScreen, impostorVoteScreen, impostorResultScreen,
     whoamiLobbyScreen, whoamiReviewScreen, whoamiGameScreen, whoamiWinnerScreen,
     triviaLobbyScreen, triviaGameScreen, triviaWinnerScreen].includes(screen)
  );
  const slug = inRoom ? gameSlug(currentRoom.gameType) :
    screen === impostorHomeScreen ? "impostor" :
    screen === whoamiHomeScreen ? "quem-sou-eu" :
    screen === triviaHomeScreen ? "corrida-do-conhecimento" : "";
  const route = slug ? `/${slug}${inRoom ? `/${currentRoom.code}` : ""}` : "/";
  if (window.location.pathname !== route) window.history.replaceState({}, "", route);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ================= MENU ================= */

const gamesGrid = document.querySelector("#games-grid");
const gamesCounter = document.querySelector("#games-counter");
const menuMessage = document.querySelector("#menu-message");

function renderGames() {
  gamesGrid.innerHTML = "";

  const availableCount = games.filter(
    (game) => game.status === "available"
  ).length;

  gamesCounter.textContent =
    `${availableCount} disponível • ${games.length - availableCount} em breve`;

  games.forEach((game, index) => {
    const card = document.createElement("button");

    card.type = "button";
    card.className =
      `game-card-menu ${game.status === "available" ? "available" : "locked"}`;

    card.innerHTML = `
      <div class="game-card-topbar">
        <div class="card-dots">
          <span class="card-dot"></span>
          <span class="card-dot"></span>
          <span class="card-dot"></span>
        </div>

        <span class="game-state">
          ${game.status === "available" ? "JOGAR" : "EM BREVE"}
        </span>
      </div>

      <div class="game-card-body">
        <div class="game-emoji">${retroIcon(game.icon, "game-menu-svg")}</div>
        <h3>${game.name}</h3>
        <p>${game.description}</p>
        <span class="game-number">
          arquivo_${String(index + 1).padStart(2, "0")}.exe
        </span>
      </div>
    `;

    card.addEventListener("click", () => {
      if (game.status !== "available") {
        menuMessage.textContent =
          `${game.name} ainda está em desenvolvimento ♡`;

        clearTimeout(window.menuMessageTimer);

        window.menuMessageTimer = setTimeout(() => {
          menuMessage.textContent = "";
        }, 2500);

        return;
      }

      menuMessage.textContent = "";

      if (game.id === "impostor") {
        showScreen(impostorHomeScreen);
        requestRooms();
      }

      if (game.id === "whoami") {
        showScreen(whoamiHomeScreen);
        requestRooms();
      }
      if (game.id === "trivia") {
        showScreen(triviaHomeScreen);
        loadTriviaConfig();
        requestRooms();
      }

    });

    gamesGrid.appendChild(card);
  });
}

renderGames();

const ROOM_UI = {
  impostor: { gameType: "impostor", slug: "impostor", home: impostorHomeScreen,
    name: () => getName(), input: () => roomInput, error: () => homeError, join: code => joinRoom(code) },
  whoami: { gameType: "whoami", slug: "quem-sou-eu", home: whoamiHomeScreen,
    name: () => getWhoAmIName(), input: () => whoamiRoomInput, error: () => whoamiHomeError, join: code => joinWhoAmIRoom(code) },
  trivia: { gameType: "trivia", slug: "corrida-do-conhecimento", home: triviaHomeScreen,
    name: () => triviaName(), input: () => triviaEl('room-code'), error: () => triviaEl('home-error'), join: code => triviaJoin(code) }
};
for (const kind of Object.keys(ROOM_UI)) {
  const check = document.getElementById(`${kind}-private`);
  const fields = document.getElementById(`${kind}-private-fields`);
  check?.addEventListener("change", () => fields?.classList.toggle("hidden", !check.checked));
}
// API universal de configurações: um registro por usuário e por jogo.
// Visitantes mantêm as preferências no próprio navegador.
// A senha da sala NÃO é persistida por segurança.
const GAME_SETTINGS_PREFIX = "caroninhas_party_settings_v1:";
const GAME_SETTINGS_FIELDS = {
  impostor: { category: "create-category", difficulty: "create-difficulty" },
  whoami: { category: "whoami-category", difficulty: "whoami-difficulty", allFinish: "whoami-all-finish" }
};
const settingsLoads = new Map();
function gamePreferenceKey(kind) { return `${GAME_SETTINGS_PREFIX}${kind}`; }
function captureGamePreferences(kind) {
  const fields = GAME_SETTINGS_FIELDS[kind] || {};
  const result = {
    categoryId: document.getElementById(fields.category)?.value || "all",
    difficultyId: document.getElementById(fields.difficulty)?.value || "all",
    isPrivate: Boolean(document.getElementById(`${kind}-private`)?.checked)
  };
  if (fields.allFinish) result.allFinish = Boolean(document.getElementById(fields.allFinish)?.checked);
  return result;
}
function applyGamePreferences(kind, settings = {}) {
  const fields = GAME_SETTINGS_FIELDS[kind];
  if (!fields) return;
  const category = document.getElementById(fields.category);
  const difficulty = document.getElementById(fields.difficulty);
  if (category) category.value = [...category.options].some(o => o.value === String(settings.categoryId)) ? String(settings.categoryId) : "all";
  if (difficulty) difficulty.value = [...difficulty.options].some(o => o.value === String(settings.difficultyId)) ? String(settings.difficultyId) : "all";
  const privateCheck = document.getElementById(`${kind}-private`);
  if (privateCheck) {
    privateCheck.checked = Boolean(settings.isPrivate);
    privateCheck.dispatchEvent(new Event("change"));
  }
  if (fields.allFinish) document.getElementById(fields.allFinish).checked = Boolean(settings.allFinish);
  // Em outra sala privada, o host deverá digitar uma nova senha.
  const password = document.getElementById(`${kind}-create-password`);
  if (password) password.value = "";
}
async function loadGamePreferences(kind) {
  if (!GAME_SETTINGS_FIELDS[kind]) return;
  const userId = currentUser?.id || null;
  const sequence = (settingsLoads.get(kind) || 0) + 1;
  settingsLoads.set(kind, sequence);
  let settings = {};
  if (userId) {
    try {
      const result = await apiJson(`/api/game-preferences/${encodeURIComponent(kind)}`, { method: "GET" });
      settings = result.settings || {};
    } catch (error) {
      console.warn("Falha ao recuperar configurações da conta:", error);
      return;
    }
  } else {
    try { settings = JSON.parse(localStorage.getItem(gamePreferenceKey(kind)) || "{}"); }
    catch (_) { settings = {}; }
  }
  if (settingsLoads.get(kind) !== sequence || (currentUser?.id || null) !== userId) return;
  applyGamePreferences(kind, settings);
}
async function saveGamePreferences(kind) {
  const settings = captureGamePreferences(kind);
  if (currentUser?.id) {
    try {
      await apiJson(`/api/game-preferences/${encodeURIComponent(kind)}`, {
        method: "PUT", body: JSON.stringify({ settings })
      });
    } catch (error) {
      console.warn("Configurações da sala não sincronizadas:", error);
    }
  } else {
    try { localStorage.setItem(gamePreferenceKey(kind), JSON.stringify(settings)); } catch (_) {}
  }
}
function refreshAllGamePreferences() {
  Object.keys(GAME_SETTINGS_FIELDS).forEach(kind => loadGamePreferences(kind));
}

function roomCreatePrivacy(kind) {
  const isPrivate = Boolean(document.getElementById(`${kind}-private`)?.checked);
  const roomPassword = document.getElementById(`${kind}-create-password`)?.value || "";
  return { isPrivate, roomPassword };
}
function roomJoinPassword(kind) {
  return document.getElementById(`${kind}-join-password`)?.value || "";
}
function showSpectatorRoom(room) {
  if (!room) return;
  currentRoom = room;
  roomCode = room.code;
  isSpectator = true;
  sessionStorage.setItem(STORAGE_KEYS.roomCode, roomCode);
  document.getElementById("spectator-room-code").textContent = `SALA ${room.code}`;
  document.getElementById("spectator-game-title").textContent =
    { impostor: "Impostor", whoami: "Quem Sou Eu?", trivia: "Corrida do Conhecimento" }[room.gameType] || "Partida";
  showScreen(spectatorScreen);
  socket.emit("spectator-get-state", { code: room.code }, result => {
    if (result?.ok) renderSpectatorState(result.state);
  });
}
function renderSpectatorState(state) {
  if (!isSpectator || !state || state.code !== roomCode) return;
  spectatorSnapshot = state;
  const phase = { category: "ESCOLHA DE TEMA", card_window: "CARTAS",
    die_roll: "SORTEIO DO DADO", question: "PERGUNTA", result: "RESULTADO",
    review: "REVISÃO", discussion: "DISCUSSÃO", voting: "VOTAÇÃO", tiebreak: "DESEMPATE",
    finished: "FIM DA PARTIDA", game: "EM JOGO" }[state.phase] || String(state.phase || "PARTIDA").toUpperCase();
  document.getElementById("spectator-phase").textContent = phase;
  document.getElementById("spectator-players-count").textContent = String(state.players?.length || 0);
  document.getElementById("spectator-viewers-count").textContent = String(state.spectatorCount || 0);
  document.getElementById("spectator-roster-list").innerHTML = (state.players || []).map(p => `
    <div class="spectator-person">${avatarImage(p.avatar,"spectator-avatar")}
    <strong>${escapeHtml(p.name)}</strong>
    <span>${p.eliminated ? "ELIMINADO" : p.connected ? "JOGANDO" : "DESCONECTADO"}</span></div>`).join("");
  const info = document.getElementById("spectator-game-info");
  if (state.gameType === "impostor") {
    info.innerHTML = `<div class="spectator-info-line">👁 Acompanhe a discussão e o andamento da votação. A palavra e o papel do impostor ficam ocultos.</div>
    ${state.speakingOrder?.length ? `<div class="spectator-info-line">Ordem de fala: ${state.speakingOrder.map(p=>escapeHtml(p.name)).join(" → ")}</div>` : ""}
    ${state.phase === "voting" ? `<div class="spectator-info-line">Votos recebidos: ${state.voteCount}/${state.totalVoters}</div>` : ""}`;
  } else if (state.gameType === "trivia") {
    info.textContent = `Acompanhe a disputa! Rodada ${state.roundNumber || 0}. As alternativas corretas só são reveladas após cada pergunta.`;
  } else {
    info.innerHTML = `<div class="spectator-info-line">👁 Acompanhe a rodada e as tentativas dos participantes. Personagens secretos não são mostrados ao espectador.</div>
    ${state.attempts?.length ? `<div class="spectator-info-line">Tentativas: ${state.attempts.map(p=>`${escapeHtml(p.name)} ${p.attempts}/3`).join(" • ")}</div>` : ""}`;
  }
}

showScreen(menuScreen);

/* ================= CONFIGURAÇÕES DO BANCO ================= */

const createCategory = document.querySelector("#create-category");
const createDifficulty = document.querySelector("#create-difficulty");
const wordBankStatus = document.querySelector("#word-bank-status");

async function loadGameConfig() {
  try {
    const response = await fetch("/api/game-config");

    if (!response.ok) {
      throw new Error("Falha ao carregar.");
    }

    const config = await response.json();

    config.categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      createCategory.appendChild(option);
    });

    config.difficulties.forEach((difficulty) => {
      const option = document.createElement("option");
      option.value = difficulty.id;
      option.textContent = difficulty.name;
      createDifficulty.appendChild(option);
    });

    wordBankStatus.textContent =
      `${config.totalWords} palavras • ` +
      `${config.categories.length} categorias • ` +
      `${config.difficulties.length} dificuldades`;
    await loadGamePreferences("impostor");
  } catch (error) {
    wordBankStatus.textContent =
      "não foi possível carregar o banco de palavras";
  }
}

loadGameConfig();


/* ================= CONFIGURAÇÕES DO QUEM SOU EU ================= */

const whoamiCategory = document.querySelector("#whoami-category");
const whoamiDifficulty = document.querySelector("#whoami-difficulty");
const whoamiBankStatus = document.querySelector("#whoami-bank-status");

async function loadWhoAmIConfig() {
  try {
    const response = await fetch("/api/whoami-config");

    if (!response.ok) {
      throw new Error("Falha ao carregar.");
    }

    const config = await response.json();

    config.categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      whoamiCategory.appendChild(option);
    });

    config.difficulties.forEach((difficulty) => {
      const option = document.createElement("option");
      option.value = difficulty.id;
      option.textContent = difficulty.name;
      whoamiDifficulty.appendChild(option);
    });

    whoamiBankStatus.textContent =
      `${config.totalCharacters} personagens • ` +
      `${config.categories.length} categorias • ` +
      `${config.difficulties.length} dificuldades`;
    await loadGamePreferences("whoami");
  } catch (error) {
    whoamiBankStatus.textContent =
      "não foi possível carregar os personagens";
  }
}

loadWhoAmIConfig();

/* ================= IMPOSTOR ================= */

const nameInput = document.querySelector("#name");
const roomInput = document.querySelector("#room-code");

const whoamiNameInput = document.querySelector("#whoami-name");
const whoamiRoomInput = document.querySelector("#whoami-room-code");

const avatarPreviewImpostor =
  document.querySelector("#avatar-preview-impostor");
const avatarPreviewWhoAmI =
  document.querySelector("#avatar-preview-whoami");

const avatarPreviewButtonImpostor =
  document.querySelector("#avatar-preview-button-impostor");
const avatarPreviewButtonWhoAmI =
  document.querySelector("#avatar-preview-button-whoami");

const avatarModal =
  document.querySelector("#avatar-modal");
const avatarModalGrid =
  document.querySelector("#avatar-modal-grid");
const avatarModalClose =
  document.querySelector("#avatar-modal-close");
const avatarModalCloseX =
  document.querySelector("#avatar-modal-close-x");

async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    }
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || "Não foi possível concluir esta ação.");
  }

  return data;
}

const avatarModalKicker = document.querySelector("#avatar-modal-kicker");
const avatarModalTitle = document.querySelector("#avatar-modal-title");
const avatarModalDescription = document.querySelector("#avatar-modal-description");
const avatarAccountUpload = document.querySelector("#avatar-account-upload");
const avatarPhotoInput = document.querySelector("#avatar-photo-input");
const avatarPhotoButton = document.querySelector("#avatar-photo-button");

function activeAvatarKey() {
  return currentUser?.avatarKey || selectedAvatar;
}

function updateAvatarPreview() {
  const selected = getAvatarDefinition(activeAvatarKey());

  if (avatarPreviewImpostor) {
    avatarPreviewImpostor.src = selected.src;
    avatarPreviewImpostor.alt = selected.name;
  }

  if (avatarPreviewWhoAmI) {
    avatarPreviewWhoAmI.src = selected.src;
    avatarPreviewWhoAmI.alt = selected.name;
  }

  const triviaAvatar = document.getElementById("avatar-preview-trivia");
  if (triviaAvatar) {
    triviaAvatar.src = selected.src;
    triviaAvatar.alt = selected.name;
  }
}

function renderAvatarModal() {
  if (!avatarModalGrid) return;

  avatarModalGrid.innerHTML = "";
  const accountMode = avatarModalMode === "account" && currentUser;
  const selectedPreset = accountMode && currentUser.avatarType === "preset"
    ? currentUser.avatarId
    : (!accountMode ? selectedAvatar : null);

  if (avatarModalKicker) avatarModalKicker.textContent = accountMode ? "PERFIL" : "VISITANTE";
  if (avatarModalTitle) avatarModalTitle.textContent = "Escolha seu avatar";
  if (avatarModalDescription) {
    avatarModalDescription.textContent = accountMode
      ? "Escolha um bichinho ou carregue uma foto sua."
      : "Escolha um animal para representar você nas salas.";
  }
  avatarAccountUpload?.classList.toggle("hidden", !accountMode);

  AVATARS.forEach((avatar) => {
    const button = document.createElement("button");
    const isSelected = avatar.id === selectedPreset;

    button.type = "button";
    button.className = `avatar-modal-option ${isSelected ? "selected" : ""}`;
    button.title = avatar.name;
    button.setAttribute("aria-label", `Escolher ${avatar.name}`);
    button.setAttribute("aria-pressed", String(isSelected));

    button.innerHTML = `
      <span class="avatar-modal-image-wrap">
        <img src="${avatar.src}" alt="${avatar.name}" />
        <span class="avatar-modal-check">✓</span>
      </span>
      <strong>${avatar.name}</strong>
    `;

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        if (accountMode) {
          const response = await apiJson("/api/profile/avatar", {
            method: "PATCH",
            body: JSON.stringify({ avatarId: avatar.id })
          });
          applyAuthenticatedUser(response.user, currentStats);
        } else {
          selectedAvatar = avatar.id;
          sessionStorage.setItem(STORAGE_KEYS.playerAvatar, selectedAvatar);
          updateAvatarPreview();
        }

        closeAvatarModal();
        showGlobalToast({
          icon: "✓",
          title: "Avatar salvo",
          message: `${avatar.name} agora é seu avatar.`,
          duration: 2200
        });
      } catch (error) {
        showGlobalToast({ icon: "!", title: "Não foi possível salvar", message: error.message });
        button.disabled = false;
      }
    });

    avatarModalGrid.appendChild(button);
  });
}

function openAvatarModal(mode = null) {
  avatarModalMode = mode || (currentUser ? "account" : "guest");
  renderAvatarModal();
  avatarModal.classList.remove("hidden");
  avatarModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeAvatarModal() {
  avatarModal.classList.add("hidden");
  avatarModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

[
  avatarPreviewButtonImpostor,
  avatarPreviewButtonWhoAmI,
  document.getElementById("avatar-preview-button-trivia")
]
  .filter(Boolean)
  .forEach((button) => {
    button.addEventListener("click", () => openAvatarModal(currentUser ? "account" : "guest"));
  });

avatarPhotoButton?.addEventListener("click", () => avatarPhotoInput?.click());

avatarPhotoInput?.addEventListener("change", async () => {
  const file = avatarPhotoInput.files?.[0];
  if (!file || !currentUser) return;

  if (file.size > 2 * 1024 * 1024) {
    showGlobalToast({ icon: "!", title: "Imagem muito grande", message: "Escolha uma imagem de até 2 MB." });
    avatarPhotoInput.value = "";
    return;
  }

  const imageData = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  }).catch((error) => {
    showGlobalToast({ icon: "!", title: "Erro na imagem", message: error.message });
    return null;
  });

  if (!imageData) return;

  try {
    avatarPhotoButton.disabled = true;
    avatarPhotoButton.textContent = "enviando...";

    const response = await apiJson("/api/profile/photo", {
      method: "POST",
      body: JSON.stringify({ imageData })
    });

    applyAuthenticatedUser(response.user, currentStats);
    closeAvatarModal();
    showGlobalToast({ icon: "✓", title: "Foto salva", message: "Sua foto de perfil foi atualizada." });
  } catch (error) {
    showGlobalToast({ icon: "!", title: "Erro no upload", message: error.message });
  } finally {
    avatarPhotoInput.value = "";
    avatarPhotoButton.disabled = false;
    avatarPhotoButton.textContent = "↑ carregar minha foto";
  }
});

avatarModalClose?.addEventListener("click", closeAvatarModal);
avatarModalCloseX?.addEventListener("click", closeAvatarModal);
avatarModal?.addEventListener("click", (event) => {
  if (event.target === avatarModal) closeAvatarModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && avatarModal && !avatarModal.classList.contains("hidden")) {
    closeAvatarModal();
  }
});

updateAvatarPreview();

const savedName =
  localStorage.getItem(STORAGE_KEYS.playerName);

if (savedName) {
  nameInput.value = savedName;
  whoamiNameInput.value = savedName;
}

if (roomCode) {
  roomInput.value = roomCode;
  whoamiRoomInput.value = roomCode;
}

const createButton = document.querySelector("#create-room");
const joinButton = document.querySelector("#join-room");
const copyButton = document.querySelector("#copy-code");
const startButton = document.querySelector("#start-game");
const readyToggleButton = document.querySelector("#ready-toggle");
const newRoundButton = document.querySelector("#new-round");
const startImpostorVoteButton = document.querySelector("#start-impostor-vote");
const impostorVoteWaiting = document.querySelector("#impostor-vote-waiting");
const impostorPhaseBanner = document.querySelector("#impostor-phase-banner");
const impostorSpeakingTitle = document.querySelector("#impostor-speaking-title");
const impostorVoteRoundLabel = document.querySelector("#impostor-vote-round-label");
const impostorVoteProgress = document.querySelector("#impostor-vote-progress");
const impostorVoteCandidates = document.querySelector("#impostor-vote-candidates");
const impostorVoteFeedback = document.querySelector("#impostor-vote-feedback");
const impostorResultSymbol = document.querySelector("#impostor-result-symbol");
const impostorResultTitle = document.querySelector("#impostor-result-title");
const impostorResultSubtitle = document.querySelector("#impostor-result-subtitle");
const impostorSelectedAvatar = document.querySelector("#impostor-selected-avatar");
const impostorSelectedName = document.querySelector("#impostor-selected-name");
const impostorRealAvatar = document.querySelector("#impostor-real-avatar");
const impostorRealName = document.querySelector("#impostor-real-name");
const impostorResultWord = document.querySelector("#impostor-result-word");
const impostorResultHint = document.querySelector("#impostor-result-hint");
const impostorResultCounts = document.querySelector("#impostor-result-counts");
const impostorResultNewRound = document.querySelector("#impostor-result-new-round");
const impostorResultWaiting = document.querySelector("#impostor-result-waiting");
const refreshRoomsButton = document.querySelector("#refresh-rooms");

const createWhoAmIRoomButton =
  document.querySelector("#create-whoami-room");
const joinWhoAmIRoomButton =
  document.querySelector("#join-whoami-room");
const whoamiCopyCodeButton =
  document.querySelector("#whoami-copy-code");
const whoamiReadyToggleButton =
  document.querySelector("#whoami-ready-toggle");
const startWhoAmIGameButton =
  document.querySelector("#start-whoami-game");
const whoamiNewRoundButton =
  document.querySelector("#whoami-new-round");
const refreshWhoAmIRoomsButton =
  document.querySelector("#refresh-whoami-rooms");

const whoamiRevealSelfButton =
  document.querySelector("#whoami-reveal-self");
const whoamiGuessInput =
  document.querySelector("#whoami-guess-input");
const whoamiGuessButton =
  document.querySelector("#whoami-guess-button");
const whoamiGuessFeedback =
  document.querySelector("#whoami-guess-feedback");
const whoamiAttempts =
  document.querySelector("#whoami-attempts");
const whoamiNotes =
  document.querySelector("#whoami-notes");

const homeError = document.querySelector("#home-error");
const lobbyError = document.querySelector("#lobby-error");
const gameError = document.querySelector("#game-error");

const whoamiHomeError =
  document.querySelector("#whoami-home-error");
const whoamiLobbyError =
  document.querySelector("#whoami-lobby-error");
const whoamiGameError =
  document.querySelector("#whoami-game-error");

const lobbyCode = document.querySelector("#lobby-code");
const lobbyCategory = document.querySelector("#lobby-category");
const lobbyDifficulty = document.querySelector("#lobby-difficulty");
const playerCount = document.querySelector("#player-count");
const readyCount = document.querySelector("#ready-count");
const playersList = document.querySelector("#players");
const waitingHost = document.querySelector("#waiting-host");

const openRoomsList = document.querySelector("#open-rooms-list");

const whoamiLobbyCode =
  document.querySelector("#whoami-lobby-code");
const whoamiLobbyCategory =
  document.querySelector("#whoami-lobby-category");
const whoamiLobbyDifficulty =
  document.querySelector("#whoami-lobby-difficulty");
const whoamiPlayerCount =
  document.querySelector("#whoami-player-count");
const whoamiReadyCount =
  document.querySelector("#whoami-ready-count");
const whoamiPlayersList =
  document.querySelector("#whoami-players");
const whoamiWaitingHost =
  document.querySelector("#whoami-waiting-host");
const whoamiOpenRoomsList =
  document.querySelector("#whoami-open-rooms-list");
const whoamiOtherCharacters =
  document.querySelector("#whoami-other-characters");
const whoamiSelfReveal =
  document.querySelector("#whoami-self-reveal");
const whoamiSelfCharacter =
  document.querySelector("#whoami-self-character");
const whoamiSelfImageWrap =
  document.querySelector("#whoami-self-image-wrap");
const whoamiSelfImage =
  document.querySelector("#whoami-self-image");
const whoamiRoundWaiting =
  document.querySelector("#whoami-round-waiting");
const whoamiSpeakingOrder =
  document.querySelector("#whoami-speaking-order");
const impostorSpeakingOrder =
  document.querySelector("#impostor-speaking-order");
const whoamiWinnerAvatar =
  document.querySelector("#whoami-winner-avatar");
const whoamiWinnerName =
  document.querySelector("#whoami-winner-name");
const whoamiWinnerCharacter =
  document.querySelector("#whoami-winner-character");
const whoamiWinnerImageWrap =
  document.querySelector("#whoami-winner-image-wrap");
const whoamiWinnerImage =
  document.querySelector("#whoami-winner-image");
const whoamiFinalResults =
  document.querySelector("#whoami-final-results");

const whoamiDrawAnimation =
  document.querySelector("#whoami-draw-animation");
const whoamiReviewMain =
  document.querySelector("#whoami-review-main");
const whoamiReviewGrid =
  document.querySelector("#whoami-review-grid");
const whoamiReviewProgress =
  document.querySelector("#whoami-review-progress");
const whoamiSelfReviewStatus =
  document.querySelector("#whoami-self-review-status");
const whoamiReviewError =
  document.querySelector("#whoami-review-error");
const whoamiLaunchOverlay =
  document.querySelector("#whoami-launch-overlay");
const whoamiLaunchCount =
  document.querySelector("#whoami-launch-count");

const hostExitOverlay =
  document.querySelector("#host-exit-overlay");
const hostLeaveTransferButton =
  document.querySelector("#host-leave-transfer");
const hostCloseRoomButton =
  document.querySelector("#host-close-room");
const hostExitCancelButton =
  document.querySelector("#host-exit-cancel");

let whoamiReviewState = null;
let currentWhoAmIRoundId = null;
let currentWhoAmIStatuses = [];
let currentWhoAmIEliminated = false;
let currentWhoAmIAllFinish = false;
let currentImpostorPhase = "discussion";
let currentImpostorVoteRound = 0;
let currentImpostorVoteSubmitted = false;
let pendingHostExitFinish = null;


const civilView = document.querySelector("#civil-view");
const impostorView = document.querySelector("#impostor-view");
const secretWord = document.querySelector("#secret-word");
const impostorHint = document.querySelector("#impostor-hint");
const roundWaiting = document.querySelector("#round-waiting");

const whoamiGuessNoticeContainer = document.querySelector("#whoami-guess-notices");
const whoamiGuessNoticeQueue = [];
let whoamiGuessNoticeTimer = null;
const WHOAMI_GUESS_NOTICE_DURATION = 4600;

const globalToast = document.querySelector("#global-toast");
const globalToastIcon = document.querySelector("#global-toast-icon");
const globalToastTitle = document.querySelector("#global-toast-title");
const globalToastMessage = document.querySelector("#global-toast-message");

const connectionOverlay = document.querySelector("#connection-overlay");
const connectionIcon = document.querySelector("#connection-icon");
const connectionKicker = document.querySelector("#connection-kicker");
const connectionTitle = document.querySelector("#connection-title");
const connectionMessage = document.querySelector("#connection-message");
const connectionLoader = document.querySelector("#connection-loader");
const connectionCountdown = document.querySelector("#connection-countdown");
const connectionSeconds = document.querySelector("#connection-seconds");
const connectionActions = document.querySelector("#connection-actions");
const connectionPrimary = document.querySelector("#connection-primary");
const connectionSecondary = document.querySelector("#connection-secondary");

let globalToastTimer = null;
let connectionWasLost = false;
let reconnectTimer = null;
let reconnectDeadlineTimer = null;
let reconnectSecondsLeft = 0;
let pendingConnectionPrimaryAction = null;
let pendingConnectionSecondaryAction = null;

const RECONNECT_ATTEMPT_SECONDS = 10;


function getName() {
  return currentUser?.nickname || nameInput.value.trim();
}

function getWhoAmIName() {
  return currentUser?.nickname || whoamiNameInput.value.trim();
}

function showGlobalToast({
  icon = "★",
  title = "Aviso",
  message = "",
  duration = 4200
} = {}) {
  clearTimeout(globalToastTimer);

  globalToastIcon.innerHTML = retroIcon(ICON_MAP[icon] || "star");
  globalToastTitle.textContent = title;
  globalToastMessage.textContent = message;

  globalToast.classList.remove("hidden");

  globalToastTimer = setTimeout(() => {
    globalToast.classList.add("hidden");
  }, duration);
}

// Cards retrô de 16×16 pixels, sem emojis de plataforma.
const WHOAMI_NOTICE_PIXEL_ICONS = {
  wrong: '<rect x="3" y="3" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 6h1v1H6zm3 0h1v1H9zM7 7h2v2H7zM6 9h1v1H6zm3 0h1v1H9z" fill="currentColor"/>',
  close: '<path d="M5 4V3h6v1h1v4h-2v2H8v2H6v-2h2V8h2V5H6v2H4V4zm2 9h3v2H7z" fill="currentColor"/>',
  correct: '<path d="M2 8h2v2H2zm2 2h2v2H4zm2 2h2v2H6zm2-2h2v2H8zm2-2h2v2h-2zm2-2h2v2h-2z" fill="currentColor"/>',
  gave_up: '<path d="M3 2h2v12H3zm2 1h8v2h-2v2H9v2H5z" fill="currentColor"/>'
};

function clearWhoAmIGuessNotices() {
  whoamiGuessNoticeQueue.length = 0;
  if (whoamiGuessNoticeTimer) clearTimeout(whoamiGuessNoticeTimer);
  whoamiGuessNoticeTimer = null;
  if (whoamiGuessNoticeContainer) whoamiGuessNoticeContainer.replaceChildren();
}

function showNextWhoAmIGuessNotice() {
  if (!whoamiGuessNoticeContainer || whoamiGuessNoticeTimer || !whoamiGuessNoticeQueue.length) return;

  const notice = whoamiGuessNoticeQueue.shift();
  const kind = ["correct", "close", "wrong", "gave_up"].includes(notice.result)
    ? notice.result : "wrong";
  const name = String(notice.playerName || "Jogador").trim().slice(0, 48);
  const guesses = {
    wrong: `${name.toLocaleUpperCase("pt-BR")} ERROU!`,
    close: `${name.toLocaleUpperCase("pt-BR")} CHEGOU PERTO!`,
    correct: `${name.toLocaleUpperCase("pt-BR")} ACERTOU!`,
    gave_up: `${name.toLocaleUpperCase("pt-BR")} DESISTIU!`
  };
  let detail = "";
  if (kind === "close") detail = "Nenhuma tentativa perdida.";
  else if (kind === "wrong") detail = notice.eliminated
    ? "Esgotou as tentativas nesta rodada."
    : `Restam ${Math.max(0, Number(notice.attemptsLeft) || 0)} tentativa${Number(notice.attemptsLeft) === 1 ? "" : "s"}.`;
  else if (kind === "correct") detail = notice.allFinish && notice.placement
    ? `Conquistou o ${notice.placement}º lugar!` : "Descobriu o personagem!";
  else detail = "Vai acompanhar o resto da rodada.";

  const card = document.createElement("div");
  card.className = `whoami-guess-notice is-${kind}`;
  card.style.setProperty("--whoami-notice-duration", `${WHOAMI_GUESS_NOTICE_DURATION}ms`);
  card.setAttribute("role", "status");

  const stamp = document.createElement("div");
  stamp.className = "whoami-guess-notice-stamp";
  stamp.innerHTML = `<svg class="whoami-notice-pixel-icon" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">${WHOAMI_NOTICE_PIXEL_ICONS[kind]}</svg>`;

  const avatar = document.createElement("div");
  avatar.className = "whoami-guess-notice-avatar";
  avatar.innerHTML = avatarImage(notice.avatar || "cat", "whoami-toast-avatar");

  const content = document.createElement("div");
  content.className = "whoami-guess-notice-content";
  const title = document.createElement("strong");
  title.className = "whoami-guess-notice-title";
  title.textContent = guesses[kind];
  const guess = document.createElement("p");
  guess.className = "whoami-guess-notice-guess";
  if (kind === "gave_up") {
    guess.textContent = "Desistiu de descobrir o personagem.";
  } else {
    guess.append("Palpite: ");
    const guessedName = document.createElement("b");
    guessedName.textContent = String(notice.guess || "").slice(0, 120);
    guess.append(guessedName);
  }
  const status = document.createElement("small");
  status.className = "whoami-guess-notice-detail";
  status.textContent = detail;
  content.append(title, guess, status);

  const progress = document.createElement("div");
  progress.className = "whoami-guess-notice-progress";
  const meter = document.createElement("div");
  meter.className = "whoami-guess-notice-meter";
  progress.append(meter);
  card.append(stamp, avatar, content, progress);
  whoamiGuessNoticeContainer.replaceChildren(card);

  // Cada acontecimento fica visível, na ordem recebida, antes do próximo.
  whoamiGuessNoticeTimer = setTimeout(() => {
    whoamiGuessNoticeTimer = null;
    card.remove();
    showNextWhoAmIGuessNotice();
  }, WHOAMI_GUESS_NOTICE_DURATION);
}

function queueWhoAmIGuessNotice(payload) {
  if (!payload || !roomCode || payload.code !== roomCode) return;
  if (currentRoom?.gameType !== "whoami") return;
  // Guarde cada palpite na fila, inclusive quando vários chegam juntos.
  whoamiGuessNoticeQueue.push(payload);
  showNextWhoAmIGuessNotice();
}

function showConnectionOverlay({
  icon = "⚠",
  kicker = "CONEXÃO",
  title = "Conexão perdida",
  message = "Tentando reconectar ao servidor...",
  loading = false,
  countdown = false,
  actions = false,
  primaryLabel = "voltar para a sala",
  secondaryLabel = "ir para o menu",
  onPrimary = null,
  onSecondary = null
} = {}) {
  connectionIcon.innerHTML = retroIcon(ICON_MAP[icon] || "warning");
  connectionKicker.textContent = kicker;
  connectionTitle.textContent = title;
  connectionMessage.textContent = message;

  connectionLoader.classList.toggle(
    "hidden",
    !loading
  );

  connectionCountdown.classList.toggle(
    "hidden",
    !countdown
  );

  connectionActions.classList.toggle(
    "hidden",
    !actions
  );

  connectionPrimary.textContent = primaryLabel;
  connectionSecondary.textContent = secondaryLabel;

  pendingConnectionPrimaryAction = onPrimary;
  pendingConnectionSecondaryAction = onSecondary;

  connectionOverlay.classList.remove("hidden");
}

function hideConnectionOverlay() {
  connectionOverlay.classList.add("hidden");
  connectionLoader.classList.add("hidden");
  connectionCountdown.classList.add("hidden");
  connectionActions.classList.add("hidden");
  pendingConnectionPrimaryAction = null;
  pendingConnectionSecondaryAction = null;
}

function stopReconnectCountdown() {
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }

  if (reconnectDeadlineTimer) {
    clearTimeout(reconnectDeadlineTimer);
    reconnectDeadlineTimer = null;
  }
}

function startReconnectCountdown(onExpired) {
  stopReconnectCountdown();

  reconnectSecondsLeft = RECONNECT_ATTEMPT_SECONDS;
  connectionSeconds.textContent = reconnectSecondsLeft;

  reconnectTimer = setInterval(() => {
    reconnectSecondsLeft -= 1;
    connectionSeconds.textContent =
      Math.max(0, reconnectSecondsLeft);

    if (reconnectSecondsLeft <= 0) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    }
  }, 1000);

  reconnectDeadlineTimer = setTimeout(() => {
    stopReconnectCountdown();

    if (typeof onExpired === "function") {
      onExpired();
    }
  }, RECONNECT_ATTEMPT_SECONDS * 1000);
}

function renderRoom(room) {
  currentRoom = room;
  roomCode = room.code;

  sessionStorage.setItem(
    STORAGE_KEYS.roomCode,
    roomCode
  );

  lobbyCode.textContent = room.code;

  lobbyCategory.textContent =
    room.category?.name || "Todas";

  lobbyDifficulty.textContent =
    room.difficulty?.name || "Aleatória";

  playerCount.textContent =
    room.players.length;

  const readyPlayers =
    room.players.filter(
      (player) => player.ready
    ).length;

  readyCount.textContent =
    `${readyPlayers}/${room.players.length} prontos`;

  playersList.innerHTML = "";

  room.players.forEach((player) => {
    const item = document.createElement("li");

    if (!player.connected) {
      item.classList.add("player-disconnected");
    }

    if (player.eliminated) {
      item.classList.add("player-eliminated");
    }

    const playerName = document.createElement("span");
    playerName.className = "player-name";

    playerName.innerHTML =
      `${avatarImage(player.avatar, "lobby-player-avatar")}<span>${
        escapeHtml(
          player.token === playerToken
            ? `${player.name} (você)`
            : player.name
        )
      }</span>${player.registered ? '<span class="registered-mark" title="Conta registrada">✓</span>' : ''}`;

    const statuses = document.createElement("div");
    statuses.className = "player-statuses";

    if (player.token === room.hostToken) {
      const hostBadge = document.createElement("span");
      hostBadge.textContent = "HOST";
      hostBadge.className = "host-badge";
      statuses.appendChild(hostBadge);
    }

    if (!player.connected) {
      const reconnectBadge =
        document.createElement("span");

      reconnectBadge.textContent = "RECONECTANDO";
      reconnectBadge.className =
        "reconnect-badge";

      statuses.appendChild(
        reconnectBadge
      );
    }

    const readyBadge =
      document.createElement("span");

    readyBadge.textContent =
      player.ready ? "✓ PRONTO" : "AGUARDANDO";

    readyBadge.className =
      `ready-badge ${
        player.ready ? "is-ready" : ""
      }`;

    statuses.appendChild(readyBadge);

    item.appendChild(playerName);
    item.appendChild(statuses);
    playersList.appendChild(item);
  });

  const me = room.players.find(
    (player) => player.token === playerToken
  );

  const amReady = Boolean(me?.ready);
  const amHost =
    playerToken === room.hostToken;

  readyToggleButton.textContent =
    amReady
      ? "✓ pronto! clicar para cancelar"
      : "✓ estou pronto";

  readyToggleButton.classList.toggle(
    "is-ready",
    amReady
  );

  startButton.classList.toggle(
    "hidden",
    !amHost
  );

  waitingHost.classList.toggle(
    "hidden",
    amHost
  );

  const enoughPlayers =
    room.players.length >= 3;

  const allReady =
    enoughPlayers &&
    room.players.every(
      (player) =>
        player.ready && player.connected
    );

  if (amHost) {
    startButton.disabled = !allReady;

    const connectedCount =
      room.players.filter(
        (player) => player.connected
      ).length;

    if (!enoughPlayers) {
      startButton.textContent =
        `▶ aguardando jogadores (${room.players.length}/3)`;
    } else if (
      connectedCount !== room.players.length
    ) {
      startButton.textContent =
        "▶ aguardando reconexão";
    } else if (!allReady) {
      startButton.textContent =
        `▶ aguardando prontos (${readyPlayers}/${room.players.length})`;
    } else {
      startButton.textContent =
        "▶ iniciar partida";
    }
  }

  const roundPhase = room.roundPhase || currentImpostorPhase || "discussion";
  currentImpostorPhase = roundPhase;

  const canStartVote =
    amHost && room.started && ["discussion", "tiebreak"].includes(roundPhase);

  startImpostorVoteButton?.classList.toggle("hidden", !canStartVote);
  if (startImpostorVoteButton && canStartVote) {
    startImpostorVoteButton.textContent =
      roundPhase === "tiebreak"
        ? "✓ iniciar votação de desempate"
        : "✓ iniciar votação";
  }

  impostorVoteWaiting?.classList.toggle(
    "hidden",
    amHost || !room.started || !["discussion", "tiebreak"].includes(roundPhase)
  );

  newRoundButton.classList.add("hidden");
  roundWaiting.classList.add("hidden");

  if (impostorResultNewRound) {
    impostorResultNewRound.classList.toggle(
      "hidden",
      !(amHost && roundPhase === "finished")
    );
  }

  if (impostorResultWaiting) {
    impostorResultWaiting.classList.toggle(
      "hidden",
      amHost || roundPhase !== "finished"
    );
  }
}


function renderWhoAmIRoom(room) {
  currentRoom = room;
  roomCode = room.code;

  sessionStorage.setItem(
    STORAGE_KEYS.roomCode,
    roomCode
  );

  whoamiLobbyCode.textContent = room.code;

  whoamiLobbyCategory.textContent =
    room.category?.name || "Todas";

  whoamiLobbyDifficulty.textContent =
    room.difficulty?.name || "Aleatória";
  const lobbyMode = document.getElementById("whoami-lobby-mode");
  if (lobbyMode) lobbyMode.textContent = room.allFinish ? "🏁 Todos até o fim" : "Primeiro a acertar";

  whoamiPlayerCount.textContent =
    room.players.length;

  const readyPlayers =
    room.players.filter(
      (player) => player.ready
    ).length;

  whoamiReadyCount.textContent =
    `${readyPlayers}/${room.players.length} prontos`;

  whoamiPlayersList.innerHTML = "";

  room.players.forEach((player) => {
    const item = document.createElement("li");

    if (!player.connected) {
      item.classList.add("player-disconnected");
    }

    const playerName =
      document.createElement("span");

    playerName.className = "player-name";

    playerName.innerHTML =
      `${avatarImage(player.avatar, "lobby-player-avatar")}<span>${
        escapeHtml(
          player.token === playerToken
            ? `${player.name} (você)`
            : player.name
        )
      }</span>${player.registered ? '<span class="registered-mark" title="Conta registrada">✓</span>' : ''}`;

    const statuses =
      document.createElement("div");

    statuses.className = "player-statuses";

    if (player.token === room.hostToken) {
      const hostBadge =
        document.createElement("span");

      hostBadge.textContent = "HOST";
      hostBadge.className = "host-badge";
      statuses.appendChild(hostBadge);
    }

    if (!player.connected) {
      const reconnectBadge =
        document.createElement("span");

      reconnectBadge.textContent =
        "RECONECTANDO";
      reconnectBadge.className =
        "reconnect-badge";

      statuses.appendChild(reconnectBadge);
    }

    const readyBadge =
      document.createElement("span");

    readyBadge.textContent =
      player.ready
        ? "✓ PRONTO"
        : "AGUARDANDO";

    readyBadge.className =
      `ready-badge ${
        player.ready ? "is-ready" : ""
      }`;

    statuses.appendChild(readyBadge);

    item.appendChild(playerName);
    item.appendChild(statuses);
    whoamiPlayersList.appendChild(item);
  });

  const me = room.players.find(
    (player) => player.token === playerToken
  );

  const amReady = Boolean(me?.ready);
  const amHost =
    playerToken === room.hostToken;

  whoamiReadyToggleButton.textContent =
    amReady
      ? "✓ pronto! clicar para cancelar"
      : "✓ estou pronto";

  whoamiReadyToggleButton.classList.toggle(
    "is-ready",
    amReady
  );

  startWhoAmIGameButton.classList.toggle(
    "hidden",
    !amHost
  );

  whoamiWaitingHost.classList.toggle(
    "hidden",
    amHost
  );

  const enoughPlayers =
    room.players.length >= 2;

  const allReady =
    enoughPlayers &&
    room.players.every(
      (player) =>
        player.ready && player.connected
    );

  if (amHost) {
    startWhoAmIGameButton.disabled = !allReady;

    const connectedCount =
      room.players.filter(
        (player) => player.connected
      ).length;

    if (!enoughPlayers) {
      startWhoAmIGameButton.textContent =
        `▶ aguardando jogadores (${room.players.length}/2)`;
    } else if (
      connectedCount !== room.players.length
    ) {
      startWhoAmIGameButton.textContent =
        "▶ aguardando reconexão";
    } else if (!allReady) {
      startWhoAmIGameButton.textContent =
        `▶ aguardando prontos (${readyPlayers}/${room.players.length})`;
    } else {
      startWhoAmIGameButton.textContent =
        "▶ iniciar partida";
    }
  }

  whoamiNewRoundButton.classList.toggle(
    "hidden",
    !amHost
  );

  whoamiRoundWaiting.classList.toggle(
    "hidden",
    amHost
  );
}


const characterImageCache = new Map();
const characterImageSources = new Map();

// O backend pesquisa provedores apropriados para cada categoria. TMDB usa
// credencial apenas no servidor; o navegador recebe somente a URL da foto.
async function resolveCharacterImage(character) {
  const name = String(character || "").trim();
  if (!name) return null;
  const cached = characterImageCache.get(name);
  if (cached && (!cached.expiresAt || cached.expiresAt > Date.now())) return cached.result ?? cached;
  if (cached) characterImageCache.delete(name);

  const pending = (async () => {
    try {
      const response = await fetch(`/api/whoami-image?name=${encodeURIComponent(name)}`);
      if (!response.ok) return null;
      const data = await response.json();
      const safe = safeCharacterImageUrl(data?.imageUrl);
      if (safe && data?.sourceUrl) {
        const sourceUrl = safeCharacterImageUrl(data.sourceUrl);
        if (sourceUrl) characterImageSources.set(name, {
          source: String(data.source || "fonte"), url: sourceUrl
        });
      }
      return safe;
    } catch {
      return null;
    }
  })();
  characterImageCache.set(name, { result: pending, expiresAt: Date.now() + 15_000 });
  const image = await pending;
  characterImageCache.set(name, { result: image, expiresAt: Date.now() + (image ? 6 * 60 * 60 * 1000 : 90_000) });
  return image;
}

function characterFallbackMarkup() {
  return `<div class="character-photo-placeholder" aria-label="Imagem não disponível">
    <svg viewBox="0 0 32 32" aria-hidden="true" shape-rendering="crispEdges" focusable="false">
      <path fill="currentColor" d="M10 2h12v3h3v4h2v10h-3v3H8v-3H5V9h2V5h3zm-1 23h14v3h5v4H4v-4h5z"/>
      <path fill="var(--cream-2)" d="M11 6h10v3h3v9h-3v2H11v-2H8V9h3z"/>
      <path fill="currentColor" d="M12 12h3v3h-3zm6 0h3v3h-3z"/>
    </svg>
    <small>SEM FOTO</small>
  </div>`;
}

function setCharacterFallback(wrap) {
  wrap.classList.add("is-placeholder");
  wrap.innerHTML = characterFallbackMarkup();
}

function attachCharacterSource(wrap, name) {
  // Miniaturas ficam limpas; o link é mostrado em prévias ampliadas
  // e nas cartas grandes da aprovação. Resultados compactos ficam limpos.
  if (["game-character-photo", "small", "final-photo", "winner-photo"].some(cls => wrap.classList.contains(cls))) return;
  wrap.querySelector(".character-image-source")?.remove();
  const source = characterImageSources.get(name);
  if (!source) return;
  const a = document.createElement("a");
  a.className = "character-image-source";
  a.href = source.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = `FONTE: ${source.source.toUpperCase()}`;
  a.title = "Abrir fonte da imagem";
  wrap.appendChild(a);
}

async function hydrateCharacterPhotos(root = document) {
  root.querySelectorAll('.character-photo-wrap:not(.is-placeholder) img.character-photo').forEach(img => {
    if (img.dataset.imageErrorBound) return;
    img.dataset.imageErrorBound = "true";
    img.addEventListener("error", () => {
      const wrap = img.closest('.character-photo-wrap');
      if (wrap) setCharacterFallback(wrap);
    }, { once: true });
    const wrap = img.closest(".character-photo-wrap.review-character-photo");
    const character = wrap?.dataset.characterName;
    if (character) {
      if (characterImageSources.has(character)) attachCharacterSource(wrap, character);
      else resolveCharacterImage(character).then(() => {
        if (wrap.isConnected && !wrap.classList.contains("is-placeholder")) {
          attachCharacterSource(wrap, character);
        }
      });
    }
  });
  const placeholders = [...root.querySelectorAll(
    '.character-photo-wrap.is-placeholder[data-character-name]'
  )];
  await Promise.all(placeholders.map(async (wrap) => {
    if (wrap.dataset.loading === "true") return;
    wrap.dataset.loading = "true";
    const character = wrap.dataset.characterName;
    const imageUrl = await resolveCharacterImage(character);
    if (!wrap.isConnected) return;
    wrap.dataset.loading = "false";
    if (!imageUrl) {
      setCharacterFallback(wrap);
      return;
    }
    wrap.classList.remove("is-placeholder");
    wrap.innerHTML = "";
    const img = document.createElement("img");
    img.className = "character-photo";
    img.src = imageUrl;
    img.alt = character || "Personagem";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => {
      characterImageCache.delete(character);
      setCharacterFallback(wrap);
    }, { once: true });
    wrap.appendChild(img);
    attachCharacterSource(wrap, character);
  }));
}

function safeCharacterImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw, window.location.origin);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function characterPhotoMarkup(imageUrl, character, extraClass = "") {
  const safeUrl = safeCharacterImageUrl(imageUrl);
  const className = extraClass ? ` ${extraClass}` : "";

  if (!safeUrl) {
    return `
      <div
        class="character-photo-wrap${className} is-placeholder"
        data-character-name="${escapeHtml(character || "")}"
      >
        ${characterFallbackMarkup()}
      </div>
    `;
  }

  return `
    <div class="character-photo-wrap${className}" data-character-name="${escapeHtml(character || "")}">
      <img
        class="character-photo"
        src="${escapeHtml(safeUrl)}"
        alt="${escapeHtml(character || "Personagem")}"
        loading="lazy"
        referrerpolicy="no-referrer"
      />
    </div>
  `;
}

function renderSpeakingOrder(container, order = [], statuses = []) {
  if (!container) return;

  const statusMap = new Map(
    (statuses || []).map((status) => [status.token, status])
  );

  container.innerHTML = "";

  (order || []).forEach((item, index) => {
    const status = statusMap.get(item.token);
    const row = document.createElement("div");
    row.className = "speaking-order-item";
    row.dataset.playerToken = item.token;

    if (item.token === playerToken) {
      row.classList.add("is-me");
    }

    if (status?.eliminated) {
      row.classList.add("eliminated");
    }

    row.innerHTML = `
      <span class="speaking-position">${index + 1}º</span>
      ${avatarImage(item.avatar, "speaking-avatar")}
      <span class="speaking-name">${escapeHtml(item.name)}</span>
      ${item.token === playerToken ? '<span class="speaking-me">VOCÊ</span>' : ""}
    `;

    container.appendChild(row);
  });
}

function updateImpostorDiscussionControls(phase = currentImpostorPhase) {
  currentImpostorPhase = phase || "discussion";

  const amHost = Boolean(
    currentRoom && currentRoom.hostToken === playerToken
  );
  const discussionActive = ["discussion", "tiebreak"].includes(currentImpostorPhase);

  if (impostorPhaseBanner) {
    impostorPhaseBanner.classList.toggle(
      "hidden",
      currentImpostorPhase !== "tiebreak"
    );
  }

  if (impostorSpeakingTitle) {
    impostorSpeakingTitle.textContent =
      currentImpostorPhase === "tiebreak"
        ? "Ordem do desempate"
        : "Quem fala primeiro?";
  }

  startImpostorVoteButton?.classList.toggle(
    "hidden",
    !(amHost && discussionActive)
  );

  if (startImpostorVoteButton && amHost && discussionActive) {
    startImpostorVoteButton.textContent =
      currentImpostorPhase === "tiebreak"
        ? "✓ iniciar votação de desempate"
        : "✓ iniciar votação";
  }

  impostorVoteWaiting?.classList.toggle(
    "hidden",
    amHost || !discussionActive
  );
}

function renderImpostorVote(payload = {}) {
  currentImpostorPhase = "voting";
  currentImpostorVoteRound = Number(payload.voteRound || currentImpostorVoteRound || 1);
  currentImpostorVoteSubmitted = Boolean(payload.alreadyVoted);

  const candidates = payload.candidates || [];
  const eliminatedTokens = payload.eliminatedTokens || [];
  const viewerEliminated = eliminatedTokens.includes(playerToken);
  const isTiebreak = Boolean(payload.tiebreak) || currentImpostorVoteRound > 1;

  impostorVoteRoundLabel.textContent = isTiebreak
    ? `DESEMPATE • VOTAÇÃO ${currentImpostorVoteRound}`
    : "VOTAÇÃO";

  impostorVoteProgress.textContent =
    `${Number(payload.votedCount || 0)}/${Number(payload.totalVoters || currentRoom?.players?.length || 0)}`;

  impostorVoteFeedback.textContent = currentImpostorVoteSubmitted
    ? "✓ Seu voto já foi confirmado. Aguardando os outros jogadores..."
    : viewerEliminated
      ? "Você está fora da rodada de fala, mas ainda pode ajudar na votação."
      : "Escolha quem você acha que é o impostor.";

  impostorVoteCandidates.innerHTML = "";

  candidates.forEach((candidate) => {
    const isSelf = candidate.token === playerToken;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `impostor-vote-card ${isSelf ? "is-self" : ""}`;
    button.disabled = isSelf || currentImpostorVoteSubmitted;
    button.dataset.playerToken = candidate.token;
    button.innerHTML = `
      ${avatarImage(candidate.avatar, "impostor-vote-avatar")}
      <strong>${escapeHtml(candidate.name)}</strong>
      <span>${isSelf ? "VOCÊ" : "VOTAR"}</span>
    `;

    button.addEventListener("click", () => {
      if (currentImpostorVoteSubmitted || isSelf) return;

      impostorVoteFeedback.textContent = "Confirmando seu voto...";
      impostorVoteCandidates
        .querySelectorAll(".impostor-vote-card")
        .forEach((card) => { card.disabled = true; });

      socket.emit(
        "cast-impostor-vote",
        { code: roomCode, targetToken: candidate.token },
        (response) => {
          if (!response?.ok) {
            impostorVoteFeedback.textContent =
              response?.error || "Não foi possível registrar seu voto.";
            impostorVoteCandidates
              .querySelectorAll(".impostor-vote-card")
              .forEach((card) => {
                card.disabled =
                  card.dataset.playerToken === playerToken || currentImpostorVoteSubmitted;
              });
            return;
          }

          currentImpostorVoteSubmitted = true;
          button.classList.add("selected");
          impostorVoteFeedback.textContent =
            `✓ Voto em ${response.targetName} confirmado. Aguardando os outros...`;
        }
      );
    });

    impostorVoteCandidates.appendChild(button);
  });

  showScreen(impostorVoteScreen);
}

function renderImpostorTiebreak(payload = {}) {
  currentImpostorPhase = "tiebreak";
  currentImpostorVoteRound = Number(payload.voteRound || currentImpostorVoteRound || 1);
  currentImpostorVoteSubmitted = false;

  renderSpeakingOrder(
    impostorSpeakingOrder,
    payload.speakingOrder || [],
    payload.statuses || []
  );

  const names = (payload.candidates || []).map((item) => item.name);
  if (impostorPhaseBanner) {
    const strong = impostorPhaseBanner.querySelector("strong");
    const small = impostorPhaseBanner.querySelector("small");
    if (strong) {
      strong.textContent = names.length
        ? `${names.join(" × ")} fazem uma rodada extra.`
        : "Somente os empatados falam nesta rodada.";
    }
    if (small) {
      small.textContent = "Depois o host abre uma nova votação apenas entre os empatados.";
    }
  }

  updateImpostorDiscussionControls("tiebreak");
  showScreen(gameScreen);
}

function renderImpostorElimination(payload = {}) {
  currentImpostorPhase = "discussion";
  currentImpostorVoteSubmitted = false;

  renderSpeakingOrder(
    impostorSpeakingOrder,
    payload.speakingOrder || [],
    payload.statuses || []
  );

  updateImpostorDiscussionControls("discussion");
  showScreen(gameScreen);

  const eliminatedName = payload.eliminated?.name || "Um jogador";
  const remainingCount = Number(payload.remainingCount || 0);

  showGlobalToast({
    icon: "×",
    title: `${eliminatedName} foi eliminado`,
    message: `Não era o impostor. A rodada continua com ${remainingCount} jogador${remainingCount === 1 ? "" : "es"} ativo${remainingCount === 1 ? "" : "s"}.`,
    duration: 5200
  });
}

function renderImpostorResult(payload = {}) {
  currentImpostorPhase = "finished";
  currentImpostorVoteSubmitted = false;

  const selected = payload.selected;
  const impostor = payload.impostor;
  const winner = payload.winner;
  const found = Boolean(payload.impostorFound);
  const winnerSide = payload.winnerSide || (found ? "investigadores" : "impostor");
  const lastRemaining = payload.resultReason === "ultimo_restante";

  const investigatorsWon = winnerSide === "investigadores";
  impostorResultSymbol.textContent = investigatorsWon ? "★" : "!";
  impostorResultSymbol.classList.toggle("success", investigatorsWon);
  impostorResultSymbol.classList.toggle("failure", !investigatorsWon);
  impostorResultTitle.textContent = investigatorsWon
    ? "Investigadores venceram!"
    : "O impostor venceu!";

  if (lastRemaining) {
    impostorResultSubtitle.textContent = winnerSide === "impostor"
      ? `${winner?.name || impostor?.name || "O impostor"} foi o último jogador ativo. Todos os outros foram eliminados.`
      : `${winner?.name || "O último jogador"} foi o último jogador ativo da rodada.`;
  } else if (found) {
    impostorResultSubtitle.textContent =
      `${selected?.name || "O jogador"} recebeu mais votos e o impostor foi descoberto.`;
  } else {
    impostorResultSubtitle.textContent =
      `${selected?.name || "O jogador"} recebeu mais votos, mas era inocente. O impostor escapou.`;
  }

  impostorSelectedAvatar.innerHTML = selected
    ? avatarImage(selected.avatar, "impostor-result-player-avatar")
    : "?";
  impostorSelectedName.textContent = selected?.name || "—";

  impostorRealAvatar.innerHTML = impostor
    ? avatarImage(impostor.avatar, "impostor-result-player-avatar")
    : "?";
  impostorRealName.textContent = impostor?.name || "—";
  impostorResultWord.textContent = payload.word || "—";
  if (impostorResultHint) impostorResultHint.textContent = payload.hint || "—";

  impostorResultCounts.innerHTML = "";
  (payload.counts || []).forEach((entry) => {
    const row = document.createElement("div");
    row.className = "impostor-result-count-row";
    row.innerHTML = `
      <span>${avatarImage(entry.avatar, "vote-count-avatar")} ${escapeHtml(entry.name)}</span>
      <strong>${entry.votes} voto${entry.votes === 1 ? "" : "s"}</strong>
    `;
    impostorResultCounts.appendChild(row);
  });

  const amHost = Boolean(currentRoom && currentRoom.hostToken === playerToken);
  impostorResultNewRound?.classList.toggle("hidden", !amHost);
  impostorResultWaiting?.classList.toggle("hidden", amHost);

  showScreen(impostorResultScreen);
}

function notesStorageKey() {
  if (!roomCode || !currentWhoAmIRoundId) return null;
  return `caroninhas_whoami_notes_${roomCode}_${currentWhoAmIRoundId}`;
}

function loadWhoAmINotes() {
  if (!whoamiNotes) return;
  const key = notesStorageKey();
  whoamiNotes.value = key ? (sessionStorage.getItem(key) || "") : "";
}

function renderWhoAmIAttempts(attemptsLeft = 3) {
  const safeLeft = Math.max(0, Math.min(3, Number(attemptsLeft) || 0));
  const dots = Array.from({ length: 3 }, (_, index) =>
    index < safeLeft ? "●" : "○"
  ).join(" ");
  whoamiAttempts.textContent = dots;
  whoamiAttempts.dataset.left = String(safeLeft);
}

function revealWhoAmISelf(character, imageUrl) {
  whoamiSelfCharacter.textContent = character || "...";
  const safeUrl = safeCharacterImageUrl(imageUrl);

  if (safeUrl) {
    whoamiSelfImage.src = safeUrl;
    whoamiSelfImageWrap.classList.remove("hidden");
  } else {
    whoamiSelfImage.removeAttribute("src");
    whoamiSelfImageWrap.classList.add("hidden");
  }

  whoamiSelfReveal.classList.remove("hidden");
  whoamiRevealSelfButton.classList.add("hidden");
}

function setWhoAmIEliminated(eliminated, character = null, imageUrl = null) {
  currentWhoAmIEliminated = Boolean(eliminated);
  whoamiGuessInput.disabled = currentWhoAmIEliminated;
  whoamiGuessButton.disabled = currentWhoAmIEliminated;

  if (currentWhoAmIEliminated) {
    document.querySelector(".whoami-self-card")?.classList.add("eliminated");
    whoamiRevealSelfButton.classList.add("hidden");
    if (character) revealWhoAmISelf(character, imageUrl);
  } else {
    document.querySelector(".whoami-self-card")?.classList.remove("eliminated");
    whoamiSelfReveal.classList.add("hidden");
    whoamiRevealSelfButton.classList.remove("hidden");
  }
}

function applyWhoAmIStatuses(statuses = []) {
  currentWhoAmIStatuses = statuses || [];
  const self = currentWhoAmIStatuses.find(
    (status) => status.token === playerToken
  );

  if (self) {
    renderWhoAmIAttempts(self.attemptsLeft);
    if (self.eliminated && !currentWhoAmIEliminated) {
      setWhoAmIEliminated(true);
    }
  }

  renderWhoAmIProgress();

  document
    .querySelectorAll(".whoami-character-card[data-player-token]")
    .forEach((card) => {
      const status = currentWhoAmIStatuses.find(
        (item) => item.token === card.dataset.playerToken
      );
      card.classList.toggle("eliminated", Boolean(status?.eliminated));
      card.classList.toggle("solved", status?.status === "correct");
      const tag = card.querySelector(".eliminated-tag");
      if (tag) {
        tag.classList.toggle("hidden", !status?.eliminated);
        tag.textContent = status?.status === "correct" ? `✓ ${status.placement || ""}º LUGAR` :
          status?.status === "gave_up" ? "DESISTIU" :
          status?.status === "abandoned" ? "ABANDONOU" : "SEM TENTATIVAS";
      }
    });

  document
    .querySelectorAll(".speaking-order-item[data-player-token]")
    .forEach((row) => {
      const status = currentWhoAmIStatuses.find(
        (item) => item.token === row.dataset.playerToken
      );
      row.classList.toggle("eliminated", Boolean(status?.eliminated));
    });
}

function renderWhoAmIProgress() {
  const panel = document.getElementById("whoami-progress-board");
  if (!panel) return;
  panel.classList.toggle("hidden", !currentWhoAmIAllFinish);
  if (!currentWhoAmIAllFinish) return;
  const solved = currentWhoAmIStatuses.filter(s => s.status === "correct")
    .sort((a, b) => (a.placement || 999) - (b.placement || 999));
  const waiting = currentWhoAmIStatuses.filter(s => s.status === "playing").length;
  panel.innerHTML = `<strong>🏁 CORRIDA DE ACERTOS</strong><small>${waiting} ainda tentando</small>` +
    (solved.length ? solved.map(s => `<span class="whoami-progress-line"><b>${s.placement}º</b> ${escapeHtml(s.name)}</span>`).join("") :
      '<small>O primeiro acerto ainda está por vir...</small>');
}

function renderWhoAmIWinner(payload = {}) {
  const winner = payload.winner;
  const allFinish = Boolean(payload.allFinish);
  document.getElementById("whoami-classic-result")?.classList.toggle("hidden", allFinish);
  document.getElementById("whoami-all-finish-result")?.classList.toggle("hidden", !allFinish);
  const ranking = document.getElementById("whoami-ranking");
  if (ranking && allFinish) {
    const results = payload.results || [];
    const sorted = [...results].sort((a, b) => {
      const order = { correct: 0, gave_up: 1, out_of_attempts: 2, abandoned: 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4) || (a.placement || 999) - (b.placement || 999);
    });
    ranking.innerHTML = sorted.map(result => {
      const status = result.status;
      const medal = status === "correct" ? `${result.placement}º LUGAR` :
        status === "gave_up" ? "DESISTIU" : status === "abandoned" ? "ABANDONOU" : "SEM TENTATIVAS";
      return `<article class="whoami-rank-entry ${status === "correct" ? "rank-correct" : "rank-out"}">
        <span class="whoami-rank-place">${status === "correct" ? (result.placement === 1 ? "🏆" : "✦") : "×"}</span>
        ${avatarImage(result.avatar, "final-player-avatar")}
        <div><strong>${escapeHtml(result.name)}</strong><small>${escapeHtml(result.character || "—")}</small></div>
        <span class="whoami-rank-status">${medal}</span>
      </article>`;
    }).join("");
  }

  if (winner) {
    whoamiWinnerAvatar.innerHTML = avatarImage(
      winner.avatar,
      "winner-player-avatar"
    );
    whoamiWinnerName.textContent = winner.name;
    whoamiWinnerCharacter.textContent = winner.character;

    const imageUrl = safeCharacterImageUrl(winner.imageUrl);
    const characterName = winner.character;
    whoamiWinnerImageWrap.classList.remove("hidden", "is-placeholder");
    whoamiWinnerImageWrap.querySelector('.character-photo-placeholder')?.remove();
    whoamiWinnerImage.style.display = "block";
    whoamiWinnerImage.onerror = () => {
      whoamiWinnerImage.style.display = "none";
      setCharacterFallback(whoamiWinnerImageWrap);
    };
    if (imageUrl) whoamiWinnerImage.src = imageUrl;
    else {
      whoamiWinnerImage.removeAttribute("src");
      resolveCharacterImage(characterName).then(url => {
        if (winner.character !== whoamiWinnerCharacter.textContent) return;
        if (url) whoamiWinnerImage.src = url;
        else whoamiWinnerImage.onerror();
      });
    }
  } else {
    whoamiWinnerAvatar.innerHTML = `<div class="winner-no-one">?</div>`;
    whoamiWinnerName.textContent = "Ninguém acertou";
    whoamiWinnerCharacter.textContent = "rodada encerrada";
    whoamiWinnerImageWrap.classList.add("hidden");
  }

  whoamiFinalResults.innerHTML = "";

  (payload.results || []).forEach((result) => {
    const card = document.createElement("article");
    card.className = `final-character-card ${result.winner ? "winner" : ""} ${result.eliminated ? "eliminated" : ""}`;
    card.innerHTML = `
      ${characterPhotoMarkup(result.imageUrl, result.character, "final-photo")}
      <div class="final-character-info">
        <div class="final-player-line">
          ${avatarImage(result.avatar, "final-player-avatar")}
          <span>${escapeHtml(result.name)}</span>
          ${result.winner ? '<strong class="winner-tag">★ VENCEDOR</strong>' : ""}
        </div>
        <strong class="final-character-name">${escapeHtml(result.character)}</strong>
      </div>
    `;
    whoamiFinalResults.appendChild(card);
  });

  hydrateCharacterPhotos(whoamiFinalResults);
  showScreen(whoamiWinnerScreen);
}

function renderWhoAmIReview(state) {
  whoamiReviewState = state;
  whoamiReviewProgress.textContent =
    `${state.approvedCount}/${state.totalCount}`;

  const self = state.self || {};

  if (self.approved) {
    whoamiSelfReviewStatus.innerHTML = `
      <strong>✓ seu personagem foi aprovado</strong>
      <span>ele continua escondido de você</span>
    `;
  } else {
    whoamiSelfReviewStatus.innerHTML = `
      <strong>seu personagem está em análise</strong>
      <span>
        ${self.approveCount || 0}/${self.eligibleCount || 0} aprovaram
        • ${self.rerollCount || 0} pediram outro
      </span>
    `;
  }

  whoamiReviewGrid.innerHTML = "";

  (state.cards || []).forEach((cardData) => {
    const card = document.createElement("article");
    card.className =
      `review-character-card ${cardData.approved ? "approved" : ""}`;

    card.innerHTML = `
      <div class="review-card-title">
        ${avatarImage(cardData.avatar, "review-player-avatar")}
        <span>${escapeHtml(cardData.name)}</span>
      </div>

      ${characterPhotoMarkup(cardData.imageUrl, cardData.character, "review-character-photo")}

      <strong class="review-character-name">
        ${escapeHtml(cardData.character)}
      </strong>

      <div class="review-vote-counts">
        <span>${cardData.approveCount}/${cardData.eligibleCount} aprovam</span>
        <span>${cardData.rerollCount}/${cardData.eligibleCount} querem outro</span>
      </div>

      <div class="review-card-status">
        ${cardData.approved
          ? "✓ personagem aprovado"
          : cardData.viewerVote === "approve"
            ? "você aprovou"
            : cardData.viewerVote === "reroll"
              ? "você pediu outro"
              : "escolha sua opinião"}
      </div>

      <div class="review-card-actions ${cardData.approved ? "hidden" : ""}">
        <button
          class="review-vote-button approve ${cardData.viewerVote === "approve" ? "selected" : ""}"
          data-target-token="${cardData.targetToken}"
          data-review-vote="approve"
        >
          aprovar
        </button>

        <button
          class="review-vote-button reroll ${cardData.viewerVote === "reroll" ? "selected" : ""}"
          data-target-token="${cardData.targetToken}"
          data-review-vote="reroll"
        >
          quero outro
        </button>
      </div>
    `;

    whoamiReviewGrid.appendChild(card);
  });

  hydrateCharacterPhotos(whoamiReviewGrid);

  whoamiReviewGrid
    .querySelectorAll("[data-review-vote]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        whoamiReviewError.textContent = "";

        socket.emit(
          "whoami-review-vote",
          {
            code: roomCode,
            targetToken: button.dataset.targetToken,
            vote: button.dataset.reviewVote
          },
          (response) => {
            if (!response?.ok) {
              whoamiReviewError.textContent =
                response?.error ||
                "Não foi possível registrar sua escolha.";
            }
          }
        );
      });
    });
}

function showWhoAmIReview(state, resumed = false) {
  showScreen(whoamiReviewScreen);
  whoamiLaunchOverlay.classList.add("hidden");

  if (resumed) {
    whoamiDrawAnimation.classList.add("hidden");
    whoamiReviewMain.classList.remove("hidden");
    renderWhoAmIReview(state);
    return;
  }

  whoamiReviewMain.classList.add("hidden");
  whoamiDrawAnimation.classList.remove("hidden");

  setTimeout(() => {
    whoamiDrawAnimation.classList.add("hidden");
    whoamiReviewMain.classList.remove("hidden");
    renderWhoAmIReview(state);
  }, 1800);
}


let whoamiFloatingPreview = null;
let whoamiPreviewCard = null;
let whoamiPreviewPinned = false;
let whoamiPreviewRequestId = 0;

function ensureWhoAmIFloatingPreview() {
  if (whoamiFloatingPreview) return whoamiFloatingPreview;

  const preview = document.createElement("div");
  preview.id = "whoami-character-floating-preview";
  preview.className = "whoami-character-floating-preview";
  preview.setAttribute("aria-hidden", "true");
  preview.innerHTML = `
    <div class="floating-preview-photo character-photo-wrap is-placeholder">
      ${characterFallbackMarkup()}
    </div>
    <div class="floating-preview-meta">
      <div class="floating-preview-player"></div>
      <strong class="floating-preview-character"></strong>
      <span class="floating-preview-tip">foto do personagem</span>
    </div>
  `;

  document.body.appendChild(preview);
  whoamiFloatingPreview = preview;

  document.addEventListener("pointerdown", (event) => {
    if (!whoamiPreviewPinned || !whoamiPreviewCard) return;
    if (whoamiPreviewCard.contains(event.target)) return;
    closeWhoAmICardPreview();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeWhoAmICardPreview();
  });

  window.addEventListener("resize", closeWhoAmICardPreview);
  window.addEventListener("scroll", closeWhoAmICardPreview, true);

  return preview;
}

function positionWhoAmICardPreview(card) {
  const preview = ensureWhoAmIFloatingPreview();
  const cardRect = card.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  const gap = 12;
  const margin = 10;

  let left = cardRect.right + gap;
  if (left + previewRect.width > window.innerWidth - margin) {
    left = cardRect.left - previewRect.width - gap;
  }

  if (left < margin) {
    left = Math.min(
      Math.max(margin, cardRect.left + cardRect.width / 2 - previewRect.width / 2),
      window.innerWidth - previewRect.width - margin
    );
  }

  let top = cardRect.top + cardRect.height / 2 - previewRect.height / 2;
  top = Math.max(margin, Math.min(top, window.innerHeight - previewRect.height - margin));

  preview.style.left = `${Math.round(left)}px`;
  preview.style.top = `${Math.round(top)}px`;
}

function setFloatingPreviewPhoto(preview, imageUrl, character, requestId) {
  const wrap = preview.querySelector(".floating-preview-photo");
  const safeUrl = safeCharacterImageUrl(imageUrl);

  const setImage = (url) => {
    if (requestId !== whoamiPreviewRequestId || !url) return;
    wrap.classList.remove("is-placeholder");
    wrap.innerHTML = "";
    const image = document.createElement("img");
    image.className = "character-photo";
    image.src = url;
    image.alt = character || "Personagem";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      if (requestId !== whoamiPreviewRequestId) return;
      wrap.classList.add("is-placeholder");
      wrap.innerHTML = characterFallbackMarkup();
    }, { once: true });
    wrap.appendChild(image);
    attachCharacterSource(wrap, character);

    // Em geral a URL da foto vem da atribuição feita pelo servidor, sem
    // metadados da origem. Consultar a fonte apenas quando a carta é aberta.
    if (!characterImageSources.has(character)) {
      resolveCharacterImage(character).then(() => {
        if (requestId === whoamiPreviewRequestId && !wrap.classList.contains("is-placeholder")) {
          attachCharacterSource(wrap, character);
        }
      });
    }
  };

  if (safeUrl) {
    setImage(safeUrl);
    return;
  }

  wrap.classList.add("is-placeholder");
  wrap.innerHTML = characterFallbackMarkup();

  resolveCharacterImage(character).then((resolvedUrl) => {
    if (resolvedUrl) setImage(resolvedUrl);
  });
}

function openWhoAmICardPreview(card, { pinned = false } = {}) {
  if (!card?.isConnected) return;

  const preview = ensureWhoAmIFloatingPreview();
  const character = card.dataset.character || "Personagem";
  const playerName = card.dataset.playerName || "Jogador";
  const avatar = card.dataset.playerAvatar || "dog";
  const imageUrl = card.dataset.imageUrl || "";
  const eliminated = card.classList.contains("eliminated");
  const requestId = ++whoamiPreviewRequestId;

  whoamiPreviewCard = card;
  whoamiPreviewPinned = Boolean(pinned);

  preview.classList.toggle("eliminated", eliminated);
  preview.querySelector(".floating-preview-player").innerHTML = `
    ${avatarImage(avatar, "floating-preview-avatar")}
    <span>${escapeHtml(playerName)}</span>
  `;
  preview.querySelector(".floating-preview-character").textContent = character;
  setFloatingPreviewPhoto(preview, imageUrl, character, requestId);

  preview.classList.add("is-visible");
  preview.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => positionWhoAmICardPreview(card));
}

function closeWhoAmICardPreview({ force = false } = {}) {
  if (whoamiPreviewPinned && !force) return;
  whoamiPreviewPinned = false;
  whoamiPreviewCard = null;
  whoamiPreviewRequestId += 1;

  if (!whoamiFloatingPreview) return;
  whoamiFloatingPreview.classList.remove("is-visible");
  whoamiFloatingPreview.setAttribute("aria-hidden", "true");
}

function bindWhoAmICardPreview(card) {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute(
    "aria-label",
    `Ver foto de ${card.dataset.character || "personagem"}`
  );

  if (finePointer) {
    card.addEventListener("mouseenter", () => {
      if (!whoamiPreviewPinned) openWhoAmICardPreview(card);
    });

    card.addEventListener("mouseleave", () => {
      if (!whoamiPreviewPinned) closeWhoAmICardPreview({ force: true });
    });
  }

  card.addEventListener("focus", () => {
    if (!whoamiPreviewPinned) openWhoAmICardPreview(card);
  });

  card.addEventListener("blur", () => {
    if (!whoamiPreviewPinned) closeWhoAmICardPreview({ force: true });
  });

  card.addEventListener("click", (event) => {
    if (finePointer) return;
    event.preventDefault();

    if (whoamiPreviewPinned && whoamiPreviewCard === card) {
      closeWhoAmICardPreview({ force: true });
      return;
    }

    openWhoAmICardPreview(card, { pinned: true });
  });
}

function renderWhoAmIGameCharacters(payload = {}) {
  const others = payload.others || [];
  currentWhoAmIRoundId = payload.roundId || currentWhoAmIRoundId;
  currentWhoAmIStatuses = payload.statuses || [];
  currentWhoAmIAllFinish = Boolean(payload.allFinish);
  const modeLabel = document.getElementById("whoami-current-mode");
  if (modeLabel) modeLabel.textContent = currentWhoAmIAllFinish ? "🏁 Todos até o fim" : "3 tentativas para acertar";

  closeWhoAmICardPreview({ force: true });
  whoamiOtherCharacters.innerHTML = "";

  others.forEach((item) => {
    const card = document.createElement("div");
    card.className = `whoami-character-card ${item.eliminated ? "eliminated" : ""}`;
    card.dataset.playerToken = item.token || "";
    card.dataset.playerName = item.name || "";
    card.dataset.playerAvatar = item.avatar || "dog";
    card.dataset.character = item.character || "";
    card.dataset.imageUrl = item.imageUrl || "";

    card.innerHTML = `
      <div class="whoami-player-label">
        ${avatarImage(item.avatar, "character-player-avatar")}
        <span>${escapeHtml(item.name)}</span>
        <span class="eliminated-tag ${item.eliminated ? "" : "hidden"}">CONCLUÍDO</span>
      </div>
      ${characterPhotoMarkup(item.imageUrl, item.character, "game-character-photo")}
      <div class="whoami-character-copy">
        <strong>${escapeHtml(item.character)}</strong>
        <span class="whoami-photo-hint">${retroIcon("eye")} ver foto</span>
      </div>
    `;

    bindWhoAmICardPreview(card);
    whoamiOtherCharacters.appendChild(card);
  });

  hydrateCharacterPhotos(whoamiOtherCharacters);

  renderSpeakingOrder(
    whoamiSpeakingOrder,
    payload.speakingOrder || [],
    currentWhoAmIStatuses
  );

  whoamiGuessInput.value = "";
  whoamiGuessFeedback.textContent = "";
  renderWhoAmIAttempts(payload.attemptsLeft ?? 3);
  setWhoAmIEliminated(
    Boolean(payload.eliminated),
    payload.selfCharacter,
    payload.selfImageUrl
  );
  applyWhoAmIStatuses(currentWhoAmIStatuses);
  if (payload.selfStatus === "correct") {
    whoamiGuessFeedback.dataset.state = "correct";
    whoamiGuessFeedback.textContent = `✓ Você acertou em ${payload.selfPlacement}º lugar! Acompanhe os outros.`;
  }
  loadWhoAmINotes();

  whoamiReviewState = null;
  whoamiReviewMain.classList.add("hidden");
  whoamiDrawAnimation.classList.remove("hidden");
  whoamiLaunchOverlay.classList.add("hidden");
}

function launchWhoAmIClientGame(payload = {}) {
  whoamiReviewMain.classList.add("hidden");
  whoamiDrawAnimation.classList.add("hidden");
  whoamiLaunchOverlay.classList.remove("hidden");

  let count = 3;
  whoamiLaunchCount.textContent = count;

  const timer = setInterval(() => {
    count -= 1;

    if (count <= 0) {
      clearInterval(timer);
      whoamiLaunchOverlay.classList.add("hidden");
      renderWhoAmIGameCharacters(payload);
      showScreen(whoamiGameScreen);
      return;
    }

    whoamiLaunchCount.textContent = count;
  }, 550);
}


/* ================= SALAS CRIADAS ================= */

function renderOpenRooms(rooms) {
  activeRooms = (rooms || []).filter(
    (room) => (room.gameType || "impostor") === "impostor"
  );

  openRoomsList.innerHTML = "";

  if (activeRooms.length === 0) {
    openRoomsList.innerHTML = `
      <div class="empty-rooms">
        nenhuma sala criada ainda.<br>
        seja o primeiro a abrir uma ♡
      </div>
    `;
    return;
  }

  activeRooms.forEach((room) => {
    const card = document.createElement("div");
    card.className =
      `room-list-card ${room.started ? "in-game" : ""}`;

    const info = document.createElement("div");
    info.className = "room-list-main";

    info.innerHTML = `
      <div class="room-list-top">
        <span class="room-list-code">${room.code}</span>
        <span class="room-status-badge">
          ${room.started ? "👁 ASSISTIR" : "ABERTA"}
        </span>${room.isPrivate ? '<span class="room-status-badge">🔒 PRIVADA</span>' : ""}
      </div>

      <div class="room-list-meta room-list-host-meta">
        ${avatarImage(room.hostAvatar, "room-host-avatar")}
        <span>Host: ${escapeHtml(room.hostName)}
        • ${room.playersCount} jogador${room.playersCount === 1 ? "" : "es"}</span>
      </div>

      <div class="room-list-settings">
        <span class="room-setting-chip">
          ${retroIcon("folder", "chip-mini-icon")}
          ${escapeHtml(room.category?.name || "Todas")}
        </span>

        <span class="room-setting-chip">
          ${escapeHtml(room.difficulty?.name || "Aleatória")}
        </span>
      </div>
    `;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "room-list-join";
    button.textContent = room.started ? "assistir" : "entrar";
    button.disabled = false;

    button.addEventListener("click", () => {
      joinRoom(room.code);
    });

    card.appendChild(info);
    card.appendChild(button);
    openRoomsList.appendChild(card);
  });
}


function renderWhoAmIOpenRooms(rooms) {
  const whoamiRooms = (rooms || []).filter(
    (room) => room.gameType === "whoami"
  );

  whoamiOpenRoomsList.innerHTML = "";

  if (whoamiRooms.length === 0) {
    whoamiOpenRoomsList.innerHTML = `
      <div class="empty-rooms">
        nenhuma sala criada ainda.<br>
        seja o primeiro a abrir uma ♡
      </div>
    `;
    return;
  }

  whoamiRooms.forEach((room) => {
    const card = document.createElement("div");
    card.className =
      `room-list-card ${room.started ? "in-game" : ""}`;

    const info = document.createElement("div");
    info.className = "room-list-main";

    info.innerHTML = `
      <div class="room-list-top">
        <span class="room-list-code">${room.code}</span>
        <span class="room-status-badge">
          ${room.started ? "👁 ASSISTIR" : "ABERTA"}
        </span>${room.isPrivate ? '<span class="room-status-badge">🔒 PRIVADA</span>' : ""}
      </div>

      <div class="room-list-meta room-list-host-meta">
        ${avatarImage(room.hostAvatar, "room-host-avatar")}
        <span>Host: ${escapeHtml(room.hostName)}
        • ${room.playersCount} jogador${room.playersCount === 1 ? "" : "es"}</span>
      </div>

      <div class="room-list-settings">
        <span class="room-setting-chip">
          ${retroIcon("folder", "chip-mini-icon")}
          ${escapeHtml(room.category?.name || "Todas")}
        </span>

        <span class="room-setting-chip">
          ${escapeHtml(room.difficulty?.name || "Aleatória")}
        </span>
      </div>
    `;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "room-list-join";
    button.textContent =
      room.started ? "assistir" : "entrar";
    button.disabled = false;

    button.addEventListener("click", () => {
      joinWhoAmIRoom(room.code);
    });

    card.appendChild(info);
    card.appendChild(button);
    whoamiOpenRoomsList.appendChild(card);
  });
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function requestRooms() {
  socket.emit("get-rooms", (response) => {
    if (response?.ok) {
      renderOpenRooms(response.rooms);
      renderWhoAmIOpenRooms(response.rooms);
    }
  });
}

refreshRoomsButton.addEventListener("click", requestRooms);
refreshWhoAmIRoomsButton.addEventListener(
  "click",
  requestRooms
);

socket.on("rooms-list", (rooms) => {
  renderOpenRooms(rooms);
  renderWhoAmIOpenRooms(rooms);
  renderTriviaRooms(rooms);
});

/* ================= CRIAR / ENTRAR ================= */

createButton.addEventListener("click", () => {
  homeError.textContent = "";

  socket.emit(
    "create-room",
    {
      name: getName(),
      categoryId: createCategory.value,
      difficultyId: createDifficulty.value,
      playerToken,
      avatar: selectedAvatar,
      ...roomCreatePrivacy("impostor")
    },
    (response) => {
      if (!response.ok) {
        homeError.textContent = response.error;
        return;
      }

      localStorage.setItem(
        STORAGE_KEYS.playerName,
        getName()
      );

      saveAdmission(response);
      saveGamePreferences("impostor");
      if (response.spectator) showSpectatorRoom(response.room);
      else { renderRoom(response.room); showScreen(lobbyScreen); }
    }
  );
});

function joinRoom(code) {
  homeError.textContent = "";

  if (!getName()) {
    homeError.textContent =
      "Digite seu nome antes de entrar em uma sala.";
    nameInput.focus();
    return;
  }

  socket.emit(
    "join-room",
    {
      name: getName(),
      code,
      playerToken,
      avatar: selectedAvatar,
      gameType: "impostor",
      roomPassword: roomJoinPassword("impostor"),
      sessionSecret: roomSessionSecret
    },
    (response) => {
      if (!response.ok) {
        homeError.textContent = response.error;
        return;
      }

      localStorage.setItem(
        STORAGE_KEYS.playerName,
        getName()
      );

      roomInput.value = response.room.code;
      saveAdmission(response);
      if (response.spectator) showSpectatorRoom(response.room);
      else { renderRoom(response.room); showScreen(lobbyScreen); }
    }
  );
}


createWhoAmIRoomButton.addEventListener(
  "click",
  () => {
    whoamiHomeError.textContent = "";

    socket.emit(
      "create-whoami-room",
      {
        name: getWhoAmIName(),
        categoryId: whoamiCategory.value,
        difficultyId: whoamiDifficulty.value,
        playerToken,
        avatar: selectedAvatar,
        ...roomCreatePrivacy("whoami"),
        allFinish: Boolean(document.getElementById("whoami-all-finish")?.checked)
      },
      (response) => {
        if (!response?.ok) {
          whoamiHomeError.textContent =
            response?.error ||
            "Não foi possível criar a sala.";
          return;
        }

        localStorage.setItem(
          STORAGE_KEYS.playerName,
          getWhoAmIName()
        );

        saveAdmission(response);
        saveGamePreferences("whoami");
        if (response.spectator) showSpectatorRoom(response.room);
        else { renderWhoAmIRoom(response.room); showScreen(whoamiLobbyScreen); }
      }
    );
  }
);

function joinWhoAmIRoom(code) {
  whoamiHomeError.textContent = "";

  if (!getWhoAmIName()) {
    whoamiHomeError.textContent =
      "Digite seu nome antes de entrar em uma sala.";
    whoamiNameInput.focus();
    return;
  }

  socket.emit(
    "join-room",
    {
      name: getWhoAmIName(),
      code,
      playerToken,
      avatar: selectedAvatar,
      gameType: "whoami",
      roomPassword: roomJoinPassword("whoami"),
      sessionSecret: roomSessionSecret
    },
    (response) => {
      if (!response?.ok) {
        whoamiHomeError.textContent =
          response?.error ||
          "Não foi possível entrar na sala.";
        return;
      }

      localStorage.setItem(
        STORAGE_KEYS.playerName,
        getWhoAmIName()
      );

      whoamiRoomInput.value =
        response.room.code;

      saveAdmission(response);
      if (response.spectator) showSpectatorRoom(response.room);
      else { renderWhoAmIRoom(response.room); showScreen(whoamiLobbyScreen); }
    }
  );
}

joinWhoAmIRoomButton.addEventListener(
  "click",
  () => {
    joinWhoAmIRoom(whoamiRoomInput.value);
  }
);

joinButton.addEventListener("click", () => {
  joinRoom(roomInput.value);
});

copyButton.addEventListener("click", async () => {
  if (!roomCode) return;

  try {
    await navigator.clipboard.writeText(roomCode);
    copyButton.textContent = "copiado!";

    setTimeout(() => {
      copyButton.textContent = "copiar";
    }, 1200);
  } catch {
    copyButton.textContent = roomCode;
  }
});


whoamiCopyCodeButton.addEventListener(
  "click",
  async () => {
    if (!roomCode) return;

    try {
      await navigator.clipboard.writeText(roomCode);
      whoamiCopyCodeButton.textContent =
        "copiado!";

      setTimeout(() => {
        whoamiCopyCodeButton.textContent =
          "copiar";
      }, 1200);
    } catch {
      whoamiCopyCodeButton.textContent =
        roomCode;
    }
  }
);

whoamiReadyToggleButton.addEventListener(
  "click",
  () => {
    if (!currentRoom || !roomCode) {
      return;
    }

    const me = currentRoom.players.find(
      (player) =>
        player.token === playerToken
    );

    const nextReady =
      !Boolean(me?.ready);

    whoamiLobbyError.textContent = "";

    socket.emit(
      "set-ready",
      {
        code: roomCode,
        ready: nextReady
      },
      (response) => {
        if (!response?.ok) {
          whoamiLobbyError.textContent =
            response?.error ||
            "Não foi possível alterar seu status.";
        }
      }
    );
  }
);

readyToggleButton.addEventListener("click", () => {
  if (!currentRoom || !roomCode) {
    return;
  }

  const me = currentRoom.players.find(
    (player) => player.token === playerToken
  );

  const nextReady = !Boolean(me?.ready);

  lobbyError.textContent = "";

  socket.emit(
    "set-ready",
    {
      code: roomCode,
      ready: nextReady
    },
    (response) => {
      if (!response?.ok) {
        lobbyError.textContent =
          response?.error || "Não foi possível alterar seu status.";
      }
    }
  );
});

startButton.addEventListener("click", () => {
  lobbyError.textContent = "";

  socket.emit(
    "start-game",
    { code: roomCode },
    (response) => {
      if (!response.ok) {
        lobbyError.textContent = response.error;
      }
    }
  );
});

function requestNewImpostorRound() {
  gameError.textContent = "";

  socket.emit(
    "new-round",
    { code: roomCode },
    (response) => {
      if (!response?.ok) {
        const message = response?.error || "Não foi possível iniciar uma nova rodada.";
        gameError.textContent = message;
        showGlobalToast({ icon: "!", title: "Nova rodada", message });
      }
    }
  );
}

newRoundButton.addEventListener("click", requestNewImpostorRound);
impostorResultNewRound?.addEventListener("click", requestNewImpostorRound);

startImpostorVoteButton?.addEventListener("click", () => {
  gameError.textContent = "";
  startImpostorVoteButton.disabled = true;

  socket.emit(
    "start-impostor-vote",
    { code: roomCode },
    (response) => {
      startImpostorVoteButton.disabled = false;
      if (!response?.ok) {
        gameError.textContent =
          response?.error || "Não foi possível iniciar a votação.";
      }
    }
  );
});


startWhoAmIGameButton.addEventListener(
  "click",
  () => {
    whoamiLobbyError.textContent = "";

    socket.emit(
      "start-whoami-game",
      { code: roomCode },
      (response) => {
        if (!response?.ok) {
          whoamiLobbyError.textContent =
            response?.error ||
            "Não foi possível iniciar.";
        }
      }
    );
  }
);

whoamiNewRoundButton.addEventListener(
  "click",
  () => {
    whoamiGameError.textContent = "";

    socket.emit(
      "new-whoami-round",
      { code: roomCode },
      (response) => {
        if (!response?.ok) {
          whoamiGameError.textContent =
            response?.error ||
            "Não foi possível iniciar uma nova rodada.";
        }
      }
    );
  }
);

function submitWhoAmIGuess() {
  if (currentWhoAmIEliminated) return;

  const guess = whoamiGuessInput.value.trim();
  whoamiGameError.textContent = "";
  whoamiGuessFeedback.textContent = "";
  delete whoamiGuessFeedback.dataset.state;

  if (!guess) {
    whoamiGuessFeedback.textContent = "Digite um nome antes de tentar.";
    whoamiGuessInput.focus();
    return;
  }

  whoamiGuessButton.disabled = true;

  socket.emit(
    "whoami-guess",
    { code: roomCode, guess },
    (response) => {
      whoamiGuessButton.disabled = currentWhoAmIEliminated;

      if (!response?.ok) {
        whoamiGuessFeedback.textContent =
          response?.error || "Não foi possível conferir o palpite.";
        return;
      }

      if (response.correct) {
        whoamiGuessFeedback.dataset.state = "correct";
        whoamiGuessFeedback.textContent = currentWhoAmIAllFinish
          ? `✓ ACERTOU! Você ficou em ${response.placement}º lugar. Acompanhe os outros!`
          : "✓ ACERTOU!";
        setWhoAmIEliminated(true, response.character, response.imageUrl);
        whoamiGuessInput.disabled = true;
        whoamiGuessButton.disabled = true;
        return;
      }

      if (response.result === "close" || response.close) {
        whoamiGuessFeedback.dataset.state = "close";
        whoamiGuessFeedback.textContent =
          response.closeReason === "incomplete"
            ? "✦ Você está no caminho certo, mas o nome está incompleto. Complete e tente de novo — não gastou tentativa."
            : "✦ Quase! A escrita está muito próxima. Confira o nome e tente de novo — não gastou tentativa.";
        renderWhoAmIAttempts(response.attemptsLeft ?? 3);
        whoamiGuessInput.select();
        whoamiGuessInput.focus();
        return;
      }

      whoamiGuessFeedback.dataset.state = "wrong";
      renderWhoAmIAttempts(response.attemptsLeft);
      whoamiGuessInput.value = "";

      if (response.eliminated) {
        whoamiGuessFeedback.textContent =
          "✕ terceira tentativa errada — você foi eliminado.";
        setWhoAmIEliminated(
          true,
          response.character,
          response.imageUrl
        );
      } else {
        whoamiGuessFeedback.textContent =
          `✕ não é esse. Restam ${response.attemptsLeft} tentativa${response.attemptsLeft === 1 ? "" : "s"}.`;
        whoamiGuessInput.focus();
      }
    }
  );
}

whoamiGuessButton.addEventListener("click", submitWhoAmIGuess);

whoamiGuessInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitWhoAmIGuess();
  }
});

whoamiNotes.addEventListener("input", () => {
  const key = notesStorageKey();
  if (key) {
    sessionStorage.setItem(key, whoamiNotes.value);
  }
});

whoamiRevealSelfButton.addEventListener(
  "click",
  () => {
    whoamiGameError.textContent = "";

    socket.emit(
      "whoami-reveal-self",
      { code: roomCode },
      (response) => {
        if (!response?.ok) {
          whoamiGameError.textContent =
            response?.error ||
            "Não foi possível revelar.";
          return;
        }

        renderWhoAmIAttempts(0);
        setWhoAmIEliminated(
          true,
          response.character,
          response.imageUrl
        );
        whoamiGuessFeedback.textContent =
          "Você desistiu desta rodada e seu personagem foi revelado.";
      }
    );
  }
);

socket.on("room-updated", (room) => {
  if (!roomCode || room.code !== roomCode) {
    return;
  }

  if (isSpectator) {
    currentRoom = room;
    document.getElementById("spectator-viewers-count").textContent = String(room.spectatorCount || 0);
  } else if (room.gameType === "trivia") {
    renderTriviaLobby(room);
  } else if (room.gameType === "whoami") {
    renderWhoAmIRoom(room);
  } else {
    renderRoom(room);
  }
});

socket.on("spectator-state", state => {
  if (isSpectator) renderSpectatorState(state);
});
socket.on("spectator-promoted", ({ room }) => {
  clearWhoAmIGuessNotices();
  isSpectator = false;
  showGlobalToast({ icon: "✓", title: "Você pode jogar!", message: "A partida terminou. Confirme presença no lobby para jogar." });
  if (room.gameType === "whoami") { renderWhoAmIRoom(room); showScreen(whoamiLobbyScreen); }
  else if (room.gameType === "trivia") { renderTriviaLobby(room); showScreen(triviaLobbyScreen); }
  else { renderRoom(room); showScreen(lobbyScreen); }
});
document.getElementById("spectator-leave")?.addEventListener("click", () => {
  socket.emit("leave-room", () => {
    const game = currentRoom?.gameType;
    resetLocalRoom();
    showScreen(game === "whoami" ? whoamiHomeScreen : game === "trivia" ? triviaHomeScreen : impostorHomeScreen);
  });
});

socket.on("host-transferred", ({
  oldHostName,
  newHostName,
  newHostToken
}) => {
  const iAmNewHost =
    newHostToken === playerToken;

  showGlobalToast({
    icon: iAmNewHost ? "★" : "↻",
    title: iAmNewHost
      ? "Você agora é o host"
      : "Host transferido",
    message: iAmNewHost
      ? `${oldHostName} saiu. Agora você controla a sala.`
      : `${oldHostName} saiu. ${newHostName} agora é o host.`,
    duration: 6000
  });
});

socket.on("room-closed", ({ gameType, reason }) => {
  resetLocalRoom();

  if (gameType === "trivia") {
    showScreen(triviaHomeScreen);
    requestRooms();
  } else if (gameType === "whoami") {
    showScreen(whoamiHomeScreen);
    requestRooms();
  } else {
    showScreen(impostorHomeScreen);
    requestRooms();
  }

  showGlobalToast({
    icon: "!",
    title: "Sala encerrada",
    message: reason || "A sala foi encerrada pelo host.",
    duration: 5000
  });
});

socket.on("game-started", ({ role, word, hint, speakingOrder = [], statuses = [], phase = "discussion" }) => {
  civilView.classList.add("hidden");
  impostorView.classList.add("hidden");

  if (role === "impostor") {
    impostorHint.textContent = hint || "indisponível";
    impostorView.classList.remove("hidden");
  } else {
    secretWord.textContent = word;
    civilView.classList.remove("hidden");
  }

  currentImpostorPhase = phase || "discussion";
  renderSpeakingOrder(impostorSpeakingOrder, speakingOrder, statuses);
  updateImpostorDiscussionControls(currentImpostorPhase);

  if (!["voting", "finished"].includes(currentImpostorPhase)) {
    showScreen(gameScreen);
  }
});

socket.on("impostor-vote-started", (payload) => {
  renderImpostorVote(payload || {});
});

socket.on("impostor-vote-progress", ({ votedCount = 0, totalVoters = 0 }) => {
  if (impostorVoteProgress) {
    impostorVoteProgress.textContent = `${votedCount}/${totalVoters}`;
  }
});

socket.on("impostor-tiebreak-started", (payload) => {
  renderImpostorTiebreak(payload || {});
  showGlobalToast({
    icon: "↻",
    title: "Empate!",
    message: "Os empatados fazem uma rodada extra antes da nova votação.",
    duration: 4600
  });
});

socket.on("impostor-player-eliminated", (payload) => {
  renderImpostorElimination(payload || {});
});

socket.on("impostor-vote-finished", (payload) => {
  renderImpostorResult(payload || {});
});

socket.on("whoami-review-started", (state) => {
  showWhoAmIReview(
    state,
    Boolean(state.resumed)
  );
});

socket.on("whoami-review-updated", (state) => {
  if (whoamiReviewScreen.classList.contains("hidden")) {
    showScreen(whoamiReviewScreen);
  }

  whoamiDrawAnimation.classList.add("hidden");
  whoamiReviewMain.classList.remove("hidden");
  renderWhoAmIReview(state);
});

socket.on("whoami-character-rerolled", ({ targetName }) => {
  showGlobalToast({
    icon: "↻",
    title: "Novo personagem sorteado",
    message: `${targetName} recebeu uma nova opção para a conferência.`,
    duration: 3200
  });
});

socket.on("whoami-review-complete", (payload) => {
  launchWhoAmIClientGame(payload || {});
});

socket.on("whoami-game-started", (payload) => {
  renderWhoAmIGameCharacters(payload || {});
  showScreen(whoamiGameScreen);
});

socket.on("whoami-guess-announced", queueWhoAmIGuessNotice);

socket.on("whoami-status-updated", ({ statuses }) => {
  applyWhoAmIStatuses(statuses || []);
});

socket.on("whoami-game-finished", (payload) => {
  currentWhoAmIRoundId = payload?.roundId || currentWhoAmIRoundId;
  renderWhoAmIWinner(payload || {});
});

socket.on("whoami-back-to-lobby", () => {
  clearWhoAmIGuessNotices();
  whoamiSelfReveal.classList.add("hidden");
  whoamiRevealSelfButton.classList.remove("hidden");
  currentWhoAmIRoundId = null;
  currentWhoAmIStatuses = [];
  currentWhoAmIAllFinish = false;
  currentWhoAmIEliminated = false;
  whoamiGuessInput.value = "";
  whoamiGuessInput.disabled = false;
  whoamiGuessButton.disabled = false;
  whoamiGuessFeedback.textContent = "";
  whoamiNotes.value = "";
  renderWhoAmIAttempts(3);
  whoamiReviewState = null;
  whoamiReviewMain.classList.add("hidden");
  whoamiDrawAnimation.classList.remove("hidden");
  whoamiLaunchOverlay.classList.add("hidden");

  showScreen(whoamiLobbyScreen);
});

socket.on("back-to-lobby", () => {
  civilView.classList.add("hidden");
  impostorView.classList.add("hidden");
  currentImpostorPhase = "discussion";
  currentImpostorVoteRound = 0;
  currentImpostorVoteSubmitted = false;
  impostorPhaseBanner?.classList.add("hidden");
  impostorVoteFeedback.textContent = "";
  impostorVoteCandidates.innerHTML = "";
  showScreen(lobbyScreen);
});

roomInput.addEventListener("input", () => {
  roomInput.value = roomInput.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
});


whoamiRoomInput.addEventListener("input", () => {
  whoamiRoomInput.value =
    whoamiRoomInput.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4);
});


[whoamiNameInput, whoamiRoomInput].forEach(
  (input) => {
    input.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter") return;

        if (
          input === whoamiRoomInput &&
          whoamiRoomInput.value
        ) {
          joinWhoAmIRoom(
            whoamiRoomInput.value
          );
        }
      }
    );
  }
);

[nameInput, roomInput].forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;

    if (input === roomInput && roomInput.value) {
      joinRoom(roomInput.value);
    }
  });
});

/* ================= SAIR DA SALA ================= */

function resetLocalRoom() {
  if (typeof triviaUi !== "undefined") clearInterval(triviaUi.ticker);
  clearWhoAmIGuessNotices();
  roomCode = null;
  currentRoom = null;

  sessionStorage.removeItem(STORAGE_KEYS.roomCode);
  sessionStorage.removeItem(STORAGE_KEYS.sessionSecret);
  roomSessionSecret = null;
  isSpectator = false;
  spectatorSnapshot = null;

  civilView.classList.add("hidden");
  impostorView.classList.add("hidden");
  currentImpostorPhase = "discussion";
  currentImpostorVoteRound = 0;
  currentImpostorVoteSubmitted = false;
  impostorPhaseBanner?.classList.add("hidden");
  if (impostorVoteFeedback) impostorVoteFeedback.textContent = "";
  if (impostorVoteCandidates) impostorVoteCandidates.innerHTML = "";
  whoamiSelfReveal.classList.add("hidden");
  whoamiRevealSelfButton.classList.remove("hidden");
  currentWhoAmIRoundId = null;
  currentWhoAmIStatuses = [];
  currentWhoAmIAllFinish = false;
  currentWhoAmIEliminated = false;
  whoamiGuessInput.value = "";
  whoamiGuessInput.disabled = false;
  whoamiGuessButton.disabled = false;
  whoamiGuessFeedback.textContent = "";
  whoamiNotes.value = "";
  renderWhoAmIAttempts(3);
  whoamiReviewState = null;
  whoamiReviewMain.classList.add("hidden");
  whoamiDrawAnimation.classList.remove("hidden");
  whoamiLaunchOverlay.classList.add("hidden");
}

function finishLeavingRoom() {
  resetLocalRoom();
  hostExitOverlay.classList.add("hidden");
  pendingHostExitFinish = null;
  showScreen(menuScreen);
}

function leaveRoomAndTransfer() {
  if (!roomCode) {
    finishLeavingRoom();
    return;
  }

  socket.emit("leave-room", () => {
    finishLeavingRoom();
  });
}

function closeRoomAsHost() {
  if (!roomCode) {
    finishLeavingRoom();
    return;
  }

  socket.emit(
    "close-room",
    { code: roomCode },
    (response) => {
      if (!response?.ok) {
        showGlobalToast({
          icon: "!",
          title: "Não foi possível encerrar",
          message:
            response?.error || "Tente novamente."
        });
        return;
      }

      finishLeavingRoom();
    }
  );
}

function requestLeaveCurrentRoom() {
  const amHost =
    currentRoom &&
    currentRoom.hostToken === playerToken;

  const hasOtherPlayers =
    currentRoom &&
    currentRoom.players.length > 1;

  if (roomCode && amHost && hasOtherPlayers) {
    hostExitOverlay.classList.remove("hidden");
    return;
  }

  leaveRoomAndTransfer();
}

hostLeaveTransferButton.addEventListener(
  "click",
  leaveRoomAndTransfer
);

hostCloseRoomButton.addEventListener(
  "click",
  closeRoomAsHost
);

hostExitCancelButton.addEventListener("click", () => {
  hostExitOverlay.classList.add("hidden");
});

hostExitOverlay.addEventListener("click", (event) => {
  if (event.target === hostExitOverlay) {
    hostExitOverlay.classList.add("hidden");
  }
});

document.querySelectorAll("[data-back-menu]").forEach((button) => {
  button.addEventListener("click", () => {
    homeError.textContent = "";
    lobbyError.textContent = "";
    gameError.textContent = "";
    whoamiHomeError.textContent = "";
    whoamiLobbyError.textContent = "";
    whoamiGameError.textContent = "";
    whoamiReviewError.textContent = "";
    menuMessage.textContent = "";

    if (roomCode) {
      requestLeaveCurrentRoom();
    } else {
      resetLocalRoom();
      showScreen(menuScreen);
    }
  });
});


/* ================= RECONEXÃO / QUEDA DO SERVIDOR ================= */

function clearBrokenSession() {
  roomCode = null;
  currentRoom = null;
  roomSessionSecret = null;
  isSpectator = false;
  sessionStorage.removeItem(STORAGE_KEYS.roomCode);
  sessionStorage.removeItem(STORAGE_KEYS.sessionSecret);
}

function abandonSavedSession({
  goToMenu = true
} = {}) {
  const savedRoomCode =
    sessionStorage.getItem(
      STORAGE_KEYS.roomCode
    );

  const finish = () => {
    stopReconnectCountdown();
    hideConnectionOverlay();
    clearBrokenSession();

    if (goToMenu) {
      showScreen(menuScreen);
      requestRooms();
    }
  };

  if (!savedRoomCode) {
    finish();
    return;
  }

  if (!socket.connected) {
    finish();
    return;
  }

  socket.emit(
    "abandon-session",
    {
      playerToken,
      roomCode: savedRoomCode,
      sessionSecret: roomSessionSecret
    },
    finish
  );

  // Não deixa o botão preso caso o callback falhe.
  setTimeout(finish, 1200);
}

function showResumeQuestion() {
  const savedRoomCode =
    sessionStorage.getItem(
      STORAGE_KEYS.roomCode
    );

  if (!savedRoomCode) {
    hideConnectionOverlay();
    return;
  }

  stopReconnectCountdown();

  showConnectionOverlay({
    icon: "↻",
    kicker: "SESSÃO ENCONTRADA",
    title: "Quer voltar para a sala?",
    message:
      `Você ainda tem uma sessão salva na sala ${savedRoomCode}.`,
    loading: false,
    countdown: false,
    actions: true,
    primaryLabel: "↻ voltar para a sala",
    secondaryLabel: "× ir para o menu",
    onPrimary: () => {
      attemptResumeSession({
        automatic: false
      });
    },
    onSecondary: () => {
      abandonSavedSession();
    }
  });
}

function showReconnectFailed(message) {
  stopReconnectCountdown();

  showConnectionOverlay({
    icon: "!",
    kicker: "NÃO FOI POSSÍVEL VOLTAR",
    title: "A reconexão demorou demais",
    message:
      message ||
      "Não conseguimos recuperar sua sala em 10 segundos.",
    loading: false,
    countdown: false,
    actions: true,
    primaryLabel: "↻ tentar novamente",
    secondaryLabel: "× ir para o menu",
    onPrimary: () => {
      attemptResumeSession({
        automatic: false
      });
    },
    onSecondary: () => {
      abandonSavedSession();
    }
  });
}

function showRoomLostState(message) {
  stopReconnectCountdown();
  clearBrokenSession();

  showConnectionOverlay({
    icon: "×",
    kicker: "SALA ENCERRADA",
    title: "Não foi possível voltar para a sala",
    message:
      message ||
      "A sala não existe mais. Ela pode ter sido encerrada ou o servidor pode ter reiniciado.",
    loading: false,
    countdown: false,
    actions: true,
    primaryLabel: "↻ procurar salas",
    secondaryLabel: "× voltar ao menu",
    onPrimary: () => {
      hideConnectionOverlay();
      showScreen(menuScreen);
      requestRooms();

      showGlobalToast({
        icon: "⌕",
        title: "Salas atualizadas",
        message:
          "Confira as salas abertas e entre novamente."
      });
    },
    onSecondary: () => {
      hideConnectionOverlay();
      showScreen(menuScreen);
    }
  });
}

function restoreSessionFromResponse(response) {
  resumingSession = false;

  if (!response?.ok) {
    showRoomLostState(
      response?.error ||
      "A sessão não pôde ser restaurada."
    );
    return false;
  }

  saveAdmission(response);
  if (response.spectator) {
    showSpectatorRoom(response.room);
  } else if (response.room.gameType === "trivia") {
    renderTriviaLobby(response.room);
    if (!response.started) showScreen(triviaLobbyScreen);
  } else if (response.room.gameType === "whoami") {
    renderWhoAmIRoom(response.room);

    if (!response.started) {
      showScreen(whoamiLobbyScreen);
    }
  } else {
    renderRoom(response.room);

    if (!response.started) {
      showScreen(lobbyScreen);
    }
  }

  stopReconnectCountdown();
  hideConnectionOverlay();

  showGlobalToast({
    icon: "✓",
    title: "Você voltou!",
    message: "Sua sessão foi restaurada.",
    duration: 3000
  });

  connectionWasLost = false;
  return true;
}

function attemptResumeSession({
  automatic = false
} = {}) {
  const savedRoomCode =
    sessionStorage.getItem(
      STORAGE_KEYS.roomCode
    );

  if (!savedRoomCode || !playerToken) {
    resumingSession = false;
    hideConnectionOverlay();
    connectionWasLost = false;
    return;
  }

  resumingSession = true;

  showConnectionOverlay({
    icon: "↻",
    kicker: automatic
      ? "RECONECTANDO"
      : "VOLTANDO PARA A SALA",
    title: "Restaurando sua sessão",
    message:
      `Tentando recuperar a sala ${savedRoomCode}.`,
    loading: true,
    countdown: true,
    actions: false
  });

  startReconnectCountdown(() => {
    resumingSession = false;

    showReconnectFailed(
      socket.connected
        ? "O servidor respondeu, mas não conseguimos recuperar sua sessão a tempo."
        : "O servidor ainda está indisponível. Você pode tentar novamente ou voltar ao menu."
    );
  });

  if (!socket.connected) {
    // O Socket.IO continua tentando conectar.
    // Assim que conectar, o evento "connect" abaixo
    // fará uma nova tentativa se ainda estivermos no processo.
    return;
  }

  let answered = false;

  socket.emit(
    "resume-session",
    {
      playerToken,
      roomCode: savedRoomCode,
      sessionSecret: roomSessionSecret
    },
    (response) => {
      if (answered) {
        return;
      }

      answered = true;

      if (!resumingSession) {
        return;
      }

      restoreSessionFromResponse(response);
    }
  );
}

connectionPrimary.addEventListener("click", () => {
  const action = pendingConnectionPrimaryAction;

  if (typeof action === "function") {
    action();
  }
});

connectionSecondary.addEventListener("click", () => {
  const action = pendingConnectionSecondaryAction;

  if (typeof action === "function") {
    action();
  }
});

socket.on("disconnect", (reason) => {
  if (reason === "io client disconnect") {
    return;
  }

  connectionWasLost = true;

  const savedRoom =
    sessionStorage.getItem(
      STORAGE_KEYS.roomCode
    );

  if (savedRoom) {
    resumingSession = true;

    showConnectionOverlay({
      icon: "⚠",
      kicker: "CONEXÃO PERDIDA",
      title: "Tentando voltar para a sala",
      message:
        "A conexão caiu. Vamos tentar recuperar sua partida automaticamente.",
      loading: true,
      countdown: true,
      actions: false
    });

    startReconnectCountdown(() => {
      resumingSession = false;
      showReconnectFailed(
        "A conexão não voltou dentro do tempo esperado."
      );
    });

    return;
  }

  showConnectionOverlay({
    icon: "⚠",
    kicker: "SERVIDOR OFFLINE",
    title: "Conexão perdida",
    message:
      "O servidor parou de responder.",
    loading: true,
    countdown: true,
    actions: false
  });

  startReconnectCountdown(() => {
    showConnectionOverlay({
      icon: "!",
      kicker: "SERVIDOR OFFLINE",
      title: "Ainda sem conexão",
      message:
        "O servidor continua indisponível.",
      loading: false,
      countdown: false,
      actions: true,
      primaryLabel: "↻ tentar novamente",
      secondaryLabel: "× fechar aviso",
      onPrimary: () => {
        socket.connect();

        showConnectionOverlay({
          icon: "↻",
          kicker: "RECONECTANDO",
          title: "Tentando novamente",
          message:
            "Estamos procurando o servidor...",
          loading: true,
          countdown: true,
          actions: false
        });

        startReconnectCountdown(() => {
          showReconnectFailed(
            "O servidor continua indisponível."
          );
        });
      },
      onSecondary: () => {
        hideConnectionOverlay();
      }
    });
  });
});

socket.on("connect_error", () => {
  connectionWasLost = true;
});

socket.io.on("reconnect_attempt", () => {
  connectionWasLost = true;
});

socket.on("connect", () => {
  const savedRoom =
    sessionStorage.getItem(
      STORAGE_KEYS.roomCode
    );

  if (!savedRoom) {
    if (connectionWasLost) {
      stopReconnectCountdown();
      hideConnectionOverlay();

      showGlobalToast({
        icon: "✓",
        title: "Servidor reconectado",
        message: "A conexão voltou ao normal.",
        duration: 3000
      });
    }

    connectionWasLost = false;
    return;
  }

  /*
    Situação 1: a conexão caiu enquanto a pessoa jogava.
    Nesse caso tentamos recuperar automaticamente.
  */
  if (connectionWasLost && resumingSession) {
    attemptResumeSession({
      automatic: true
    });
    return;
  }

  /*
    Situação 2: página acabou de carregar (F5).
    Não entra automaticamente: pergunta primeiro.
  */
  if (!connectionWasLost) {
    showResumeQuestion();
  }
});

/* =========================================================
   V19 — CONTA, PERFIL, SESSÃO PERSISTENTE E ESTATÍSTICAS
   ========================================================= */

const accountGuestControls = document.querySelector("#account-guest-controls");
const accountUserControls = document.querySelector("#account-user-controls");
const accountLoginButton = document.querySelector("#account-login-button");
const accountRegisterButton = document.querySelector("#account-register-button");
const accountProfileButton = document.querySelector("#account-profile-button");
const accountHeaderAvatar = document.querySelector("#account-header-avatar");
const accountHeaderNickname = document.querySelector("#account-header-nickname");
const accountDropdown = document.querySelector("#account-dropdown");
const accountOpenProfile = document.querySelector("#account-open-profile");
const accountOpenStats = document.querySelector("#account-open-stats");
const accountLogoutButton = document.querySelector("#account-logout-button");

const authModal = document.querySelector("#auth-modal");
const authModalClose = document.querySelector("#auth-modal-close");
const authTabs = [...document.querySelectorAll("[data-auth-tab]")];
const authLoginPanel = document.querySelector("#auth-login-panel");
const authRegisterPanel = document.querySelector("#auth-register-panel");
const authRecoverPanel = document.querySelector("#auth-recover-panel");
const authMessage = document.querySelector("#auth-message");

const authLoginNickname = document.querySelector("#auth-login-nickname");
const authLoginPassword = document.querySelector("#auth-login-password");
const authLoginSubmit = document.querySelector("#auth-login-submit");
const authRegisterNickname = document.querySelector("#auth-register-nickname");
const authRegisterBirth = document.querySelector("#auth-register-birth");
const authRegisterPassword = document.querySelector("#auth-register-password");
const authRegisterConfirm = document.querySelector("#auth-register-confirm");
const authRegisterSubmit = document.querySelector("#auth-register-submit");
const authRecoverNickname = document.querySelector("#auth-recover-nickname");
const authRecoverBirth = document.querySelector("#auth-recover-birth");
const authRecoverVerify = document.querySelector("#auth-recover-verify");
const authRecoverPassword = document.querySelector("#auth-recover-password");
const authRecoverConfirm = document.querySelector("#auth-recover-confirm");
const authRecoverReset = document.querySelector("#auth-recover-reset");
const recoverStepOne = document.querySelector("#recover-step-one");
const recoverStepTwo = document.querySelector("#recover-step-two");

const profileModal = document.querySelector("#profile-modal");
const profileModalClose = document.querySelector("#profile-modal-close");
const profileTabs = [...document.querySelectorAll("[data-profile-tab]")];
const profileMainPanel = document.querySelector("#profile-main-panel");
const profileStatsPanel = document.querySelector("#profile-stats-panel");
const profileAvatar = document.querySelector("#profile-avatar");
const profileChangeAvatar = document.querySelector("#profile-change-avatar");
const profileTitle = document.querySelector("#profile-title");
const profileMemberSince = document.querySelector("#profile-member-since");
const profileNicknameForm = document.querySelector("#profile-nickname-form");
const profileNicknameInput = document.querySelector("#profile-nickname-input");
const profilePasswordForm = document.querySelector("#profile-password-form");
const profileCurrentPassword = document.querySelector("#profile-current-password");
const profileNewPassword = document.querySelector("#profile-new-password");
const profileConfirmPassword = document.querySelector("#profile-confirm-password");
const profileMessage = document.querySelector("#profile-message");

const statTotalGames = document.querySelector("#stat-total-games");
const statTotalWins = document.querySelector("#stat-total-wins");
const statTotalLosses = document.querySelector("#stat-total-losses");
const statWinRate = document.querySelector("#stat-win-rate");
const statImpostorGames = document.querySelector("#stat-impostor-games");
const statImpostorWins = document.querySelector("#stat-impostor-wins");
const statTimesImpostor = document.querySelector("#stat-times-impostor");
const statWinsAsImpostor = document.querySelector("#stat-wins-as-impostor");
const statWinsAsInvestigator = document.querySelector("#stat-wins-as-investigator");
const statWhoamiGames = document.querySelector("#stat-whoami-games");
const statWhoamiWins = document.querySelector("#stat-whoami-wins");
const statWhoamiEliminations = document.querySelector("#stat-whoami-eliminations");
const statWhoamiCorrect = document.querySelector("#stat-whoami-correct");
const statWhoamiAverage = document.querySelector("#stat-whoami-average");

function setAccountMessage(element, message = "", success = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("success", Boolean(success));
}

function profileDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function syncGameIdentityUI() {
  const logged = Boolean(currentUser);
  const key = activeAvatarKey();
  const avatar = getAvatarDefinition(key);

  [nameInput, whoamiNameInput, document.getElementById("trivia-name")].filter(Boolean).forEach((input) => {
    if (logged) {
      input.value = currentUser.nickname;
      input.readOnly = true;
    } else {
      input.readOnly = false;
      const guestName = localStorage.getItem(STORAGE_KEYS.playerName) || "";
      if (!input.value || input.value === currentUser?.nickname) input.value = guestName;
    }
  });

  document.querySelectorAll(".guest-identity-field").forEach((field) => {
    field.classList.toggle("account-identity", logged);
    const badge = field.querySelector(".guest-identity-heading > span");
    if (badge) badge.textContent = logged ? "CONTA" : "VISITANTE";
    const label = field.querySelector(".guest-identity-heading label");
    if (label) label.textContent = logged ? "Seu perfil" : "Seu nome e avatar";
    const help = field.querySelector(".avatar-help");
    if (help) {
      help.textContent = logged
        ? "Seu nickname e avatar vêm da sua conta. Clique no avatar para alterar."
        : "Clique no avatar para escolher outro animal.";
    }
  });

  if (avatarPreviewImpostor) avatarPreviewImpostor.src = avatar.src;
  if (avatarPreviewWhoAmI) avatarPreviewWhoAmI.src = avatar.src;
  const triviaAvatar = document.getElementById("avatar-preview-trivia");
  if (triviaAvatar) triviaAvatar.src = avatar.src;
}

function renderStats(stats = {}) {
  currentStats = stats || {};
  const impostor = currentStats.impostor || {};
  const whoami = currentStats.whoami || {};

  if (statTotalGames) statTotalGames.textContent = currentStats.totalGames || 0;
  if (statTotalWins) statTotalWins.textContent = currentStats.totalWins || 0;
  if (statTotalLosses) statTotalLosses.textContent = currentStats.totalLosses || 0;
  if (statWinRate) statWinRate.textContent = `${currentStats.winRate || 0}%`;
  if (statImpostorGames) statImpostorGames.textContent = impostor.games || 0;
  if (statImpostorWins) statImpostorWins.textContent = `${impostor.wins || 0} vitórias`;
  if (statTimesImpostor) statTimesImpostor.textContent = impostor.timesImpostor || 0;
  if (statWinsAsImpostor) statWinsAsImpostor.textContent = impostor.winsAsImpostor || 0;
  if (statWinsAsInvestigator) statWinsAsInvestigator.textContent = impostor.winsAsInvestigator || 0;
  if (statWhoamiGames) statWhoamiGames.textContent = whoami.games || 0;
  if (statWhoamiWins) statWhoamiWins.textContent = `${whoami.wins || 0} vitórias`;
  if (statWhoamiEliminations) statWhoamiEliminations.textContent = whoami.eliminations || 0;
  if (statWhoamiCorrect) statWhoamiCorrect.textContent = whoami.correct || 0;
  if (statWhoamiAverage) statWhoamiAverage.textContent = whoami.avgAttemptsToWin || 0;
}

function applyAuthenticatedUser(user, stats = null) {
  const previousUserId = currentUser?.id || null;
  currentUser = user || null;
  if (stats) renderStats(stats);

  accountGuestControls?.classList.toggle("hidden", Boolean(currentUser));
  accountUserControls?.classList.toggle("hidden", !currentUser);

  if (currentUser) {
    if (accountHeaderNickname) accountHeaderNickname.textContent = currentUser.nickname;
    if (accountHeaderAvatar) accountHeaderAvatar.src = currentUser.avatarUrl;
    if (profileAvatar) profileAvatar.src = currentUser.avatarUrl;
    if (profileTitle) profileTitle.textContent = `@${currentUser.nickname}`;
    if (profileMemberSince) profileMemberSince.textContent = profileDate(currentUser.createdAt);
    if (profileNicknameInput) profileNicknameInput.value = currentUser.nickname;
  }

  syncGameIdentityUI();
  updateAvatarPreview();
  if (previousUserId !== (currentUser?.id || null)) refreshAllGamePreferences();
}

function clearAuthenticatedUser() {
  const wasLoggedIn = Boolean(currentUser);
  currentUser = null;
  currentStats = null;
  accountGuestControls?.classList.remove("hidden");
  accountUserControls?.classList.add("hidden");
  accountDropdown?.classList.add("hidden");
  syncGameIdentityUI();
  updateAvatarPreview();
  if (wasLoggedIn) refreshAllGamePreferences();
}

function reconnectSocketForAccount() {
  if (!socket) return;
  if (socket.connected) socket.disconnect();
  socket.connect();
}

async function loadCurrentAccount() {
  try {
    const data = await apiJson("/api/auth/me", { method: "GET" });
    if (data.authenticated && data.user) {
      applyAuthenticatedUser(data.user, data.stats || {});
    } else {
      clearAuthenticatedUser();
    }
  } catch (_) {
    clearAuthenticatedUser();
  }
}

function switchAuthTab(tab) {
  const map = {
    login: authLoginPanel,
    register: authRegisterPanel,
    recover: authRecoverPanel
  };

  authTabs.forEach((button) => button.classList.toggle("active", button.dataset.authTab === tab));
  Object.entries(map).forEach(([key, panel]) => panel?.classList.toggle("hidden", key !== tab));
  setAccountMessage(authMessage, "");

  if (tab !== "recover") {
    recoveryResetToken = null;
    recoverStepOne?.classList.remove("hidden");
    recoverStepTwo?.classList.add("hidden");
  }
}

function openAuthModal(tab = "login") {
  switchAuthTab(tab);
  authModal?.classList.remove("hidden");
  authModal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeAuthModal() {
  authModal?.classList.add("hidden");
  authModal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setAccountMessage(authMessage, "");
}

function switchProfileTab(tab = "profile") {
  profileTabs.forEach((button) => button.classList.toggle("active", button.dataset.profileTab === tab));
  profileMainPanel?.classList.toggle("hidden", tab !== "profile");
  profileStatsPanel?.classList.toggle("hidden", tab !== "stats");
}

async function refreshStats() {
  if (!currentUser) return;
  try {
    const data = await apiJson("/api/profile/stats", { method: "GET" });
    renderStats(data.stats || {});
  } catch (error) {
    showGlobalToast({ icon: "!", title: "Estatísticas", message: error.message });
  }
}

async function openProfileModal(tab = "profile") {
  if (!currentUser) {
    openAuthModal("login");
    return;
  }

  switchProfileTab(tab);
  if (tab === "stats") await refreshStats();

  profileModal?.classList.remove("hidden");
  profileModal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setAccountMessage(profileMessage, "");
}

function closeProfileModal() {
  profileModal?.classList.add("hidden");
  profileModal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setAccountMessage(profileMessage, "");
}

accountLoginButton?.addEventListener("click", () => openAuthModal("login"));
accountRegisterButton?.addEventListener("click", () => openAuthModal("register"));
authModalClose?.addEventListener("click", closeAuthModal);
authTabs.forEach((button) => button.addEventListener("click", () => switchAuthTab(button.dataset.authTab)));

authModal?.addEventListener("click", (event) => {
  if (event.target === authModal) closeAuthModal();
});

profileModalClose?.addEventListener("click", closeProfileModal);
profileModal?.addEventListener("click", (event) => {
  if (event.target === profileModal) closeProfileModal();
});

accountProfileButton?.addEventListener("click", () => {
  const isHidden = accountDropdown?.classList.toggle("hidden");
  accountProfileButton.setAttribute("aria-expanded", String(!isHidden));
});

accountOpenProfile?.addEventListener("click", () => {
  accountDropdown?.classList.add("hidden");
  openProfileModal("profile");
});

accountOpenStats?.addEventListener("click", () => {
  accountDropdown?.classList.add("hidden");
  openProfileModal("stats");
});

profileTabs.forEach((button) => button.addEventListener("click", async () => {
  const tab = button.dataset.profileTab;
  switchProfileTab(tab);
  if (tab === "stats") await refreshStats();
}));

profileChangeAvatar?.addEventListener("click", () => openAvatarModal("account"));

document.addEventListener("click", (event) => {
  if (!accountUserControls?.contains(event.target)) {
    accountDropdown?.classList.add("hidden");
    accountProfileButton?.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (authModal && !authModal.classList.contains("hidden")) closeAuthModal();
  if (profileModal && !profileModal.classList.contains("hidden")) closeProfileModal();
});

authLoginSubmit?.addEventListener("click", async () => {
  setAccountMessage(authMessage, "");
  try {
    authLoginSubmit.disabled = true;
    const data = await apiJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        nickname: authLoginNickname.value,
        password: authLoginPassword.value
      })
    });

    applyAuthenticatedUser(data.user, data.stats || {});
    closeAuthModal();
    reconnectSocketForAccount();
    showGlobalToast({ icon: "✓", title: "Bem-vindo!", message: `Você entrou como ${data.user.nickname}.` });
    authLoginPassword.value = "";
  } catch (error) {
    setAccountMessage(authMessage, error.message);
  } finally {
    authLoginSubmit.disabled = false;
  }
});

authRegisterSubmit?.addEventListener("click", async () => {
  setAccountMessage(authMessage, "");
  if (authRegisterPassword.value !== authRegisterConfirm.value) {
    setAccountMessage(authMessage, "As senhas não coincidem.");
    return;
  }

  try {
    authRegisterSubmit.disabled = true;
    const data = await apiJson("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        nickname: authRegisterNickname.value,
        birthDate: authRegisterBirth.value,
        password: authRegisterPassword.value
      })
    });

    applyAuthenticatedUser(data.user, {
      totalGames: 0,
      totalWins: 0,
      totalLosses: 0,
      winRate: 0,
      impostor: {},
      whoami: {}
    });
    closeAuthModal();
    reconnectSocketForAccount();
    showGlobalToast({ icon: "✓", title: "Conta criada", message: "Agora escolha seu avatar." });
    openAvatarModal("account");

    authRegisterPassword.value = "";
    authRegisterConfirm.value = "";
  } catch (error) {
    setAccountMessage(authMessage, error.message);
  } finally {
    authRegisterSubmit.disabled = false;
  }
});

authRecoverVerify?.addEventListener("click", async () => {
  setAccountMessage(authMessage, "");
  try {
    authRecoverVerify.disabled = true;
    const data = await apiJson("/api/auth/recovery/verify", {
      method: "POST",
      body: JSON.stringify({
        nickname: authRecoverNickname.value,
        birthDate: authRecoverBirth.value
      })
    });
    recoveryResetToken = data.resetToken;
    recoverStepOne?.classList.add("hidden");
    recoverStepTwo?.classList.remove("hidden");
  } catch (error) {
    setAccountMessage(authMessage, error.message);
  } finally {
    authRecoverVerify.disabled = false;
  }
});

authRecoverReset?.addEventListener("click", async () => {
  setAccountMessage(authMessage, "");
  if (authRecoverPassword.value !== authRecoverConfirm.value) {
    setAccountMessage(authMessage, "As senhas não coincidem.");
    return;
  }

  try {
    authRecoverReset.disabled = true;
    await apiJson("/api/auth/recovery/reset", {
      method: "POST",
      body: JSON.stringify({
        resetToken: recoveryResetToken,
        newPassword: authRecoverPassword.value
      })
    });
    recoveryResetToken = null;
    switchAuthTab("login");
    authLoginNickname.value = authRecoverNickname.value;
    setAccountMessage(authMessage, "Senha alterada. Entre com sua nova senha.", true);
    authRecoverPassword.value = "";
    authRecoverConfirm.value = "";
  } catch (error) {
    setAccountMessage(authMessage, error.message);
  } finally {
    authRecoverReset.disabled = false;
  }
});

profileNicknameForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAccountMessage(profileMessage, "");
  try {
    const data = await apiJson("/api/profile/nickname", {
      method: "PATCH",
      body: JSON.stringify({ nickname: profileNicknameInput.value })
    });
    applyAuthenticatedUser(data.user, currentStats);
    setAccountMessage(profileMessage, "Nickname alterado. Esse será seu próximo login.", true);
  } catch (error) {
    setAccountMessage(profileMessage, error.message);
  }
});

profilePasswordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAccountMessage(profileMessage, "");

  if (profileNewPassword.value !== profileConfirmPassword.value) {
    setAccountMessage(profileMessage, "As novas senhas não coincidem.");
    return;
  }

  try {
    await apiJson("/api/profile/password", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: profileCurrentPassword.value,
        newPassword: profileNewPassword.value
      })
    });
    profileCurrentPassword.value = "";
    profileNewPassword.value = "";
    profileConfirmPassword.value = "";
    setAccountMessage(profileMessage, "Senha alterada com sucesso.", true);
  } catch (error) {
    setAccountMessage(profileMessage, error.message);
  }
});

accountLogoutButton?.addEventListener("click", async () => {
  try {
    await apiJson("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
  } catch (_) {
    // Mesmo que a requisição falhe, voltamos ao modo visitante na interface.
  }

  clearAuthenticatedUser();
  reconnectSocketForAccount();
  showGlobalToast({ icon: "✓", title: "Sessão encerrada", message: "Você voltou ao modo visitante." });
});

loadCurrentAccount();

/* =========================================================
   V19.1 — MOSTRAR / OCULTAR SENHAS
   ========================================================= */

function setupPasswordToggles() {
  const passwordInputs = [...document.querySelectorAll('.account-input[type="password"]')];

  passwordInputs.forEach((input) => {
    if (input.closest('.password-field')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'password-field';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const button = document.createElement('button');
    button.className = 'password-toggle';
    button.type = 'button';
    button.setAttribute('aria-label', 'Mostrar senha');
    button.setAttribute('title', 'Mostrar senha');
    button.innerHTML = '<svg class="site-icon" aria-hidden="true"><use href="#icon-eye-off"></use></svg>';
    wrapper.appendChild(button);

    const iconUse = button.querySelector('use');

    button.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      const nextLabel = showing ? 'Mostrar senha' : 'Ocultar senha';
      button.setAttribute('aria-label', nextLabel);
      button.setAttribute('title', nextLabel);
      iconUse?.setAttribute('href', showing ? '#icon-eye-off' : '#icon-eye');
    });
  });
}

setupPasswordToggles();


/* ==== V20.11: URLs diretas de salas ==== */
function openInitialDeepLink() {
  if (!pendingDeepLink || sessionStorage.getItem(STORAGE_KEYS.roomCode)) return;
  const link = pendingDeepLink;
  pendingDeepLink = null;
  const kind = { "impostor": "impostor", "quem-sou-eu": "whoami", "corrida-do-conhecimento":"trivia" }[link.slug];
  const ui = ROOM_UI[kind];
  if (!ui) return;
  showScreen(ui.home);
  if(kind === "trivia") loadTriviaConfig();
  requestRooms();
  if (!link.code) return;
  ui.input().value = link.code;
  window.history.replaceState({}, "", `/${link.slug}/${link.code}`);
  socket.emit("room-preview", { code: link.code, gameType: ui.gameType }, response => {
    if (!response?.ok) {
      ui.error().textContent = response?.error || "Sala não encontrada.";
      return;
    }
    const privateRoom = Boolean(response.room.isPrivate);
    const note = document.getElementById(`${kind}-direct-notice`);
    if (note) {
      note.classList.remove("hidden");
      note.textContent = privateRoom
        ? `🔒 Sala privada ${link.code}. Informe a senha e entre para ${response.room.started ? "assistir" : "jogar"}.`
        : `🔗 Você abriu a sala ${link.code}. ${response.room.started ? "Entre para assistir até a próxima partida." : "Entre para jogar!"}`;
    }
    if (!privateRoom && ui.name()) ui.join(link.code);
  });
}
if (socket.connected) setTimeout(openInitialDeepLink, 0);
else socket.once("connect", openInitialDeepLink);

/* =============================================================
   V20.20 — Corrida do Conhecimento (torres e categorias por tags)
   Todas as chaves/API remotas ficam do lado do servidor.
   ============================================================= */
const triviaUi = {
  categories: [], selected: new Set(), loaded: false, previousScores: {},
  currentState: null, myAnswered: false, ticker: null, pendingAnswer: false, winnerTimer: null, winnerRound: null
};
const triviaEl = id => document.getElementById(`trivia-${id}`);
function triviaSavePrefs() {
  try { localStorage.setItem('caroninhas_party_settings_v1:trivia', JSON.stringify({
    categories:[...triviaUi.selected],difficulty:triviaEl('difficulty').value,
    durationSeconds:Number(triviaEl('seconds').value),isPrivate:triviaEl('private').checked
  })); } catch(_) {}
}
function triviaRenderTags() {
  const box = triviaEl('category-tags');box.replaceChildren();
  triviaUi.categories.forEach(category=>{
    const on=triviaUi.selected.has(category.id);
    const button=document.createElement('button');button.type='button';button.className=`trivia-tag ${on?'chosen':''}`;
    button.setAttribute('aria-pressed',String(on));
    button.textContent=`${on?'✓':'+'} ${category.name}`;
    button.title=`${category.available} perguntas aprovadas`;button.addEventListener('click',()=>{
      if(on) triviaUi.selected.delete(category.id);else triviaUi.selected.add(category.id);
      triviaRenderTags();triviaSavePrefs();
    });box.appendChild(button);
  });
  const n=triviaUi.selected.size;triviaEl('selected-count').textContent=`${n} de ${triviaUi.categories.length} selecionadas`;
  triviaEl('create-room').disabled=n===0 || !triviaUi.loaded;
}
async function loadTriviaConfig() {
  if(triviaUi.loaded) return;
  const error=triviaEl('home-error');error.textContent='';
  try {
    const response=await fetch('/api/trivia/categories',{cache:'no-store'});
    const json=await response.json();
    if(!response.ok) throw new Error(json.error || 'Falha ao carregar categorias.');
    triviaUi.categories=json.categories || [];
    let settings={};
    try {settings=JSON.parse(localStorage.getItem('caroninhas_party_settings_v1:trivia') || '{}');} catch(_){}
    const names=new Set(triviaUi.categories.map(c=>c.id));
    const desired=Array.isArray(settings.categories) ? settings.categories : json.defaults;
    triviaUi.selected=new Set((desired || []).filter(c=>names.has(c)));
    if(['random','easy','medium','hard'].includes(settings.difficulty)) triviaEl('difficulty').value=settings.difficulty;
    if(Number.isInteger(settings.durationSeconds) && settings.durationSeconds>=0 && settings.durationSeconds<=30)
      triviaEl('seconds').value=settings.durationSeconds;
    triviaEl('private').checked=Boolean(settings.isPrivate);
    triviaEl('private-fields').classList.toggle('hidden',!triviaEl('private').checked);
    triviaUi.loaded=true;triviaRenderTags();
  } catch(err) {
    error.textContent=err.message || 'Ronizada Quest indisponível.';
    triviaEl('selected-count').textContent='API indisponível';
    triviaEl('create-room').disabled=true;
  }
}
triviaEl('select-all').addEventListener('click',()=>{
  triviaUi.selected=new Set(triviaUi.categories.map(c=>c.id));triviaRenderTags();triviaSavePrefs();
});
triviaEl('clear-all').addEventListener('click',()=>{
  triviaUi.selected.clear();triviaRenderTags();triviaSavePrefs();
});
triviaEl('difficulty').addEventListener('change',triviaSavePrefs);
// Controle numérico independente do estilo de <select>, preservando valores 0–30.
function triviaNormalizeSeconds() {
  const input=triviaEl('seconds');
  const number=Number(input.value);
  input.value=Number.isFinite(number)&&input.value.trim()!==''
    ? String(Math.min(30,Math.max(0,Math.round(number)))) : '15';
  triviaSavePrefs();
}
triviaEl('time-minus').addEventListener('click',()=>{
  triviaEl('seconds').value=Math.max(0,Number(triviaEl('seconds').value || 0)-1);
  triviaSavePrefs();
});
triviaEl('time-plus').addEventListener('click',()=>{
  triviaEl('seconds').value=Math.min(30,Number(triviaEl('seconds').value || 0)+1);
  triviaSavePrefs();
});
triviaEl('seconds').addEventListener('change',triviaNormalizeSeconds);
triviaEl('private').addEventListener('change',()=>{
  triviaEl('private-fields').classList.toggle('hidden',!triviaEl('private').checked);
  triviaSavePrefs();
});
function triviaName() {return (currentUser?.nickname || triviaEl('name').value.trim()).slice(0,20);}
function triviaJoin(code) {
  const error=triviaEl('home-error');error.textContent='';
  if(!triviaName()) return error.textContent='Digite seu nome para entrar.';
  socket.emit('join-room',{name:triviaName(),code:String(code||'').toUpperCase(),playerToken,
    avatar:selectedAvatar,gameType:'trivia',roomPassword:triviaEl('join-password').value,
    sessionSecret:roomSessionSecret},response=>{
      if(!response?.ok) return error.textContent=response?.error || 'Erro ao entrar na sala.';
      saveAdmission(response);
      localStorage.setItem(STORAGE_KEYS.playerName,triviaName());
      if(response.spectator) showSpectatorRoom(response.room);
      else { renderTriviaLobby(response.room);if(!response.room.started) showScreen(triviaLobbyScreen); }
    });
}
triviaEl('create-room').addEventListener('click',()=>{
  const error=triviaEl('home-error');error.textContent='';
  const seconds=Number(triviaEl('seconds').value);
  if(!triviaName()) return error.textContent='Digite seu nome.';
  if(!triviaUi.selected.size) return error.textContent='Marque pelo menos uma categoria.';
  if(!Number.isInteger(seconds) || seconds<0 || seconds>30) return error.textContent='Informe um tempo inteiro de 0 a 30.';
  triviaSavePrefs();
  socket.emit('create-trivia-room',{
    name:triviaName(),avatar:selectedAvatar,playerToken,
    categories:[...triviaUi.selected],difficulty:triviaEl('difficulty').value,
    durationSeconds:seconds,isPrivate:triviaEl('private').checked,
    roomPassword:triviaEl('create-password').value
  },response=>{
    if(!response?.ok) return error.textContent=response?.error || 'Não foi possível criar.';
    saveAdmission(response);localStorage.setItem(STORAGE_KEYS.playerName,triviaName());
    renderTriviaLobby(response.room);showScreen(triviaLobbyScreen);
  });
});
triviaEl('join-room').addEventListener('click',()=>triviaJoin(triviaEl('room-code').value));
triviaEl('room-code').addEventListener('input',()=>{
  triviaEl('room-code').value=triviaEl('room-code').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
});
triviaEl('room-code').addEventListener('keydown',e=>{if(e.key==='Enter') triviaJoin(triviaEl('room-code').value);});
triviaEl('refresh-rooms').addEventListener('click',requestRooms);
function renderTriviaRooms(rooms) {
  const box=triviaEl('rooms');if(!box) return;box.replaceChildren();
  const matches=(rooms || []).filter(r=>r.gameType==='trivia');
  if(!matches.length) {box.textContent='Nenhuma corrida aberta. Crie a primeira!';return;}
  matches.forEach(room=>{
    const card=document.createElement('div');card.className='trivia-open-room';
    const info=document.createElement('div');
    const title=document.createElement('strong');title.textContent=`${room.code} · ${room.hostName}`;
    const summary=document.createElement('small');
    summary.textContent=`${room.playersCount} jogador(es) · ${room.triviaSettings?.categories?.length||0} categorias · ${room.started?'Em andamento':'Aguardando'}${room.isPrivate?' · Privada':''}`;
    info.append(title,summary);
    const join=document.createElement('button');join.type='button';join.className='mini-button';
    join.textContent=room.started?'Assistir':'Entrar';join.addEventListener('click',()=>triviaJoin(room.code));
    card.append(info,join);box.append(card);
  });
}
function renderTriviaLobby(room) {
  if(room.gameType!=='trivia') return;
  currentRoom=room;roomCode=room.code;
  sessionStorage.setItem(STORAGE_KEYS.roomCode,roomCode);
  triviaEl('lobby-code').textContent=room.code;
  const setting=room.triviaSettings || {};
  triviaEl('lobby-settings').textContent=`${setting.categories?.length||0} categorias · ${
    ({random:'Aleatória',easy:'Fácil',medium:'Média',hard:'Difícil'})[setting.difficulty] || 'Aleatória'
  } · ${setting.durationSeconds===0?'Sem cronômetro':`${setting.durationSeconds || 15}s por pergunta`}`;
  triviaEl('player-count').textContent=room.players.length;
  triviaEl('ready-count').textContent=`${room.readyCount}/${room.players.length} prontos`;
  const list=triviaEl('players');list.replaceChildren();
  room.players.forEach(p=>{
    const li=document.createElement('li');li.className='trivia-lobby-player';
    const av=document.createElement('img');av.src=getAvatarDefinition(p.avatar).src;av.alt='';
    const name=document.createElement('span');name.textContent=p.name+(p.token===playerToken?' (você)':'');
    const status=document.createElement('strong');status.textContent=(p.token===room.hostToken?'★ HOST · ':'')+(p.ready?'PRONTO':p.connected?'AGUARDANDO':'DESCONECTADO');
    li.append(av,name,status);list.append(li);
  });
  const me=room.players.find(p=>p.token===playerToken);
  triviaEl('ready').textContent=me?.ready?'✓ Pronto (clicar para cancelar)':'✓ Estou pronto';
  const isHost=room.hostToken===playerToken;
  triviaEl('start').classList.toggle('hidden',!isHost || room.started);
  triviaEl('start').disabled=!room.allReady;
  triviaEl('wait-host').classList.toggle('hidden',isHost);
}
triviaEl('ready').addEventListener('click',()=>{
  if(!currentRoom || currentRoom.gameType!=='trivia') return;
  const me=currentRoom.players.find(p=>p.token===playerToken);
  socket.emit('set-ready',{code:roomCode,ready:!me?.ready},res=>{
    if(!res?.ok) triviaEl('lobby-error').textContent=res.error;
  });
});
triviaEl('start').addEventListener('click',()=>{
  triviaEl('lobby-error').textContent='';
  socket.emit('start-trivia-game',{code:roomCode},res=>{
    if(!res?.ok) triviaEl('lobby-error').textContent=res.error;
  });
});
triviaEl('copy-code').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(roomCode || '');triviaEl('copy-code').textContent='Copiado!';}
  catch{triviaEl('copy-code').textContent=roomCode || '----';}
  setTimeout(()=>{triviaEl('copy-code').textContent='Copiar';},1700);
});
function triviaTimeTick() {
  const state=triviaUi.currentState;const q=state?.question;
  const timer=triviaEl('timer');
  if(!q || state.phase!=='question') {timer.textContent='—';return;}
  if(q.durationSeconds===0){timer.textContent='∞';return;}
  const seconds=Math.max(0,Math.ceil((new Date(q.expiresAt).getTime()-Date.now())/1000));
  timer.textContent=`${seconds}s`;timer.classList.toggle('urgent',seconds<=5);
}
function triviaRenderTowers(state) {
  const box=triviaEl('towers');box.replaceChildren();
  const ranked=[...(state.players||[])].sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
  ranked.forEach((p,i)=>{
    const col=document.createElement('div');col.className=`trivia-tower ${!p.connected?'offline':''} ${p.finalista?'finalista':''}`;
    col.style.setProperty('--tower-color',['#5ca9fa','#a68bfa','#54dab0','#f5b95a','#f181b5','#7ed3e3'][[...p.token].reduce((sum,ch)=>sum+ch.charCodeAt(0),0)%6]);
    const avatar=document.createElement('img');avatar.className='trivia-avatar';avatar.src=getAvatarDefinition(p.avatar).src;avatar.alt='';
    const name=document.createElement('strong');name.className='trivia-tower-name';name.textContent=p.name;
    const score=document.createElement('span');score.className='trivia-score';score.textContent=`${p.score}/10`;
    const blocks=document.createElement('div');blocks.className='trivia-tower-blocks';
    for(let level=10;level>=1;level--){
      const block=document.createElement('span');block.className=`trivia-tower-block ${p.score>=level?'filled':''}`;
      block.title=`Nível ${level}`;blocks.append(block);
    }
    if((triviaUi.previousScores[p.token] ?? 0)<p.score) col.classList.add('advanced');
    col.append(avatar,name,score,blocks);box.append(col);
    triviaUi.previousScores[p.token]=p.score;
  });
}
function triviaShowWinner(state) {
  if (!state || state.phase!=='finished' || !state.winnerToken ||
      !currentRoom || currentRoom.gameType!=='trivia' || state.code!==roomCode) return;
  const winner=(state.players||[]).find(player=>player.token===state.winnerToken);
  if (!winner) return;
  const avatar=triviaEl('winner-avatar');
  avatar.src=getAvatarDefinition(winner.avatar).src;
  avatar.alt=`Avatar de ${winner.name}`;
  triviaEl('winner-name').textContent=winner.name;
  triviaEl('winner-rounds').textContent=`${state.roundNumber||0} rodadas disputadas`;
  // A última rodada de desempate pode ter encerrado com somente um finalista.
  triviaEl('winner-tiebreak').classList.toggle('hidden',!state.tiebreak);
  const rankings=triviaEl('final-ranking');
  rankings.replaceChildren();
  const others=(state.players||[]).filter(player=>player.token!==state.winnerToken)
    .sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'pt-BR'));
  [winner,...others].forEach((player,index)=>{
    const entry=document.createElement('li');
    entry.className=`trivia-final-entry ${index===0?'is-champion':''}`;
    const place=document.createElement('span');place.className='trivia-final-place';
    place.textContent=index===0?'🏆':`${index+1}º`;
    const portrait=document.createElement('img');portrait.className='trivia-final-avatar';
    portrait.src=getAvatarDefinition(player.avatar).src;portrait.alt='';
    const name=document.createElement('strong');name.textContent=player.name;
    const score=document.createElement('span');score.className='trivia-final-score';
    score.textContent=`${player.score}/10`;
    entry.append(place,portrait,name,score);
    rankings.append(entry);
  });
  const host=currentRoom.hostToken===playerToken;
  triviaEl('winner-replay').classList.toggle('hidden',!host);
  triviaEl('winner-wait-host').classList.toggle('hidden',host);
  triviaEl('winner-error').textContent='';
  showScreen(triviaWinnerScreen);
}
function triviaScheduleWinner(state) {
  if(state.phase!=='finished'||!state.winnerToken){
    clearTimeout(triviaUi.winnerTimer);triviaUi.winnerTimer=null;
    triviaUi.winnerRound=null;return;
  }
  // Não reiniciar a transição quando chegam eventos de atualização/reconexão.
  const key=`${state.code}:${state.roundNumber}:${state.winnerToken}`;
  if(triviaUi.winnerRound===key) return;
  clearTimeout(triviaUi.winnerTimer);triviaUi.winnerRound=key;
  triviaUi.winnerTimer=setTimeout(()=>{
    triviaUi.winnerTimer=null;
    if(triviaUi.winnerRound===key && triviaUi.currentState?.phase==='finished' &&
       triviaUi.currentState.code===state.code &&
       (triviaGameScreen===document.querySelector('.screen:not(.hidden)') ||
        triviaWinnerScreen===document.querySelector('.screen:not(.hidden)')))
      triviaShowWinner(triviaUi.currentState);
  },1700);
}
function triviaRenderState(state) {
  if(!state || state.code!==roomCode || currentRoom?.gameType!=='trivia') return;
  const old=triviaUi.currentState;
  if(old?.question?.roundId!==state.question?.roundId){triviaUi.myAnswered=false;triviaUi.pendingAnswer=false;}
  triviaUi.currentState=state;
  if(triviaGameScreen.classList.contains('hidden') && !(state.phase==='finished' && !triviaWinnerScreen.classList.contains('hidden'))) showScreen(triviaGameScreen);
  triviaEl('round').textContent=`Rodada ${state.roundNumber || 1}${state.tiebreak?' · DESEMPATE':''}`;
  triviaEl('answer-count').textContent=`${state.answerCount || 0}/${state.eligibleCount || 0} respostas`;
  triviaRenderTowers(state);
  triviaEl('return-lobby').classList.toggle('hidden',state.phase!=='finished'||currentRoom?.hostToken!==playerToken);
  const q=state.question;
  triviaEl('question-text').textContent=q?.question || (state.phase==='loading'?'Sorteando pergunta...':'Preparando partida...');
  triviaEl('question-category').textContent=q?.category || 'Corrida até 10';
  triviaEl('question-difficulty').textContent=({easy:'Fácil',medium:'Média',hard:'Difícil'})[q?.difficulty] || '';
  const box=triviaEl('answers');box.replaceChildren();
  const isEligible=state.players?.some(p=>p.token===playerToken && (!state.tiebreak || p.finalista));
  if(q?.options && ['question','resolving','results','finished'].includes(state.phase)){
    q.options.forEach(option=>{
      const button=document.createElement('button');button.type='button';button.className='trivia-answer';
      const label=document.createElement('b');label.textContent=option.id;
      const text=document.createElement('span');text.textContent=option.text;
      button.append(label,text);
      if(state.result){
        if(option.id===state.result.correctOptionId) button.classList.add('correct');
      }
      button.disabled=state.phase!=='question' || triviaUi.myAnswered || triviaUi.pendingAnswer || !isEligible;
      button.addEventListener('click',()=>{
        if(triviaUi.pendingAnswer || triviaUi.myAnswered) return;
        triviaUi.pendingAnswer=true;
        triviaRenderState(triviaUi.currentState);
        socket.emit('trivia-answer',{code:roomCode,roundId:q.roundId,optionId:option.id},response=>{
          if(triviaUi.currentState?.question?.roundId!==q.roundId) return;
          triviaUi.pendingAnswer=false;
          if(response?.ok) triviaUi.myAnswered=true;
          else triviaEl('game-error').textContent=response?.error || 'Não foi possível responder.';
          triviaRenderState(triviaUi.currentState);
        });
      });box.append(button);
    });
  }
  const result=triviaEl('result');result.textContent='';
  if(state.result){
    const own=state.result.answers?.find(a=>a.token===playerToken);
    if(state.phase==='finished') {
      const winner=state.players?.find(p=>p.token===state.winnerToken);
      result.textContent=`🏆 ${winner?.name || 'Jogador'} venceu a Corrida do Conhecimento!`;
    } else if(own) result.textContent=own.correct?'✓ Você acertou! +1 na corrida.':'Você não avançou nesta rodada.';
    else result.textContent='Rodada encerrada. Próxima pergunta em 4 segundos.';
  }
  triviaEl('progress-message').textContent=state.phase==='question'
    ? !isEligible?'Acompanhe o desempate dos finalistas.':triviaUi.myAnswered?'Resposta confirmada! Aguardando os outros...':'Selecione uma alternativa; você só pode responder uma vez.'
    : state.phase==='results'?'Próxima pergunta automaticamente em 4 segundos...'
    : state.phase==='finished'?'Partida encerrada. O anfitrião pode criar outra sala para jogar novamente.'
    : state.phase==='error'?'Ocorreu um erro na rodada. Saia da sala e tente outra partida.':'Aguarde...';
  clearInterval(triviaUi.ticker);triviaTimeTick();
  if(state.phase==='question') triviaUi.ticker=setInterval(triviaTimeTick,200);
  triviaScheduleWinner(state);
}
socket.on('trivia-state',state=>triviaRenderState(state));
socket.on('trivia-my-state',({answered,roundId})=>{
  if(triviaUi.currentState?.question?.roundId!==roundId) return;
  triviaUi.myAnswered=Boolean(answered);triviaRenderState(triviaUi.currentState);
});
socket.on('trivia-error',({error})=>{if(currentRoom?.gameType==='trivia') triviaEl('game-error').textContent=error;});
triviaEl('name').value=localStorage.getItem(STORAGE_KEYS.playerName) || '';
updateAvatarPreview();

triviaEl('winner-replay').addEventListener('click',()=>{
  triviaEl('winner-error').textContent='';
  triviaEl('winner-replay').disabled=true;
  socket.emit('restart-trivia-game',{code:roomCode},response=>{
    triviaEl('winner-replay').disabled=false;
    if(!response?.ok) triviaEl('winner-error').textContent=response?.error || 'Falha ao reabrir a sala.';
  });
});
triviaEl('return-lobby').addEventListener('click',()=>{
  socket.emit('restart-trivia-game',{code:roomCode},response=>{
    if(!response?.ok) triviaEl('game-error').textContent=response?.error || 'Falha ao reabrir a sala.';
  });
});
socket.on('trivia-back-to-lobby',()=>{
  if(currentRoom?.gameType!=='trivia') return;
  clearInterval(triviaUi.ticker);clearTimeout(triviaUi.winnerTimer);triviaUi.winnerTimer=null;triviaUi.winnerRound=null;
  triviaUi.currentState=null;triviaUi.previousScores={};triviaUi.myAnswered=false;
  triviaEl('game-error').textContent='';
  showScreen(triviaLobbyScreen);
});
