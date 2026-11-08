# Caroninhas Party V20.13 — Correção da votação do Impostor

## Problema corrigido
Na V20.12, quando a votação eliminava um inocente, o servidor voltava para a discussão e abria outra votação normal. Isso contrariava a regra de **uma eliminação por partida**.

## Regra implementada
1. O host inicia a **votação normal** após a discussão.
2. Se os maiores votos empatarem, **somente os empatados** fazem a rodada extra de fala e se tornam candidatos no desempate; os jogadores da sala continuam votando.
3. Se o desempate empatar novamente, a etapa de desempate se repete até haver um candidato com mais votos.
4. Assim que um participante é escolhido e eliminado, **a partida termina imediatamente**:
   - Impostor eliminado → **Investigadores venceram!**
   - Inocente eliminado → **O impostor venceu!**
5. Uma nova partida só começa pelo comando de nova rodada após a tela de resultado.

## Arquivos alterados
- `server.js`: resolução da votação e proteção contra emissão duplicada de resultado.
- `tests/impostor-vote.test.js`: testes automatizados de regressão (apenas no pacote completo).

## Validação
- Execute `node --test tests/impostor-vote.test.js` na pasta do projeto.
- Foram testados: votação normal com acerto, votação normal com erro, dois empates consecutivos, desempate que encontra o impostor, votação incompleta e proteção contra resultados duplicados.
- Não houve teste integrado com navegadores e PostgreSQL de produção neste ambiente.

## Atualização na Discloud
- O ZIP completo contém `discloud.config` na raiz.
- **Não inclui `.env`**, nem altera credenciais do banco, a VLAN ou as migrações.
- `database/data/quiz_questions.jsonl` (1.000 perguntas) e os scripts/migrações do acervo permanecem intactos.
- Para alteração mínima em instalação V20.12, substitua somente o `server.js` pelo do patch e reinicie a aplicação.
