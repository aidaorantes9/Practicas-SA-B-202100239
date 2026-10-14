// P10 - metricas para Prometheus (endpoint /metrics).
// Senales de oro: latencia, trafico y errores (histograma http) y saturacion (metricas del proceso).
// Metricas de negocio: intentos de agendar citas e inicios de sesion, por resultado.
const client = require("prom-client");
const { context } = require("@opentelemetry/api");
const logger = require("./logger");

const registro = new client.Registry();
client.collectDefaultMetrics({ register: registro });

const duracionHttp = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duracion de las peticiones HTTP atendidas, por metodo, ruta y codigo de respuesta",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registro],
});

// negocio: "rechazada" es una regla del estudio (artista ocupado, inexistente); "error" es una falla del sistema
const citasIntentos = new client.Counter({
  name: "citas_intentos_total",
  help: "Intentos de agendar una cita, por resultado: exitosa, rechazada o error",
  labelNames: ["resultado"],
  registers: [registro],
});

const iniciosSesion = new client.Counter({
  name: "inicios_sesion_total",
  help: "Intentos de inicio de sesion, por resultado: exitoso, credenciales_invalidas o error",
  labelNames: ["resultado"],
  registers: [registro],
});

const RUTAS_IGNORADAS = ["/health", "/metrics"];

// mide cada peticion y deja un registro JSON con su traza
function middlewareMetricas(req, res, next) {
  if (RUTAS_IGNORADAS.includes(req.path)) return next();
  const ctx = context.active();
  const fin = duracionHttp.startTimer({ method: req.method });
  const inicio = Date.now();
  res.on("finish", () => {
    const route = req.baseUrl + (req.route ? req.route.path : "") || "sin_ruta";
    fin({ route, status_code: res.statusCode });
    context.with(ctx, () => {
      const nivel = res.statusCode >= 500 ? "error" : "info";
      logger[nivel](
        { method: req.method, route, status_code: res.statusCode, duracion_ms: Date.now() - inicio },
        "peticion http"
      );
    });
  });
  next();
}

async function endpointMetricas(req, res) {
  res.set("Content-Type", registro.contentType);
  res.end(await registro.metrics());
}

module.exports = { registro, middlewareMetricas, endpointMetricas, citasIntentos, iniciosSesion };
