# 07 — RONIZADA QUEST V1.3 — SERVIÇO DE PERGUNTAS, PRAZOS E SORTEIO

## 1. Função e limites

**Ronizada Quest / Caroninhas Trivia API** é um **segundo aplicativo Express independente**. Ela mantém questões, aprovadores, categorias, rodadas, gabaritos privados e respostas registradas no tempo. **Não** é o frontend da Corrida; **não** gerencia lobbies, avatares, host, prontos nem torres. O portal Caroninhas Party é o orquestrador multiplayer que consome a API com `x-api-key` a partir do backend.

A API expõe `/health` para verificação e `/api/v1/*` para operações de serviço. A versão estudada é **1.3.0**.

## 2. Contratos REST exatos de alto nível

| Método | Rota | Header obrigatório | Retorno/semântica |
|---|---|---|---|
| GET | `/` | nenhum | service, online, version |
| GET | `/health` | nenhum | 200 quando banco OK, 503 quando indisponível |
| GET | `/api/v1/stats` | `x-api-key` | `{total,by_status}` |
| GET | `/api/v1/categories` | `x-api-key` | `{categories:[{name,total,available}]}` |
| POST | `/api/v1/rounds` | `x-api-key` | 201 + pergunta/opções sem resposta correta |
| GET | `/api/v1/rounds/:id` | `x-api-key` | pergunta recuperável, `expiresAt`, `expired`, `finished`, sem gabarito |
| POST | `/api/v1/rounds/:id/answers` | `x-api-key` | 201 resposta pontual; 409 duplicada/encerrada; 410 atrasada |
| POST | `/api/v1/rounds/:id/finish` | `x-api-key` | 200 gabarito + resultado das respostas previamente registradas |
| GET | `/api/v1/admin/questions` | `x-admin-key` | consulta de questões para revisão |
| PATCH | `/api/v1/admin/questions/:id/status` | `x-admin-key` | alteração do status de revisão |

A chave de serviço (`TRIVIA_API_KEY`) e a administrativa (`TRIVIA_ADMIN_KEY`) devem ser **distintas**. `src/app.js` valida com `secureMatch` e middleware do Express; resposta típica a chave ausente/inválida: `401`.

## 3. Criar rodada

```http
POST /api/v1/rounds
x-api-key: <SECRET_DO_SERVIDOR>
Content-Type: application/json

{"roomId":"caroninhas-uuid-exemplo","category":"Videogames","difficulty":"medium","durationSeconds":15}
```

Resposta representativa:

```json
{
 "roundId":"00000000-0000-4000-8000-000000000000",
 "questionId":"[id-opentdb]",
 "question":"Em que jogo... ?",
 "category":"Videogames","difficulty":"medium","type":"multiple",
 "options":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],
 "durationSeconds":15,"startedAt":"2026-10-24T12:00:00Z","expiresAt":"2026-10-24T12:00:15Z",
 "attribution":"OpenTDB"
}
```

O exemplo é esquemático (não uma pergunta real). `roomId` precisa corresponder a `[a-zA-Z0-9_:.-]{1,120}`. Categoria é o **nome canônico do banco**, não um apelido de interface. `difficulty` aceita `easy`,`medium`,`hard`; ausência usa o filtro opcional da API quando permitido. `durationSeconds` deve ser inteiro de 0 a 30.

### Garantias SQL na criação

A API inicia transação, utiliza `pg_advisory_xact_lock(hashtext(roomId))`, recusa sala com rodada ainda aberta e seleciona pergunta `review_status='approved'` que ainda **não** apareceu no mesmo `room_id`. `ORDER BY RANDOM() LIMIT 1`. Monta alternativas com ID A-D e as embaralha; grava `correct_option_id` **somente no banco**; `UNIQUE(room_id,question_id)` evita repetição daquela questão dentro da partida. Falta de pergunta aprovada para filtro retorna `409`.

## 4. Enviar resposta

```http
POST /api/v1/rounds/<roundId>/answers
x-api-key: <SECRET_DO_SERVIDOR>
Content-Type: application/json

{"playerId":"[TOKEN_RESOLVIDO_NO_SERVIDOR]","optionId":"C"}
```

Atenção: `playerId` é fornecido pelo **backend do portal** após validar socket, sala e fase; o navegador envia só `optionId` ao portal. A API inicia transação, bloqueia a linha da rodada (`FOR UPDATE`), verifica alternativa existente e executa `INSERT ... SELECT` com condição temporal:

```sql
AND (
  r.duration_seconds = 0
  OR clock_timestamp() < r.started_at + (r.duration_seconds * INTERVAL '1 second')
)
```

