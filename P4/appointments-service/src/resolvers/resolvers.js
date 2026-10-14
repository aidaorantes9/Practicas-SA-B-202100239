// aqui van las funciones que responden cada query y mutation
// esta es la logica de negocio real del microservicio de citas

const Appointment = require("../models/Appointment");
const { publishAppointmentCreated } = require("../rabbitmq");
const { citasIntentos } = require("../observabilidad/metricas");
const logger = require("../observabilidad/logger");

const ARTISTS_SERVICE_URL = process.env.ARTISTS_SERVICE_URL;

// P10: un rechazo es una regla del estudio (artista ocupado o inexistente), no una falla del sistema.
// Se cuenta aparte para que no consuma el presupuesto de error del SLO.
class RechazoNegocio extends Error {}

// llamada directa a artists-service, sin pasar por el api gateway
// esto es la conexion que dibujamos en el diagrama de arquitectura
async function checkArtistAvailability(artistId) {
  const url = `${ARTISTS_SERVICE_URL}/internal/artists/${artistId}/availability`;
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

// convierte una fila de la base de datos al formato que espera graphql
function toGraphqlType(row) {
  return {
    id: row.id,
    artistId: row.artist_id,
    clientId: row.client_id,
    date: row.date.toISOString(),
    bodyPart: row.body_part,
    design: row.design,
    durationMinutes: row.duration_minutes,
    status: row.status,
    depositAmount: row.deposit_amount ? parseFloat(row.deposit_amount) : null,
    depositPaid: row.deposit_paid,
  };
}

// logica de crear una cita, sin cambios respecto a P4
async function crearCita(args, context) {
  // el id del cliente logueado viene en un header que puso el api gateway
  // despues de validar el token, asi no repetimos la logica de jwt aqui
  const clientId = parseInt(context.request.headers["x-user-id"], 10);

  if (!clientId) {
    throw new RechazoNegocio("no se encontro el usuario, inicia sesion primero");
  }

  // paso 1: preguntamos directo a artists-service si el artista esta libre
  const disponibilidad = await checkArtistAvailability(args.artistId);

  if (!disponibilidad.found) {
    throw new RechazoNegocio("ese artista no existe");
  }

  if (!disponibilidad.available) {
    throw new RechazoNegocio("ese artista no esta disponible por ahora");
  }

  // paso extra: revisamos si el artista ya tiene otra cita en ese mismo horario
  // esto evita que dos clientes agenden al mismo artista a la misma hora
  const duracion = args.durationMinutes || 60;
  const conflictos = await Appointment.findOverlapping(args.artistId, args.date, duracion);

  if (conflictos.length > 0) {
    throw new RechazoNegocio("ese artista ya tiene una cita agendada en ese horario");
  }

  // paso 2: guardamos la cita en nuestra propia base de datos
  const nuevaCita = await Appointment.createAppointment({
    artistId: args.artistId,
    clientId,
    date: args.date,
    bodyPart: args.bodyPart,
    design: args.design,
    durationMinutes: args.durationMinutes,
  });

  // paso 3: publicamos el evento a rabbitmq, no esperamos a que se procese
  // esto es lo que hace el flujo asincrono, appointments-service no se bloquea
  // esperando a que notification-service termine de armar y enviar el correo
  publishAppointmentCreated(nuevaCita);

  return nuevaCita;
}

const root = {
  // query: trae todas las citas
  appointments: async () => {
    const rows = await Appointment.findAll();
    return rows.map(toGraphqlType);
  },

  // query: trae una cita por id
  appointment: async ({ id }) => {
    const row = await Appointment.findById(id);
    if (!row) return null;
    return toGraphqlType(row);
  },

  // mutation: crea una cita nueva, midiendo el resultado como metrica de negocio
  createAppointment: async (args, context) => {
    try {
      const nuevaCita = await crearCita(args, context);
      citasIntentos.inc({ resultado: "exitosa" });
      logger.info({ cita_id: nuevaCita.id, artist_id: args.artistId }, "cita creada");
      return toGraphqlType(nuevaCita);
    } catch (error) {
      if (error instanceof RechazoNegocio) {
        citasIntentos.inc({ resultado: "rechazada" });
        logger.warn({ artist_id: args.artistId, motivo: error.message }, "cita rechazada");
      } else {
        citasIntentos.inc({ resultado: "error" });
        logger.error({ artist_id: args.artistId, error: error.message }, "error del sistema al crear la cita");
      }
      throw error;
    }
  },

  // mutation: cambia el estado de una cita, ejemplo completada o cancelada
  // no se puede usar esta funcion para poner agendada directamente
  // para eso existe registerDeposit, ya que agendada requiere el anticipo pagado
  updateAppointmentStatus: async ({ id, status }) => {
    if (status === "agendada") {
      throw new Error("una cita solo pasa a agendada pagando el anticipo, usa registerDeposit");
    }

    const actualizada = await Appointment.updateStatus(id, status);
    if (!actualizada) {
      throw new Error("no se encontro esa cita");
    }
    return toGraphqlType(actualizada);
  },

  // mutation: registra el pago del anticipo del cliente
  // en un estudio de tatuajes real, la cita no se confirma solo con agendarla,
  // se confirma hasta que el cliente paga un anticipo de dinero
  registerDeposit: async ({ id, amount }) => {
    const cita = await Appointment.findById(id);

    if (!cita) {
      throw new Error("no se encontro esa cita");
    }

    if (amount <= 0) {
      throw new Error("el monto del anticipo debe ser mayor a cero");
    }

    const actualizada = await Appointment.registerDeposit(id, amount);
    return toGraphqlType(actualizada);
  },
};

module.exports = root;
