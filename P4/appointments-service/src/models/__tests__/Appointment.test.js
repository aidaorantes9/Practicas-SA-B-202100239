// pruebas de la regla de negocio del anticipo
// mockeamos el modulo db para no necesitar una base de datos real corriendo

jest.mock("../../db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

const { pool } = require("../../db");
const {
  createAppointment,
  registerDeposit,
} = require("../Appointment");

// limpia el historial del mock antes de cada test
// para que mock.calls[0] siempre sea la llamada de ese test especifico
beforeEach(() => {
  pool.query.mockClear();
});

describe("createAppointment", () => {
  it("crea la cita con el estado inicial pendiente_anticipo", async () => {
    const citaEsperada = {
      id: 1,
      artist_id: 5,
      client_id: 10,
      status: "pendiente_anticipo",
    };
    pool.query.mockResolvedValueOnce({ rows: [citaEsperada] });

    const resultado = await createAppointment({
      artistId: 5,
      clientId: 10,
      date: "2026-10-01T10:00:00",
      bodyPart: "brazo",
      design: "flor",
      durationMinutes: 60,
    });

    const [queryEnviado] = pool.query.mock.calls[0];
    expect(queryEnviado).toContain("pendiente_anticipo");
    expect(resultado.status).toBe("pendiente_anticipo");
  });
});

describe("registerDeposit", () => {
  it("cambia el estado a agendada cuando se registra el anticipo", async () => {
    const citaActualizada = {
      id: 1,
      status: "agendada",
      deposit_amount: 200,
      deposit_paid: true,
    };
    pool.query.mockResolvedValueOnce({ rows: [citaActualizada] });

    const resultado = await registerDeposit(1, 200);

    const [queryEnviado] = pool.query.mock.calls[0];
    expect(queryEnviado).toContain("agendada");
    expect(resultado.status).toBe("agendada");
    expect(resultado.deposit_paid).toBe(true);
  });
});
