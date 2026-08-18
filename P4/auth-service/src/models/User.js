// este archivo agrupa todas las consultas sql relacionadas al usuario
// es el equivalente al repository que usamos en la practica 3

const { pool } = require("../db");
const { encrypt, decrypt, hashEmail } = require("../utils/crypto");
const bcrypt = require("bcrypt");

// crea un usuario nuevo, encriptando nombre y correo, y hasheando el password
async function createUser({ name, email, password, role }) {
  const nameEncrypted = encrypt(name);
  const emailEncrypted = encrypt(email);
  const emailHash = hashEmail(email);
  const passwordHash = await bcrypt.hash(password, 10);

  const query = `
    INSERT INTO users (name_encrypted, email_encrypted, email_hash, password_hash, role)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, role, created_at;
  `;

  const values = [nameEncrypted, emailEncrypted, emailHash, passwordHash, role || "client"];
  const result = await pool.query(query, values);
  return result.rows[0];
}

// busca un usuario por su correo, usando el hash para no desencriptar toda la tabla
async function findByEmail(email) {
  const emailHash = hashEmail(email);
  const query = "SELECT * FROM users WHERE email_hash = $1";
  const result = await pool.query(query, [emailHash]);

  if (result.rows.length === 0) return null;

  const user = result.rows[0];
  return user;
}

// busca un usuario por su id, usado por el middleware de autenticacion
async function findById(id) {
  const query = "SELECT * FROM users WHERE id = $1";
  const result = await pool.query(query, [id]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

// arma un objeto seguro para mandar al cliente, sin password ni datos crudos
function toSafeObject(user) {
  return {
    id: user.id,
    name: decrypt(user.name_encrypted),
    email: decrypt(user.email_encrypted),
    role: user.role,
  };
}

module.exports = { createUser, findByEmail, findById, toSafeObject };