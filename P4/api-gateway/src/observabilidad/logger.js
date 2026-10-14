// P10 - registros estructurados en JSON con el identificador de traza de la peticion en curso.
// Desde un registro se llega a su traza (trace_id) y desde una traza a sus registros.
const pino = require("pino");
const { trace } = require("@opentelemetry/api");

const logger = pino({
  base: { service: process.env.OTEL_SERVICE_NAME || "desconocido" },
  messageKey: "message",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (etiqueta) => ({ level: etiqueta }),
  },
  mixin() {
    const span = trace.getActiveSpan();
    if (!span) return {};
    const { traceId, spanId } = span.spanContext();
    return { trace_id: traceId, span_id: spanId };
  },
});

module.exports = logger;
