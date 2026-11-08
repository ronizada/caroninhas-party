# 03 — CONTRATOS DE INTEGRAÇÃO: REST + SOCKET.IO

## 1. Convenções

O frontend chama **REST** com `fetch()` para perfil, configuração e catálogo; utiliza **Socket.IO** para salas e jogos. O servidor usa callbacks de confirmação (`ack`) em ações mutáveis. Identificadores `gameType`: `impostor`, `whoami`, `trivia`. Código de sala: **4 caracteres**, alfabeto servidor `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem caracteres visualmente confusos). URLs de entrada: `/impostor/ABCD`, `/quem-sou-eu/ABCD`, `/corrida-do-conhecimento/ABCD` quando código é conhecido.

O portal envia `room-updated` para membros da sala e `rooms-list` para todos quando muda o estado. Clientes nunca escolhem quem é o impostor, qual resposta está correta, o placar ou quem venceu.

## 2. Rotas HTTP do portal

| Método | Rota | Responsabilidade / formato | Autenticação |
|---|---|---|---|
| GET | `/` e `/impostor[/ABCD]`, `/quem-sou-eu[/ABCD]`, `/corrida-do-conhecimento[/ABCD]` | entrega `public/index.html` como shell único | pública |
| GET | `/quiz-e-caos[/ABCD]` | 302 para `/`, modalidade removida | pública |
| GET | `/api/game-config` | categorias/dificuldades de palavras do Impostor | pública |
| GET | `/api/whoami-config` | categorias/dificuldades de personagens | pública |
| GET | `/api/whoami-image` | descoberta de imagem com parâmetros do personagem/categoria | pública; sujeito às credenciais servidor/provedores |
| GET | `/api/rooms` | `{rooms:[...]}` | pública |
| GET | `/api/trivia/categories` | proxy da Ronizada Quest; `{categories:[{id,name,available}],defaults:[...],difficulties:[...],durationSeconds:15}` | pública, **chave só backend** |
| GET | `/api/auth/me` | sessão atual, perfil e estatísticas | cookie opcional |
| POST | `/api/auth/register` | criar conta com nickname/senha/data nascimento | pública |
| POST | `/api/auth/login` | entrar e emitir cookie HttpOnly | pública |
| POST | `/api/auth/logout` | sair e invalidar sessão | sessão opcional |
| POST | `/api/auth/recovery/verify` | nickname + data nascimento → token temporário | pública com limite de tentativas |
| POST | `/api/auth/recovery/reset` | token válido + senha nova | token temporário |
| PATCH | `/api/profile/nickname` | renomear conta | cookie |
| PATCH | `/api/profile/password` | alterar senha | cookie + senha atual |
| PATCH | `/api/profile/avatar` | escolher avatar nativo | cookie |
| POST | `/api/profile/photo` | foto personalizada (bytes conforme handler) | cookie |
| GET | `/api/profile/image/:id` | servir foto cadastrada com MIME correto | público, imagem ligada a perfil |
| GET | `/api/game-preferences/:gameType` | preferências da modalidade | cookie |
| PUT | `/api/game-preferences/:gameType` | salvar preferências da modalidade | cookie |
| GET | `/api/profile/stats` | resumo da conta | cookie |

**Erro comum de réplica:** não publicar `/api/v1/rounds` diretamente no portal; essa API pertence ao serviço `ronizada-quest` e deve ser chamada de servidor para servidor. Outra falha comum é copiar a chave `TRIVIA_API_KEY` para `public/script.js`: **proibido**.

### Contratos de conta (formas principais)

```json
// POST /api/auth/register
{"nickname":"Jogador123","password":"[SENHA]","birthDate":"2000-04-12"}
// POST /api/auth/login
{"nickname":"Jogador123","password":"[SENHA]"}
// GET /api/auth/me (quando logado)
{"authenticated":true,"user":{"id":123,"nickname":"Jogador123","avatarKey":"dog","avatarType":"preset","avatarId":"dog","avatarUrl":"/avatars/dog.png"},"stats":{"totalGames":0,"totalWins":0}}
```

O exemplo contém **campos representativos**, não uma captura completa obrigatória de resposta; use `auth.js` para o payload exato e tratamentos de erros.

## 3. Formato público de sala (`publicRoom`)

```json
{
  "code":"ABCD", "gameType":"trivia", "hostToken":"[token-local]",
  "isPrivate":false, "spectatorCount":0,
  "hostName":"Roni", "hostAvatar":"dog",
  "players":[{"token":"[token-local]","id":"[socket-id]","name":"Roni","avatar":"dog","registered":false,"ready":true,"connected":true,"eliminated":false}],
  "playersCount":1,"connectedCount":1,"readyCount":1,"allReady":false,
  "started":false,"roundPhase":null,"createdAt":0,
  "category":{},"difficulty":{},"allFinish":false,
  "triviaSettings":{"categories":["História"],"difficulty":"random","durationSeconds":15}
}
```

Não confiar cegamente em `hostToken` recebido do navegador: toda ação privilegiada valida token efetivamente anexado a `socket.data.playerToken`, código de sala e papel da conexão.

## 4. Socket.IO — comandos do cliente para servidor

| Evento | Payload de entrada (mínimo/mais comum) | Papel e restrições | Ack / efeito |
|---|---|---|---|
| `get-rooms` | callback | qualquer conexão | lista de salas |
| `room-preview` | `{code,gameType}` | qualquer | prévia/visibilidade |
| `resume-session` | `{playerToken,roomCode,sessionSecret}` | jogador pré-admitido | reata vínculo, segredo verificado |
| `abandon-session` | sessão existente | vínculo prévio | limpa vínculo |
| `create-room` | `{name,avatar,playerToken,category,difficulty,...}` | visitante/conta | cria sala Impostor |
| `create-whoami-room` | `{name,avatar,playerToken,category,difficulty,allFinish,...}` | visitante/conta | cria sala Quem Sou Eu? |
| `create-trivia-room` | `{name,avatar,playerToken,categories,difficulty,durationSeconds,isPrivate,roomPassword}` | visitante/conta | cria sala Corrida |
| `join-room` | `{name,code,playerToken,avatar,gameType,roomPassword,sessionSecret}` | qualquer | ingressa como jogador ou espectador conforme estado |
| `set-ready` | `{code,ready}` | membro da sala | atualiza presença |
| `start-game` | `{code}` | host Impostor | sorteia palavra e papel |
| `start-impostor-vote` | `{code}` | host Impostor | inicia votação |
| `cast-impostor-vote` | `{code,targetToken}` | jogador votante | um voto; não pode em si mesmo |
| `start-whoami-game` | `{code}` | host Quem Sou Eu? | sorteia personagens, fase de revisão |
| `whoami-review-vote` | `{code,targetToken,vote:'approve'|'reroll'}` | outro jogador | voto de revisão; sem autoavaliação |
| `whoami-reveal-self` | `{code}` | próprio jogador | desistência; revela quando pertinente |
| `whoami-guess` | `{code,guess}` | próprio jogador | classifica correto, próximo, errado |
| `new-whoami-round` | `{code}` | host, regras do modo | volta ao lobby/nova rodada |
| `new-round` | `{code}` | host Impostor | reinicia ciclo |
| `start-trivia-game` | `{code}` | host Corrida | exige 2+ conectados e todos prontos |
| `trivia-answer` | `{code,roundId,optionId}` | jogador elegível | API grava resposta; **não aceita score nem playerId** |
| `restart-trivia-game` | `{code}` | host após vitória | reseta prontidão e retorna ao lobby |
| `spectator-get-state` | `{code}` | espectador | estado sanitizado |
| `close-room` | `{code}` | host | encerra sala |
| `leave-room` | callback | participante | sai da sala |

**Contrato de erro predominante:** `callback({ok:false,error:"..."})`; êxito `callback({ok:true,...})`. Nem todo evento usa o mesmo objeto de retorno: consulte os handlers para o formato exato.

## 5. Socket.IO — mensagens servidor para cliente

| Evento | Quando | Payload / preocupação |
|---|---|---|
| `rooms-list` | ingresso e atualização | lista filtrável por `gameType` |
| `room-updated` | ready, membros, lobby etc. | sala pública |
| `host-transferred` | transferência de controle | identidade novo anfitrião |
| `room-closed` | fim administrativo | razão e gameType |
| `game-started` | Impostor | **payload personalizado por jogador**: a palavra não vaza ao impostor |
| `impostor-vote-started`, `impostor-vote-progress`, `impostor-tiebreak-started`, `impostor-player-eliminated`, `impostor-vote-finished` | votação/eliminação | status, candidatos, vencedores; nunca antes da fase correta |
| `whoami-review-started`, `whoami-review-updated`, `whoami-character-rerolled`, `whoami-review-complete` | conferência dos personagens | cuidado para não revelar próprio personagem antecipadamente |
| `whoami-game-started`, `whoami-guess-announced`, `whoami-status-updated`, `whoami-game-finished`, `whoami-back-to-lobby` | partida de personagens | resumos, tentativas, fim |
| `trivia-state` | toda mudança na corrida | fase, pergunta **sem gabarito antes do resultado**, scores e estado geral |
| `trivia-my-state` | resposta do participante | `{answered,roundId}` específico, em socket pessoal |
| `trivia-error`, `trivia-back-to-lobby` | falha/revanche | erro ou retorno |
| `spectator-state`, `spectator-promoted` | assistência e retorno | estado público e promoção para jogar |
| `back-to-lobby` | nova rodada Impostor | reabre sala |

## 6. Reconexão e segurança da admissão

O cliente armazena `playerToken`, `roomCode` e `sessionSecret` em **`sessionStorage`**. Na reconexão, chama `resume-session`. O portal mantém prazo de desconexão `RECONNECT_GRACE_MS = 30000` ms antes da remoção definitiva; há lógica de transferência de anfitrião/remoção de desconectado. A identidade de conta vem de cookie de sessão validado no backend e **tem precedência** sobre nome/avatar enviados pelo cliente.

`join-room` verifica senha de sala privada com hash `scrypt`; existe limite de **8 tentativas por IP em 60 segundos** para essa verificação, de acordo com o handler de referência. A separação entre `playerToken` e sessão autenticada é essencial: não usar o token do navegador como prova de propriedade de uma conta.

## 7. Corrida — estado Socket.IO (`trivia-state`)

```json
{
  "code":"ABCD","phase":"question","roundNumber":3,"tiebreak":false,
  "players":[{"token":"P1","name":"Roni","avatar":"dog","connected":true,"score":2,"finalista":false}],
  "question":{"roundId":"[UUID]","question":"Pergunta PT-BR", "options":[{"id":"A","text":"Alternativa"}],"category":"História","difficulty":"easy","startedAt":"[ISO]","expiresAt":"[ISO]","durationSeconds":15},
  "answerCount":0,"eligibleCount":2,"result":null,"winnerToken":null
}
```

Fases observáveis: `starting`, `loading`, `question`, `resolving`, `results`, `finished`, `error`. Resultado público só quando a Trivia API tiver finalizado. `trivia-my-state` é usado para restaurar o bloqueio do botão ao reconectar.

## 8. Erros que outra IA precisa evitar

1. Misturar `Socket.IO` e WebSocket puro sem adaptar protocolo/acks/salas.
2. Trocar `playerToken` por `socket.id`; `socket.id` muda ao reconectar.
3. Mostrar gabarito para todos antes do fim da pergunta.
4. Aceitar posição da torre, `winnerToken` ou pontuação vinda do cliente.
5. Alterar os nomes dos eventos sem migrar cliente e servidor juntos.
6. Não transferir/encerrar sala após desconexões e abandono de host.
7. Reiniciar sem redirecionar clientes e perder estados sem tratamento de erro.

**Localização do contrato exato:** `server.js` (handlers e eventos), `trivia-race.js` (eventos Corrida), `public/script.js` (emissores e listeners) e `auth.js` (REST).
