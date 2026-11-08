# Ajuste visual — crédito da fonte

- Miniaturas de personagens no Quem Sou Eu?: não exibem o selo `FONTE`.
- Fotos em prévia ampliada: mantêm o selo com link para a origem.
- Cartas grandes na fase de aprovação: continuam exibindo atribuição.
- Não altera a API de imagens, o PostgreSQL nem outros jogos.

**Base:** V20.18. A renovação automática do token IGDB não está incluída neste pacote.

Para aplicar só o ajuste em uma instalação V20.18, substitua `public/style.css` pelo arquivo do patch.
