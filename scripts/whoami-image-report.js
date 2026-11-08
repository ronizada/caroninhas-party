"use strict";
// Relatório do inventário local — NÃO dispara consultas em massa às APIs.
const db = require("../db");
(async () => {
  try {
    const { rows } = await db.query(`
      SELECT cc.name AS categoria, COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE NULLIF(TRIM(ch.image_url), '') IS NOT NULL)::int AS cadastradas,
             COUNT(*) FILTER (WHERE NULLIF(TRIM(ch.image_url), '') IS NULL)::int AS busca_sob_demanda
      FROM characters ch
      JOIN character_categories cc ON cc.id = ch.category_id
      WHERE ch.active = TRUE
      GROUP BY cc.id, cc.name, cc.display_order
      ORDER BY cc.display_order, cc.name
    `);
    console.log("Quem Sou Eu? — situação das URLs cadastradas");
    console.table(rows);
    console.log("'Busca sob demanda' não significa imagem ausente: é resolvida quando o personagem aparece no jogo.");
    console.log("Fontes externas não são consultadas em massa para respeitar limites e licenças.");
  } catch (error) {
    console.error("Erro no relatório:", error.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
