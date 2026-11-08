# Caroninhas Party V20.17 — fotos inteligentes do Quem Sou Eu?

## O que mudou
- A busca foi transferida do navegador para um endpoint do servidor: `GET /api/whoami-image?name=PERSONAGEM`.
- Ordem de consulta por categoria:
  - **Animes e Desenhos:** AniList → Wikipédia (português/inglês).
  - **Cinema e Séries:** TVmaze *somente para personagens com uma série mapeada e nome exato no elenco* → Wikipédia.
  - **Brasil / Famosos:** TMDB (quando configurado, retrato de pessoa) → TVmaze (pessoa) → Wikipédia.
  - **Jogos / História e Cultura:** Wikipédia (ainda sem provedor especializado seguro para retratos individuais).
- Fotos inseridas previamente em `characters.image_url` têm prioridade.
- As buscas conferem correspondência de nomes. A resposta do backend inclui URL da fonte para crédito.
- O site mostra um retrato substituto retrô (SEM FOTO) quando não houver correspondência segura.
- Cache **temporário em memória do servidor** por 6 horas para resultados e 10 minutos para buscas sem resultado, com limite de 500 entradas. Sem coleta massiva.
- Endpoint protegido por limite de requisições por IP.
- `npm run images:report` produz uma tabela com quantos personagens têm foto cadastrada manualmente e quantos dependem de busca sob demanda. **Não usa as APIs externas.**

## Configuração na Discloud
Atualize com o ZIP fornecido. Não inclua ou apague `.env`. Nenhuma migração foi criada nesta versão.

**Opcional:** para ativar a busca de retratos de atores e celebridades no TMDB, adicione **uma** destas variáveis no ambiente do app:

```dotenv
TMDB_READ_ACCESS_TOKEN=SEU_TOKEN_DE_LEITURA_TMDB
# OU
TMDB_API_KEY=SUA_CHAVE_TMDB_V3
```

Credenciais são usadas exclusivamente no servidor (nunca enviadas ao browser). Sem chave, os outros provedores permanecem operacionais.

Também é possível desativar provedores públicos:

```dotenv
WHOAMI_ANILIST_ENABLED=false
WHOAMI_TVMAZE_ENABLED=false
```

## Atribuição e direitos
- TMDB requer atribuição incluindo logo oficial e o texto “This product uses the TMDB API but is not endorsed or certified by TMDB.” O rodapé inclui o texto, link e referência ao logo oficial. Antes de ativar em produção, confirme que o recurso remoto do logo carrega corretamente no navegador e que o uso do site atende à licença aplicável (uso comercial necessita acordo).
- AniList possui restrições para coleta em massa e uso comercial. Este código consulta por personagem apresentado, sem preencher permanentemente o banco com dados da AniList.
- TVmaze requer crédito e respeito à licença CC BY-SA para dados, e as imagens podem ter direitos próprios de terceiros. Usamos links para as imagens originais, sem cópia local.
- Imagens pré-existentes no campo `image_url` precisam ter seus direitos revisados pelo administrador.
- A fonte do retrato é exibida como link ao lado da imagem quando recuperada via API.

## Limitações e próximos passos
- A API do TMDB não é buscador de retratos de personagens fictícios; ela é usada aqui apenas para atores e outras pessoas reais com **nome exato**.
- O TVmaze depende de mapeamentos entre personagem e série; a lista é pequena e extensível em `whoami-images.js`.
- Alguns personagens continuam sem fotos corretas. O fallback é intencional: **não mostra imagem de outra pessoa por semelhança aproximada**.
- O ambiente de geração não consultou os provedores externos em tempo real nem o PostgreSQL da Discloud. Foram executados testes automatizados com respostas simuladas. Verifique com uma partida real depois do deploy.

## Teste rápido
1. Entre no Quem Sou Eu? e inicie uma rodada.
2. Confira personagens de séries (ex.: Walter White), animes (ex.: Naruto) e pessoas reais.
3. Abra o inspetor de rede e confira respostas para `/api/whoami-image?name=...`.
4. Confira a indicação **FONTE** no retrato quando usado algum provedor e o card `SEM FOTO` quando não houver imagem.
5. Opcionalmente execute `npm run images:report` com PostgreSQL configurado.

O Impostor, as salas e o acervo de 1.000 perguntas do antigo Quiz & Caos não foram alterados.
