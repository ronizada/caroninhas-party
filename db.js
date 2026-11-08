require("dotenv").config();

const { Pool } = require("pg");

function createPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000
    });
  }

  return new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || "caroninhas_party",
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000
  });
}

const pool = createPool();

pool.on("error", (error) => {
  console.error("Erro inesperado no PostgreSQL:", error);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function testConnection() {
  await pool.query("SELECT 1");
}

module.exports = {
  pool,
  query,
  testConnection
};
