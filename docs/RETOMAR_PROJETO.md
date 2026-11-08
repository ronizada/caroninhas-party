# Como retomar o Caroninhas Party depois de uma pausa

## Foto do projeto (linha-base)

- **Portal:** V20.20.4, `package.json` version `5.0.20`.
- **Perguntas:** Ronizada Quest API V1.3.0, aplicação Node separada.
- **Três jogos:** Impostor, Quem Sou Eu?, Corrida do Conhecimento.
- **Banco:** PostgreSQL com schema principal `public` e schema separado `trivia`.
- **Frontend:** HTML + CSS + JS puro; CSS de tema rosa/creme; Chakra Petch para estilo retrô legível e Nunito para leitura.
- **Multiplayer:** Socket.IO, salas/lobbies em memória, host, espectador e reconexão.

## Ordem recomendada para quem continuar

1. Ler `README.md`, `AGENTS.md` e `docs/INSTALACAO_LOCAL.md`.
2. Instalar dependências e rodar `npm test` **nos dois serviços**.
3. Criar banco **de desenvolvimento**, executar `npm run db:init` na raiz.
4. Configurar o usuário PostgreSQL restrito da Trivia e executar o serviço em uma porta diferente.
5. Abrir o portal e validar seus três jogos com vários navegadores.
6. Conferir `docs/referencia-tecnica/06_DESIGN_SYSTEM_VISUAL.md` antes de qualquer mudança visual.
7. Alterar somente a modalidade solicitada; evitar mudanças globais sem testes de regressão.
8. Antes de publicar, testar a Corrida com tempo 0/15, categorias, níveis 0–10, desempate e campeão.
9. Publicar **primeiro em app de teste**, com backup da versão funcional, antes de atualizar produção.

## Requisitos visuais que NÃO devem ser perdidos

- Fundo rosa quadriculado e janelas de desktop retrô com barra de título e pontos de janela.
- Superfícies creme, linhas e bordas escuras, sombras duras deslocadas, botões consistentes.
- Chakra Petch + Nunito; números de inputs devem ser legíveis.
- Seleções e checkboxes sem as faixas rosa decorativas que foram rejeitadas.
- Inputs e botões alinhados em altura; não cortar janela ou esconder ações importantes.
- Mesmo sistema de nome/avatar da conta para todas as modalidades.
- Responsividade e rolagem de segurança para telas menores.

## Pontos funcionais a preservar

- **Impostor:** sorteio da palavra, impostor, votos, eliminação, vitória.
- **Quem Sou Eu?:** personagens, imagens e provedores, etapas de revisão e palpites, resultados.
- **Corrida:** categorias múltiplas via tags, dificuldade aleatória/fixa, tempo de 0 a 30 (15 padrão), todos respondendo à mesma pergunta, +1 por acerto, avanço automático, perguntas extras de desempate, tela de campeão e ranking.
- **Contas e salas:** login/visitante, foto de perfil, apelido, sessão, host, prontidão, salas privadas e reconexão.

## Pendências verificáveis em instalação nova

- Não há dump do banco de produção; dados de usuários e históricos não podem ser restaurados só com o GitHub.
- `services/ronizada-quest/data/questions.jsonl` **não tem questões aprovadas**; a curadoria do banco precisa ser reconstituída.
- Fontes externas de imagens podem exigir credenciais e estar sujeitas a limites de terceiros.
- Não há garantia de que o deploy remoto atualmente corresponda exatamente a esta fotografia de código. Comparar antes de publicar modificações.

## Prompt de retomada para outra IA

> Este repositório é a linha-base arquivada do Caroninhas Party V20.20.4 e Ronizada Quest V1.3.0. Leia primeiro README.md, AGENTS.md, docs/RETOMAR_PROJETO.md e os documentos de docs/referencia-tecnica/. Não altere a arquitetura de dois serviços, não exponha credenciais, não reestruture as regras de Impostor/Quem Sou Eu?/Corrida sem solicitação. Preserve o design system rosa/creme, Chakra Petch + Nunito, as telas de conta/avatares e as regras de salas. Faça modificações incrementais com testes e prove que não houve regressão. Nunca use banco de produção para testes.
