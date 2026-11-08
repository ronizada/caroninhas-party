# 05 — FRONTEND, NAVEGAÇÃO, DOM, MODAIS, ESTADOS E RESPONSIVIDADE

## 1. Modelo de frontend: SPA sem framework

`public/index.html` contém **todas as telas pré-renderizadas como seções**; apenas uma tela aparece por vez. `public/script.js` é carregado globalmente e gerencia eventos e fluxo através de funções, objetos de estado e seletores DOM; a função `showScreen(screen)` oculta todos os elementos de `allScreens`, remove classes antigas `screen-mode-*` de `<body>` e adiciona a classe da tela atual (ex.: `screen-mode-trivia-game-screen`). CSS usa essas classes para centralização, limites de viewport e variações de cada modalidade. O frontend não é React nem usa roteador de biblioteca; links `/impostor/ABCD`, etc. são processados por regex e `pendingDeepLink` em `script.js`, enquanto o Express entrega `index.html`.

Existe `MutationObserver` que normaliza o início de textos visíveis com letra maiúscula (excluindo, por exemplo, `.window-title`). Uma reconstrução que altere esta lógica pode mudar a capitalização de títulos e microcopy.

## 2. Inventário das telas principais

| ID HTML | Modalidade | Missão |
|---|---|---|
| `menu-screen` | comum | Biblioteca de minijogos, cards, informações de conta/estado |
| `impostor-home-screen` | Impostor | Criar/entrar, selecionar categoria e dificuldade, privacidade |
| `lobby-screen` | Impostor | Código, lista, ready, host |
| `game-screen` | Impostor | Palavra/papel/ordem de fala |
| `impostor-vote-screen` | Impostor | votação e candidatos |
| `impostor-result-screen` | Impostor | eliminação/vencedor por lado |
| `whoami-home-screen` | Quem Sou Eu? | Criar/entrar, filtros, regras, privacidade |
| `whoami-lobby-screen` | Quem Sou Eu? | Lobby e confirmação |
| `whoami-review-screen` | Quem Sou Eu? | Revisão colaborativa e reroll |
| `whoami-game-screen` | Quem Sou Eu? | Cards/nomes/imagens de outros; palpites, status e tentativas |
| `whoami-winner-screen` | Quem Sou Eu? | Resultado e classificação, considerando allFinish |
| `trivia-home-screen` | Corrida | Tags, dificuldade, tempo, privacidade, salas abertas e entrada |
| `trivia-lobby-screen` | Corrida | Código, players, prontidão, início pelo host |
| `trivia-game-screen` | Corrida | Pergunta + respostas na esquerda; torres na direita; timer |
| `trivia-winner-screen` | Corrida | Campeão, foto/avatar, ranking, estatísticas e revanche |
| `spectator-screen` | comum | Status de espectador da sala e progresso observável |

**Não confundir tela com URL:** telas internas mudam via classe `.hidden`, mesmo sem alterar `location.pathname`.

## 3. Estado de identidade do cliente

`script.js` define `AVATARS` (10 PNGs), `STORAGE_KEYS`, `playerToken` e funções de conta/perfil. Há três possibilidades: (a) visitante com nome e avatar local, (b) conta autenticada com nickname/avatar preset, (c) conta com foto enviada ao banco e servida pelo endpoint de perfil. `syncGameIdentityUI` e funções de preview/modal tornam a identificação **consistente entre os três jogos**. O navegador não pode fazer o backend aceitar nickname falso quando a sessão está autenticada; `resolvePlayerIdentity()` substitui o pedido pela conta verdadeira.

### `sessionStorage` e `localStorage`

| Chave | Storage | Uso |
|---|---|---|
| `caroninhas_player_token` | session | identidade de participação entre reconnects na aba |
| `caroninhas_room_session_secret` | session | segredo para retomar entrada |
| `caroninhas_room_code` | session | código atual |
| `caroninhas_player_name` | local/session conforme função | apelido preferido do visitante |
| `caroninhas_player_avatar` | local/session conforme função | avatar preferido |
| chave de preferências da Corrida em `caroninhas_party_settings_v1:trivia` | local | tags, dificuldade, segundos e privacidade quando aplicável |

Consultar `public/script.js` para a distribuição exata entre storages: armazenamento não é autenticação de conta.

## 4. Componentes reutilizáveis de interface

| Componente / classe | Estrutura esperada | Semântica |
|---|---|---|
| `.retro-window` | caixa com `.window-bar` + conteúdo | moldura desktop, raio e sombra dura |
| `.window-bar` | `.window-dots` + `.window-title` + `.window-actions` | barra rosa, pontos coloridos e ícones decorativos |
| `.retro-button` + `.primary`/`.secondary` | `<button>` | CTA, variação de cores, sombra e borda |
| `.mini-button` | `<button>` | ações secundárias (copiar, limpar, atualizar) |
| `.retro-input-wrap` | container contendo `<input>` e ícone opcional | caixas de texto, identidade, código e senha |
| `.retro-select` | `<select>` | dificuldade/categoria; seta integrada sem faixa rosa extra |
| `.retro-check-option` | checkbox e texto | seleção de privacidade e preferências |
| `.guest-identity-card`, `.guest-avatar-preview`, `.guest-name-row` | nome/avatar do jogador | **mesmo padrão em todas as modalidades** |
| `.nav-back` | botão | retorno sem navegação quebrada |
| `.tiny-label` | microtítulo | kicker retrô, geralmente maiúsculo e espaçado |
| `.players-panel`, `.ready-summary`, `.waiting-box` | blocos do lobby | participantes, confirmação, aguardo |
| `.error`, `.toast-message` | texto de status | erro e confirmação acessível |
| `.screen.hidden` | seção invisível | transição de tela |
| `.open-rooms-section` | lista + cabeçalho e refresh | descoberta de salas |

