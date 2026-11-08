# 08 — SEGURANÇA, CONTAS, AMBIENTE, OPERAÇÃO E INCIDENTES

## 1. Modelo de autenticação existente

O sistema de contas reside em `auth.js` e banco `public`. Nickname permitido: de **3 a 20 caracteres**, letras ASCII, números, ponto e sublinhado; reserva `admin`, `moderador`, `sistema`, `caroninhas`. A comparação de unicidade usa normalização **NFKC + `toLocaleLowerCase('pt-BR')`**. Senha permitida: de **6 a 72 caracteres**. Data de nascimento no formato `YYYY-MM-DD` e coerência temporal básica.

As senhas são armazenadas usando **scrypt** com salt aleatório de 16 bytes, chave derivada de 64 bytes. `password_hash` segue `scrypt$<salt_base64>$<hash_base64>`. Verificação usa `crypto.timingSafeEqual` e scrypt assíncrono.

### Sessão

- Login gera token aleatório de 32 bytes, exposto apenas como cookie `caroninhas_session`.
- Banco guarda `SHA256(token)` em `user_sessions.token_hash`, nunca o token bruto.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 30 dias, `Secure` quando HTTPS/proxy sinalizam conexão segura.
- `getUserFromRequest` e `getUserFromSocket` buscam sessão a partir do cookie; frontend não autentica jogador com `playerToken` local.
- `/api/auth/me` renova sessão válida, retornando perfil + stats.
- `/api/auth/logout` apaga sessão do banco e expira cookie.

**Risco a registrar:** a validade de cookies em vários dispositivos depende das linhas em `user_sessions`; alterar senha por reset remove sessões de todos os dispositivos.

## 2. Recuperação de senha

Recuperação baseia-se em **nickname e data de nascimento**; `/api/auth/recovery/verify` limita a 8 tentativas a cada 15 minutos por par IP+nickname, gera token de reset aleatório com TTL **10 minutos**, salvo em `Map` no processo. `/api/auth/recovery/reset` verifica token e altera senha. O código não declara envio por e-mail ou SMS. Esse mecanismo tem implicações de segurança: quem conhece nickname e data de nascimento pode tentar recuperação; para produção com ameaça elevada, considerar fator de verificação adicional **como melhoria futura, não funcionalidade já entregue**.

## 3. Fotos, avatares e privacidade

A conta pode usar um dos 10 animais em `/public/avatars/*.png` ou uma foto personalizada gravada em `BYTEA` em `users.profile_image`. O campo `avatar_type` distingue `preset` e `upload`. Endpoints de perfil autenticados atualizam a escolha; `GET /api/profile/image/:id` serve os bytes com MIME. Fotos e data de nascimento são dados pessoais: **não copiar para anexos públicos, prompts de IA ou dumps não protegidos**. O token usado para reconexão da sala não autentica conta.

## 4. Salas privadas, host e Socket.IO

Senha de sala é armazenada **somente em memória** via `scryptSync` com salt aleatório; verificação usa `timingSafeEqual`. Há limite para tentativas de ingresso em sala privada. Host é determinado pelo token admitido e pelo estado do socket, não por valor vindo do cliente. Existe separação jogador vs. espectador, controle de ação por fase e conferência de sessão para reconexão. Código de sala não deve ser tratado como senha: sala privada exige segredo adicional.

## 5. Backend para backend e gestão de segredos

Variáveis do portal, conforme `.env.example`, documentos e código:

| Nome | Uso | Atenção |
|---|---|---|
| `PORT` | porta HTTP (padrão 8080) | número válido |
| `DATABASE_URL` | conexão PostgreSQL portal | segredo crítico |
| `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` | alternativa de conexão | não combinar incorretamente com `DATABASE_URL` |
| `AUTO_INIT_DB` | habilita bootstrap base | ainda há migrations e importações fora desse flag |
| `TRIVIA_API_URL` | base do serviço de perguntas | ex.: URL pública do app separado |
| `TRIVIA_API_KEY` | chave de serviço para a Trivia | **somente backend** |
| `TMDB_READ_ACCESS_TOKEN` | API de imagens TMDB | segredo |
| `IGDB_CLIENT_ID` | credencial client de IGDB | segredo/identificador |
| `IGDB_CLIENT_SECRET` | segredo Twitch/IGDB | segredo |
| `IGDB_ACCESS_TOKEN` | possível token obtido/configurado | segredo |

Os nomes adicionais/alternativos devem ser validados em `whoami-images.js`; não presumir que todos são obrigatórios simultaneamente. No serviço Trivia: `TRIVIA_API_KEY`, `TRIVIA_ADMIN_KEY`, `DATABASE_URL` ou credenciais DB_* e opções de importação (`AUTO_IMPORT`). Nunca duplicar a `TRIVIA_ADMIN_KEY` no portal; só chave de serviço.

### Modelo seguro de configuração

