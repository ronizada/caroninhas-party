# 10 — PLAYBOOK DE RECONSTRUÇÃO PARA OUTRA INTELIGÊNCIA ARTIFICIAL

## 1. Missão

**Objetivo:** reconstruir um portal web quase idêntico ao **Caroninhas Party V20.20.4** em estética, navegação, regras, API, banco e comportamento multiplayer, usando o conjunto de documentos, capturas de referência e, quando autorizado, os dois ZIPs-fonte do projeto. **Não** criar um conceito inspirado no Caroninhas; implementar a mesma solução.

### Prompt-mestre pronto para copiar

> Você é uma equipe sênior de frontend, backend Node.js, PostgreSQL, WebSocket, QA e design de interfaces. Sua tarefa é REPRODUZIR o Caroninhas Party conforme os arquivos `00` a `11` desta pasta. Priorize equivalência exata de UX, comportamento e arquitetura. O frontend deve usar HTML5, CSS3 e JavaScript puro, Express/Socket.IO/pg no backend e a API Ronizada Quest separada para perguntas. A interface deve seguir a paleta rosa/creme, grade de 42px, barras retrô, Chakra Petch + Nunito, bordas de 3px e sombras duras. Preserve os três jogos Impostor, Quem Sou Eu? e Corrida do Conhecimento. Reutilize identidade, contas, avatares, salas, lobbies, pronto, host, senha, espectador, reconexão e telas de resultado em todas as modalidades. Represente a Corrida com 24 tags filtráveis, dificuldade random/easy/medium/hard, relógio 0..30, torres 0..10, respostas temporizadas pela API, desempate extra e tela de campeão. Não invente APIs, bibliotecas, telas, coleções ou estados; marque explicitamente qualquer dado não fornecido. Nunca coloque chaves ou credenciais no frontend. Use banco de TESTE, valide os contratos e escreva testes equivalentes antes do deploy. Entregue código modular, esquema de banco, scripts, testes e evidências visuais. Ao concluir, liste divergências conhecidas e requisitos não verificados.

## 2. Não começar por CSS isolado

Uma boa reconstrução precisa de:

1. **Banco e domínio**: esquema `public`, `trivia`, entidades, credenciais isoladas e bootstrap não destrutivo.
2. **API de perguntas**: rest V1.3 e invariantes de tempo/gabarito/duplicata.
3. **Servidor de salas**: estados, token e segredo de reconexão, host, ready, espectadores, eventos por jogo.
4. **Frontend estrutural**: uma SPA com `screen` e `showScreen`, rotas deep link, perfil, modais e conexão Socket.IO.
5. **Visual**: somente após estrutura pronta, aplicar tokens e cascata de CSS comparando imagens.
6. **Validação**: testar duas conexões reais, fluxo de vitória e rollback.

A ordem reduz risco de criar uma “imagem bonita” sem jogo funcionando, ou refazer game state depois de fazer componentes.

## 3. Matriz de fidelidade

| Item | Fidelidade obrigatória | Tolerância permitida |
|---|---|---|
| Lógica das rodadas, voto, tentativas, ponto e desempate | funcionalmente exata | nenhuma alteração voluntária |
| REST/Socket.IO: nomes de eventos, payloads de uso, autorização | exata | somente adaptação explicitada |
| Dados e perguntas | depende de acervo real | placeholders apenas em homologação, identificados |
| Shell visual, cores, tipografia e janela | próxima do pixel | diferenças de renderização de fontes por OS |
| Avatares preset | mesmos arquivos/ordem | nenhuma troca sem autorização |
| Fotos de conta | mesma origem (PostgreSQL) e endpoint | conteúdo pessoal não acompanha entrega |
| Provêdores externos | mesma hierarquia/categoria/fallback | URLs e respostas são dinâmicas |
| Persistência de sala | efêmera como referência | melhoria estrutural só numa versão nova e aprovada |
| Responsividade | respeitar telas 390/1366/1536 e zoom | scroll interno controlado quando necessário |
| Metadados de social preview | OG/Twitter presentes | mídia do banner exato exige asset original |

## 4. Contratos de aceitação da réplica

### Comum

- Biblioteca e três cards; navegação sem refresh entre estados.
- Registro/login por nickname; perfil e estatísticas, avatar default/preset/upload.
- Salas de 4 caracteres, pública/privada, senha com hash, host, ready, join por código, listagem e espectadores.
- Reconexão por `playerToken+roomCode+sessionSecret` dentro de 30s de tolerância.

### Impostor

- Mínimo 3, papel secreto exclusivo, palavra/dica, discussão/ordem, voto não duplicável, empate/revotação, eliminação e lado vencedor.

### Quem Sou Eu?

- Mínimo 2, múltiplos personagens, revisão coletiva, aprovação/reroll, limite 3 erros, quase acerto sem tentativa, allFinish opcional, imagens e fallbacks.

### Corrida

