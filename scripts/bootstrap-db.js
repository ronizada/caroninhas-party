const fs = require("fs");
const path = require("path");

async function bootstrapDatabase(pool) {
  const schema = fs.readFileSync(
    path.join(__dirname, "..", "database", "schema.sql"),
    "utf8"
  );

  const seed = fs.readFileSync(
    path.join(__dirname, "..", "database", "seed.sql"),
    "utf8"
  );

  await pool.query("BEGIN");

  try {
    await pool.query(schema);
    await pool.query(seed);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => {});
    throw error;
  }

  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM categories WHERE active = TRUE) AS categories,
      (SELECT COUNT(*) FROM difficulties) AS difficulties,
      (SELECT COUNT(*) FROM words WHERE active = TRUE) AS words,
      (SELECT COUNT(*) FROM character_categories WHERE active = TRUE) AS character_categories,
      (SELECT COUNT(*) FROM characters WHERE active = TRUE) AS characters
  `);

  return counts.rows[0];
}

module.exports = {
  bootstrapDatabase
};