Há `ON CONFLICT (round_id,player_id) DO NOTHING` e UNIQUE/PK para uma resposta por jogador por rodada. A resposta é **imutável** após registrada. Código HTTP:

- `201`: registro aceito, resposta contém `registered:true` e `receivedAt` do banco.
- `409`: já respondeu ou rodada fechada.
- `410`: após prazo, nenhuma resposta registrada.
- `400`: ID inválido, alternativa inválida, corpo inválido.
- `401`: autenticação de serviço ausente/inválida.
- `404`: rodada inexistente.

Com `durationSeconds=0` a condição temporal aceita até o `/finish` encerrar a rodada manualmente.

## 5. Encerrar e pontuar

```http
POST /api/v1/rounds/<roundId>/finish
x-api-key: <SECRET_DO_SERVIDOR>
Content-Type: application/json

{}
```

Não colocar `{answers:[...]}` nessa rota. A V1.3 **removeu** a possibilidade de entregar respostas junto ao fechamento; faz correção apenas do que já está em `trivia.round_answers`. Resposta contém `correctOptionId` e `results:[{playerId,optionId,correct}]`. Quem não respondeu não aparece nessa lista; o portal o trata como erro/ausência (`+0`). Isso garante que um encerramento tardio não valide respostas enviadas depois do relógio.

## 6. Comunicação Portal → Trivia

`trivia-race.js` implementa `api(endpoint, options)`: base `TRIVIA_API_URL` (fallback histórico `https://ronizada-quest.discloud.dev`), timeout 12 segundos via `AbortSignal.timeout(12000)`, `x-api-key` e `content-type: application/json` no `fetch`. `/api/trivia/categories` do portal consulta a API e faz cache **em memória por 60 segundos**. Falha de conexão apresenta HTTP 503 com texto informativo (não expõe segredo).

Na Corrida, `nextRound` escolhe categorias/dificuldades; `finish` mapeia resultados por token, incrementa no máximo até 10, decide desempate e emite atualização Socket.IO. Falhas na API não devem virar acerto falso; a fase passa a `error`.

## 7. Categorias e regras da configuração

A API disponibiliza até **24 categorias** conforme as questões PT-BR e status de revisão. Um filtro por nome precisa ser exatamente `category_pt` do banco. O portal define três aliases de exibição: `Ciência e natureza → Ciências`, `Séries e televisão → Séries e TV`, `Livros e literatura → Livros`. O backend nunca envia o alias no lugar do identificador canônico. É possível marcar todas, retirar todas, ou selecionar qualquer combinação não vazia.

## 8. Revisão e origem do acervo

Questões oriundas do Open Trivia Database, com derivados traduzidos PT-BR. A origem é citada como **CC BY-SA 4.0** nos documentos da API; manter atribuição e cumprir termos aplicáveis. Há dados em `data/questions.jsonl`, pipeline de importação em `src/importer.js` e scripts `db:import`, `db:check`. O conteúdo contém estados `pending`, `approved`, `blocked`, `rejected`; somente `approved` participa de rodadas. O lote de 5.046 questões aprovado para ensaio **não** passou por revisão factual individual. Se outra IA reproduzir o site, não transformar esse status operacional em certificação de qualidade.

## 9. Deploy e preservação de dados

- App Discloud isolado: `ronizada-quest`.
- DB PostgreSQL existente, schema `trivia`, role limitada `caroninhas_trivia_api`, rede privada com VLAN no cenário documentado.
- `.env` individual: `TRIVIA_API_KEY`, `TRIVIA_ADMIN_KEY`, credenciais do banco e `AUTO_IMPORT=if_empty` quando cabível.
- Migração aditiva V1.3 cria `trivia.round_answers`. Não apagar nem reimportar as perguntas ao atualizar somente a lógica.
- Verificar `/health`, `/api/v1/stats` (via backend autorizado) e um ciclo de rodada/duplicata/410/finish.

## 10. Casos de teste essenciais

1. Criar rodada de 15s, responder de dois jogadores dentro do prazo; repetir resposta do primeiro deve dar `409`.
2. Criar nova rodada de 15s, tentar responder depois do prazo; deve dar `410`; `/finish` retorna `results:[]` se ninguém respondeu.
3. Criar sem cronômetro (`0`); resposta aceita depois de 15s **desde que rodada não tenha sido encerrada**.
4. `GET /rounds/:id` nunca revela `correctOptionId`.
5. Duas rodadas com mesmo `roomId` não repetem a mesma questão; não criar duas rodadas abertas simultaneamente para mesmo roomId.
6. Filtro por categoria/dificuldade esgotado retorna `409`, portal tenta outras combinações válidas.
7. Verificar erro de API/restart sem pontuação local incorreta.
