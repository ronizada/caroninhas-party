# Integração planejada — Corrida do Conhecimento V20.20

A V1.3 é SOMENTE a API. A V20.19 do Caroninhas Party permanece intacta.

1. Adicionar `TRIVIA_API_URL` e `TRIVIA_API_KEY` apenas no **backend** do Caroninhas Party.
2. Host escolhe 15 segundos por padrão, ou duração 0–30 (0=sem cronômetro) na **tela de criação da sala**.
3. Backend do jogo cria uma rodada com roomId único via `POST /api/v1/rounds`.
4. Compartilha por Socket.IO o **mesmo** enunciado, alternativas e `expiresAt` para todos, **sem chave/gabarito**.
5. Ao jogador escolher, o backend valida sua identidade e envia `POST /api/v1/rounds/:id/answers` com identificador estável e opção A–D. Retorno `201` confirma; `409` duplicado/encerrado; `410` expirado.
6. Quando todos responderem ou o cronômetro acabar, o backend do jogo chama `POST /api/v1/rounds/:id/finish` com `{}`. **Não** passa `answers` nesse endpoint.
7. A API retorna apenas as respostas que foram registradas no prazo. O servidor do jogo avança **uma casa** para cada acerto, nenhum avanço para erros/ausências; fim na casa 10. Empates serão tratados no jogo.
8. Não confiar nos tempos do navegador; somente timestamps da API/DB valem para encerrar.

A chave do serviço deve permanecer secreta no servidor, nunca em React/HTML, e usuários não devem poder passar `playerId` de terceiros sem validação pelo backend.
