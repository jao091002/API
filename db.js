require('dotenv').config();

const { Pool } = require('pg');

let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('DATABASE_URL não configurada.');
    error.code = 'DATABASE_URL_MISSING';
    throw error;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });
    pool.on('error', (error) => {
      console.error('Erro inesperado na conexão com o banco:', error.message);
    });
  }
  return pool;
}

module.exports = {
  query: (...args) => getPool().query(...args),
  connect: () => getPool().connect(),
  end: async () => { if (pool) await pool.end(); },
};
