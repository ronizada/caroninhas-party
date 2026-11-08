# V1.3 — banco compartilhado com Caroninhas Party

O usuário `caroninhas_trivia_api` e o esquema `trivia` **já foram criados e testados na V1.2**. Não execute novamente o SQL de preparação do usuário.

- Esta atualização adiciona somente a tabela `trivia.round_answers`, com chave única por (rodada, jogador).
- A tabela é criada automaticamente com `CREATE TABLE IF NOT EXISTS` ao iniciar a API.
- Tabelas `public.*` do jogo principal ficam intocadas.
- Não executa `DROP`, `TRUNCATE`, `DELETE`, nem redefine senhas.
- Mantém as 5.247 questões existentes, inclusive suas aprovações.
- Reuse a **mesma `.env` de `ronizada-quest`** que funcionou na V1.2. **Não** copie a do `caroninhas-party`.
- Garanta um backup do PostgreSQL antes da atualização.

Se a API não iniciar, verifique as mensagens no log da `ronizada-quest` antes de qualquer intervenção no banco.
