// este archivo tiene las funciones de encriptar y desencriptar
// usamos aes 256 cbc para nombre y correo, con un iv distinto cada vez
// el password nunca se encripta con aes, eso usa bcrypt en otro archivo

const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
const SECRET_KEY = process.env.AES_SECRET_KEY; // debe tener 32 caracteres
const HMAC_KEY = process.env.HMAC_SECRET_KEY;

// encripta un texto plano y regresa el iv junto con el texto encriptado
// el iv va pegado adelante separado por dos puntos, asi lo guardamos todo en un solo campo
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

// hace lo contrario de encrypt, separa el iv del texto y desencripta
function decrypt(encryptedText) {
  const [ivHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// genera un hash deterministico del correo con hmac sha256
// esto sirve para poder buscar por correo en el login sin desencriptar toda la tabla
// a diferencia de aes, el mismo correo siempre da el mismo hash
function hashEmail(email) {
  return crypto.createHmac("sha256", HMAC_KEY).update(email.toLowerCase()).digest("hex");
}

module.exports = { encrypt, decrypt, hashEmail };