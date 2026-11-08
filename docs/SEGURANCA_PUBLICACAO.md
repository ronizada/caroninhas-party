# Segurança e publicação no GitHub

## Confirmação antes de `git push`

- [ ] `git status --short` **não mostra** `.env` ou variantes contendo segredos reais.
- [ ] Não há dump de PostgreSQL, backup SQL, logs internos, capturas com chaves ou dados de contas.
- [ ] Não foram adicionados `node_modules`, `.git` antigo ou arquivos de configuração de produção.
- [ ] Os dois modelos `.env.example` contêm **somente valores fictícios**.
- [ ] O arquivo real `discloud.config` **não** está versionado (somente `.example`).
- [ ] Nenhuma URL `DATABASE_URL` real, token IGDB/TMDB ou `TRIVIA_ADMIN_KEY` real aparece em código, docs, commits, issues ou prints.
- [ ] O portal e a API estão claramente separados na estrutura.
- [ ] Foi revisado o direito de publicar as imagens e o acervo de perguntas.

O `.gitignore` evita arquivos acidentais em uma **nova** adição ao Git, mas não elimina segredos de commits antigos. Se uma chave já tiver sido publicada em histórico Git, **troque-a** no provedor e considere limpeza de histórico; apenas excluir o arquivo num novo commit não a protege.

## Modelo de segurança em runtime

- Autenticação de conta via sessão/cookie; não confundir com `playerToken` de sala.
- A API usa `TRIVIA_API_KEY` para chamadas servidor–servidor; nunca imprimir nem enviar ao frontend.
- A chave administrativa `TRIVIA_ADMIN_KEY` permanece exclusiva da API.
- O usuário PostgreSQL da Trivia deve ser restrito e dono apenas do schema `trivia`; não pode criar objetos em `public`.
- Não inserir `DATABASE_URL` da produção em workflows públicos ou logs da CI.
- As salas usam estado em memória e chaves de entrada; código de sala sozinho não é controle de acesso para salas privadas.

## Limitações de segurança da versão arquivada

- O fluxo histórico de recuperação de senha depende de informações que podem ser descobertas; antes de ampliar acesso público, avalie mecanismos mais fortes de recuperação.
- Informações de sessão/banco requerem backups protegidos com acesso controlado.
- Não há evidência de monitoramento avançado, HSM, isolamento de containers ou sistema de auditoria de segurança nesta linha-base. Não pressupor que existem.
- Para hospedagem, revise cookies, TLS, CORS, proxy e rate limiting de acordo com o ambiente real antes de operar amplamente.

## Vulnerabilidades

Não divulgue tokens e dados privados em issue pública. Se configurar o repositório público, utilize os recursos de reporte privado do GitHub e defina canal de contato do mantenedor.
