# Manifesto de preservação — Caroninhas Party

**Data de preparação do pacote GitHub:** 2026-11-08.

| Componente | Fonte validada | Conteúdo |
|---|---|---|
| Portal | `CARONINHAS_PARTY_V20_20_4_REFINAMENTO_VISUAL.zip`, extraído do kit documental V20.20.4 | Código Express, Socket.IO, HTML, CSS, JavaScript, banco, conteúdo local, avatares e testes |
| API | `RONIZADA_QUEST_TRIVIA_API_V1_3_DISCLOUD.zip` | Código Express, migrations do schema `trivia`, dados de origem, rotas e testes |
| Referência | Documentação técnica V20.20.4 entregue anteriormente | Contratos, design system, regras das modalidades e diagramas |

## Alterações feitas **apenas para GitHub**

- `README.md` com instalação, execução, testes e push GitHub.
- `AGENTS.md`, `NOTICE.md`, `SECURITY.md` e documentação adicional em `docs/`.
- Arquivos `.env.example` atualizados para **ambiente local e placeholders**, sem hosts/senhas específicos da produção.
- Manifestos reais `discloud.config` removidos dos exemplos de código GitHub; incluídos modelos `discloud.config.example` com IDs fictícios.
- Histórico de `LEIA-ME_*` movido para `docs/historico/`.
- O serviço Trivia foi colocado em `services/ronizada-quest/` para manter os dois processos independentes.
- CI do GitHub executa testes sem deploy automático.

## Não modificados

O **código JavaScript**, os estilos CSS, HTML, imagens, schemas SQL, migrações, dados e testes do portal e da API foram copiados sem alterações das versões de origem. Os estilos e a interface continuam V20.20.4. Não foram feitas mudanças de regras, pontuação, banco ou autenticação nesta edição.

## Não incluídos

- `.env` reais, tokens, dados pessoais e senhas.
- Banco PostgreSQL de produção e histórico de sessões.
- Manifestos ativos de produção da Discloud.
- Capturas de tela com apelidos de participantes que não são necessárias para a execução.

Os checksums dos arquivos deste pacote constam no arquivo `SHA256SUMS.txt` na raiz. **Esses hashes verificam apenas o pacote arquivado, não a instalação publicada remotamente.**
