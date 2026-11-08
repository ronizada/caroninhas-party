# Caroninhas Party V20.15 — Notificações de palpites no Quem Sou Eu?

## O que mudou

- Cada palpite válido é anunciado para **todos os jogadores e espectadores da sala**.
- Notificações no canto superior direito com avatar, nome, palpite digitado, resultado (ACERTOU, QUASE, ERROU) e mensagem contextual.
- No modo **Todos até o fim**, o acerto também mostra a colocação (1º, 2º, ...).
- Desistências também geram aviso público.
- O tempo de cada aviso é **4,6 segundos**, exibido por uma barra regressiva colorida.
- Vários palpites recebidos rapidamente são exibidos **em sequência**, sem substituição imediata.
- Ícones feitos em SVG de pixels (16×16), sem emojis nativos.
- A informação secreta do personagem nunca é enviada no evento de aviso: apenas o palpite público e seu resultado.
- A fila de avisos é limpa ao sair da sala ou voltar ao lobby.

## Arquivos alterados

- `server.js` — evento Socket.IO `whoami-guess-announced`, incluindo o canal dos espectadores.
- `public/index.html` — recipiente dos avisos.
- `public/script.js` — apresentação, fila, timer e liberação da fila.
- `public/style.css` — estilo retrô, ícones e barra de tempo.
- `tests/whoami-handlers.test.js` — testes do envio do aviso.

## Compatibilidade

- Base: V20.14.1, com persistência universal e modo **Todos até o fim**.
- Impostor sem alterações de regras.
- Banco de **1.000 perguntas do antigo Quiz & Caos preservado**.
- Não há migrações novas de banco.
- ZIP completo sem `.env`; manter as variáveis de ambiente da Discloud.

## Teste manual recomendado

1. Abrir uma sala Quem Sou Eu? com dois jogadores.
2. Fazer um palpite incorreto, conferir o mesmo aviso em ambos os navegadores.
3. Fazer um palpite QUASE e depois um correto, conferindo aviso e colocação.
4. Entrar como espectador em uma partida em curso e conferir que também vê novos avisos.
5. Enviar dois palpites de jogadores diferentes quase simultaneamente, conferindo a fila.
6. Testar F5 e saída da sala para confirmar que avisos antigos não continuam aparecendo.

Testes automatizados validam o comportamento lógico; testar os avisos com navegadores reais antes de anunciar a versão como estável em produção.
