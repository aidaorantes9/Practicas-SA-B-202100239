// este archivo maneja la conexion a postgres y crea la tabla si no existe
// no usamos un orm pesado, solo el cliente pg directo para mantenerlo simple

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// crea la tabla users si no existe todavia
// se llama una vez cuando arranca el servicio
async function initDb() {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name_encrypted TEXT NOT NULL,
      email_encrypted TEXT NOT NULL,
      email_hash VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'client',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;

  // reintenta la conexion unas veces por si la base de datos
  // todavia no esta lista cuando el servicio arranca
  let intentos = 0;
  const maxIntentos = 10;

  while (intentos < maxIntentos) {
    try {
      await pool.query(query);
      console.log("auth-service: tabla users lista");
      return;
    } catch (error) {
      intentos++;
      console.log(`auth-service: esperando base de datos, intento ${intentos}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  throw new Error("auth-service: no se pudo conectar a la base de datos");
}

module.exports = { pool, initDb };