# Diagrama del flujo de telemetría: Práctica 10

Cómo viajan las tres señales (trazas, métricas y registros) desde los servicios hasta Grafana, y cómo las métricas gobiernan el canary. Todo el stack de observabilidad se despliega por GitOps (ArgoCD, repo `P8_GITOPS_202100239`).

**Leyenda:**

| Color | Significado |
|---|---|
| 🟧 Naranja | Servicios instrumentados en el namespace `production` |
| 🟦 Azul | Trazas (OpenTelemetry, OTLP) |
| 🟩 Verde | Métricas (Prometheus) |
| 🟪 Morado | Registros (JSON, Loki) |
| 🟥 Rojo | Decisiones automáticas: alertas y promoción o reversión del canary |
| ⬜ Gris | Visualización y consulta |

```mermaid
flowchart LR
    classDef svc fill:#fde7d0,stroke:#d97706,color:#000
    classDef tr fill:#dbe9fb,stroke:#2563eb,color:#000
    classDef me fill:#dcf5e3,stroke:#16a34a,color:#000
    classDef lo fill:#ece0fb,stroke:#7c3aed,color:#000
    classDef dec fill:#fde2e2,stroke:#c0392b,color:#000
    classDef vis fill:#eeeeee,stroke:#666,color:#000

    GEN["generador-trafico<br/>1 ronda por segundo"]:::svc

    subgraph PROD["namespace production"]
        direction TB
        GW["api-gateway<br/>Express"]:::svc
        AU["auth-service<br/>Express + bcrypt"]:::svc
        AP["appointments-service<br/>Express + GraphQL"]:::svc
        AR["artists-service<br/>(sin instrumentar)"]
        INS["En cada uno de los 3 servicios:<br/>telemetry.js (SDK OpenTelemetry)<br/>metricas.js (prom-client, /metrics)<br/>logger.js (pino JSON + trace_id)"]:::svc
        GW -- "traceparent" --> AU
        GW -- "traceparent" --> AP
        AP -- "traceparent" --> AR
        GW & AU & AP --- INS
    end

    GEN --> GW

    subgraph MON["namespace monitoring"]
        direction TB
        OTC["OTel Collector<br/>receptor OTLP :4318"]:::tr
        TEMPO[("Tempo<br/>trazas")]:::tr
        PROM[("Prometheus<br/>scrape cada 15 s")]:::me
        RULES["PrometheusRule<br/>26 reglas de registro<br/>(SLI, burn rate, presupuesto)<br/>4 alertas multiventana"]:::dec
        ALLOY["Alloy<br/>lee stdout de los pods"]:::lo
        LOKI[("Loki<br/>registros")]:::lo
        GRAF["Grafana<br/>tablero P10 Senales de oro<br/>y Explore"]:::vis
    end

    subgraph ROLL["Argo Rollouts"]
        AT["AnalysisTemplate *-metricas<br/>trafico, 5xx, p95, citas-con-error<br/>solo pods del canary"]:::dec
        RO["Rollout canary<br/>20 % y analisis, 50 % y analisis, 100 %"]:::dec
    end

    INS -- "1. trazas: OTLP/HTTP" --> OTC
    OTC -- "OTLP/gRPC" --> TEMPO
    INS -- "2. metricas: GET /metrics<br/>(ServiceMonitor)" --> PROM
    PROM --> RULES
    INS -- "3. registros: stdout JSON" --> ALLOY
    ALLOY --> LOKI

    RULES -- "alerta con runbook_url" --> GRAF
    PROM --> GRAF
    TEMPO -- "Related logs (trace_id)" --> GRAF
    LOKI -- "trace_id enlaza a Tempo" --> GRAF

    PROM -- "PromQL por<br/>rollouts_pod_template_hash" --> AT
    AT -- "Successful: promover<br/>Failed: abortar" --> RO
    RO -. "cambia la version de" .-> GW
```

## Las tres señales y cómo se correlacionan

| Señal | Origen en el código | Transporte | Almacén | Llave de correlación |
|---|---|---|---|---|
| Trazas | `src/observabilidad/telemetry.js`: SDK de OpenTelemetry con autoinstrumentación (http, express, fetch, pg, graphql, amqplib) | OTLP/HTTP al Collector, OTLP/gRPC a Tempo | Tempo | `trace_id`, propagado entre servicios con la cabecera W3C `traceparent` |
| Métricas | `src/observabilidad/metricas.js`: histograma `http_request_duration_seconds`, contadores `citas_intentos_total` e `inicios_sesion_total` | Prometheus lee `/metrics` cada 15 s (ServiceMonitor) | Prometheus | Etiquetas `app` y `rollouts_pod_template_hash` (versión del pod) |
| Registros | `src/observabilidad/logger.js`: pino en JSON, un `mixin` copia el `trace_id` y el `span_id` del span activo | stdout, Alloy los recoge | Loki | `trace_id` y `span_id`, idénticos a los del span en Tempo |

## Recorrido de un síntoma a su causa

1. **Alerta:** Prometheus evalúa la tasa de quema del SLO y dispara `CitasPresupuestoQuemaRapida`, con su `runbook_url`.
2. **Traza:** en Grafana, Explore con Tempo y TraceQL `{ resource.service.name = "appointments-service" && status = error }`; la traza muestra `api-gateway → auth-service → appointments-service` y el span con error (`Status Message`).
3. **Registro:** el botón **Related logs** del span abre Loki filtrado por ese `trace_id`; el registro JSON trae el campo `error` con la causa.

## Cómo las métricas gobiernan el canary

Cada paso de análisis del Rollout crea un `AnalysisRun` a partir de la plantilla `<servicio>-production-metricas`. Las consultas filtran por `rollouts_pod_template_hash` del pod canary, así que miden **solo la versión candidata**. Se toleran 1 medición mala de 3 (`failureLimit: 1`); dos malas abortan el Rollout y el tráfico vuelve por completo a la versión estable.
