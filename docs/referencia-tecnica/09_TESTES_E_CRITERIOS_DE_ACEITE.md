# 09 — QA, TESTES DE REGRESSÃO, ACEITAÇÃO E FIDELIDADE

## 1. Objetivo de qualidade

Uma reconstrução aceitável deve provar **equivalência funcional e visual** nos três jogos e no shell comum. Apenas renderizar a home e a tela da Corrida não basta. O pacote do portal declara `npm test` com runner `node --test tests/*.test.js`; os testes atuais incluem `impostor-vote`, família `whoami-*`, `trivia-race`, `trivia-final-screen`, `trivia-visual-refinement`. Testes da Ronizada Quest têm grupos de normalização, bootstrap e rounds V1.3.

**Historicamente** a V20.20.4 passou em 60 testes reportados na conversa do projeto. Esse número não substitui rodar a suíte novamente no ambiente de destino nem comprova testes ponta a ponta remotos. Não prometer disponibilidade de APIs externas por testes unitários.

## 2. Matriz de validação obrigatória

| ID | Área | Etapa | Resultado esperado |
|---|---|---|---|
| A01 | Shell | visitar `/` | biblioteca sem erros e card de três jogos |
| A02 | Navegação | abrir URLs diretas das três modalidades | mesma SPA com tela correta, sem 404 |
| A03 | Perfil | cadastrar conta válida | cookie HttpOnly, perfil exibido com apelido |
| A04 | Perfil | login inválido | 401 e feedback, nenhum cookie novo |
| A05 | Avatar | trocar preset e usar foto cadastrada | imagem consistente em lobby e jogo |
| A06 | Sala | criar sala pública; segundo cliente entrar por código | mesmo código, ambos presentes |
| A07 | Privacidade | sala com senha errada/correta | nega/aceita conforme credencial |
| A08 | Host | membro comum tenta iniciar partida | ação negada |
| A09 | Ready | membro não pronto tenta iniciar | host não consegue iniciar |
| A10 | Reconexão | atualizar aba em partida e retomar dentro da tolerância | identidade conservada, estado readquirido |
| A11 | Abandono | host sai | transferência/encerramento conforme código; nenhum cliente preso |
| I01 | Impostor | iniciar com 2 pessoas | impedido (mínimo 3) |
| I02 | Impostor | iniciar com 3, todos prontos | papéis privados e uma palavra |
| I03 | Impostor | votar em si e votar 2× | ambos impedidos |
| I04 | Impostor | empate na votação | desempate sem perder estado |
| I05 | Impostor | encerrar rodada | vencedor/side correto e histórico pertinente |
| Q01 | Quem Sou Eu? | iniciar com 2+ | inicia revisão, personagens não duplicados |
| Q02 | Quem Sou Eu? | autoavaliar personagem | proibido |
| Q03 | Quem Sou Eu? | todos aprovam / pedem reroll | transição/reroll apenas conforme unanimidade |
| Q04 | Quem Sou Eu? | palpite próximo | não gasta tentativa |
| Q05 | Quem Sou Eu? | três erros | elimina e registra tentativas |
| Q06 | Quem Sou Eu? | `allFinish` ativo | encerra apenas ao fim de todos |
| Q07 | Quem Sou Eu? | falha de imagem externa | fallback sem travar a sala |
| T01 | Corrida | GET `/api/trivia/categories` | retorna categorias e defaults sem chave no navegador |
| T02 | Corrida | tags selecionar/remover/limpar/todas | estado visual e payload de IDs canônicos |
| T03 | Corrida | zero categorias | botão criar desabilitado/erro |
| T04 | Corrida | dificuldade aleatória/fixa | filtro respeitado na questão |
| T05 | Corrida | 15s padrão, 0 e 30 | cronômetro exato e validação 0..30 |
| T06 | Corrida | resposta dupla | primeira aceita; segunda 409 |
| T07 | Corrida | resposta tardia | API responde 410; jogador +0 |
| T08 | Corrida | dois clientes, pergunta única | ambos veem as mesmas opções/roundId |
| T09 | Corrida | todos responderam | encerra imediatamente sem esperar prazo |
| T10 | Corrida | resposta correta | sobe exatamente uma casa |
| T11 | Corrida | erro/ausente | torre não avança |
| T12 | Corrida | rodada resolve | gabarito só após `/finish`, próximo sorteio após 4s |
| T13 | Corrida | empate na chegada a 10 | pergunta extra só finalistas, sem pontuar acima de 10 |
| T14 | Corrida | vitória única | tela de campeão, foto, ranking, rodadas, ação host |
| T15 | Corrida | API de perguntas falha | erro controlado sem pontos falsos |
| D01 | Visual | telas em 1366×768 e 1536×864 | sem botões inacessíveis e alinhamento de controles |
| D02 | Visual | mobile 390×844 | conteúdo acessível, sem corte lateral global |
| D03 | Visual | input tempo | valor “15” nítido, − e + funcionam |
| D04 | Visual | select/checkbox | **sem faixas rosas** residuais |
| D05 | Visual | Código/Senha/Entrar | três controles de **52px de altura externa** na Corrida |
| D06 | Visual | font loading | Chakra Petch + Nunito; sem Pixelify desatualizada |
| D07 | Visual | consistência dos jogos | mesma identidade retro, nenhum painel preto exclusivo |

