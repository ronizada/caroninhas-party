# Caroninhas Party 🎮

**Portal de minijogos multiplayer em tempo real** com identidade visual retrô, salas privadas e públicas, contas, avatares e três modalidades: **Impostor**, **Quem Sou Eu?** e **Corrida do Conhecimento**.

> **Versões arquivadas neste repositório:** Caroninhas Party **V20.20.4** (o `package.json` registra `5.0.20`) e serviço independente **Ronizada Quest / Trivia API V1.3.0**. Esta é uma **cópia para GitHub/continuidade do projeto**, não um backup de dados ou credenciais da hospedagem.
>
> **Publicação:** não há deploy automático. A aplicação principal e a API de perguntas devem ser instaladas/publicadas **separadamente**. Nunca envie os arquivos deste repositório diretamente sobre a produção sem criar um backup e configurar os manifestos específicos.

![Identidade visual do Caroninhas Party](public/caroninhas-party-banner.png)

## Visão geral

| Modalidade | O que faz |
|---|---|
| **Impostor** | Sorteia palavras e o papel do impostor; coordena discussão, votos e eliminação. |
| **Quem Sou Eu?** | Sorteia personagens, trabalha com imagens, revisão entre jogadores e palpites. |
| **Corrida do Conhecimento** | Cada acerto preenche um nível de uma torre de 0 a 10; perguntas simultâneas, prazo, seleção de categorias/dificuldade, avanço automático, desempate e tela de campeão. |

O site compartilha entre as modalidades o **mesmo sistema de conta/perfil, apelido, avatares, criação/entrada em salas, anfitrião, jogadores prontos, espectadores e reconexão**. A interface usa rosa e creme, janelas de desktop retrô, bordas escuras e fontes **Chakra Petch + Nunito**.

### Tecnologias

- **Node.js 20+** (recomendado Node.js 22 LTS no ambiente local).
- **Express 5**, **Socket.IO 4** e JavaScript no servidor.
- **HTML5, CSS3 e JavaScript puro**, sem React/Vue/Vite, no navegador.
- **PostgreSQL** para contas, conteúdo e histórico; o estado ativo das salas reside em memória do processo do portal.
- **Ronizada Quest**, um segundo backend Express que usa o schema PostgreSQL `trivia` e guarda as respostas individuais com validação do prazo.
- **Discloud** foi a plataforma de implantação original; o projeto também pode executar em um computador local com PostgreSQL.

## Estrutura do repositório

```text
caroninhas-party/
├── README.md                     # este guia
├── AGENTS.md                     # instruções para continuar o projeto com outra IA
├── .env.example                  # modelo SEM segredos do portal
├── discloud.config.example       # apenas modelo, sem identificador de produção
├── server.js                     # HTTP, Socket.IO, salas e jogos
├── auth.js                       # contas, sessão e perfil
├── db.js                         # conexão PostgreSQL
├── trivia-race.js                # orquestração da Corrida do Conhecimento
├── whoami-images.js              # obtenção de imagens de personagens
├── public/
│   ├── index.html                # telas e componentes
│   ├── script.js                 # estado de UI, sockets, navegação
│   ├── style.css                 # tema, design system e responsividade
│   └── avatars/                  # imagens padrão do projeto
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   ├── migrations/
│   └── data/
├── scripts/                      # instalação, migrações, relatórios
├── tests/                        # testes do portal
├── services/ronizada-quest/      # SEGUNDA aplicação: API de perguntas V1.3
│   ├── .env.example
│   ├── src/
│   ├── data/questions.jsonl      # acervo de origem; não é dump da produção
│   ├── sql/
│   ├── scripts/
│   └── tests/
├── docs/                         # instalação, segurança, deploy, inventário
└── .github/workflows/tests.yml   # CI de testes; NÃO publica automaticamente
```

## Como executar: versão curta

**Pré-requisitos:** Node.js 20 ou superior, npm e PostgreSQL em execução (recomendado PostgreSQL 15+). Os comandos abaixo são para um terminal na **raiz do projeto**. No Windows, PowerShell e terminal do VS Code funcionam.

### 1. Preparar o banco PostgreSQL do portal

```powershell
Copy-Item .env.example .env
```

Edite `.env` com o host, a porta, o usuário e a senha do **seu PostgreSQL local**. Não use o banco de produção para experimentar. O exemplo usa `DB_NAME=caroninhas_party_local`.

```bash
npm ci
npm run db:init
```

