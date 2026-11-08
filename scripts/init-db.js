require("dotenv").config();

const { Pool } = require("pg");
const { bootstrapDatabase } = require("./bootstrap-db");

async function bootstrapExistingDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 15000
  });

  try {
    const result = await bootstrapDatabase(pool);

    console.log("Banco remoto preparado com sucesso.");
    console.log(`Categorias: ${result.categories}`);
    console.log(`Dificuldades: ${result.difficulties}`);
    console.log(`Palavras do Impostor: ${result.words}`);
    console.log(`Categorias do Quem Sou Eu: ${result.character_categories}`);
    console.log(`Personagens do Quem Sou Eu: ${result.characters}`);
  } finally {
    await pool.end();
  }
}

async function bootstrapLocalDatabase() {
  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT || 5432);
  const user = process.env.DB_USER || "postgres";
  const password = process.env.DB_PASSWORD || undefined;
  const database = process.env.DB_NAME || "caroninhas_party";

  if (!/^[a-zA-Z0-9_]+$/.test(database)) {
    throw new Error("DB_NAME inválido.");
  }

  const admin = new Pool({
    host,
    port,
    user,
    password,
    database: "postgres"
  });

  try {
    const exists = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [database]
    );

    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${database}"`);
      console.log(`Banco "${database}" criado.`);
    } else {
      console.log(`Banco "${database}" já existe.`);
    }
  } finally {
    await admin.end();
  }

  const pool = new Pool({
    host,
    port,
    user,
    password,
    database
  });

  try {
    const result = await bootstrapDatabase(pool);

    console.log("Banco local preparado com sucesso.");
    console.log(`Categorias: ${result.categories}`);
    console.log(`Dificuldades: ${result.difficulties}`);
    console.log(`Palavras do Impostor: ${result.words}`);
    console.log(`Categorias do Quem Sou Eu: ${result.character_categories}`);
    console.log(`Personagens do Quem Sou Eu: ${result.characters}`);
  } finally {
    await pool.end();
  }
}

async function main() {
  if (process.env.DATABASE_URL) {
    await bootstrapExistingDatabase();
  } else {
    await bootstrapLocalDatabase();
  }
}

main().catch((error) => {
  console.error("Falha ao preparar o banco:", error.message);
  process.exit(1);
});
