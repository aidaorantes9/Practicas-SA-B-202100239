// conexion a postgres y creacion de la tabla notifications
// mismo patron que los demas servicios

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function initDb() {
  const query = `
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      appointment_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      message VARCHAR(500) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'enviado',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cron_summaries (
      id SERIAL PRIMARY KEY,
      generado_en TIMESTAMP NOT NULL,
      resumen_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  let intentos = 0;
  const maxIntentos = 10;

  while (intentos < maxIntentos) {
    try {
      await pool.query(query);
      console.log("notification-service: tabla notifications lista");
      return;
    } catch (error) {
      intentos++;
      console.log(`notification-service: esperando base de datos, intento ${intentos}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  throw new Error("notification-service: no se pudo conectar a la base de datos");
}

module.exports = { pool, initDb };