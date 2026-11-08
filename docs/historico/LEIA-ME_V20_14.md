# Caroninhas Party V20.14 — Todos até o fim e preferências universais

Base: V20.13. Impostor e banco de perguntas preservados.

## Quem Sou Eu? — novo modo

Na criação da sala, nova caixa de seleção **🏁 Todos até o fim**, desmarcada por padrão.

- **Desmarcada:** comportamento original. O primeiro acerto encerra a partida e mostra o vencedor como antes.
- **Marcada:** o primeiro acerto é **1º lugar**, o segundo **2º**, etc.; a partida continua até que todos tenham acertado, desistido, esgotado 3 tentativas ou abandonado.
- Ao acertar, o jogador deixa de palpitar, revela o próprio personagem, acompanha a partida e aparece no placar parcial.
- A tela final apresenta as colocações por ordem de acerto, desistentes, jogadores sem tentativas e abandonos.
- **Estatísticas:** só o primeiro colocado ganha a vitória. Acertos de todos os participantes são registrados (`match_players.role = 'acertou'`). O perfil ganhou o contador **Acertos**, incluindo vitórias clássicas antigas.
- Desistência preserva a quantidade real de tentativas gastas; não é contabilizada como três erros.
- A desconexão permite **30 segundos** para retomar a sessão normalmente. Depois, quem ainda estava tentando vira **ABANDONOU** e deixa de impedir o encerramento. Quem já acertou permanece classificado, mesmo se sair da sala.
- A lista original de participantes é mantida no registro da rodada para exibir corretamente desistentes e abandonos na tela final e gravar seus resultados.

## Preferências universais de sala

- As configurações da última sala **criada com sucesso** são recuperadas automaticamente para a próxima criação daquele jogo.
- Por enquanto, Impostor e Quem Sou Eu? guardam categoria, dificuldade e indicador de sala privada; Quem Sou Eu? também guarda o novo modo.
- Usuários autenticados: salvas por usuário/jogo no PostgreSQL. Visitantes: salvas no `localStorage` do navegador.
- O módulo de preferências é genérico: jogos futuros podem cadastrar seus próprios campos sem criar outra tabela.
- **Segurança:** senha de sala **não é salva**. A caixa *Sala privada?* pode ser restaurada, mas será necessário definir uma nova senha ao criar outra sala privada.
- Preferências de um jogo não substituem as do outro. Entrar em sala criada por outra pessoa não sobrescreve as escolhas de anfitrião.

## Banco de dados e migração

Nova migração automática: `database/migrations/004_game_preferences.sql`, criando `user_game_preferences` (user_id, game_type, settings, updated_at).

A nova tabela é **aditiva**: mantém usuários, salas temporárias da aplicação, histórico e as **1.000 perguntas** do acervo preservado. Nenhum comando de remoção de tabelas ou dados é incluído.

Para subir na Discloud, use `CARONINHAS_PARTY_V20_14_PARA_DISCLOUD.zip` com arquivos diretamente na raiz. Não contém `.env`. Mantenha a configuração privada existente do PostgreSQL e VLAN.

## Validação

- `node --check server.js`, `auth.js`, `public/script.js` aprovados.
- `node --test tests/*.test.js`: 15 testes aprovados (Impostor e Quem Sou Eu?).
- Confirmação de IDs de interface sem duplicação.
- **Ainda é necessário** realizar teste real com PostgreSQL e 2–4 navegadores, especialmente F5 durante a partida e retorno depois do prazo de 30 s.
