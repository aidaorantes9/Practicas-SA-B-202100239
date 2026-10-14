// P10 - trazas con OpenTelemetry. Se carga ANTES que la app: node -r ./src/observabilidad/telemetry.js
// La autoinstrumentacion cubre http, express, fetch (undici), pg, graphql y amqplib, y propaga
// el contexto entre servicios con la cabecera W3C "traceparent".
// Configuracion por variables de entorno: OTEL_SERVICE_NAME y OTEL_EXPORTER_OTLP_ENDPOINT.
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");

const RUTAS_IGNORADAS = ["/health", "/metrics"];

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": { enabled: false },
      // el trace_id lo agrega nuestro propio logger, asi no se duplica el campo
      "@opentelemetry/instrumentation-pino": { enabled: false },
      "@opentelemetry/instrumentation-http": {
        ignoreIncomingRequestHook: (req) => RUTAS_IGNORADAS.includes(req.url),
      },
    }),
  ],
});

sdk.start();

process.on("SIGTERM", () => {
  sdk.shutdown().finally(() => process.exit(0));
});
