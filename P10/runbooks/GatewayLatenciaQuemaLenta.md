# Runbook: GatewayLatenciaQuemaLenta

| Campo | Valor |
|---|---|
| Severidad | `warning`: atender en horario laboral |
| SLO | El 95 % de las peticiones del api-gateway responde en menos de 0,5 s, en 7 días |
| Condición | Más del 30 % de las peticiones tarda 0,5 s o más, en las últimas 6 horas **y** en los últimos 30 minutos, durante 5 minutos |
| Significado | El presupuesto de latencia de 7 días se agota en poco más de un día |
| Tablero | Grafana, `P10 Senales de oro`, filas **Latencia** y **Saturación** |

## Diagnóstico

Una degradación lenta suele ser de capacidad, no una caída:

1. Panel *Latencia p50 y p99 del gateway*: si sube el p99 pero no el p50, el problema afecta a pocas peticiones (una ruta, un pod); si suben los dos, a todo el servicio.
2. Panel *Peticiones por segundo por ruta y versión*: identificar la ruta lenta.
3. Fila Saturación: memoria creciendo sin parar en un pod sugiere una fuga; reiniciar ese pod es la mitigación inmediata y la fuga se corrige en el código.
4. En Tempo, `{ resource.service.name = "api-gateway" && duration > 500ms }` y comparar varias trazas: si el span lento es siempre el mismo servicio, el problema está ahí.

Para las causas conocidas, ver [GatewayLatenciaQuemaRapida](GatewayLatenciaQuemaRapida.md#causas-conocidas-y-mitigación).

## Verificar la recuperación

`slo:gateway_lentas:ratio_rate30m` por debajo de 0,30 y la alerta en `inactive`.
