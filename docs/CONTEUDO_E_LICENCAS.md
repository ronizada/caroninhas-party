# Conteúdo, dados e licenças

## Três tipos de material distintos

1. **Código do projeto:** servidor, interface, CSS, testes e scripts; este pacote **não concede automaticamente licença de código aberto** a terceiros. O titular deve decidir como licenciar o repositório.
2. **Perguntas da Ronizada Quest:** `services/ronizada-quest/data/questions.jsonl`, acervo derivado do **Open Trivia Database (OpenTDB)**, atribuído na documentação da versão original como material sob **CC BY-SA 4.0**. Mantenha referência e atribuição aplicáveis; verifique os termos atuais do provedor antes de redistribuir publicamente.
3. **Imagens e nomes de personagens:** há avatares gráficos locais e referências/metadados consultados a provedores externos (IGDB, TMDB, AniList, Wikipedia/Wikimedia, TVmaze etc.). A obtenção pública de uma imagem **não** implica permissão para redistribuir arquivos dessa imagem em repositório público. Revise licenças e direitos antes de publicar.

## O arquivo de perguntas não é um dump de produção

O JSONL de origem tem **5.247 registros**:

| Estado | Quantidade | Implicação inicial |
|---|---:|---|
| `pending` | 5.046 | Não aparece em partidas até aprovação |
| `blocked` | 106 | Indisponível |
| `rejected` | 95 | Indisponível |
| **Total** | **5.247** | Registros do acervo local |

Na instalação de produção do projeto houve uma **liberação administrativa de perguntas** que não está refletida no arquivo-fonte. Portanto, **ao criar o banco do zero, o sorteio pode retornar ausência de perguntas aprovadas**. A API seleciona somente `review_status='approved'`.

**Recomendação para retomada:** revisar amostras e aprovar conscientemente questões em banco de desenvolvimento ou usar as rotas administrativas para curadoria. Evite assumir que a tradução foi validada; o histórico da versão registra liberação em lote sem verificação factual individual.

A API administra dados em `trivia.questions`, `trivia.rounds` e `trivia.round_answers`, isolados do schema `public` utilizado pelo portal. Esses registros de partidas não são versionados no GitHub.

## O que ficou intencionalmente fora

- Fotos de usuários armazenadas no PostgreSQL (incluindo dados `BYTEA`).
- Senhas, cookies, tokens, e-mails, datas de nascimento e outros dados privados reais.
- Dumps da base da Discloud, sessões e registros históricos de usuários.
- Chaves de APIs externas.

## Antes de escolher um repositório público

- Revise **licenciamento de avatares, banner e qualquer imagem local** que não tenha autoria/uso expressamente autorizado.
- Revise atribuição e possíveis obrigações *ShareAlike* do dataset OpenTDB.
- Não inclua fotos de perfil de jogadores nem dados exportados de contas.
- Defina uma licença para o código **somente quando tiver certeza de que pode concedê-la**; não se presume MIT ou Apache.
- Se houver dúvida sobre direitos de redistribuição, mantenha o GitHub **privado** até resolver.