```dotenv
# arquivo real protegido e não versionado
PORT=8080
DATABASE_URL=postgresql://USUARIO:SENHA@HOST_PRIVADO:5432/BANCO
TRIVIA_API_URL=https://ronizada-quest.discloud.dev
TRIVIA_API_KEY=<SEGREDO_DIFERENTE_DA_CHAVE_ADMIN>
AUTO_INIT_DB=false
# variáveis opcionais dos provedores, quando efetivamente configuradas
```

Valores acima são PLACEHOLDERS. É proibido publicar ZIP com senhas reais por acidente. Os ZIPs de referência da documentação não exigem embutir `.env`. Idealmente configurar segredos pelo painel/gerenciador apropriado; se precisar enviar `.env` no deploy privado, manter a cópia fora de repositórios.

## 6. Inicialização e migrações

`server.js` conecta banco, opcionalmente executa `bootstrapDatabase`, **sempre chama** `runMigrations` e `loadQuizQuestions`, e então inicia servidor. Isso implica testes de startup contra banco **separado**. O backend Trivia executa preparação limitada ao schema `trivia` ao subir, e pode importar em modo `if_empty`. Não automatizar uso de usuário PostgreSQL privilegiado na API de perguntas.

## 7. Observabilidade realmente presente

Há `console.log`/`console.error` no servidor para conexões, início, erros de sorteio, comunicação e autenticação. **Constatação importante:** o código atual registra em log a palavra e a identidade do impostor no começo de rodada; isso deve ser tratado como risco de exposição de informação de jogo a quem acessa logs e precisa de revisão antes de operar logs públicos ou compartilhados. A API fornece `/health`. **Não se verificou** Prometheus, Grafana, Loki integrado ao site, Sentry, tracing OpenTelemetry, alertas de uptime, métricas HTTP estruturadas ou auditoria de mudanças administrativas nesta implementação. Recomendações de observabilidade devem aparecer como melhorias futuras.

## 8. Incidentes comuns — diagnóstico sem expor segredos

| Sintoma | Causa provável e diagnóstico |
|---|---|
| `/api/trivia/categories` 503 / UI “API indisponível” | conferir `TRIVIA_API_KEY` no backend do portal, `TRIVIA_API_URL`, conectividade e `/health` do serviço; nunca expor valor da chave no chat |
| Falha `getaddrinfo ENOTFOUND` para DB privado | verificar VLAN/host privado da Discloud; `localhost` não é DB remoto |
| Erro `password authentication failed` | role/senha/URL DB divergentes; confirmar usuário restrito e parâmetros no app correto |
| UI antiga depois de atualização | cache de `style.css?v=...` e Ctrl+F5; conferir arquivo implantado |
| Sala desaparece após deploy | estado em memória do portal, comportamento esperado nesta arquitetura |
| Foto de perfil não aparece | sessão, `avatar_type`, bytes no banco, endpoint de imagem/MIME; não copiar só PNG preset |
| Pergunta expira mas jogador tenta responder | retorno 410 da Trivia; mostrar “Tempo esgotado” sem marcar acerto |
| Quem Sou Eu? sem imagem | confirmar token do provedor, resolução/fallback e URLs; não quebrar o jogo inteiro |
| Categoria visível com zero perguntas | categoria filtrada por `available > 0` no portal; revisar API e cache de 60s |

## 9. Rotina de publicação recomendada

1. Identificar app de destino por ID real no painel, não pelo nome do arquivo ZIP.
2. Salvar ZIP anterior e manifesto original da Discloud.
3. Confirmar `.env` não foi sobrescrita, segredo não consta em ZIP público.
4. Testar `npm ci` e `npm test` localmente.
5. Usar banco de homologação para versões beta; **mesmo AUTO_INIT_DB=false pode executar migrações/importações**.
6. Inspecionar `package.json`, scripts de migração, diferenças de SQL e `discloud.config` antes do deploy.
7. Publicar a aplicação correta e verificar inicialização + HTTP + Socket.IO + duas abas/usuários.
8. Validar Impostor, Quem Sou Eu? e Corrida, inclusive rollback.
9. Se houver falha, restaurar apenas a aplicação afetada, sem comandos destrutivos no banco.

## 10. Riscos técnicos e recomendações (NÃO implantadas automaticamente)

- Persistir salas para suportar restart ou implementar avisos/reconexão robustos.
- Separar worker de migrations do startup e controlar versões no banco.
- Fortalecer recuperação de conta (segredo de recuperação fora da data de nascimento).
- Implementar políticas de CSP, limites de chamadas por API externa e tratamento homogêneo de erros.
- Implementar consentimento/retenção/remoção de dados pessoais, se exigido pela legislação.
- Revisão factual das 5.046 perguntas liberadas em lote.
- Adicionar auditoria automatizada de acessibilidade e monitoramento real.

Esses são **itens de evolução**, não recursos presentes no código-fonte analisado.