O comando `db:init` pode criar o banco local se o usuário configurado possuir permissão `CREATEDB`, além de instalar o schema e dados iniciais. Em PostgreSQL hospedado, prefira criar **um banco próprio de teste** previamente. O comando não deve ser usado sem revisão em um banco de produção.

### 2. Preparar e iniciar a Ronizada Quest (API separada)

1. No mesmo PostgreSQL **de desenvolvimento**, crie o usuário restrito `caroninhas_trivia_api` e o schema `trivia` pertencente a ele, seguindo [Instalação local](docs/INSTALACAO_LOCAL.md#3-preparar-o-schema-trivia-e-o-usuario-restrito).
2. Copie `services/ronizada-quest/.env.example` para `services/ronizada-quest/.env`.
3. Configure a conexão e gere **duas chaves distintas** de ao menos 24 caracteres: `TRIVIA_API_KEY` e `TRIVIA_ADMIN_KEY`.
4. Em `services/ronizada-quest`, execute:

```bash
npm install
npm run db:check
npm start
```

A API local atenderá em `http://127.0.0.1:8081/health` se a porta de exemplo for mantida. A importação inicial cria as tabelas em `trivia` e processa o arquivo de perguntas. **Importante:** as perguntas de origem não vêm aprovadas para uso; veja [Conteúdo e licenças](docs/CONTEUDO_E_LICENCAS.md).

### 3. Iniciar o portal

De volta à **raiz** do repositório, em outro terminal:

```bash
npm start
```

Abra `http://127.0.0.1:8080`. Confirme que a chave `TRIVIA_API_KEY` do portal seja **idêntica** à chave de serviço da Ronizada Quest; mantenha `TRIVIA_ADMIN_KEY` somente na API.

> Se não configurar a Trivia API, o portal ainda poderá inicializar, mas a Corrida não conseguirá carregar as categorias. O PostgreSQL do portal continua obrigatório.

**Instruções completas para Windows, macOS e Linux:** [docs/INSTALACAO_LOCAL.md](docs/INSTALACAO_LOCAL.md). Incluem SQL seguro, portas, configuração do banco e erros comuns.

## Configuração de ambiente

Os **dois arquivos `.env` são diferentes**:

| Variável | Aplicação | Função |
|---|---|---|
| `PORT` | Ambas | Porta HTTP (`8080` no portal, `8081` na API no exemplo local) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conforme serviço | Conexão PostgreSQL alternativa à `DATABASE_URL` |
| `DATABASE_URL` | Ambas | URL completa de conexão; segredo, nunca versionar |
| `AUTO_INIT_DB` | Portal | Quando `true`, tenta inicializar tabelas no startup; use `false` após bootstrap local |
| `TRIVIA_API_URL` | Portal | URL acessível do backend da Ronizada Quest |
| `TRIVIA_API_KEY` | **Ambas** | A mesma chave de serviço para chamadas servidor–servidor |
| `TRIVIA_ADMIN_KEY` | **Só API** | Chave de administração de perguntas, diferente da chave de serviço |
| `AUTO_IMPORT` | Só API | `if_empty` (padrão recomendado), `off` ou `always` |
| `DATABASE_SSL` | Só API | Habilitar TLS conforme o banco remoto |
| `TMDB_READ_ACCESS_TOKEN`, `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | Portal, opcionais | Serviços de imagens/identificação de personagens |

Consulte [docs/CONFIGURACAO.md](docs/CONFIGURACAO.md). **Nunca faça commit do `.env`.**

## Comandos

| Pasta | Comando | Finalidade |
|---|---|---|
| raiz | `npm ci` | Instala dependências do portal respeitando `package-lock.json` |
| raiz | `npm run db:init` | Prepara banco **de desenvolvimento** e conteúdo inicial |
| raiz | `npm start` | Executa o portal |
| raiz | `npm run dev` | Executa portal com `node --watch` |
| raiz | `npm test` | Testes locais do portal (60 casos na linha-base) |
| raiz | `npm run images:report` | Relatório de imagens do Quem Sou Eu? |
| `services/ronizada-quest` | `npm install` | Instala dependências da API |
| `services/ronizada-quest` | `npm start` | Executa API de perguntas |
| `services/ronizada-quest` | `npm run db:check` | Verifica formato do acervo sem gravar no banco |
| `services/ronizada-quest` | `npm test` | Testes locais da API (18 casos na linha-base) |

Os testes unitários podem executar sem PostgreSQL; uma partida **real** exige os dois serviços e o banco configurado.

## Publicar em um repositório GitHub

1. Baixe e extraia o ZIP deste pacote (deixe `README.md`, `server.js`, `package.json` e `.github` **na raiz**, sem uma subpasta adicional ao subir os arquivos).
2. Crie **um repositório vazio** no GitHub, público ou privado. Para uma primeira publicação, recomendo **privado** enquanto você revisa os recursos e os direitos de uso de imagens/perguntas.
3. Abra um terminal na raiz e execute:

```bash
git init
git add .
git commit -m "Arquivo do Caroninhas Party V20.20.4 e Ronizada Quest V1.3"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

Substitua a URL pelo endereço do **seu repositório recém-criado**. Se o projeto já for um repositório Git, **não repita `git init`/`git remote add origin` sem conferir o remoto atual**. Nenhuma conta/URL privada está definida neste pacote.

Antes de `git push`, execute `node scripts/verificar-github.js` e `git status` e confirme que **não** aparecem `.env`, dumps, `node_modules`, capturas com dados pessoais ou manifestos de produção. Os arquivos são protegidos pelo `.gitignore`, mas o responsável pelo repositório deve conferir o primeiro commit.

**Atenção:** GitHub é controle de versão, **não** substitui o PostgreSQL, os segredos de ambiente ou o backup da Discloud. O repositório pode ser publicado sem interrupção do site atual. Para colocar o sistema no ar, veja [docs/DEPLOY_DISCLOUD.md](docs/DEPLOY_DISCLOUD.md).

## Documentação para retomar o projeto futuramente

- [Instalação local passo a passo](docs/INSTALACAO_LOCAL.md)
- [Como publicar no GitHub (Windows/PowerShell)](docs/COMO_PUBLICAR_GITHUB.md)
- [Ambientes, variáveis e segredos](docs/CONFIGURACAO.md)
- [Publicação independente das duas apps na Discloud](docs/DEPLOY_DISCLOUD.md)
- [Dados, conteúdo, licenças e aprovação de perguntas](docs/CONTEUDO_E_LICENCAS.md)
- [Segurança antes de tornar público](docs/SEGURANCA_PUBLICACAO.md)
- [Como retomar e continuar o projeto](docs/RETOMAR_PROJETO.md)
- [Documentação técnica original V20.20.4](docs/referencia-tecnica/00_LEIA_PRIMEIRO.md)
- [Design system e regras visuais](docs/referencia-tecnica/06_DESIGN_SYSTEM_VISUAL.md)
- [Contratos HTTP e Socket.IO](docs/referencia-tecnica/03_CONTRATOS_HTTP_E_SOCKET_IO.md)
- [Guia de reconstrução para IA](docs/referencia-tecnica/10_GUIA_DE_RECONSTRUCAO_PARA_IA.md)
- [Instruções para assistentes de código](AGENTS.md)

## Status e limitações conhecidos

- É uma **fotografia do código V20.20.4**, não uma cópia do banco de produção nem das configurações ativas da Discloud.
- Salas ativas são mantidas **em memória** no portal; reiniciar o processo interrompe salas em andamento. Não pressuponha escalabilidade horizontal.
- O arquivo de origem da Trivia contém **5.247 perguntas** com estados iniciais `pending`/`blocked`/`rejected`; o banco de produção teve aprovações administrativas que **não estão** neste repositório. Um banco novo exige revisão/ativação consciente do acervo antes de jogar.
- Informações de usuários, fotos pessoais, senhas, tokens, `DATABASE_URL` de produção e dumps **não foram incluídos**.
- Dependendo das integrações habilitadas, imagens do Quem Sou Eu? dependem de serviços externos, disponibilidade e credenciais próprias.
- Os pacotes incluem conteúdo de terceiros; **revisar atribuições/licenças antes de publicar como repositório público**. Não foi concedida uma licença livre para o código do portal por este pacote.

## Créditos e dados

O serviço de perguntas usa material derivado do **Open Trivia Database (OpenTDB)**, identificado na versão de origem como **CC BY-SA 4.0**. Mantenha a atribuição, as informações de origem e as condições aplicáveis ao redistribuir o acervo. Imagens de personagens de provedores externos não são automaticamente licenciadas para redistribuição. Veja [docs/CONTEUDO_E_LICENCAS.md](docs/CONTEUDO_E_LICENCAS.md).

---

**Arquivo de preservação para manutenção futura.** A prioridade ao retomar o desenvolvimento é **preservar os três jogos e o design visual compartilhado**, alterando apenas o necessário para a funcionalidade solicitada.
