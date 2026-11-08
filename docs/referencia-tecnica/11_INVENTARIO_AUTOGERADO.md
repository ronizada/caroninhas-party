# 11 — INVENTÁRIO GERADO DIRETAMENTE DOS ARQUIVOS-FONTE

> Gerado a partir dos ZIPs específicos da V20.20.4 e da API V1.3; lista de itens observados no código, sem anexar credenciais nem dados pessoais. Códigos-fonte e linhas podem mudar em outros builds.

## 1. Hash SHA-256 dos arquivos essenciais

| Serviço | Arquivo | SHA-256 | Linhas |
|---|---|---|---:|
| Portal | `server.js` | `e5b234327ff51422551d7e12f27e6e11786548cebbb62e91d116b4fabae854dc` | 3109 |
| Portal | `trivia-race.js` | `c26bce42c86f50a65d9c73a17c564828e75978af6c5bbaa85dfd3b3e6a90e93f` | 294 |
| Portal | `auth.js` | `5eae2acc6be3ef92626ca62ab6fc2552e1f537c3674da5326a43c94427904d01` | 771 |
| Portal | `db.js` | `ae497d100428f2b9b310217054bdcba0babb33a62ca7f8620de5234c8c07b638` | 46 |
| Portal | `whoami-images.js` | `5aa4e5fc75f4a526082f676544a5ac3636f04ea189597bbb883786ad55a841f1` | 378 |
| Portal | `public/index.html` | `9c3af5383a2227749617f51cd9bbf5842553c7d7f912818408a6b6af318eb689` | 1651 |
| Portal | `public/script.js` | `dc91bd922b42be4149e3ec3d02f00ac9905edb2f3c9701436d86e3f644a9033b` | 5060 |
| Portal | `public/style.css` | `c70b7f0069205572f19d18d81289e915e072145b7722feb08f7e8492713ded9b` | 6182 |
| Portal | `database/schema.sql` | `6202b3818c7d90b6a4215b2d5dbfb1622cfe44a67717db68e94d881584c7f057` | 173 |
| Portal | `database/seed.sql` | `b81bb2b80d3b166f3efdf0ac7a3088687f946fe82380eb0dc65284960442aa5e` | 654 |
| Portal | `package.json` | `a95a7e4398f75d30403f46198ac0326a3a4ae60a39901a9e793bc9814f332c89` | 20 |
| Portal | `discloud.config` | `164023f0dec29faab5291601ec5dea2a8f5b83d33cd1f96e284ca90192a17524` | 11 |
| Trivia API | `src/app.js` | `b36ca6b0772250689855769503e70e26d677ece7d0d11b169644524e3a811b17` | 229 |
| Trivia API | `src/server.js` | `dbfd6a565203d553f87c11c62f1647732387e08eeed925c7379f82b2a292b9c0` | 50 |
| Trivia API | `src/bootstrap.js` | `b1d5ee8a959da2f6160b55682ea10b8aebd9e3b4bd743cb61b6ba35d721ecb0f` | 56 |
| Trivia API | `src/db.js` | `69b19dd1fac7b23df9df426a9042fe41db28144bbcb8a914ceff72605f666337` | 21 |
| Trivia API | `src/rounds.js` | `724acceb87ab247f217ace3c4a0a35560eed24ac21b8bc4dfa35f6a319952c89` | 19 |
| Trivia API | `src/normalize.js` | `1ac1f348514320742217024995a7ffb9a7c20425bd2bd9b6812cd451c996a60d` | 80 |
| Trivia API | `src/validation.js` | `bbdb4cd39a7245368fdda6e9651f753a20488dd3e0b73b6d1129e95878690229` | 29 |
| Trivia API | `sql/001_init.sql` | `9dfc44832a6277d9a04eecc7fe55de6f216de41e22838032978f3ec5a715172d` | 55 |
| Trivia API | `package.json` | `1e60fb22602b27092aedaead4fe9064f3654ebb783b287d53c30733a771ae221` | 26 |
| Trivia API | `discloud.config` | `b0f84d4bd7806123ac107c41aa2b4c0d7b75a7f804393d6265f6e236475b6429` | 11 |

## 2. Roteamento REST detectado por expressões `app.get/post/patch/put`

### Portal: server.js

- Linha 32: `app.get(/^\/(impostor|quem-sou-eu|corrida-do-conhecimento)(?:\/[A-Z0-9]{4})?\/?$/i,`
- Linha 37: `app.get(/^\/quiz-e-caos(?:\/[A-Z0-9]{4})?\/?$/i, (req, res) => res.redirect(302, "/"));`
- Linha 1573: `app.get("/api/game-config", async (req, res) => {`
- Linha 1608: `app.get("/api/whoami-config", async (req, res) => {`
- Linha 1645: `app.get("/api/whoami-image", async (req, res) => {`
- Linha 1683: `app.get("/api/rooms", (req, res) => {`

