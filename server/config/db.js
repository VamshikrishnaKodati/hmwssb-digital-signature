const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hmwssb',
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  getClient: () => pool.connect(),
};
