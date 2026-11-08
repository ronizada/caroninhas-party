# Instalação local — passo a passo

Este roteiro preserva o estado do projeto: **portal V20.20.4** e **Ronizada Quest V1.3**. Os dois processos Node.js usam **um PostgreSQL** compartilhado, porém schemas e permissões diferentes.

## 1. Pré-requisitos

- Node.js **20 ou superior** (recomendado 22), acompanhado de npm.
- PostgreSQL **15 ou superior** instalado e em execução. O exemplo usa 5432.
- Git (opcional para executar; necessário para commits no GitHub).
- Um editor como VS Code; no Windows, use PowerShell.
- Portas locais livres: **8080** (portal), **8081** (API) e **5432** (PostgreSQL).

Comprove a instalação:

```powershell
node --version
npm --version
git --version
psql --version
```

`psql` não é obrigatório se você preferir o Query Tool do pgAdmin para executar o SQL, mas simplifica a configuração.

**Não use senhas ou banco de produção para este procedimento.**

## 2. Preparar o banco principal e instalar o portal

Na raiz do repositório:

```powershell
Copy-Item .env.example .env
npm ci
```

Edite `.env` com a senha e o usuário do PostgreSQL **local**. O exemplo configurado no repositório é:

```dotenv
PORT=8080
AUTO_INIT_DB=false
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=SENHA_LOCAL_REAL
DB_NAME=caroninhas_party_local
TRIVIA_API_URL=http://127.0.0.1:8081
TRIVIA_API_KEY=UMA_CHAVE_DE_SERVICO_ALEATORIA_IGUAL_NOS_DOIS
```

Use sua senha local; não copie este bloco sem editar. `DATABASE_URL` é alternativa a `DB_*`; se definida, será priorizada. Certifique-se de **não** apontar para produção.

```powershell
npm run db:init
```

O script `scripts/init-db.js`:

1. conecta inicialmente ao banco administrativo `postgres`;
2. cria `caroninhas_party_local` se não existir e se o usuário possuir permissão;
3. executa `database/schema.sql` e `database/seed.sql`;
4. imprime contagens iniciais.

Se a conta não puder criar bancos, crie `caroninhas_party_local` manualmente em uma ferramenta PostgreSQL autorizada e execute novamente `npm run db:init`. Ele usa a conexão indicada em `.env`.

> `npm start` também aplica migrações do portal e sincroniza o conteúdo local legado. Executar `db:init` antes da primeira inicialização evita erros de tabelas não existentes. Não altere `AUTO_INIT_DB` para `true` sem saber que banco está configurado.

## 3. Preparar o schema Trivia e o usuário restrito

A API V1.3 **recusa iniciar** com superusuário PostgreSQL, usuário que possa criar no schema `public` ou um usuário que não seja dono de `trivia`.

Para um banco de desenvolvimento **novo**, conecte-se ao banco `caroninhas_party_local` com um usuário administrador:

```powershell
psql -h 127.0.0.1 -p 5432 -U postgres -d caroninhas_party_local
```

Execute **uma vez**, dentro de `psql`:

```sql
CREATE ROLE caroninhas_trivia_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
```

Defina a senha sem expô-la na linha de comando nem no histórico:

```psql
\password caroninhas_trivia_api
```

Em seguida:

```sql
CREATE SCHEMA trivia AUTHORIZATION caroninhas_trivia_api;
GRANT CONNECT ON DATABASE caroninhas_party_local TO caroninhas_trivia_api;
GRANT USAGE, CREATE ON SCHEMA trivia TO caroninhas_trivia_api;
```

No PostgreSQL 15+, o schema `public` normalmente não dá permissão de criação a usuários comuns. Em um banco local criado/migrado de versões antigas, confira isso e ajuste as permissões com cuidado **somente nesse banco de desenvolvimento**; a API verifica o privilégio antes de prosseguir.

Se o usuário ou o schema já existir, **não execute o `CREATE` novamente**; valide proprietário e permissões. Para produção compartilhada, nunca execute mudanças de ownership ou `GRANT` sem revisão. A versão de origem também inclui `services/ronizada-quest/sql/000_PREPARAR_SCHEMA_E_USUARIO.sql`, que exige edição manual de senha e foi concebido para o ambiente original; **não é necessário executá-lo junto com as instruções acima**.

Saia do `psql` com `\q`.

## 4. Configurar a API de perguntas

Abra outro terminal na pasta da API:

```powershell
Set-Location services/ronizada-quest
Copy-Item .env.example .env
npm install
npm run db:check
```

Abra `services/ronizada-quest/.env` (a cópia privada) e ajuste:

```dotenv
PORT=8081
HOST=0.0.0.0
AUTO_IMPORT=if_empty
DATABASE_SSL=false
DATABASE_URL=postgresql://caroninhas_trivia_api:SENHA_LOCAL_ESCAPADA@127.0.0.1:5432/caroninhas_party_local
TRIVIA_API_KEY=CHAVE_DE_SERVICO_ALEATORIA_COM_24_OU_MAIS_CARACTERES
TRIVIA_ADMIN_KEY=OUTRA_CHAVE_ALEATORIA_COM_24_OU_MAIS_CARACTERES
```

