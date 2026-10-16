# Práctica 10: Observabilidad y operación

**Alejandra, carné 202100239, Sección B.** Software Avanzado, Segundo Semestre 2026.

El estudio de tatuajes de las prácticas anteriores ahora se observa con las tres señales: **trazas** (OpenTelemetry y Tempo), **métricas** (Prometheus) y **registros** JSON con `trace_id` (Loki). Dos SLO con reglas de registro y alertas por tasa de quema vigilan la experiencia del cliente, y el canary de Argo Rollouts se promueve o se revierte según las métricas de Prometheus de la versión candidata. Todo el stack se despliega por GitOps.

## Tabla de la entrega

| Elemento | Valor |
|---|---|
| Repositorio de código | https://github.com/aidaorantes9/Practicas-SA-B-202100239 |
| Repositorio GitOps | https://github.com/aidaorantes9/P8_GITOPS_202100239 |
| Servicios instrumentados y namespace | `api-gateway`, `auth-service` y `appointments-service`, en el namespace `production`. El stack de observabilidad vive en `monitoring` |
| AnalysisTemplate (nombre y ruta) | `appointments-service-production-metricas` (y las equivalentes `api-gateway-production-metricas` y `auth-service-production-metricas`). Plantilla: `P5/charts/sa-platform/charts/<servicio>/templates/analysistemplate.yaml` del repo de código |
| Consultas PromQL del análisis | **trafico-canary:** `sum(rate(http_request_duration_seconds_count{app="appointments-service",rollouts_pod_template_hash="{{args.canary-hash}}"}[2m])) or vector(0)` ≥ 0,05<br>**tasa-de-error:** 5xx del canary / total del canary ≤ 0,05<br>**latencia-p95:** `histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{...canary...}[2m])))` ≤ 0,5 s (1 s en auth)<br>**citas-con-error:** `citas_intentos_total{resultado="error"}` / (`exitosa` + `error`) del canary ≤ 0,05 |
| SLO (objetivo y ventana) | **Agendar cita sin error del sistema:** 99 %, 7 días<br>**Latencia del gateway < 0,5 s:** 95 %, 7 días |
| Ruta del PrometheusRule | `observabilidad/slo-reglas.yaml` del repo GitOps (`PrometheusRule` `slo-estudio-tatuajes`, namespace `monitoring`) |
| Ruta del JSON del tablero | `P10/tablero/tablero-senales-de-oro.json` (fuente: `P10/tablero/generar-tablero.py`). En GitOps: `observabilidad/tablero-senales-de-oro.json`, cargado como ConfigMap por Kustomize |
| AnalysisRun fallido y Rollout | `appointments-service-production-cd744f5ff-3-1` del Rollout `appointments-service-production`: `v0.1.8` abortada por `citas-con-error` (2 mediciones con valor 1 > `failureLimit: 1`). Evidencia: `P10/evidencias/analysisrun-fallido-v018.txt` |
| Recorrido síntoma a causa (ruta y tiempo) | Alerta `CitasPresupuestoQuemaRapida` en Prometheus → traza en Tempo (span `graphql.resolve createAppointment`, `Channel closed`) → **Related logs** en Loki por `trace_id`. Tiempo: PENDIENTE. Detalle en el [informe](docs/informe-operacion.md#4-recorrido-hasta-la-causa) |
| Video (URL y minutaje) | PENDIENTE |

## Documentos

| Documento | Contenido |
|---|---|
| [Informe de operación](docs/informe-operacion.md) | Los 6 campos: SLO, fallo inducido, detección, recorrido, recuperación y alertas faltantes o sobrantes |
| [Diagrama del flujo de telemetría](docs/diagrama-telemetria.md) | Cómo viajan trazas, métricas y registros, y cómo Prometheus gobierna el canary ([PNG](docs/diagrama-telemetria.png)) |
| Runbooks | [CitasPresupuestoQuemaRapida](runbooks/CitasPresupuestoQuemaRapida.md), [CitasPresupuestoQuemaLenta](runbooks/CitasPresupuestoQuemaLenta.md), [GatewayLatenciaQuemaRapida](runbooks/GatewayLatenciaQuemaRapida.md), [GatewayLatenciaQuemaLenta](runbooks/GatewayLatenciaQuemaLenta.md) |
| [Tablero](tablero/tablero-senales-de-oro.json) | `P10 Senales de oro`: SLO y presupuesto, latencia, tráfico, errores, saturación, negocio y registros con error |

## Qué se instrumentó

| Pieza | Dónde | Qué hace |
|---|---|---|
| Trazas | `P4/<servicio>/src/observabilidad/telemetry.js` | SDK de OpenTelemetry cargado con `node -r` antes de la app. Autoinstrumenta http, express, fetch, pg, graphql y amqplib, y propaga el contexto con la cabecera W3C `traceparent`. Exporta por OTLP/HTTP al Collector |
| Métricas | `P4/<servicio>/src/observabilidad/metricas.js` | `/metrics` con prom-client: histograma `http_request_duration_seconds` (método, ruta, código), métricas del proceso y dos de negocio: `citas_intentos_total{resultado}` (exitosa, rechazada, error) e `inicios_sesion_total{resultado}` |
| Registros | `P4/<servicio>/src/observabilidad/logger.js` | pino en JSON; un `mixin` agrega `trace_id` y `span_id` del span activo a cada línea |
| Stack | Repo GitOps, `argocd/plataforma-*.yaml` | kube-prometheus-stack (Prometheus, Grafana), Loki, Tempo, OpenTelemetry Collector y Alloy, todos como Applications de ArgoCD |
| Recolección | `P5/charts/sa-platform/charts/<servicio>/templates/servicemonitor.yaml` | ServiceMonitor que copia la etiqueta `rollouts_pod_template_hash`, para distinguir el canary de la versión estable |
| Tráfico real | `trafico/generador-trafico.yaml` del repo GitOps | Simula clientes: consulta el catálogo, agenda citas (algunas chocan y se rechazan) y a veces se equivoca de contraseña |

## Incidentes reales encontrados durante la práctica

| Incidente | Cómo se detectó | Causa raíz | Corrección |
|---|---|---|---|
| El gateway devolvía 500 a los 5 s | El canary de `v0.1.7` no se promovía: `trafico-canary` = 0 | Las URLs internas apuntaban a `sa-p8-*`, pero en GitOps los Services se llaman `*-production` (`EAI_AGAIN`) | Valor `serviciosSufijo` en el chart |
| Citas con `Channel closed` (14/10, 15:11 y 15:36) | Tablero, fila Negocio, y alerta `CitasPresupuestoQuemaRapida` | Cada commit al repo de código hacía que el chart de Bitnami generara un erlang cookie nuevo y RabbitMQ se reiniciaba; appointments no se reconecta | `ignoreDifferences` y `RespectIgnoreDifferences=true` en `infra-production` |
| Canary de auth abortado sin cambios en el código | AnalysisRun con `latencia-p95` = 0,56 y 0,69 s | El login calcula bcrypt (p95 de 0,95 s); el umbral común de 0,5 s no aplica a auth | Umbral propio de 1 s en `apps/auth-service/values-production.yaml` |
| Grafana y Tempo con `OOMKilled` | Reinicios de los pods durante las consultas | Límites de 384 Mi y 512 Mi | 768 Mi y 1,5 Gi |

## Datos para `verificar_p10.sh`

| Variable | Valor |
|---|---|
| `CARNET` | `202100239` |
| `REPO_CODE` | `https://github.com/aidaorantes9/Practicas-SA-B-202100239` |
| `REPO_GITOPS` | `https://github.com/aidaorantes9/P8_GITOPS_202100239` |
| `NS` / `NS_OBS` | `production` / `monitoring` |
| `ROLLOUT` | `appointments-service-production` |
| `SERVICIOS` | `api-gateway auth-service appointments-service` |
| `PROM_SVC` / `PROM_PORT` | `prometheus-operated` / `9090` |
| `METRICA_NEGOCIO` | `citas_intentos_total` |
| `REGLA_SLI` | `slo:citas_sli:ratio_rate7d` |
| `POD_LOGS` | `appointments-service` |

## Capturas

| # | Captura | Qué muestra |
|---|---|---|
| 10 | [canary en análisis](capturas/10-canary-analisis-en-curso.png) | `v0.1.7` al 50 %, primer AnalysisRun exitoso y los fallidos por falta de tráfico |
| 11 | [canary promovido](capturas/11-canary-promovido-v017.png) | Los 3 servicios promovidos por métricas, con los 6 AnalysisRun exitosos |
| 12 | [reglas de SLO](capturas/12-reglas-slo-prometheus.png) | Reglas de registro evaluándose en Prometheus |
| 13 | [tablero: SLO y latencia](capturas/13-tablero-slo-y-latencia.png) | SLI, presupuesto restante y latencia por servicio |
| 14 | [tablero: tráfico y errores](capturas/14-tablero-trafico-errores.png) | Tráfico por versión y el 100 % de 5xx del incidente de DNS |
| 15 | [tablero: saturación, negocio y registros](capturas/15-tablero-saturacion-negocio-logs.png) | El tablero detectando el incidente de RabbitMQ |
| 16 | [alerta en firing](capturas/16-alerta-quema-rapida-firing.png) | `CitasPresupuestoQuemaRapida` con su `runbook_url` |
| 17 | [tablero con la alerta](capturas/17-tablero-alerta-activa.png) | 2 alertas activas y 82 % de error en citas |
| 18 | [canary abortado](capturas/18-canary-abortado-por-metricas.png) | `v0.1.8` abortada por `citas-con-error` |
| 19 | [valores medidos](capturas/19-analysisrun-valores-medidos.png) | Las métricas técnicas pasan; solo la de negocio falla |
| 22 | [registro relacionado](capturas/22-log-relacionado-por-trace-id.png) | El log de error con el mismo `trace_id` y `span_id` que el span de Tempo |
