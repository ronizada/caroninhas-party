# Caroninhas Party V20.18 — Buscador de imagens melhorado

## Alterações realizadas

Mantidas todas as funcionalidades anteriores. Não modifica o banco de personagens nem o antigo acervo das 1.000 perguntas.

- **Cinema e séries:** TVmaze ganhou mapeamentos para Sydney Adamu e outros personagens de *The Bear*, além de *The Last of Us*. Quando a ficha do personagem não possui foto própria, utiliza foto do ator somente após correspondência exata com o personagem no elenco. Para o filme *Tár*, usa a API do TMDB (já habilitada no seu `.env`) para confirmar o papel "Lydia Tár" na lista de créditos, e então pode mostrar **foto da atriz** (não um retrato oficial da personagem em cena).
- **História, cultura e Brasil:** se a Wikipédia não tiver miniatura, usa o Wikidata para identificar a pessoa, examina o campo `P18` e consulta o Wikimedia Commons para obter miniatura e referência da fonte. Rejeita homônimos quando o resultado é ambíguo; há identificação explícita para Sócrates e Franklin D. Roosevelt. Só aceita imagens com metadados indicando licenças de domínio público/Creative Commons compatíveis, ainda sujeitas à verificação dos créditos/condições da obra.
- **Jogos:** integração **opcional** com a API de personagens da IGDB (não busca capa do jogo no lugar de personagem). Faz pesquisa pelo nome, exige correspondência exata e usa `mug_shot`. **Precisa de credenciais Twitch/IGDB próprias** para funcionar; sem elas, mantém o fallback atual da Wikipédia. A licença da API não significa que todos os retratos de personagens estejam liberados para qualquer utilização; verifique os direitos.
- **Cache:** buscas sem imagem voltam a poder ser tentadas após 90 segundos (antes eram 10 minutos no servidor e indefinidas no navegador), sem repetir consultas idênticas durante esse período.
- **Segurança:** tokens permanecem apenas no servidor e os domínios de imagem fornecidos pelos provedores continuam restritos a uma lista aprovada.

## Variáveis de ambiente na Discloud

**TMDB já configurado:** mantenha `TMDB_READ_ACCESS_TOKEN` como está. Não precisa modificar para aproveitar as melhorias de cinema.

**IGDB (opcional):** cadastre uma aplicação Twitch, obtenha o `Client ID` e um token de acesso de aplicação válido, depois adicione ao `.env` do app:

```dotenv
IGDB_CLIENT_ID=SEU_CLIENT_ID
IGDB_ACCESS_TOKEN=SEU_TOKEN_TWITCH_VALIDO
```

O token Twitch expira e precisará ser renovado. Esta versão não implementa renovação automática. Sem essas variáveis, o site continua funcionando, mas a cobertura de personagens de jogos ainda será limitada.

Desabilitar fontes, se desejar:

```dotenv
WHOAMI_WIKIDATA_ENABLED=false
WHOAMI_IGDB_ENABLED=false
WHOAMI_TVMAZE_ENABLED=false
WHOAMI_ANILIST_ENABLED=false
```

## Testar após atualizar a Discloud

O endpoint continua: `https://caroninhas-party.discloud.dev/api/whoami-image?name=...`

Consultas de diagnóstico sugeridas (nomes devem estar ativos no banco):

- `?name=Sydney%20Adamu` → tentar TVmaze
- `?name=Lydia%20T%C3%A1r` → tentar TMDB (foto da atriz da personagem)
- `?name=S%C3%B3crates` → Wikipédia ou, se a página não tiver foto, Wikidata/Commons
- `?name=Gengar` → IGDB quando houver credenciais, ou Wikipédia/fallback

**Os resultados variam conforme a disponibilidade e as licenças das imagens.** Uma fonte pode não encontrar foto. O fallback `SEM FOTO` continua sendo a escolha segura quando não existe uma correspondência adequada.

## Verificações

- Testes automatizados: cenários de correspondência exata, prioridade, fallbacks, cache, credenciais e respostas simuladas das APIs.
- Sem consultas massivas às APIs: a busca continua sendo sob demanda, apenas para personagens exibidos.
- **Não foi possível confirmar cobertura real** dos 1.224 personagens; é necessário testar as APIs a partir da Discloud.
- Não são enviados ao navegador tokens da TMDB ou IGDB.
- Qualquer fonte externa pode conter imagens com direitos autorais; créditos e permissão de uso ainda precisam ser conferidos, especialmente para jogos.

Arquivos modificados: `whoami-images.js`, `public/script.js`, `package.json`, `package-lock.json`, documentação. Novos testes em `tests/whoami-image-improvements.test.js`. Não há migrações novas.
