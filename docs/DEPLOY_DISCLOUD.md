# Publicação na Discloud — dois aplicativos independentes

**Este repositório foi preparado para preservar o código e publicar no GitHub, não para atualizar produção automaticamente.** Os pacotes de deploy devem ser montados **separadamente**, respeitando as variáveis privadas e os identificadores de cada app.

## Topologia esperada

```text
Navegador
   │ HTTPS + Socket.IO
   ▼
Caroninhas Party — servidor Express/Socket.IO
   │ SQL (schema public)                 ┌───────────────────────┐
   ├────────────────────────────────────►│ PostgreSQL (1 banco) │
   │                                    └──────────▲────────────┘
   │ HTTPS + x-api-key                            │ SQL (schema trivia)
   ▼                                              │
Ronizada Quest — servidor Express ─────────────────┘
```

**Não envie a pasta `services/ronizada-quest` como parte da raiz de execução do portal na Discloud.** O projeto GitHub pode ser monorrepositório, mas as duas aplicações têm servidores e arquivos `discloud.config` diferentes.

## Identificadores e cuidados

Na implantação histórica, o portal principal era `caroninhas-party`, a API era `ronizada-quest` e havia uma versão de testes `caroninhas-party-v2020-test`. **Esses nomes são referência histórica**, não confirmação da configuração atual da sua conta.

Neste repositório, os arquivos `discloud.config.example` são intencionalmente **modelos não operacionais**. Devem ser copiados para `discloud.config` e configurados com os identificadores corretos **somente na cópia local de deploy**.

### Portal

Use o modelo da raiz:

```text
NAME=Caroninhas Party - Teste
TYPE=site
MAIN=server.js
START=npm start
RAM=512
VERSION=latest
AUTORESTART=true
ID=SEU_APP_DE_TESTE
VLAN=true
HOSTNAME=SEU_HOSTNAME_DE_TESTE
```

Altere `ID` e `HOSTNAME` para a aplicação que você **pretende** atualizar. Não utilize o `ID` de produção só para experimentar uma versão. Mantenha `package.json` e `server.js` no nível principal do ZIP de deploy.

### API de perguntas

Use `services/ronizada-quest/discloud.config.example` como ponto de partida. Identificador **diferente** do portal, `MAIN=index.js`, `START=npm start`, `VLAN=true` quando necessário para banco privado.

## Preparar o portal para deploy

1. Crie uma **cópia temporária** da raiz do projeto sem `.git`, `.github`, `docs`, `node_modules` nem `services`.
2. A cópia deve conter `server.js`, `auth.js`, `db.js`, `trivia-race.js`, `whoami-images.js`, `public/`, `database/`, `scripts/`, `package.json` e `package-lock.json` (e arquivos pertinentes de configuração), preservando a estrutura relativa.
3. Crie o `discloud.config` real nessa cópia, com o identificador correto. **Não** commite esse manifesto se ele contiver identificadores privados ou parâmetros específicos de produção.
4. Configure as variáveis privadas pelo mecanismo disponível em sua hospedagem; caso sua modalidade de deploy exija `.env` no ZIP, adicione-o **somente à cópia privada de deploy**, nunca à pasta GitHub. Confirme o nome exato da aplicação antes de enviar.
5. Compacte o **conteúdo da pasta de deploy**, com `discloud.config` na raiz do ZIP.
6. Guarde um backup da versão online e do banco antes de atualizar.
7. Envie **somente** ao aplicativo pretendido, confira logs e teste navegação/Socket.IO.

O portal usa PostgreSQL na inicialização e pode aplicar migrações automaticamente: tenha especial atenção à conexão real do `.env`. Não execute `npm run db:init` contra produção sem revisão.

## Preparar a Ronizada Quest para deploy

1. Crie uma cópia temporária de **apenas** `services/ronizada-quest/`.
2. Mantenha `index.js`, `src/`, `sql/`, `scripts/`, `data/`, `package.json` e arquivos pertinentes.
3. Crie `discloud.config` nessa cópia, com ID próprio de API.
4. Configure chave de serviço, chave de administração e conexão PostgreSQL **restrita ao schema `trivia`**.
5. No painel, habilite a rede privada/VLAN se o host do PostgreSQL exigir.
6. Gere ZIP com os arquivos da API **na raiz** e publique somente no aplicativo da API.
7. Confira `GET /health`: deve indicar a versão `1.3.0` e conectividade de banco. Teste uma rodada com prazo sem enviar chaves no browser.

## Como verificar a comunicação

1. `/health` da Ronizada Quest precisa retornar `status: ok`.
2. `/api/trivia/categories` do portal deve trazer categorias sem mostrar `TRIVIA_API_KEY` para o navegador.
3. No portal, teste uma sala da Corrida com dois navegadores, respostas, prazo e classificação.
4. Teste **Impostor** e **Quem Sou Eu?** após qualquer alteração do portal.
5. Atualize CSS/JS no navegador com Ctrl+F5 se houver cache de versão anterior.

## Rollback

- Guarde o ZIP funcional do **portal** e o ZIP funcional da **API** de forma separada.
- Reversão de arquivos **não reverte banco**; migrações e dados exigem planejamento próprio, backup e eventualmente restauração controlada.
- O `discloud.config` do portal e o da API **nunca** devem compartilhar o mesmo ID.
- Não restaure um dump antigo de produção sem avaliar efeitos em contas, sessões e histórico.

## GitHub Actions

`.github/workflows/tests.yml` executa testes **sem deploy** e não requer `.env` nem chaves reais. Para automatizar publicações futuras, crie workflow separado com revisão explícita, segredos do GitHub Actions e proteção de ambiente. **Nenhum token de Discloud é incluído aqui.**
