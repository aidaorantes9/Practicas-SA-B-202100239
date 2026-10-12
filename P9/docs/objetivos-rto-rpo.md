# Objetivos de recuperacion declarados (antes de las pruebas)

Declarado el 2026-10-12, antes de ejecutar la reconstruccion cronometrada.
El RPO ya figuraba en Git desde el 2026-10-09 (comentario del Schedule en argocd/plataforma-velero.yaml, commit 3ab4ab9).

| Objetivo | Valor | Alcance |
|---|---|---|
| **RPO** | **15 minutos** | Datos de PostgreSQL (unico dato irrecuperable del sistema) |
| **RTO** | **30 minutos** | Desde la perdida total del cluster hasta: 12 Applications Synced/Healthy y PostgreSQL con los datos del ultimo respaldo |

## Justificacion del RPO (15 min)

- Velero respalda el volumen de PostgreSQL con un Schedule `*/15 * * * *` hacia GCS, fuera del cluster.
- En el peor caso se pierden los datos escritos desde el ultimo respaldo: hasta 15 minutos.
- Para un estudio de tatuajes (citas, artistas), perder hasta 15 minutos de registros es tolerable y se reconstruye
  manualmente con el cliente; respaldar con mas frecuencia aumenta costo y carga sin beneficio proporcional.

## Justificacion del RTO (30 min)

Estimacion por fases, medida en ejecuciones previas con virtualizacion VT-x y cache de imagenes:

| Fase | Estimado |
|---|---|
| Terraform: cluster kind de 3 nodos | 1-2 min |
| Calico disponible | 3-5 min |
| ArgoCD y app raiz | 3-4 min |
| Waves -3 a 1 (plataforma, politicas, secretos, infraestructura, 5 servicios con canary) | 8-12 min |
| Restauracion de datos desde Velero | 2-3 min |
| **Total estimado** | **17-26 min**, con margen hasta 30 min |

## Fuera del alcance de estos objetivos

- Mensajes en transito en RabbitMQ (no se restauran; se regeneran).
- El ambiente staging (no forma parte del flujo de entrega de P8).
- La perdida de los prerrequisitos de dia -1 en GCP (buckets, Secret Manager, cuenta de servicio).