### Portal: auth.js

- Linha 335: `app.get("/api/auth/me", async (req, res) => {`
- Linha 349: `app.post("/api/auth/register", async (req, res) => {`
- Linha 380: `app.post("/api/auth/login", async (req, res) => {`
- Linha 411: `app.post("/api/auth/logout", async (req, res) => {`
- Linha 422: `app.post("/api/auth/recovery/verify", async (req, res) => {`
- Linha 460: `app.post("/api/auth/recovery/reset", async (req, res) => {`
- Linha 487: `app.patch("/api/profile/nickname", async (req, res) => {`
- Linha 515: `app.patch("/api/profile/password", async (req, res) => {`
- Linha 540: `app.patch("/api/profile/avatar", async (req, res) => {`
- Linha 568: `app.post("/api/profile/photo", async (req, res) => {`
- Linha 604: `app.get("/api/profile/image/:id", async (req, res) => {`
- Linha 646: `app.get("/api/game-preferences/:gameType", async (req, res) => {`
- Linha 662: `app.put("/api/game-preferences/:gameType", async (req, res) => {`
- Linha 683: `app.get("/api/profile/stats", async (req, res) => {`

### Portal: trivia-race.js

- Linha 65: `app.get('/api/trivia/categories', async (req,res) => {`

### Trivia: src/app.js

- Linha 25: `app.get('/', (req, res) => res.json({ service:'Caroninhas Trivia API', status:'online', version:'1.3.0', docs:'Consulte o README do pacote; acesso à API requer chave privada.' }));`
- Linha 27: `app.get('/health', async (req, res, next) => {`
- Linha 32: `app.get('/api/v1/stats', service, async (req, res) => {`
- Linha 39: `app.get('/api/v1/categories', service, async (req, res) => {`
- Linha 46: `app.post('/api/v1/rounds', service, async (req, res) => {`
- Linha 93: `app.get('/api/v1/rounds/:id', service, async (req, res) => {`
- Linha 115: `app.post('/api/v1/rounds/:id/answers', service, async (req, res) => {`
- Linha 153: `app.post('/api/v1/rounds/:id/finish', service, async (req, res) => {`
- Linha 180: `app.get('/api/v1/admin/questions', admin, async (req, res) => {`
- Linha 192: `app.patch('/api/v1/admin/questions/:id/status', admin, async (req, res) => {`

## 3. Eventos Socket.IO recebidos e emitidos (ocorrências detectadas)

### server.js

- L200: `io.emit("rooms-list", roomsList());`
- L207: `io.to(code).emit("room-updated", publicRoom(room));`
- L248: `io.to(spectatorChannel(room.code)).emit("spectator-state", buildSpectatorState(room));`
- L523: `io.to(room.code).emit("impostor-vote-finished", buildImpostorFinishedPayload(room));`
- L557: `io.to(room.code).emit("impostor-vote-started", buildImpostorVotePayload(room));`
- L572: `io.to(room.code).emit("impostor-vote-progress", {`
- L609: `io.to(room.code).emit("impostor-tiebreak-started", {`
- L753: `io.to(room.code).emit("host-transferred", {`
- L1090: `io.to(player.socketId).emit(eventName, {`
- L1146: `io.to(room.code).emit("whoami-guess-announced", event);`
- L1147: `io.to(spectatorChannel(room.code)).emit("whoami-guess-announced", event);`
- L1159: `io.to(room.code).emit("whoami-game-finished", buildWhoAmIFinishedPayload(room));`
- L1313: `io.to(room.code).emit("whoami-status-updated", {`
- L1335: `io.to(player.socketId).emit(`
- L1405: `io.to(player.socketId).emit(`
- L1425: `io.to(player.socketId).emit(`
- L1446: `io.to(player.socketId).emit("game-started", {`
- L1452: `io.to(player.socketId).emit("game-started", {`
- L1460: `io.to(player.socketId).emit("impostor-vote-started", {`
- L1471: `io.to(player.socketId).emit("impostor-tiebreak-started", {`
- L1479: `io.to(player.socketId).emit(`
- L1540: `io.to(spectatorChannel(room.code)).emit("room-closed", {`
- L1544: `io.to(room.code).emit("room-closed", {`
- L1695: `io.on("connection", (socket) => {`
- L1701: `socket.on("resume-session", (`
- L1743: `socket.on("abandon-session", (`
- L1767: `socket.on("room-preview", ({ code, gameType }, callback) => {`
- L1775: `socket.on("spectator-get-state", ({ code }, callback) => {`
- L1781: `socket.on("get-rooms", (callback) => {`
- L1790: `socket.on("create-room", async (`
- L1885: `socket.on("create-whoami-room", async (`
- L1981: `socket.on("join-room", async (`
- L2146: `socket.on("set-ready", (`
- L2193: `socket.on("start-game", async (`
- L2316: `socket.on("start-impostor-vote", (`
- L2359: `socket.on("cast-impostor-vote", (`
- L2425: `socket.on("start-whoami-game", async (`
- L2562: `socket.on("whoami-review-vote", async (`
- L2671: `io.to(room.code).emit(`
- L2697: `socket.on("whoami-reveal-self", (`
- L2764: `socket.on("whoami-guess", (`
- L2833: `io.to(room.code).emit("whoami-game-finished", buildWhoAmIFinishedPayload(room));`
- L2887: `socket.on("new-whoami-round", (`
- L2927: `io.to(roomCode).emit("whoami-back-to-lobby");`
- L2933: `socket.on("new-round", (`
- L2973: `io.to(roomCode).emit("back-to-lobby");`
- L2979: `socket.on("close-room", (`
- L3014: `socket.on("leave-room", (callback) => {`
- L3022: `socket.on("disconnect", () => {`

