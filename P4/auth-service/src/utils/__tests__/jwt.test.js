// pruebas de generacion y verificacion de tokens
process.env.JWT_SECRET = "secreto-de-prueba";
process.env.JWT_EXPIRES_IN_SECONDS = "3600";

const { generateToken, verifyToken } = require("../jwt");

describe("generateToken y verifyToken", () => {
  const usuarioDePrueba = { id: 42, role: "client" };

  it("genera un token que puede ser verificado y contiene los datos correctos", () => {
    const token = generateToken(usuarioDePrueba);
    const payload = verifyToken(token);

    expect(payload.id).toBe(usuarioDePrueba.id);
    expect(payload.role).toBe(usuarioDePrueba.role);
  });

  it("lanza un error si el token es invalido", () => {
    expect(() => verifyToken("token-que-no-es-valido")).toThrow();
  });
});
