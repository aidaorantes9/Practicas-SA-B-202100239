# Runbook: GatewayLatenciaQuemaRapida

| Campo | Valor |
|---|---|
| Severidad | `critical`: atender de inmediato |
| SLO | El 95 % de las peticiones del api-gateway responde en menos de 0,5 s, en 7 días |
| Condición | Más del 72 % de las peticiones tarda 0,5 s o más, en la última hora **y** en los últimos 5 minutos, durante 1 minuto |
| Significado | El presupuesto de latencia de 7 días se agota en unas 12 horas |
| Tablero | Grafana, `P10 Senales de oro`, filas **Latencia** y **Saturación** |

## Primeros 3 minutos

1. **¿Qué servicio es lento? (30 s)** Panel *Latencia p95 por servicio*. Si solo el gateway está alto, el cuello está en él o en algo que espera; si un servicio de atrás también, ese es el origen.
2. **¿Es saturación? (30 s)** Fila Saturación: CPU cerca del límite (200m por contenedor) o *Retraso del event loop* alto indican que el proceso no da abasto.
3. **¿Es un timeout? (1 min)** Una latencia plana en exactamente 5 s es el timeout del proxy del gateway: el destino no responde. Buscar en Tempo las trazas lentas:

       { resource.service.name = "api-gateway" && duration > 500ms }

   El span más largo dentro de la traza indica el servicio que hace esperar. En el log del gateway, el error `[HPM] Error occurred while proxying` dice a qué host no pudo llegar.

## Causas conocidas y mitigación

| Síntoma | Causa | Mitigación |
|---|---|---|
| Latencia plana en 5 s con `EAI_AGAIN` | El gateway apunta a un nombre de Service que no existe (incidente del 14/10/2026: `sa-p8-*` en lugar de `*-production`) | Corregir `serviciosSufijo` en GitOps y recrear los pods del gateway |
| CPU al límite | Más tráfico del que soportan 2 réplicas | Subir réplicas en `values-production.yaml` del servicio (por GitOps) |
| Solo pods de una versión nueva | Regresión de rendimiento | `kubectl argo rollouts abort <servicio>-production -n production` |

## Verificar la recuperación

`slo:gateway_lentas:ratio_rate5m` por debajo de 0,72 y el p95 del gateway bajo la línea de 0,5 s.
