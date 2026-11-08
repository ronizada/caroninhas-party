# Ronizada Quest / Trivia API V1.3

Este diretorio contem o **segundo servidor**, separado do portal principal.

**Inicio recomendado:** siga [README principal](../../README.md) e [Instalacao local](../../docs/INSTALACAO_LOCAL.md). Depois consulte [README original da V1.3](README_ORIGINAL_V1_3.md), [contratos](../../docs/referencia-tecnica/07_RONIZADA_QUEST_API.md) e [conservacao do acervo](../../docs/CONTEUDO_E_LICENCAS.md).

> Aviso: as questoes importadas do arquivo de origem estao pendentes/bloqueadas/rejeitadas. Partidas so encontram registros com `review_status='approved'`; nao assuma que o banco novo esta habilitado para jogar logo apos a importacao.

Comandos desta pasta: `npm install`, `npm test`, `npm run db:check`, `npm start`. O schema `trivia` e o papel restrito devem existir antes de iniciar, e o `.env` deve estar preenchido.
