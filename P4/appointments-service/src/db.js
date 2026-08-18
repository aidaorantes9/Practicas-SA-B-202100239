// conexion a postgres y creacion de la tabla appointments
// mismo patron que usamos en auth-service

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
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      artist_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      date TIMESTAMP NOT NULL,
      body_part VARCHAR(100) NOT NULL,
      design VARCHAR(255),
      duration_minutes INTEGER DEFAULT 60,
      status VARCHAR(50) NOT NULL DEFAULT 'pendiente_anticipo',
      deposit_amount DECIMAL,
      deposit_paid BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN NOT NULL DEFAULT false;
  `;

  let intentos = 0;
  const maxIntentos = 10;

  while (intentos < maxIntentos) {
    try {
      await pool.query(query);
      console.log("appointments-service: tabla appointments lista");
      return;
    } catch (error) {
      intentos++;
      console.log(`appointments-service: esperando base de datos, intento ${intentos}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  throw new Error("appointments-service: no se pudo conectar a la base de datos");
}

module.exports = { pool, initDb };