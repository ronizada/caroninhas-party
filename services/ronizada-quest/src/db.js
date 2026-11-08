require('dotenv').config();
const { Pool } = require('pg');

function makePool() {
  const options = { max: 10, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 };
  if (process.env.DATABASE_URL) options.connectionString = process.env.DATABASE_URL;
  else {
    Object.assign(options, {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'caroninhas_trivia',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD
    });
  }
  if (process.env.DATABASE_SSL === 'true') options.ssl = { rejectUnauthorized: true };
  return new Pool(options);
}

module.exports = { makePool };