### Modal de avatar

Não recriar um seletor próprio para cada jogo. O mesmo modal lista avatares preset e exibe prévia; avatar personalizado para usuário autenticado é parte do perfil. Dependendo da origem do valor, `getAvatarDefinition()` converte chave `profile:<id>:<versão>` em `/api/profile/image/<id>?v=...` ou busca `/avatars/<animal>.png`.

## 5. Página de criação da Corrida

Estrutura real de `index.html`:

```text
#trivia-home-screen
  .game-page-shell
    .nav-back
    .retro-window.trivia-window
      .window-bar
      .trivia-home-main
        .trivia-intro  (JOGO 03 / título / subtítulo)
        .guest-identity-card (nome e avatar)
        .trivia-config  (grid de duas áreas)
          .trivia-main-settings
            .trivia-categories-card  (título, texto, 24 tags, selecionar/limpar)
            .trivia-join-section  (código, senha, botão entrar)
          .trivia-side-settings
            .trivia-create-settings  (dificuldade, tempo -/+; sala privada; CTA)
            .trivia-open-rooms    (lista de salas e atualizar)
```

O formulário **não** deve criar uma janela escura dentro do portal: os elementos herdam tokens globais. O painel de tags é grupo de botões com `aria-pressed`; nome e avatar aparecem no mesmo componente usado no Impostor/Quem Sou Eu?. O tempo tem botões `trivia-time-minus` e `trivia-time-plus` e um número sempre legível, de 0 a 30.

### Tags e preferências

`loadTriviaConfig()` busca `/api/trivia/categories`, converte `defaults` para seleção inicial quando o navegador não tem preferências, mantém lista canônica de ids, salva em localStorage e desabilita criar sala com zero tags ou API indisponível. `displayCategory` substitui somente os rótulos amigáveis; o servidor usa IDs canônicos no filtro SQL.

## 6. Lobby e corrida em andamento

- Lobby: `.lobby-content`, `.room-code-panel`, `.players-panel`, pronto, iniciar (somente host), configurações selecionadas, lista de jogadores com fotos. O botão do host depende de `allReady`.
- Partida: `.trivia-play-header` com título `Rodada N` e `.trivia-timer`; `.trivia-play-grid` com dois painéis: `.trivia-question-panel` e `.trivia-towers-panel`.
- Painel pergunta: categoria, dificuldade, enunciado, alternativas clicáveis, revelação do gabarito e feedback de acerto/erro; desabilitar após envio.
- Torres: 10 segmentos por jogador empilhados de cima para baixo, mas **preenchimento visual de baixo para cima** (`for level = 10 ... 1`). Avatar e nome em cima; score `N/10`; classes `.advanced`, `.offline`, `.finalista`; cor individual via `--tower-color`.
- Celular: jogo muda para uma coluna, com **torres acima da pergunta**, blocos mais baixos, possível rolagem horizontal **somente no painel das torres**, e alternativas podem virar coluna única em larguras pequenas.

## 7. Tela de campeão

`#trivia-winner-screen` é uma janela própria, semelhante à apresentação de vencedor de Quem Sou Eu?. Inclui: `.trivia-winner-heading`, `.trivia-winner-hero` com avatar grande e coroa, `.trivia-winner-details`, `.trivia-winner-stats`, `.trivia-ranking-panel` com classificação final, `.trivia-winner-actions` para revanche (host) e volta à biblioteca. A transição sai de `trivia-game-screen` quando o estado `finished` é recebido, após cerca de 1,7 s, preservando feedback do último acerto.

## 8. Telas de Impostor / Quem Sou Eu? — o que replicar

- Preservar cabeçalho e moldura, campos de categoria/dificuldade, nome/avatar, sala pública/privada, código/entrar e listas.
- Impostor: cartões secretos e avisos de impostor, votação em telas dedicadas e placar/fim.
- Quem Sou Eu?: cards de personagens, imagética e fallbacks, revisão coletiva, modais de imagem e preview flutuante; avisos em fila, palpites e classificação de todos.
- O site tem área de conta: login/cadastro, recuperação, perfil, troca de nickname/senha/avatar/foto e estatísticas. Uma réplica só das três telas de jogo **não é réplica completa**.

## 9. Acessibilidade e experiência real

Há `aria-label`, `aria-live`, `aria-pressed` e botões nativos em elementos específicos; replicar ao menos os existentes. Melhorias desejáveis não confirmadas no código: auditoria WCAG 2.2, testes completos por teclado/leitor de tela, políticas CSP e redução de movimento ampla. Marcar como trabalho futuro, não como recurso já presente.

## 10. Fluxo de telas ao implementar nova modalidade

Reutilize o padrão completo: inclusão em `renderGames` (card da biblioteca), DOM específico em `index.html`, registro em `allScreens`, entradas de `showScreen`, deep link, eventos de lobby, identidade sincronizada, lista de salas, privacidade/ready/host, reconexão e saída, telas de resultado. Não adicionar JS que force um tema/cor local de forma global. Não remover as três modalidades existentes.
