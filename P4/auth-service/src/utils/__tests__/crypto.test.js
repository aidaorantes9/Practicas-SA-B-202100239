// pruebas de las funciones de encriptado
// se fijan variables de entorno antes de importar el modulo, porque
// crypto.js las lee una sola vez al cargarse
process.env.AES_SECRET_KEY = "12345678901234567890123456789012"; // 32 caracteres
process.env.HMAC_SECRET_KEY = "clave-de-prueba-hmac";

const { encrypt, decrypt, hashEmail } = require("../crypto");

describe("encrypt y decrypt", () => {
  it("desencripta correctamente lo que fue encriptado", () => {
    const textoOriginal = "alejandra@example.com";
    const encriptado = encrypt(textoOriginal);
    const desencriptado = decrypt(encriptado);
    expect(desencriptado).toBe(textoOriginal);
  });

  it("genera un iv distinto cada vez, por lo que el resultado encriptado no se repite", () => {
    const textoOriginal = "mismo texto";
    const primeraVez = encrypt(textoOriginal);
    const segundaVez = encrypt(textoOriginal);
    expect(primeraVez).not.toBe(segundaVez);
  });
});

describe("hashEmail", () => {
  it("genera el mismo hash para el mismo correo (determinístico)", () => {
    const hash1 = hashEmail("Prueba@Correo.com");
    const hash2 = hashEmail("Prueba@Correo.com");
    expect(hash1).toBe(hash2);
  });

  it("normaliza mayusculas antes de generar el hash", () => {
    const hashMinusculas = hashEmail("prueba@correo.com");
    const hashMayusculas = hashEmail("PRUEBA@CORREO.COM");
    expect(hashMinusculas).toBe(hashMayusculas);
  });
});
