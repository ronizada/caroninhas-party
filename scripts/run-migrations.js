const fs = require("fs");
const path = require("path");

async function runMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const dir = path.join(__dirname, "..", "database", "migrations");
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const applied = await pool.query("SELECT name FROM app_migrations");
  const appliedNames = new Set(applied.rows.map((row) => row.name));
  const executed = [];

  for (const file of files) {
    if (appliedNames.has(file)) continue;

    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO app_migrations (name) VALUES ($1)",
        [file]
      );
      await client.query("COMMIT");
      executed.push(file);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  return executed;
}

module.exports = { runMigrations };