## 3. Testes de segurança/privacidade

- Testar acesso à `/api/v1/*` sem chave → 401; nunca embutir chave no HTML/JS/resposta pública.
- Login com sessão falsificada não pode renomear perfil de outro usuário.
- Um jogador em sala não pode responder pela identidade de outro através de `playerId` forjado.
- Ações de host são negadas para outros sockets.
- Um espectador não pode alterar votos nem respostas.
- Foto de perfil não deve permitir conteúdo/script inseguro; respeitar MIME/limites implementados.
- Senha da sala e segredo de sessão não devem aparecer em logs/JSON público.

## 4. Testes com conexão real

Usar 2–3 navegadores/abas independentes (perfis de browser separados para evitar compartilhar cookies involuntariamente) e banco de **homologação**. Manter clocks do servidor e do banco coerentes; testar prazo usando registros do PostgreSQL. Validar o modo sem cronômetro separadamente. Atualizações na API podem funcionar enquanto o portal antigo ainda está online; isso não demonstra que a integração do jogo foi validada.

## 5. Validação visual pixel comparativa

1. Capturar screenshots das mesmas rotas/estados no sistema de referência e na cópia, no mesmo browser, zoom **100%** e viewport fixa.
2. Manter escala, devicePixelRatio, fonte carregada e número de jogadores idênticos.
3. Comparar fundo, grid 42px, bordas de 3px, título, altura barra 42px, sombra 8×9px, conteúdo creme, posição dos botões, tags e labels.
4. Checar 1366×768, 1536×864 e 390×844; adicionalmente testar zoom 125% e foco pelo teclado.
5. Medir e corrigir divergências de CSS; não tentar “consertar” com `overflow:hidden` no body se ocultar ações.
6. Repetir screenshot após mudanças em uma regra global (`.retro-button`, `.retro-input-wrap`, fontes), pois afetam **todos os jogos**.

## 6. Checklist para liberação

```text
[ ] Backup da versão publicada disponível e confirmado
[ ] Arquivos fonte e manifestos revisados
[ ] .env presente APENAS no ambiente privado apropriado
[ ] npm ci + npm test executados sem falhas
[ ] Banco/teste separado utilizado para homologação
[ ] Todos os três jogos iniciam e concluem
[ ] Modo espectador/reconexão/host verificados
[ ] Trivia V1.3 health/categories/answers/finish validados
[ ] Teste de atraso (HTTP 410) e duplicata (409) confirmado
[ ] UI desktop e mobile inspecionadas
[ ] Fontes Chakra Petch/Nunito carregadas
[ ] Entrar + inputs com alturas padronizadas; sem faixas rosas
[ ] Tela de campeão testada
[ ] Produção atualizada somente após testes e rollback definido
```

## 7. Escopo não testado automaticamente

A presença de teste automatizado não prova que o banco remoto está íntegro, que URLs de terceiros respondem, que todas as imagens estão corretas, nem que hospedagem irá manter Socket.IO estável para muitos jogadores. Medir carga/latência e auditar acessibilidade/segurança são tarefas extras. Este documento distingue testes históricos de evidência atual.
