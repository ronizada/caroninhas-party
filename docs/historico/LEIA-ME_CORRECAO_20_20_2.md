# Corrida do Conhecimento — correção 20.20.2

Mudanças restritas às telas da Corrida do Conhecimento:
- Componente de identidade (nome + avatar) reutiliza os estilos e o mesmo seletor dos jogos Impostor e Quem Sou Eu.
- Se houver conta autenticada, o nickname é preenchido automaticamente e o avatar vem da conta, inclusive foto personalizada. O visitante pode escolher o bichinho no mesmo modal.
- Layout de configuração distribuído em duas colunas no computador, com painel de categorias/tags à esquerda e opções/salas abertas à direita.
- Mantidas as 24 categorias, dificuldade, cronômetro, sala privada, criação/entrada e torres.
- Paleta e fontes originais do site, sem forçar tema escuro.
- Em telas pequenas, o conteúdo tem rolagem para preservar acessibilidade. A interface mira caber por inteiro no desktop convencional, mas isso depende de altura, zoom e quantidade de salas.

**Publicação:** este pacote completo usa o `discloud.config` da versão de teste (`caroninhas-party-v2020-test`). Se for atualizar a aplicação de produção, preserve o `discloud.config` da aplicação já publicada (especialmente ID e HOSTNAME), o arquivo `.env` e um backup completo da V20.19 antes de enviar. O ZIP não inclui `.env`.

**Verificação:** `node --check public/script.js` e `npm test` (53 testes) executados com sucesso. Ainda faltam verificar visualmente no seu navegador e testar integração real na Discloud.