### trivia-race.js

- L100: `io.to(room.code).emit('trivia-state',neutral);`
- L101: `room.players.forEach(p=>{ if(p.socketId) io.to(p.socketId).emit('trivia-my-state',{answered:Boolean(state.answers[p.token]),roundId:state.question?.roundId}); }`
- L156: `io.to(room.code).emit('trivia-error',{error:state.error});broadcast(room);`
- L188: `io.to(room.code).emit('trivia-error',{error:state.error});broadcast(room);`
- L209: `io.to(player.socketId).emit('trivia-state',payload);`
- L212: `socket.on('create-trivia-room', async (request={},callback=()=>{}) => {`
- L236: `socket.on('start-trivia-game',async ({code}={},callback=()=>{}) => {`
- L250: `socket.on('restart-trivia-game',({code}={},callback=()=>{})=>{`
- L259: `io.to(room.code).emit('trivia-back-to-lobby');updateRoom(room.code);`
- L262: `socket.on('trivia-answer',async ({code,roundId,optionId}={},callback=()=>{}) => {`

## 4. Todas as seções de tela de `index.html`

| Linha | ID |
|---:|---|
| 99 | `menu-screen` |
| 175 | `impostor-home-screen` |
| 340 | `lobby-screen` |
| 428 | `game-screen` |
| 522 | `impostor-vote-screen` |
| 560 | `impostor-result-screen` |
| 629 | `whoami-home-screen` |
| 803 | `whoami-lobby-screen` |
| 896 | `whoami-review-screen` |
| 973 | `whoami-game-screen` |
| 1111 | `whoami-winner-screen` |
| 1179 | `trivia-home-screen` |
| 1228 | `trivia-lobby-screen` |
| 1236 | `trivia-game-screen` |
| 1250 | `trivia-winner-screen` |
| 1554 | `spectator-screen` |

## 5. Categorias no dataset de origem da Trivia (não refletindo liberação em banco)

O JSONL fonte contém 5.247 registros. Os status e quantidades desta seção representam o **arquivo de importação**, não o banco depois da aprovação em lote: a importação tem status de revisão próprios e a base viva pode divergir.

| Categoria canônica (`category_pt`) | Quantidade no JSONL |
|---|---:|
| Animais | 98 |
| Anime e mangá | 203 |
| Arte | 58 |
| Celebridades | 52 |
| Cinema | 300 |
| Ciência e natureza | 296 |
| Computação | 189 |
| Conhecimentos gerais | 465 |
| Desenhos e animações | 108 |
| Esportes | 175 |
| Geografia | 381 |
| História | 410 |
| Jogos de tabuleiro | 78 |
| Livros e literatura | 119 |
| Matemática | 77 |
| Mitologia | 70 |
| Musicais e teatro | 36 |
| Música | 488 |
| Política | 74 |
| Quadrinhos | 78 |
| Séries e televisão | 195 |
| Tecnologia e gadgets | 39 |
| Veículos | 86 |
| Videogames | 1172 |

Total de categorias: **24**; registros: **5247**. Status no arquivo fonte: `blocked`=106, `pending`=5046, `rejected`=95.

## 6. Avatares preset e mídias de interface

- `public/avatars/bear.png`
- `public/avatars/cat.png`
- `public/avatars/dog.png`
- `public/avatars/fox.png`
- `public/avatars/frog.png`
- `public/avatars/owl.png`
- `public/avatars/panda.png`
- `public/avatars/penguin.png`
- `public/avatars/pig.png`
- `public/avatars/tiger.png`
- `public/caroninhas-party-banner.png` (social preview do site).

