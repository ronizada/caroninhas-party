# Caroninhas Party V20.20 — Corrida do Conhecimento (BETA DE TESTES)

Este pacote foi gerado a partir do backup **RESTAURAR_CARONINHAS_PARTY_V20_19_DISCLOUD.zip**, sem alterar os arquivos da aplicação já publicada.

## O que foi implementado

- Terceiro jogo no menu, **Corrida do Conhecimento**, sem remover Impostor nem Quem Sou Eu?.
- Criação de sala com tags clicáveis e **24 categorias** carregadas em tempo real da Ronizada Quest API V1.3; as 12 categorias combinadas com o usuário vêm selecionadas por padrão (quando disponíveis).
- Mapeamento fiel de nomes: Ciências -> `Ciência e natureza`; Séries e TV -> `Séries e televisão`; Livros -> `Livros e literatura`. Nunca filtrar pelo rótulo simplificado.
- Dificuldades Aleatória, Fácil, Média e Difícil; tempo 15 segundos padrão ou personalizável de **0 a 30**, com **0 sem cronômetro**.
- Tela de lobby, criação e entrada por código, salas privadas, confirmação de presença e anfitrião.
- Todos recebem a MESMA pergunta, com alternativas e `expiresAt` vindo da API.
- Uma resposta irrevogável por jogador; chave da API somente no backend; o cliente não envia `playerId`, pontuação nem gabarito.
- Resultado automático quando todos os jogadores conectados participantes respondem, ou após o prazo. Correção usa SOMENTE as respostas persistidas na Ronizada Quest V1.3.
- 10 segmentos verticais por jogador (acerto +1, erro 0), resultado por 4 segundos, sorteio automático da próxima pergunta, desempate por perguntas extras quando vários alcançam 10 juntos.
- Vitória, possibilidade de o anfitrião voltar ao lobby para outra corrida, reconexão e modo espectador simples.
- Sem migração nova na base principal, sem alterar as tabelas `public` e sem modificações no código da Ronizada Quest.

## ATENÇÃO: TESTE EM APP SEPARADO, NÃO SOBRESCREVA A V20.19

- `discloud.config` possui `ID=caroninhas-party-v2020-test` e `HOSTNAME=caroninhas-v2020-test`. Esta identificação é proposital: **não atualizar o aplicativo original `caroninhas-party` nesta primeira etapa**.
- O pacote **NÃO** inclui arquivo `.env` nem segredos reais. Crie `.env` com base em `.env.example` para o ambiente de teste.
- Para manter dados e estatísticas da produção intactos, aponte a `.env` para **outro banco PostgreSQL de teste**. O servidor legado executa migrações e sincronização de acervo ao iniciar; não confie apenas em `AUTO_INIT_DB=false` para isolamento.
- Se o banco de teste estiver vazio, prepare-o conforme os scripts de inicialização do Caroninhas Party antes de usar o modo multiplayer.
- É necessária a chave de **serviço** `TRIVIA_API_KEY` da `ronizada-quest`. Use a mesma chave de serviço já configurada para o aplicativo Trivia, não `TRIVIA_ADMIN_KEY`. `TRIVIA_API_URL` deve apontar para a V1.3 online.
- Exige uma versão de Node.js com `fetch`/`AbortSignal.timeout` nativos (Node 18 ou superior).
- A Ronizada Quest V1.3 continua no app `ronizada-quest`; este pacote não a substitui.

## Testes locais efetuados neste pacote

- `node --check` nos arquivos JavaScript modificados.
- `npm test`: **53 testes passaram**, incluindo testes de regressão do Impostor, Quem Sou Eu? e um teste simulado de criação/correção de rodada da Corrida do Conhecimento.
- Visualização e interação com tags verificadas no navegador Chromium, em 1280x900 e 390x844. Visual do jogo com quatro torres e pergunta simulado no navegador.

**Ainda NÃO foi realizado teste ponta a ponta usando a base PostgreSQL de teste e dois navegadores reais conectados à API hospedada.** Esse é o próximo passo antes de pensar em publicar a V20.20 no lugar da V20.19.

## Sequência recomendada de validação

1. Faça backup da V20.19 e confirme a disponibilidade da Ronizada Quest V1.3.
2. Crie uma **aplicação de teste** e um banco/teste isolado; configure `.env` sem expor nenhuma senha em prints.
3. Acesse `/api/trivia/categories` da **aplicação de teste**. A resposta deve conter categorias com `available > 0`.
4. Entre com dois navegadores: o host cria sala, escolhe tags/dificuldade/15s, ambos marcam pronto e host inicia.
5. Verifique que apenas assuntos selecionados aparecem e ambos veem as mesmas alternativas.
6. Verifique acerto, erro, resposta duplicada, tempo expirado, avanço de torre e 4 segundos de intervalo.
7. Verifique o modo 0 segundos, desconexões, desempate quando ambos alcançam 10 e retorno ao lobby.
8. Só após esses testes considere gerar uma variante deliberada com `ID=caroninhas-party` para produção.

## Arquivos alterados ou adicionados

- `server.js`: pontos de integração Socket.IO, lobby, reconexão, roteamento e sanitização de sala.
- `trivia-race.js`: módulo novo de servidor, filtros, rodadas, timing, pontuação, desempate e vitória.
- `public/index.html`, `public/script.js`, `public/style.css`: três novas telas e torres, com estilos isolados.
- `tests/trivia-race.test.js`: testes de filtros e comunicação simulada.
- `tests/whoami-igdb-token.test.js`: atualização da verificação de versão `20.19` para `20.20`.
- `package.json`, `package-lock.json`: atualização de versão.
- `discloud.config`: **ID/hostname de teste**, nunca da aplicação original.

## Limitações conhecidas da beta

- Estado das salas do Caroninhas Party permanece em memória, assim como nos outros jogos; reiniciar o processo encerra salas ativas.
- Se a API externa cair enquanto encerra a rodada, a partida exibe um erro e não altera a pontuação local. É preferível parar à pontuar incorretamente.
- O sorteio evita repetir perguntas usando um `roomId` novo por partida na Ronizada Quest. Se um filtro ficar sem perguntas, ele procura outras combinações selecionadas, mantendo a dificuldade fixa quando ela não é aleatória.
