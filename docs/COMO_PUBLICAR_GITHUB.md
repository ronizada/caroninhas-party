# Como enviar o projeto para o GitHub (Windows / PowerShell)

Esta etapa serve para **guardar o código**. Ela **não** publica a aplicação na Discloud, não inicia servidores e não envia o banco de dados.

## 1. Criar o repositório

1. Entre no GitHub e crie um repositório **novo e vazio** com um nome como `caroninhas-party`.
2. Recomendo marcar **Private** no início. Você poderá mudar a visibilidade depois de conferir licenças das perguntas/imagens.
3. Na criação, **não** selecione a opção para gerar README, `.gitignore` ou licença automaticamente, pois os arquivos já estão prontos neste pacote.
4. Copie a URL do repositório GitHub, terminada em `.git`.

## 2. Extrair e conferir a pasta

Extraia o ZIP do projeto no PC. A pasta de trabalho deve mostrar diretamente:

```text
README.md
package.json
server.js
public/
database/
services/
docs/
.github/
```

Não faça upload de uma **pasta-mãe extra** se isso fizer o GitHub mostrar somente uma subpasta que contém todo o sistema.

## 3. Verificar os arquivos privados

No terminal PowerShell **na raiz extraída**:

```powershell
node scripts/verificar-github.js
```

O script examina arquivos privados conhecidos, manifestos reais de deploy e arquivos de backup. Ele **não substitui auditoria de segredos**, mas ajuda a detectar erros comuns. Não inclua `.env`, logs e dumps no commit.

## 4. Publicar com Git

```powershell
git init
git add .
git status --short
git commit -m "Preserva Caroninhas Party V20.20.4 e Ronizada Quest V1.3"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

Troque o remoto pelo endereço real. Se o Git pedir autenticação, siga o fluxo de autenticação suportado por sua instalação; **não cole senhas ou tokens no README nem em screenshots**.

Se já tiver um projeto Git nessa pasta, verifique `git remote -v` e o estado antes de editar o remoto.

## 5. Confirmar no GitHub

Verifique se aparecem:

- `README.md` na raiz;
- `server.js`, `public/` e `database/`;
- `services/ronizada-quest/` com `src/`, `sql/`, `data/` e `package.json`;
- `docs/` com a instalação e documentação técnica;
- `.github/workflows/tests.yml` com resultados de testes.

Não devem aparecer: `.env`, `node_modules`, dumps de bancos, `discloud.config` real e segredos.

## 6. Trabalhar depois do arquivo

```powershell
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
Set-Location SEU_REPOSITORIO
Copy-Item .env.example .env
npm ci
```

Para completar a instalação com PostgreSQL e Trivia API, siga [Instalação local](INSTALACAO_LOCAL.md).

## Dúvidas comuns

**Posso subir os arquivos pelo navegador sem Git?** É possível enviar arquivos pela interface do GitHub, mas ela não respeita automaticamente o `.gitignore` do jeito que o cliente Git respeita. **Não recomendo** este método para um projeto com `.env` e arquivos de deploy. Use Git e confira `git status` antes do commit.

**Meu site sai do ar ao fazer push?** Não. Este pacote não contém automação de deploy. O código publicado no GitHub é separado da aplicação em execução na Discloud.

**Vou conseguir restaurar a aplicação inteira?** Você terá código, assets locais, schemas, migrações, testes e documentação. **Não** terá contas/dados de produção, sessões, credenciais ou aprovações de perguntas do PostgreSQL remoto.
