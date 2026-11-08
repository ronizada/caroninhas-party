# Ronizada Quest — Caroninhas Trivia API V1.3

**Aplicação separada** da `caroninhas-party`. Usa o banco PostgreSQL existente, mas **apenas o schema `trivia`**, com o usuário restrito `caroninhas_trivia_api` já criado na V1.2.

## O que muda em relação à V1.2

- Cada rodada inicia com `durationSeconds` entre **0 e 30** (padrão 15; `0` significa sem cronômetro).
- `POST /api/v1/rounds/:id/answers` registra **uma única resposta por jogador**, antes do prazo segundo o relógio do PostgreSQL. O servidor responde `201` com confirmação, `409` para duplicata/rodada encerrada e `410` para resposta atrasada.
- `POST /api/v1/rounds/:id/finish` **não aceita mais** `answers` no JSON. Corrige somente respostas já registradas tempestivamente. O resultado inclui gabarito e acertos de quem respondeu; ausentes não pontuam.
- `GET /api/v1/rounds/:id` devolve dados públicos da questão e os tempos, **sem gabarito**.
- A inicialização aplica uma migração **aditiva**: cria `trivia.round_answers` se ainda não existir. Não apaga perguntas ou rodadas, não altera `public` e, com `AUTO_IMPORT=if_empty`, não reimporta as 5.247 questões existentes.

## Rotas

| Método | Caminho | Autorização | Uso |
|---|---|---|---|
| GET | `/health` | nenhuma | Disponibilidade e banco |
| GET | `/api/v1/stats` | `x-api-key` | Total de perguntas e status |
| GET | `/api/v1/categories` | `x-api-key` | Categorias e disponibilidade |
| POST | `/api/v1/rounds` | `x-api-key` | Criar rodada |
| GET | `/api/v1/rounds/:id` | `x-api-key` | Recuperar pergunta e prazo |
| POST | `/api/v1/rounds/:id/answers` | `x-api-key` | Submeter resposta individual |
| POST | `/api/v1/rounds/:id/finish` | `x-api-key` | Finalizar e corrigir |
| GET | `/api/v1/admin/questions` | `x-admin-key` | Administração |
| PATCH | `/api/v1/admin/questions/:id/status` | `x-admin-key` | Revisão |

**As chaves devem permanecer SOMENTE nos backends.** Nunca exponha `x-api-key` ou `x-admin-key` no JavaScript do navegador. O backend do Caroninhas Party deve autenticar jogadores/salas antes de chamar essas rotas.

## Exemplo de uso: uma pergunta para vários jogadores

```http
POST /api/v1/rounds
x-api-key: <chave_servidor>
Content-Type: application/json

{"roomId":"sala-teste-001","durationSeconds":15}
```

A resposta `201` traz `roundId`, `options`, `startedAt` e `expiresAt`, **sem** `correctOptionId`.

```http
POST /api/v1/rounds/<roundId>/answers
x-api-key: <chave_servidor>
Content-Type: application/json

{"playerId":"jogador-1","optionId":"B"}
```

Repetir a mesma resposta retorna `409`. Enviar depois do prazo retorna `410`.

```http
POST /api/v1/rounds/<roundId>/finish
x-api-key: <chave_servidor>
Content-Type: application/json

{}
```

A resposta traz `correctOptionId` e `results` apenas para os jogadores que responderam dentro do prazo. Resposta enviada diretamente ao `/finish` causa `400`, sem mudar o estado da rodada. O servidor do jogo considera quem não está em `results` como **não respondeu / não avança**.

**Observação:** o prazo bloqueia novas respostas no banco; o fechamento explícito é chamado pelo backend do jogo quando o tempo acabar ou todos tiverem respondido. Isso evita que o backend espere por um temporizador em memória da API e permite que a proteção de tempo resista a reinícios.

## Publicação na Discloud — apenas ronizada-quest

1. Faça um backup do PostgreSQL e guarde o ZIP funcional da V1.2.
2. O `discloud.config` **já tem** `ID=ronizada-quest`. Atualize **somente essa aplicação**, nunca `caroninhas-party`.
3. **Este ZIP não contém `.env` nem senhas.** Copie para a raiz deste pacote, em seu computador, a **mesma `.env` funcional da V1.2**, preservando as chaves e a senha existentes. Sem ela, o deploy não funcionará. Não publique a `.env` em GitHub.
4. Confirme que a VLAN continua ligada no painel da aplicação `ronizada-quest`.
5. Faça upload do ZIP com os arquivos da API e sua `.env` em sua conta; a aplicação aplicará a migração `CREATE TABLE IF NOT EXISTS trivia.round_answers` automaticamente na inicialização.
6. Confira os logs e `https://ronizada-quest.discloud.dev/health` — versão esperada `1.3.0`.
7. Teste uma rodada nova e o endpoint `/answers`; os comandos da seção `TESTAR_V1_3.md` ajudam.

Não execute novamente o SQL de criação de usuário da V1.2: ele já foi executado no seu PostgreSQL. Não inclua dados da Trivia no ZIP do Caroninhas Party.

## Testes

`npm install` e `npm test`. Os 18 testes locais incluem simulação das rotas, não um PostgreSQL real. **A confirmação na Discloud depende de um deploy e teste reais**.

## Fonte e licença das perguntas

Perguntas derivadas do Open Trivia Database (OpenTDB), CC BY-SA 4.0, com atribuição preservada na API. As 5.247 perguntas existentes e seus estados são preservados; o upgrade não revisa os gabaritos.
