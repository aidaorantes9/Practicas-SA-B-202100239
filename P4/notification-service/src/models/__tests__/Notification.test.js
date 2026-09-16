// pruebas del modelo de notificaciones
// mockeamos el modulo db para no necesitar una base de datos real corriendo

jest.mock("../../db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

const { pool } = require("../../db");
const {
  createNotification,
  saveCronSummary,
} = require("../Notification");

beforeEach(() => {
  pool.query.mockClear();
});

describe("createNotification", () => {
  it("crea la notificacion con el estado inicial enviado", async () => {
    const notificacionEsperada = {
      id: 1,
      appointment_id: 5,
      client_id: 10,
      message: "tu cita fue confirmada",
      status: "enviado",
    };
    pool.query.mockResolvedValueOnce({ rows: [notificacionEsperada] });

    const resultado = await createNotification({
      appointmentId: 5,
      clientId: 10,
      message: "tu cita fue confirmada",
    });

    const [queryEnviado] = pool.query.mock.calls[0];
    expect(queryEnviado).toContain("enviado");
    expect(resultado.status).toBe("enviado");
  });
});

describe("saveCronSummary", () => {
  it("serializa el resumen a texto json antes de guardarlo", async () => {
    const resumen = {
      generadoEn: "2026-09-16T10:00:00",
      totalNotificaciones: 3,
    };
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, generado_en: resumen.generadoEn, resumen_json: JSON.stringify(resumen) }],
    });

    await saveCronSummary(resumen);

    // el segundo valor enviado al query debe ser un string json, no el objeto crudo
    const [, valoresEnviados] = pool.query.mock.calls[0];
    const jsonGuardado = valoresEnviados[1];

    expect(typeof jsonGuardado).toBe("string");
    expect(JSON.parse(jsonGuardado)).toEqual(resumen);
  });
});
