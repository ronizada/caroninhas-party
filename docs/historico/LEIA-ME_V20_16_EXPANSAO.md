# Caroninhas Party — expansão Quem Sou Eu? V20.16

## O que foi preparado

- 5 lotes de 144 novos nomes (720 personagens), mais a importação dos lotes 1–2 (288 nomes) que ainda eram apenas propostas.
- Uma migração PostgreSQL `005_whoami_expansion_1008.sql` que adiciona os **1.008** nomes sem apagar os 216 existentes.
- Nova contagem planejada: **1.224** personagens, com **204 por categoria** e **68 de cada dificuldade por categoria**.
- Não há mudança nas regras do Impostor, Quem Sou Eu?, salas, login, estatísticas nem no catálogo de 1.000 perguntas preservado.

## Para atualizar pela Discloud

1. Faça backup do seu banco PostgreSQL antes de qualquer atualização.
2. Envie `CARONINHAS_PARTY_V20_16_EXPANSAO_1224_PARA_DISCLOUD.zip` para atualizar o aplicativo existente.
3. Mantenha as variáveis `DATABASE_URL`, `AUTO_INIT_DB` e a configuração de VLAN já cadastradas; **o ZIP não inclui `.env`**.
4. Na inicialização, `scripts/run-migrations.js` aplica automaticamente o novo arquivo `005_whoami_expansion_1008.sql`, **desde que** a aplicação consiga conectar ao PostgreSQL e execute sua inicialização normal.
5. Confira os logs e as contagens abaixo. Não substitua a senha privada do banco.

## Conferir no PostgreSQL

```sql
SELECT cc.name AS categoria, d.name AS dificuldade, COUNT(*) AS personagens
FROM characters ch
JOIN character_categories cc ON cc.id = ch.category_id
JOIN difficulties d ON d.id = ch.difficulty_id
WHERE ch.active = TRUE
GROUP BY cc.name, d.name
ORDER BY cc.name, d.name;

SELECT COUNT(*) AS personagens_ativos FROM characters WHERE active = TRUE;
SELECT COUNT(*) AS perguntas_preservadas FROM quiz_questions;
SELECT name, applied_at FROM app_migrations
WHERE name = '005_whoami_expansion_1008.sql';
```

Se o PostgreSQL já tiver personagens criados manualmente com os mesmos nomes e categorias, `ON CONFLICT DO NOTHING` preservará os registros existentes. Nessa situação, a contagem final real pode divergir da projeção de 1.224. Duplicatas com grafia diferente também podem existir no banco remoto, que não foi acessado durante a preparação.

## Limites da revisão

A validação automatizada cobre distribuição, unicidade e estrutura. Não constitui revisão factual ou validação da dificuldade de todos os 1.008 nomes. Não foram implementados aliases automáticos: o conteúdo revisado mantém nomes sugeridos e o sistema atual de correção de palpites permanece como estava.