- 24 tags disponíveis quando API retorna, 12 defaults canônicos e aliases corretos.
- Dificuldade aleatória/fixa, 0..30 segundos, privacidade, 2+ jogadores, perguntas idênticas por rodada e seleção imutável.
- Relógio validado no PostgreSQL da Trivia, 1 ponto por acerto, sem pontos para atrasado/ausente, limite 10, desempate só finalistas.
- Transição automática de 4s e tela de campeão com ranking e botão de revanche apenas ao host.

### Visual

- Rosa quadriculado `#ead7e2`, linhas 42px; janela creme `#f7f1df`; bordas `#2f2927`; barra rosa `#f3a6b9`; sombra dura 8/9px; título `.exe`, três dots.
- Chakra Petch (substituto de Pixelify na V20.20.4) e Nunito; legibilidade de números.
- Campos código/senha + botão Entrar da Corrida com 52px, no mesmo alinhamento.
- Sem faixas verticais rosas decorativas em select/checkbox.
- Mesma identificação de nome/avatar em todas as modalidades.

## 5. Arquivos prioritários para leitura por agentes

```text
1. public/index.html       (rotas de tela, shell, campos, SVG, conteúdo)
2. public/style.css        (valores CSS e regras media da versão)
3. public/script.js        (estados e interação real)
4. server.js               (salas, Socket.IO, Impostor, Quem Sou Eu?)
5. trivia-race.js          (corrida, API e desempate)
6. auth.js                 (conta, cookies, perfil, stats)
7. whoami-images.js        (buscador de imagens)
8. database/schema.sql + database/migrations/* + seed.sql
9. Ronizada Quest src/app.js + src/server.js + sql/001_init.sql
10. tests/ de ambos os projetos
```

Se o agente não receber os ZIPs-fonte, pedir os **arquivos que faltam** e reconstruir as partes especificadas, mas sinalizar aproximação inevitável. **Nenhum documento textual garante reprodução pixel perfeita de 6.000 linhas de CSS nem o acervo completo de milhares de registros sem os assets reais.**

## 6. Processo de implementação por sprints (sugestão, não estado atual)

| Fase | Entregáveis | Condição de avanço |
|---|---|---|
| 0 | Inventário + branch/cópia isolada | testes antigos preservados |
| 1 | DB + scripts + serviço de autenticação | cadastro/login/avatares OK |
| 2 | serviço de salas/socket/reconexão | duas abas e host/ready OK |
| 3 | Impostor | votação/empates/regressão OK |
| 4 | Quem Sou Eu? | revisão, palpites, imagens/allFinish OK |
| 5 | Trivia API | 201/409/410/finish + SQL OK |
| 6 | Corrida | filtros/tempo/torres/campeão OK |
| 7 | CSS + social + responsive | screenshots e UI idênticos |
| 8 | Hardening e deploy de teste | plano de rollback, smoke real |

## 7. Prompts para revisão especializados

### Backend
> Compare cada `socket.on` e a transição de fase do código reconstruído com `server.js`, `trivia-race.js` e `03_CONTRATOS_HTTP_E_SOCKET_IO.md`. Liste divergências linha a linha. Procure vazamentos de gabarito e de personagem oculto; rejeite mudanças de fase sem autorização de host.

### Frontend
> Compare o DOM de todas as 16 telas, nomes de IDs/classes, modais, armazenamento de token e callbacks com `index.html` e `script.js`. Verifique que mudanças da Corrida não alteram visual/funcionalidade do Impostor e Quem Sou Eu?.

### Design
> Renderize 1366×768, 1536×864 e 390×844 nas mesmas condições das referências. Compare grid, cores CSS, fonte Chakra Petch/Nunito, janelas e ações. Meça sobreposição, clipping, scroll e legibilidade do tempo.

### Segurança
> Procure segredos em bundle/browser/log e SQL sem parâmetros. Teste sala privada e troca de host, cookie HttpOnly, acesso por token de outro jogador, expiração em banco. Não confunda `playerToken` com sessão de conta.

## 8. Alterações proibidas sem autorização específica

- Sobrescrever `caroninhas-party` com ZIP de `ronizada-quest` ou `caroninhas-party-v2020-test`.
- Alterar/remover schema `public` para instalar trivia.
- Trocar visual retrô pastel por dark mode, blue SaaS ou glassmorphism.
- Redefinir o modo de vitória ou as pontuações.
- Tirar login/perfil/avatares/Quem Sou Eu?/Impostor por considerá-los “não essenciais à demo”.
- Transferir chave admin da Trivia ou `DATABASE_URL` para browser.
- Inventar que estatísticas de Corrida estão persistidas em `match_history` sem implementação.

## 9. Entrega requerida do agente construtor

Código-fonte completo; `README` com instruções por ambiente; `package-lock`; migrations/scripts; `.env.example` sem segredo; testes unitários e E2E quando possível; relatório de acessibilidade parcial; screenshots por viewport; tabela de paridade de regras; listagem do que foi aproximado; ZIP de homologação com ID de teste; guia seguro para promoção a produção.
