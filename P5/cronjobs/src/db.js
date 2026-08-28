// conexion a la base de datos cronjobs_db, mismo patron que los demas servicios

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: "cronjobs_db",
});

async function initDb() {
  const query = `
    CREATE TABLE IF NOT EXISTS cron_executions (
      id SERIAL PRIMARY KEY,
      executed_at TIMESTAMP NOT NULL,
      carnet VARCHAR(20) NOT NULL
    );
  `;
  await pool.query(query);
}

module.exports = { pool, initDb };