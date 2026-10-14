# Runbook: CitasPresupuestoQuemaRapida

| Campo | Valor |
|---|---|
| Severidad | `critical`: atender de inmediato |
| SLO | Agendar cita sin error del sistema, 99 % en 7 días |
| Condición | Más del 14,4 % de los intentos de agendar cita terminan en error del sistema, en la última hora **y** en los últimos 5 minutos, durante 1 minuto |
| Significado | El presupuesto de error de 7 días se agota en unas 12 horas si nada cambia |
| Tablero | Grafana, `P10 Senales de oro`, filas **SLO** y **Negocio** |

## Qué ve el cliente

Intenta agendar una cita y recibe un error. Un rechazo de negocio (artista ocupado, horario inválido) **no** dispara esta alerta: se cuenta como `resultado="rechazada"`, no como `error`.

## Primeros 3 minutos: de la alerta a la causa

1. **Confirmar el alcance (30 s).** En el tablero, fila Negocio, mirar *Intentos de agendar cita por resultado*. Si `exitosa` cayó a cero y `error` subió, el fallo es total; si solo una parte, puede ser un pod o una versión (ver *Peticiones por ruta y versión*).
2. **Ir al log del error (30 s).** En la fila *Logs con error*, el primer registro `"level":"error"` de `appointments-service` dice la causa en el campo `error`. Consulta equivalente en Loki:

       {namespace="production", app="appointments-service"} | json | level="error"

3. **Abrir la traza (1 min).** En ese log, el campo `trace_id` es un enlace a Tempo. La traza muestra el recorrido `api-gateway → auth-service → appointments-service → artists-service` y en qué span está el error. Búsqueda equivalente en Tempo (Explore, TraceQL):

       { resource.service.name = "appointments-service" && status = error }

4. **Decidir la mitigación** con la tabla de causas conocidas.

## Causas conocidas y mitigación

| Mensaje en el log | Causa | Mitigación inmediata |
|---|---|---|
| `Channel closed` | RabbitMQ se reinició y appointments quedó con el canal AMQP cerrado: no se reconecta solo | `kubectl argo rollouts restart appointments-service-production -n production` |
| `ECONNREFUSED` o `EAI_AGAIN` hacia artists | artists caído, o una NetworkPolicy o un nombre de Service incorrecto | `kubectl get pods,endpoints -n production \| grep artists`; revisar `sa-p8-app-config` |
| Errores de PostgreSQL | Base de datos caída o sin conexiones | `kubectl get pod sa-p8-postgresql-0 -n production`; si está `Unknown`, borrarlo con `--force` |
| Errores solo en pods con un hash nuevo | Una versión nueva defectuosa | `kubectl argo rollouts abort <servicio>-production -n production`; el canary vuelve a la versión estable |

## Verificar la recuperación

- `slo:citas_error:ratio_rate5m` baja de 0,144 y la alerta se apaga sola (la ventana de 5 min lo permite en pocos minutos).
- En el log ya no aparecen errores nuevos y vuelven las citas `exitosa`.

## Después

Registrar el incidente: hora de inicio, hora de la alerta, hora de recuperación y presupuesto consumido (`slo:citas_presupuesto:restante`). Si el presupuesto está agotado, congelar despliegues que no sean correcciones hasta que se recupere.
