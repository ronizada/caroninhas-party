# Caroninhas Party V20.20.3 — tela de campeão e cronômetro

Base: V20.20.2. Alterações limitadas a `public/index.html`, `public/script.js` e `public/style.css`.

- Tela final independente ao concluir a Corrida, com avatar, nome, medalha, placar e número de rodadas.
- Desempate continua sendo decidido exclusivamente pelo servidor; a tela respeita `winnerToken`.
- Após 1,7 s do anúncio na tela da última questão, todos recebem a tela final.
- Host escolhe **Jogar novamente**, retornando todos ao lobby. Demais participantes veem **Aguardando o anfitrião**.
- Botão **Voltar à biblioteca** usa a saída de sala já existente no Caroninhas Party.
- Campo **Tempo por pergunta** tem valor visível e controles − / +; aceita inteiro de 0 a 30 (0 sem cronômetro).
- Nenhuma mudança no backend, API de perguntas, banco, outros jogos ou autenticação.

## Publicação

O pacote inclui os arquivos completos, mas **não contém `.env`**. Seu `discloud.config` continua configurado para a aplicação de teste; para atualizar a aplicação principal, mantenha o `.env` e o `discloud.config` originais e preserve um backup anterior.

## Testes

Executar `node --check public/script.js` e `npm test`. Validar na Discloud o encerramento da Corrida com 2+ jogadores e a volta ao lobby.

- Rodapé de créditos movido após as telas da Corrida, evitando aparecer antes do jogo no celular.