**Atenção ao `DATABASE_URL`:** se a senha tiver `@`, `#`, `:` ou outros caracteres reservados, faça a codificação percentual adequada (percent-encoding). Outra opção é conectar-se a um servidor externo usando os campos `DB_*`, mas o código atual exige `DATABASE_URL` ao apontar para localhost.

Você pode gerar cada chave em um terminal **local**, executando o comando duas vezes (não cole os resultados em nenhum chat):

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Cole um resultado no `TRIVIA_API_KEY` **dos dois serviços** e outro resultado somente no `TRIVIA_ADMIN_KEY` da API.

**As duas chaves precisam ser diferentes.** A `TRIVIA_API_KEY` desta pasta deve ser copiada para o `.env` do **portal**, mas a `TRIVIA_ADMIN_KEY` deve permanecer apenas aqui.

Inicie a API:

```powershell
npm start
```

O serviço verificará o usuário restrito, criará/verificará tabelas **somente em `trivia`** e, com `AUTO_IMPORT=if_empty`, importará o acervo uma única vez quando a tabela estiver vazia.

Em outro terminal ou navegador, teste:

```powershell
Invoke-RestMethod http://127.0.0.1:8081/health
```

O resultado esperado inclui `status: ok` e `version: 1.3.0`. Essa verificação prova conectividade com banco, **não** comprova disponibilidade de questões aprovadas.

### O acervo não nasce aprovado

O arquivo `data/questions.jsonl` registra **5.046 pendentes, 106 bloqueadas e 95 rejeitadas**. Uma cópia nova do banco só permite sortear questões quando `review_status='approved'`. A aprovação em lote feita historicamente no ambiente publicado **não é recriada automaticamente** e a revisão factual continua pendente. Antes de jogar localmente, faça a curadoria/ativação consciente de questões pela interface administrativa da API (usando a chave administrativa) ou um processo explícito de revisão. Consulte [Conteúdo e licenças](CONTEUDO_E_LICENCAS.md).

## 5. Iniciar o portal

Com a API aberta em outro terminal, volte à raiz do repositório:

```powershell
Set-Location ../..
npm start
```

Acesse:

- Portal: <http://127.0.0.1:8080>
- API de perguntas: <http://127.0.0.1:8081/health>
- Categorias consumidas pelo portal: <http://127.0.0.1:8080/api/trivia/categories> (depende de `TRIVIA_API_KEY` válida)

Confirme visualmente a biblioteca, criação de sala, avatares e categorias da Corrida. Os outros dois jogos compartilham o mesmo portal e banco, mas não dependem da Ronizada Quest.

## 6. Linux/macOS

Use os mesmos comandos de npm. No lugar de `Copy-Item`, utilize:

```bash
cp .env.example .env
cd services/ronizada-quest
cp .env.example .env
cd ../..
```

A etapa PostgreSQL depende da instalação local. Em instalações que oferecem usuário `postgres` por socket, você pode precisar de privilégios administrativos para executar `psql` na conta correta. Não copie comandos `sudo` cegamente para servidor remoto.

## 7. Testes

Na raiz:

```powershell
npm test
node --check server.js
node --check public/script.js
```

No serviço:

```powershell
Set-Location services/ronizada-quest
npm test
node --check src/server.js
```

Na versão de origem, os testes locais são **60 no portal + 18 na API**. Esses testes não substituem validação integrada com PostgreSQL e dois navegadores em uma sala real.

## 8. Solução de problemas

| Sintoma | Primeiras verificações |
|---|---|
| `node`/`npm` não encontrado | Instalar Node.js e reabrir o terminal; verificar PATH. |
| Banco inacessível | Serviço PostgreSQL, `DB_*`/`DATABASE_URL`, senha, firewall, base existente. |
| Portal falha ao iniciar | Executar `npm run db:init` em banco **de desenvolvimento**; conferir migrações e logs. |
| API recusa usuário de banco | O papel deve ser dono de `trivia`, sem superusuário e sem permissão CREATE em `public`. |
| `TRIVIA_API_KEY` inválida | Mesma chave de serviço no portal e API; a chave administrativa é distinta. |
| `/api/trivia/categories` falha | Primeiro testar `/health` da API e logs dos dois processos. |
| Categorias disponíveis, sem questões jogáveis | `review_status='approved'` ausente no banco local; o acervo de origem vem pendente. |
| `EADDRINUSE` | Porta 8080/8081 já está em uso; altere somente a porta correspondente e `TRIVIA_API_URL`. |
| Arquivos CSS antigos | Limpe o cache do navegador ou use Ctrl+F5. |
| Sala sumiu após reinício | Estado das salas é em memória; comportamento esperado desta versão. |

## 9. Não fazer

- Não copiar o `.env` da aplicação publicada para GitHub ou material compartilhado.
- Não usar o `DATABASE_URL` real da Discloud para testes.
- Não iniciar a Trivia com um PostgreSQL superusuário.
- Não executar SQL de criação do schema no servidor de produção sem antes conferir o proprietário e as permissões.
- Não marcar todas as perguntas como aprovadas silenciosamente: são dados que ainda requerem revisão.
