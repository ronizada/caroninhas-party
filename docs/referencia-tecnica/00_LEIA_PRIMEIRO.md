# CARONINHAS PARTY — DOCUMENTAÇÃO MESTRA

> **Nota da edição GitHub (2026-11-08):** este documento foi transcrito da documentação da V20.20.4. Os pacotes ZIP `fontes-de-referencia/` foram substituídos pelo **código-fonte disponível diretamente na raiz do repositório** (portal) e em `services/ronizada-quest/` (API). Capturas com identificação de jogadores não foram incluídas por privacidade. Consulte `public/style.css` e `public/index.html` para a especificação visual executável. As informações de produção são históricas, não verificações de operação atual.

## Especificação técnica, de produto e visual, orientada à reconstrução

**Linha-base documental:** pacote `CARONINHAS_PARTY_V20_20_4_REFINAMENTO_VISUAL.zip` e serviço `RONIZADA_QUEST_TRIVIA_API_V1_3_DISCLOUD.zip`, analisados em 24/10/2026.  
**Abrangência:** site, frontend, backend, autenticação, PostgreSQL, salas multiplayer, Impostor, Quem Sou Eu?, Corrida do Conhecimento, API Trivia, estilos, infraestrutura, operação e critérios de réplica.  
**Estado:** documentação da implementação de referência, **não** auditoria conclusiva do ambiente remoto. Comportamentos de servidor/infraestrutura que exigem medição em produção são assinalados como *verificação necessária*.  
**Idioma:** português brasileiro. **Público-alvo:** desenvolvedor pleno/sênior, arquiteto de software, designer de interface, QA e agentes de codificação.

## 1. Como ler e como entregar este material a outra IA

Este pacote foi estruturado para permitir a **reconstrução funcional e visual** usando o código-fonte como fonte máxima de verdade. Leia os documentos na sequência: [01 Arquitetura](01_ARQUITETURA_E_INFRAESTRUTURA.md), [02 Dados](02_BANCO_DADOS_E_PERSISTENCIA.md), [03 Contratos HTTP e sockets](03_CONTRATOS_HTTP_E_SOCKET_IO.md), [04 Jogos](04_REGRAS_E_ESTADOS_DOS_JOGOS.md), [05 Frontend](05_FRONTEND_TELAS_E_COMPONENTES.md), [06 Design system](06_DESIGN_SYSTEM_VISUAL.md), [07 Trivia](07_RONIZADA_QUEST_API.md), [08 Segurança](08_SEGURANCA_E_OPERACAO.md), [09 Testes](09_TESTES_E_CRITERIOS_DE_ACEITE.md), [10 Reconstrução](10_GUIA_DE_RECONSTRUCAO_PARA_IA.md), [11 Inventário verificável](11_INVENTARIO_AUTOGERADO.md). As capturas em `referencias-visuais/` complementam o CSS, mas **não** o substituem.

### Ordem de precedência de fontes
1. Arquivo-fonte da mesma versão (JS, HTML, CSS, SQL) e seus testes.
2. Documentação versionada inclusa nos ZIPs.
3. Referências visuais da versão e telas reais disponíveis.
4. Especificação neste pacote (síntese interpretada do código).
5. Sugestões de melhoria — devem ser explicitamente separadas do que existe.

**Regra fundamental:** uma réplica não deve inventar novas modalidades, botões, efeitos, bibliotecas, rotas, banco, personagens ou fluxos; também não deve eliminar recursos por não serem parte da tela em foco. A meta é equivalência antes de modernização.

## 2. O que é o produto

**Caroninhas Party** é um portal web brasileiro de minijogos multiplayer em tempo real, com identidade visual retrô/desktop, biblioteca de jogos, acesso como visitante ou conta, perfis e avatares, salas por código, salas públicas/privadas, anfitrião, confirmação de presença, reconexão e espectadores. Modalidades ativas desta linha-base:

| Slug | Modalidade | Núcleo da mecânica |
|---|---|---|
| `/impostor` | Impostor | Uma pessoa desconhece a palavra; discussão, votação, eliminações e vitória por lado |
| `/quem-sou-eu` | Quem Sou Eu? | Personagens sorteados ocultos para o próprio participante; revisão entre pares, palpites e classificações |
| `/corrida-do-conhecimento` | Corrida do Conhecimento | Pergunta compartilhada, resposta individual até o prazo, torre 0–10 e desempate |

A rota legada `/quiz-e-caos` redireciona para `/`; não a trate como quarta modalidade ativa.

## 3. Princípios de identidade e consistência

- **Um único site e um único shell visual:** fundo rosa quadriculado, janelas retrô, barra de título com três pontos, bordas grossas escuras, sombra dura deslocada, superfícies creme, botões e rótulos comuns.
- **Biblioteca e jogo compartilham padrões:** cards de seleção, criação/entrada em sala, identidade do jogador, avatares, sala/lobby, status *pronto*, controles de anfitrião, espera, retorno, estados de erro e reconexão.
- **Cada jogo altera somente suas particularidades:** Impostor (palavra/voto), Quem Sou Eu? (personagens/revisão), Corrida (tags/pergunta/cronômetro/torres/desempate/campeão).
- **Não criar tema independente por jogo.** O design escuro originalmente utilizado numa beta da Corrida foi rejeitado; a V20.20.4 usa o tema geral do Caroninhas.
- **Não misturar credenciais:** a chave da Ronizada Quest reside no backend do site, nunca no navegador.

## 4. Distinção entre versão, pacote e deploy

O site apresenta a sequência visual/funcional **V20.20.4** nos arquivos/leituras; o `package.json` do site registra `version: 5.0.20`. Não normalize esses dois identificadores silenciosamente. A API separada registra `version: 1.3.0`. O `discloud.config` incluído no ZIP da V20.20.4 preserva **identificadores de aplicação de TESTE**; o endereço de produção `caroninhas-party.discloud.dev` depende de um manifesto de produção mantido pelo operador. Não copie o manifesto de teste para o aplicativo principal.

## 5. O que este conjunto NÃO contém

- Senhas, cookies de sessão, `DATABASE_URL` real, chaves de API, tokens IGDB/TMDB e banco em produção.
- Exportação integral das tabelas PostgreSQL de produção, de sessões ou de histórico.
- Dump das fotos de perfil armazenadas em `users.profile_image`.
- Garantia de equivalência pixel a pixel em todos os navegadores/resoluções ou da disponibilidade de provedores externos.
- Evidência de orquestrador, cache distribuído, CDN próprio, Docker/Kubernetes, pipeline CI/CD ou observabilidade avançada: **não presumir que existem**.

## 6. Condições de uma reconstrução fiel

A reconstrução precisa reproduzir, no mínimo, a navegação, fluxos de acesso, eventos do multiplayer, os três estados de jogo, banco de dados, progresso/reconexão, busca de imagens do Quem Sou Eu?, acervo e temporização da Trivia, configuração da Corrida por tags, estilo retrô com fontes corretas e responsividade. O acervo exato e as imagens originais requerem os dados/arquivos originais e políticas de licença; uma IA não os recriará fielmente apenas com descrição.

**Glossário curto:** *host/anfitrião* = dono lógico da sala; *playerToken* = identificador local de participação (não substitui sessão autenticada); *sessionSecret* = segredo por admissão na sala, usado na retomada; *round* = rodada; *phase* = estado do processo; *trivia* = API de perguntas e também gameType da Corrida; *finalista* = jogador que alcança 10 e disputa desempate.
