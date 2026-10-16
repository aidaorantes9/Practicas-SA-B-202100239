# Informe de operación: Práctica 10

**Alejandra, carné 202100239, Sección B.** Sistema: estudio de tatuajes (api-gateway, auth-service, appointments-service, artists-service, notification-service) en kind, desplegado por GitOps con ArgoCD y Argo Rollouts.

## 1. SLO declarados

| SLO | Indicador (SLI) | Objetivo | Ventana | Por qué ese número |
|---|---|---|---|---|
| **Agendar cita** | Intentos de `createAppointment` que terminan **sin error del sistema** / intentos totales. Un rechazo de negocio (artista ocupado) cuenta como bueno | **99 %** | 7 días | Agendar es la acción que genera ingresos. El 1 % de presupuesto (unos 100 errores por cada 10 000 intentos) permite desplegar seguido sin miedo, y una falla total se nota en minutos |
| **Latencia del gateway** | Peticiones del `api-gateway` que responden en **menos de 0,5 s** / peticiones totales | **95 %** | 7 días | Bajo medio segundo la aplicación se siente inmediata. Se pide 95 % y no 99 % porque el login calcula bcrypt a propósito y los pods recién creados en kind son lentos en sus primeras peticiones |

Reglas de registro en `observabilidad/slo-reglas.yaml` (repo GitOps): tasa de error en 5 min, 30 min, 1 h, 6 h y 7 días, el SLI, la **tasa de quema** (`slo:citas_burn_rate:1h` = tasa de error / (1 - 0,99)) y el presupuesto restante. Alertas multiventana: **quema rápida** (burn rate > 14,4 en 1 h y en 5 min, `critical`) y **quema lenta** (> 6 en 6 h y en 30 min, `warning`), cada una con su `runbook_url`.

## 2. Fallo inducido

**Qué:** la versión `v0.1.8` de appointments-service agrega un "anticipo sugerido del 30 %" que lee `disponibilidad.tarifa.porHora`, pero la API de artists **no devuelve ninguna tarifa**. Cada cita falla con `TypeError: Cannot read properties of undefined (reading 'porHora')` antes de guardarse. Es un error de **contrato entre servicios**, distinto al de P8 (el `/health` que devolvía 500).

**Cómo:** commit `480178f` en `P4/appointments-service/src/resolvers/resolvers.js`, tag `v0.1.8`, el pipeline (pruebas, Trivy, firma con Cosign, SBOM) lo aprobó porque **no había prueba del resolver**, y abrió el PR #4 en GitOps. El PR se fusionó a las **15:42:20 del 14/10/2026**.

## 3. Tiempo de detección

| Hora (14/10/2026) | Desde la fusión | Evento |
|---|---|---|
| 15:42:20 | 0 s | ArgoCD aplica `v0.1.8`; nace el pod canary (20 %) |
| 15:44:39 | 2 min 19 s | El pod queda listo y empieza el AnalysisRun `appointments-service-production-cd744f5ff-3-1` |
| 15:46:36 | 4 min 16 s | Primera medición: `citas-con-error` = **1** (100 % de error en el canary) |
| **15:47:41** | **5 min 21 s** | Segunda medición mala, supera `failureLimit: 1`: **el Rollout se aborta solo** |

Las métricas técnicas **pasaron**: 5xx = 0, p95 = 0,22 s y 0,13 s, tráfico = 0,29 y 0,31 rps. GraphQL responde 200 aunque falle, así que **sin la métrica de negocio `citas_intentos_total{resultado="error"}`, `v0.1.8` habría llegado al 100 %**.

## 4. Recorrido hasta la causa

Para el recorrido cronometrado se provocó un fallo controlado (se borra el pod de RabbitMQ; appointments queda con el canal AMQP cerrado) y se midió desde la alerta en `firing` hasta el registro con la causa. Grabado en el video.

| Paso | Herramienta | Qué se ve | Hora |
|---|---|---|---|
| 1. Alerta | Prometheus, `/alerts` | `CitasPresupuestoQuemaRapida` en `firing`, con `runbook_url` | PENDIENTE |
| 2. Traza | Grafana, Explore, Tempo (TraceQL `status = error`) | `api-gateway → auth-service → appointments-service`; span `graphql.resolve createAppointment` con `Status Message: Channel closed` | PENDIENTE |
| 3. Registro | Botón **Related logs** del span (Loki por `trace_id`) | JSON `"level":"error"`, `"error":"Channel closed"`, mismo `trace_id` y `span_id` que el span | PENDIENTE |
| **Total** | | | **PENDIENTE (meta < 3 min)** |

La traza mostró algo que los registros solos no decían: el span `pg.query:INSERT` **terminó bien antes** de que fallara la publicación en RabbitMQ. Durante ese incidente las citas **se guardaban** pero el cliente recibía un error: riesgo de citas duplicadas y de confirmaciones que nunca se envían.

## 5. Tiempo de recuperación

**Qué lo resolvió: el canary, de forma automática.** A las 15:47:41 Argo Rollouts escaló el canary a 0 y devolvió el 100 % del tráfico a `v0.1.7`, que nunca dejó de atender. Daño total: solo el tercio de las citas que llegó al pod canary durante unos 3 minutos. Ninguna persona intervino.

Después, a mano, se dejó Git igual al clúster: `git revert` del commit del error (`010a347`) y, en GitOps, el tag de appointments de vuelta a `v0.1.7` (`cc6b141`, 15:59). Como `v0.1.7` ya era la versión estable, el Rollout volvió a `Healthy` sin otro canary (**rollback declarativo**).

## 6. Alerta faltante o sobrante

**Faltantes:**
- **Ninguna alerta avisa que un canary se abortó.** El aborto solo queda como evento `RolloutAborted`; GitOps sigue declarando `v0.1.8` y nadie se entera hasta mirar ArgoCD. Falta una alerta sobre `rollout_info{phase="Degraded"}` de Argo Rollouts.
- **Ninguna alerta mira las dependencias.** En el incidente real de RabbitMQ (15:11), la alerta de SLO tardó **7 min** en dispararse porque la ventana de 1 h debía acumular errores. Una alerta directa sobre la salud de RabbitMQ, o sobre `citas_intentos_total{resultado="error"}` en 2 min, lo habría visto en menos de 1 min.

**Sobrante:**
- **El umbral común de latencia del canary (p95 < 0,5 s) dio un falso positivo en auth-service.** Su canary de `v0.1.8`, sin cambios en el código, se abortó con p95 de 0,56 y 0,69 s. El p95 de `/api/auth/login` en la versión estable es de 0,95 s por bcrypt. Se corrigió con un umbral propio de 1 s para auth (`apps/auth-service/values-production.yaml`), y el reintento pasó.

Los incidentes reales que aparecieron durante la práctica (DNS del gateway, reinicios de RabbitMQ, OOM de Grafana y Tempo) están en el [README](../README.md#incidentes-reales-encontrados-durante-la-práctica).
