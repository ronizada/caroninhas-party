# Configuração por ambiente

## Dois processos, dois `.env`

- `.env` (raiz): configura o **portal Caroninhas Party**.
- `services/ronizada-quest/.env`: configura a **API independente**.
- O `.gitignore` ignora os dois. Faça cópias dos arquivos `.env.example` fornecidos e edite apenas as cópias.

| Portal | Tipo / exemplo local | Observações |
|---|---|---|
| `PORT` | `8080` | Porta HTTP do portal |
| `AUTO_INIT_DB` | `false` | Só `true` se quiser tentar bootstrap na inicialização; `npm run db:init` recomendado na primeira instalação |
| `DATABASE_URL` | URL PostgreSQL completa | Se presente, é priorizada sobre `DB_*` |
| `DB_HOST` | `127.0.0.1` | Host quando não existe `DATABASE_URL` |
| `DB_PORT` | `5432` | Porta do PostgreSQL |
| `DB_USER` | `postgres` local | Em hospedagem, use usuário com privilégios adequados e restritos |
| `DB_PASSWORD` | segredo local | Nunca versionar |
| `DB_NAME` | `caroninhas_party_local` | Nome do banco do portal |
| `TRIVIA_API_URL` | `http://127.0.0.1:8081` | URL base da API acessível **pelo servidor** |
| `TRIVIA_API_KEY` | chave aleatória compartilhada | Usar **a mesma chave** no serviço Trivia |

Provedores opcionais consultados no código de imagens: TMDB, IGDB, AniList, Wikipedia, Wikidata, Commons e TVmaze (variáveis de token quando cabíveis, conforme `whoami-images.js`). Se não configurar tokens específicos, funcionalidades baseadas nesses provedores podem operar com fallback limitado.

| Ronizada Quest | Exemplo local | Observações |
|---|---|---|
| `PORT` | `8081` | Porta HTTP API |
| `HOST` | `0.0.0.0` | Interface de escuta |
| `DATABASE_URL` | conexão como `caroninhas_trivia_api` | Usar em modo localhost com esta versão |
| `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` | alternativa | Conexão sem URL; usuário obrigatoriamente restrito |
| `DATABASE_SSL` | `false` local | `true` se certificado do banco remoto for validável |
| `AUTO_IMPORT` | `if_empty` | `off`, `if_empty` ou `always`; `always` pode alterar/importar dados |
| `TRIVIA_API_KEY` | chave de serviço | Tem de coincidir com a variável do portal |
| `TRIVIA_ADMIN_KEY` | outra chave distinta | Exclusiva da API; não colocar no portal nem no browser |

O código Trivia verifica comprimento mínimo de **24 caracteres** para as chaves e exige que sejam distintas. Gere valores aleatórios usando um gerenciador de segredos. **Não** copie uma senha real para um comando, screenshot ou issue do GitHub.

## Ambiente local versus Discloud

| Aspecto | Local | Discloud |
|---|---|---|
| Servidor principal | Node.js em 8080 | App separado; respeitar a porta fornecida |
| Trivia | Node.js em 8081 | Outro app, p.ex. `ronizada-quest` |
| PostgreSQL | Banco de teste local | Banco configurado na hospedagem, com schemas `public` e `trivia` |
| Rede entre apps | `http://127.0.0.1:8081` | URL da Trivia acessível a partir do backend principal |
| `TRIVIA_API_KEY` | Gerada para teste | Segredo **próprio do ambiente** e igual em ambos os serviços |
| Banco de produção | NÃO acessar | Não é exportado nem alterado por esta versão GitHub |

## Não existem neste pacote

- Valores reais de tokens e senhas.
- Dump do banco de produção e dados de usuários.
- Ficheiros `.env` ou identificadores de aplicações de produção prontos para sobrescrever.
- Certificados e arquivos privados.

Consulte [Segurança de publicação](SEGURANCA_PUBLICACAO.md) e [Instalação local](INSTALACAO_LOCAL.md).
