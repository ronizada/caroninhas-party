# Caroninhas Party V20.12 — Quiz & Caos retirado

Esta versão **remove o jogo Quiz & Caos do site e das salas**, mantendo o acervo de perguntas no PostgreSQL e no código-fonte para um projeto futuro.

## Removido
- Card do Quiz & Caos na biblioteca (restam Impostor, Quem Sou Eu? e os jogos futuros anunciados).
- Telas do Quiz: entrada, lobby, tabuleiro, cartas, perguntas e resultados.
- Lógica de partidas/salas e eventos Socket.IO do Quiz no servidor.
- Personalização específica de peões e estatísticas do Quiz na interface e no endpoint do perfil.
- Estilos CSS exclusivos desses componentes.
- Rota pública `/api/quiz-config` (não utilizada após remoção).

## Preservado — **não apagar**
- `database/data/quiz_questions.jsonl`: **1.000 perguntas** nas categorias Conhecimentos Gerais e História & Geografia.
- `database/migrations/002_quiz_caos.sql`: estrutura histórica de `quiz_questions` **e registros de resultados antigos**; ainda cria as tabelas para instalações novas.
- `database/migrations/003_quiz_pawns.sql`: migração histórica; mantida para não modificar a cadeia já aplicada.
- `scripts/load-quiz-questions.js`: sincronização das perguntas no início do servidor.
- Dados de partidas antigas já existentes no PostgreSQL: não são excluídos nem apresentados nas estatísticas atuais.
- Os outros jogos, contas, salas privadas, reconexão e modo espectador.

## Deploy na Discloud
- Enviar o ZIP `CARONINHAS_PARTY_V20_12_SEM_QUIZ_PARA_DISCLOUD.zip` como atualização do aplicativo existente.
- O pacote tem arquivos de aplicativo na **raiz do ZIP** (incluindo `discloud.config`).
- **Não inclui `.env`** e não altera credenciais nem rede VLAN.
- Verificar se `DATABASE_URL` continua configurada e `AUTO_INIT_DB=true`, caso esteja usando a inicialização automática.
- Não há nova migração, `DROP TABLE`, `TRUNCATE` ou comando de exclusão do acervo.
- As rotas antigas `/quiz-e-caos` e `/quiz-e-caos/ABCD` passam a redirecionar para `/`.

## Verificação rápida após atualizar
1. Abra a página inicial: devem existir **2 jogos disponíveis** (Impostor e Quem Sou Eu?).
2. Crie/entre em uma sala de cada um e confira o lobby.
3. Abra `/quiz-e-caos`: deve voltar à página inicial.
4. Confira os logs de inicialização: deve haver o registro da quantidade de perguntas preservadas.

Observação: não foi executada uma partida multiplayer real com o banco de produção neste ambiente. Foram realizadas checagens de sintaxe JavaScript, HTML, CSS e estrutura dos arquivos.
