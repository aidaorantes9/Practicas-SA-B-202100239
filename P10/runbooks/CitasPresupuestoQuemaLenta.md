# Runbook: CitasPresupuestoQuemaLenta

| Campo | Valor |
|---|---|
| Severidad | `warning`: atender en horario laboral, no de madrugada |
| SLO | Agendar cita sin error del sistema, 99 % en 7 días |
| Condición | Más del 6 % de los intentos terminan en error del sistema, en las últimas 6 horas **y** en los últimos 30 minutos, durante 5 minutos |
| Significado | A este ritmo el presupuesto de 7 días se agota en poco más de un día |
| Tablero | Grafana, `P10 Senales de oro`, filas **SLO** y **Negocio** |

## Por qué existe esta alerta

Detecta un fallo **parcial y sostenido** que la quema rápida no ve: por ejemplo, un solo pod de dos con problemas, o un artista cuyo calendario siempre falla. También queda encendida un tiempo después de un incidente grande, mientras la ventana de 30 minutos se limpia; si la quema rápida ya se apagó y no hay errores nuevos en los logs, solo hay que esperar.

## Diagnóstico

1. En el tablero, *Consumo del presupuesto: tasa de error de citas por ventana*: si la línea de 5 min está en cero, el problema ya pasó y la alerta se apagará cuando la de 30 min baje de 6 %.
2. Si sigue habiendo errores, separar por pod: en Loki

       sum by (pod) (count_over_time({namespace="production", app="appointments-service"} | json | level="error" [10m]))

   Un solo pod con errores apunta a ese pod (reiniciarlo); todos los pods apuntan a una dependencia.
3. Abrir un `trace_id` de esos logs en Tempo y seguir el mismo procedimiento que en [CitasPresupuestoQuemaRapida](CitasPresupuestoQuemaRapida.md#causas-conocidas-y-mitigación).

## Verificar la recuperación

`slo:citas_error:ratio_rate30m` por debajo de 0,06 y la alerta en `inactive`.
