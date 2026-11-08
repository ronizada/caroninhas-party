# Caroninhas Party — V20.19

Base: **V20.18.1** (pacote DISCloud com crédito das miniaturas). As telas, partidas, cadastro/login, dados, notificações, integrações e regras existentes foram mantidos.

## O que mudou

1. **Token da IGDB automático.** Com `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET` no ambiente **do servidor**, o jogo solicita um **app access token** à Twitch (`POST https://id.twitch.tv/oauth2/token`, `grant_type=client_credentials`). Armazena-o em memória, reutiliza até próximo ao vencimento e solicita um novo automaticamente com base em `expires_in`. Um `401` da IGDB provoca a obtenção de um novo token e **uma única nova tentativa** da requisição. Consultas simultâneas compartilham a obtenção do token. Uma falha de autenticação não bloqueia a Wikipédia/fallback e o token não é enviado ao navegador.
2. **Etiquetas de fonte apenas em fotos ampliadas.** As miniaturas do jogo, fotos pequenas de revelação e cartões compactos de resultados não exibem `FONTE`. Ao ampliar uma foto no Quem Sou Eu?, o selo e o link da origem aparecem quando o provedor os disponibiliza. As fotos grandes da etapa de aprovação também mostram a atribuição, se disponível. Quando a imagem já veio embutida na partida sem dados da fonte, a fonte é consultada sob demanda na abertura da foto ampliada.

## Configuração IGDB na Discloud

Adicione às **variáveis de ambiente da aplicação** (não aos arquivos públicos):

```dotenv
IGDB_CLIENT_ID=SEU_CLIENT_ID_DA_TWITCH
IGDB_CLIENT_SECRET=SEU_CLIENT_SECRET_DA_TWITCH
```

- **Não é necessário preencher `IGDB_ACCESS_TOKEN`** quando `IGDB_CLIENT_SECRET` está disponível. A Twitch gera um token de aplicação novo, que não utiliza `refresh_token`.
- A configuração anterior `IGDB_CLIENT_ID` + `IGDB_ACCESS_TOKEN`, sem Client Secret, **ainda é aceita**. Nesse modo legado o token continua fixo, portanto sua expiração **não será renovada automaticamente**. Para ativar a renovação, adicione `IGDB_CLIENT_SECRET`.
- Mantenha `WHOAMI_IGDB_ENABLED=false` caso deseje desabilitar o serviço. Todas as demais integrações e opções anteriores permanecem.
- O token fica em memória: reiniciar a aplicação obtém outro token na próxima busca de personagem de jogos. Não é necessário agendar tarefas ou criar tabela no PostgreSQL.
- Por segurança, não envie seu Client Secret no chat, não o inclua no ZIP e nunca o exponha em `public/`.

## Validação e implantação

```bash
npm ci
npm test
npm start
```

Testes incluídos para renovação antes do vencimento, tratamento de `401` nos dois endpoints da IGDB, paralelismo, fallback, modo legado e regras das etiquetas. A integração online com credenciais reais, navegação visual e deploy em Discloud precisam ser confirmados no ambiente real.

Após configurar as variáveis da Twitch e implantar o ZIP, entre no **Quem Sou Eu?**, escolha personagens de **Jogos**, abra a foto ampliada e verifique se surge o link `FONTE` quando existir imagem identificada. Para conferir a manutenção do banco, preserve as migrações originais e evite reinicializar ou apagar as tabelas.

## Arquivos modificados em relação ao ZIP fornecido

- `whoami-images.js`: obtenção e renovação de token via servidor.
- `public/script.js`: regras de crédito e busca de metadados para prévia ampliada.
- `public/style.css`: etiquetas somente nas visualizações grandes.
- `public/index.html`: atualiza versão dos assets CSS/JS para evitar cache antigo no navegador.
- `package.json` e `package-lock.json`: versão `5.0.19` e comando `npm test`.
- `tests/whoami-igdb-token.test.js`: testes novos.
- Este documento.

**Preservados sem alteração:** `server.js`, `auth.js`, `db.js`, estrutura `database/`, demais telas e mídias, configurações de deployment e os testes anteriores.
