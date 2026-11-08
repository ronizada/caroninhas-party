# Caroninhas Party — V20.20.4 (refinamentos visuais)

Base: **V20.20.3**, a versão com Corrida do Conhecimento e tela de campeão.

## Alterações feitas

- A fonte retrô `Pixelify Sans` foi substituída por **Chakra Petch** nas interfaces que a utilizavam no site inteiro. A fonte de leitura longa **Nunito** foi preservada. Isso inclui números, botões, cabeçalhos e outros componentes que usavam a fonte anterior.
- Removida a **faixa vertical rosa** decorativa dos selects (`.retro-select`), mantendo as setas, cores e bordas do Caroninhas Party.
- Removida a faixa rosa decorativa dos checkboxes (`.retro-check-option`); a caixa de seleção continua funcionando.
- **Entrar em uma corrida:** inputs de código e senha e botão Entrar com 52 px de altura externa, alinhamento vertical e sem margem superior herdada no botão.
- Número do **Tempo por pergunta** adota a fonte mais legível, mantendo os botões -/+, valor 0 a 30 e a semântica de 0 = sem limite.
- Forçado recarregamento de CSS no navegador pelo `?v=20.20.4`.

## Arquivos alterados

- `public/style.css` (visuais e tipografia do site)
- `public/index.html` (importação da nova fonte e versão do CSS)
- `tests/trivia-visual-refinement.test.js` (4 testes de regressão visual estática)

Nenhuma modificação em `server.js`, `public/script.js`, `trivia-race.js`, no banco de dados ou nas regras das três modalidades.

## Instalação — cuidado com o site principal

Este ZIP contém o projeto completo, **não contém `.env`** e mantém o `discloud.config` de **teste** (`ID=caroninhas-party-v2020-test`).

1. Guarde um backup da versão online antes de atualizar.
2. Preserve **seu `.env` e `discloud.config` atuais** (não use o `discloud.config` de teste deste arquivo para a aplicação principal).
3. Aplique a V20.20.4 e reinicie a aplicação.
4. Atualize a página com `Ctrl+F5` para evitar CSS em cache.

## Verificação

`node --check public/script.js` e `npm test`.

As revisões visuais foram feitas em uma prévia local com viewport desktop (1366×768 e 1536×864) e mobile (390×844). O visual depende das fontes disponibilizadas pelo Google Fonts no navegador do usuário. Pequenas telas continuam usando rolagem quando necessária.