## 7. Inventário de testes

### Portal
- `tests/impostor-vote.test.js`
- `tests/trivia-final-screen.test.js`
- `tests/trivia-race.test.js`
- `tests/trivia-visual-refinement.test.js`
- `tests/whoami-all-finish.test.js`
- `tests/whoami-expansion.test.js`
- `tests/whoami-handlers.test.js`
- `tests/whoami-igdb-token.test.js`
- `tests/whoami-image-improvements.test.js`
- `tests/whoami-images.test.js`

### Trivia
- `tests/bootstrap.test.js`
- `tests/normalize.test.js`
- `tests/rounds-v13.test.js`

## 8. CSS: tokens globais declarados no início do arquivo

```css
:root {
  --bg: #ead7e2;
  --grid: rgba(116, 84, 92, 0.10);

  --cream: #f7f1df;
  --cream-2: #fff9e9;
  --cream-3: #eadfbe;

  --ink: #2e2524;
  --muted: #786a65;
  --line: #2f2927;

  --pink: #f3a6b9;
  --pink-deep: #df7f9a;
  --orange: #ef9c63;
  --lime: #d8e87e;
  --yellow: #f2d36f;
  --mint: #91c9b6;

  --shadow: #2e2524;
  --soft-shadow: rgba(46, 37, 36, 0.15);
}
```

## 9. Arquivos do projeto portal (sem datasets binários e segredos)

```text
.discloudignore
.env.example
CORRECOES_V20_20_2.txt
LEIA-ME_AJUSTE_CREDITOS.md
LEIA-ME_CORRECAO_20_20_2.md
LEIA-ME_V20_12.md
LEIA-ME_V20_13.md
LEIA-ME_V20_14.md
LEIA-ME_V20_14_1.md
LEIA-ME_V20_15.md
LEIA-ME_V20_16_EXPANSAO.md
LEIA-ME_V20_17_IMAGENS.md
LEIA-ME_V20_18_BUSCADOR.md
LEIA-ME_V20_19_TOKEN_E_CREDITOS.md
LEIA-ME_V20_20_3_CAMPEAO_TEMPO.md
LEIA-ME_V20_20_4_REFINAMENTO_VISUAL.md
LEIA-ME_V20_20_CORRIDA.md
auth.js
database/data/quiz_questions.jsonl
database/migrations/001_v19_accounts.sql
database/migrations/002_quiz_caos.sql
database/migrations/003_quiz_pawns.sql
database/migrations/004_game_preferences.sql
database/migrations/005_whoami_expansion_1008.sql
database/schema.sql
database/seed.sql
db.js
discloud.config
package-lock.json
package.json
public/avatars/bear.png
public/avatars/cat.png
public/avatars/dog.png
public/avatars/fox.png
public/avatars/frog.png
public/avatars/owl.png
public/avatars/panda.png
public/avatars/penguin.png
public/avatars/pig.png
public/avatars/tiger.png
public/index.html
public/script.js
public/style.css
scripts/bootstrap-db.js
scripts/init-db.js
scripts/load-quiz-questions.js
scripts/run-migrations.js
scripts/whoami-image-report.js
server.js
tests/impostor-vote.test.js
tests/trivia-final-screen.test.js
tests/trivia-race.test.js
tests/trivia-visual-refinement.test.js
tests/whoami-all-finish.test.js
tests/whoami-expansion.test.js
tests/whoami-handlers.test.js
tests/whoami-igdb-token.test.js
tests/whoami-image-improvements.test.js
tests/whoami-images.test.js
trivia-race.js
whoami-images.js
```

## 10. Arquivos da API (sem questões individuais e segredos)

```text
.discloudignore
.env.example
.gitignore
CONFIGURAR_BANCO.md
INTEGRACAO_CARONINHAS_V20_20.md
README.md
TESTAR_V1_3.md
discloud.config
index.js
package.json
scripts/bootstrap.js
scripts/import.js
scripts/migrate.js
sql/000_PREPARAR_SCHEMA_E_USUARIO.sql
sql/001_init.sql
src/app.js
src/bootstrap.js
src/config.js
src/db.js
src/importer.js
src/normalize.js
src/rounds.js
src/server.js
src/validation.js
tests/bootstrap.test.js
tests/normalize.test.js
tests/rounds-v13.test.js
```

## 11. Notas de rastreabilidade

- O inventário é um **índice técnico**; para comportamento exato, abrir o trecho correspondente no código fonte referenciado.
- Nomes de rotas em `RegExp` não são simples literais de string; a seção 2 mostra a expressão de montagem.
- Os valores de secrets não aparecem aqui. Os hashes representam apenas arquivos não confidenciais da cópia de referência.
- Não publicar dump de banco ou fotos de perfil junto com o documento.
