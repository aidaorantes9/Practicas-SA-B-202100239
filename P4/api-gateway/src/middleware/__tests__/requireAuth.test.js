// pruebas del middleware que protege las rutas privadas
// mockeamos fetch para no necesitar que auth-service este corriendo de verdad

process.env.AUTH_SERVICE_URL = "http://auth-service-de-prueba";

const requireAuth = require("../requireAuth");

// helpers para simular req, res y next de express sin levantar un servidor real
function crearReqFalso(cookies = {}) {
  return { cookies, headers: {} };
}

function crearResFalso() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => {
  global.fetch = jest.fn();
});

describe("requireAuth", () => {
  it("responde 401 si no viene la cookie token", async () => {
    const req = crearReqFalso({});
    const res = crearResFalso();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("responde 401 si auth-service dice que el token no es valido", async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ valid: false }),
    });

    const req = crearReqFalso({ token: "token-invalido" });
    const res = crearResFalso();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("agrega x-user-id y x-user-role y llama next cuando el token es valido", async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ valid: true, user: { id: 7, role: "client" } }),
    });

    const req = crearReqFalso({ token: "token-valido" });
    const res = crearResFalso();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(req.headers["x-user-id"]).toBe("7");
    expect(req.headers["x-user-role"]).toBe("client");
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
