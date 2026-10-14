require('dotenv').config();

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('Defina DATABASE_URL no arquivo .env para conectar ao Neon.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (error) => {
  console.error('Erro inesperado na conexão com o banco:', error.message);
});

module.exports = pool;
