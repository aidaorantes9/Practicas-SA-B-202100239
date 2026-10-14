# Informe de la prueba de DR: Práctica 9

**Alejandra · 202100239 · Sección B · Software Avanzado, USAC** · Pruebas ejecutadas el 12 de octubre de 2026 (horas en GMT-6).

## 1. Objetivos declarados

| Objetivo | Valor | Justificación |
|---|---|---|
| **RPO** | **15 min** | Velero respalda el volumen de PostgreSQL (`*/15 * * * *`) hacia GCS. Para un estudio de tatuajes, perder hasta 15 min de citas es tolerable y se reconstruye con el cliente; respaldar más seguido aumenta carga sin beneficio proporcional. |
| **RTO** | **30 min** | Suma estimada por fases (clúster 1-2 min, Calico 3-5, ArgoCD 3-4, waves 8-12, datos 2-3 = 17-26 min) más margen. Incluye datos restaurados, no solo pods corriendo. |

Declarados **antes** de las pruebas y sin ajustarlos después: el RPO está en Git desde el 9/10 (commit `3ab4ab9`) y el RTO desde el 12/10 a las 14:59 (`91d64ce`), 21 min antes de la destrucción. Detalle: [`objetivos-rto-rpo.md`](objetivos-rto-rpo.md).

## 2. Escenario ejecutado

1. **Pérdida de nodo** (14:13:24): `kubectl drain sa-p9-worker` mientras una sonda en el control-plane consultaba `/health` de los 5 servicios.
2. **Pérdida de datos** (14:48:22): `DROP TABLE cron_executions` en `cronjobs_db`, restaurada con Velero desde el último respaldo programado. Hubo un **intento previo fallido** (14:30:45), documentado.
3. **Pérdida total del clúster** (15:20:26): `simular-desastre.sh` eliminó a la vez los 3 nodos de kind (control-plane y 2 workers) y con ellos **todos los volúmenes**, incluido el de PostgreSQL. Sobrevivió solo lo que está fuera del clúster: el estado de Terraform y los respaldos en GCS, la llave de Sealed Secrets y las credenciales de Velero en Secret Manager, los repos en GitHub y el caché de imágenes. Inmediatamente después se ejecutó `./P9/bootstrap.sh`, sin ningún paso manual.

## 3. Tiempos medidos

**RTO real: 27 min 39 s** (15:20:26 → 15:48:05), con 13/13 Applications `Synced/Healthy` y PostgreSQL con datos. Objetivo: 30 min. ✅

| Hito | Hora | Duración |
|---|---|---|
| Inicio de la destrucción → clúster eliminado | 15:20:26 → 15:20:57 | 31 s |
| Fase 0: caché y reconciliación del estado remoto | → 15:21:20 | 23 s |
| Fase 1: Terraform crea kind (3 nodos) | → 15:22:21 | 1 min 1 s |
| Fase 2: Calico, llaves, base P8, ArgoCD, app raíz | → 15:29:43 | 7 min 22 s |
| Fase 3: ArgoCD sincroniza las 13 Applications | → 15:45:06 | **15 min 23 s** |
| Fase 4: restauración de datos desde Velero | → 15:48:05 | 2 min 59 s |

Restauración de datos aislada (prueba 2): **1 min 37 s** del `DROP TABLE` a PostgreSQL listo.
Evidencia: [`desastre-20261012-152025.log`](../evidencias/reconstruccion/desastre-20261012-152025.log), [`bootstrap-20261012-152057.log`](../evidencias/bootstrap/bootstrap-20261012-152057.log), [`restauracion-20261012-144818.log`](../evidencias/restauracion/restauracion-20261012-144818.log).

## 4. Pérdida medida

Medida con el CronJob que inserta una fila cada 2 min: se comparó la tabla fila por fila (id y hora) antes del desastre y tras la restauración. **En las tres mediciones, las filas recuperadas son idénticas a las originales.**

| Prueba | Respaldo usado | Último dato recuperado | **RPO real** | Filas perdidas |
|---|---|---|---|---|
| Restauración oficial | 14:45:25 | 14:44:04 | **4 min 15 s** ✅ | 2 (14:46, 14:48) |
| Reconstrucción total | 15:15:26 | 15:14:05 | **6 min 21 s** ✅ | 3 (15:16, 15:18, 15:20)¹ |
| Restauración, intento 1 | 14:15:25 | 14:14:31 | **16 min 14 s** ❌ | 8 (14:16 a 14:30) |

¹ Estimadas por el calendario del CronJob; la última captura previa fue a las 15:08 (33 filas, todas recuperadas).

**Qué no se recuperó y por qué:** las filas escritas después del último respaldo, porque Velero respalda por intervalos. En el intento 1, el desastre ocurrió 20 s después de que **empezara** el respaldo de las 14:30, que aún no terminaba, así que se usó el de las 14:15. Tampoco se restauran los **mensajes en tránsito de RabbitMQ** (fuera del alcance declarado).

## 5. Puntos únicos de fallo detectados

| Hallazgo | Impacto observado |
|---|---|
| **PostgreSQL y RabbitMQ: 1 réplica, volumen `local` atado al nodo** | Al drenar `sa-p9-worker`, RabbitMQ quedó `Pending` hasta el `uncordon`; ante una pérdida real seguiría caído. El respaldo de las 14:15 (durante el drenaje) no incluyó RabbitMQ. |
| **Velero omitía en silencio los volúmenes `hostPath`** | El primer respaldo marcó `Completed` **sin los datos**. Se detectó revisando los Pod Volume Backups y se corrigió con volúmenes `local`. |
| **Git declaraba una versión rota** | Tras el abort del canary de P8, Git seguía en `auth-service v0.1.6` (`/health` → 500). Una reconstrucción la habría desplegado al 100 %. Corregido con un revert en Git. |
| **Procedimiento de restauración no ensayado** | El intento 1 falló: sin `persistentvolumes`, el PVC conservó el `volumeName` del volumen borrado y quedó `Pending`. |
| **Toda la plataforma en un único host** | VirtualBox en modo NEM (Hyper-V activo) multiplicó los tiempos (load > 90, timeouts de etcd). Corregido usando VT-x nativo. |
| **Suspensión prolongada** | Tras 3 días, el token del CNI de Calico venció: ningún pod podía crearse ni borrarse. Y con TTL de 72 h, un clúster detenido más de 3 días **pierde todos sus respaldos**. |
| **Kyverno con 1 réplica y `failurePolicy: Fail`** | Mientras se reprograma, bloquea la creación de pods en `production`. |
| **Proveedor de kind y bloqueo de Terraform** | El provider no detecta un clúster borrado (se reconcilia en el bootstrap); un apply interrumpido dejó un lock huérfano en GCS (`force-unlock`). |

## 6. Brecha y plan

| Objetivo | Declarado | Medido | Brecha | Plan para cerrarla |
|---|---|---|---|---|
| RTO | 30 min | 27 min 39 s | Cumplido, con 2 min 21 s de margen | La fase 3 consume el 56 %: precargar todas las imágenes en el caché (Kyverno se agregó tarde) y quitar la espera secuencial entre waves que no dependen entre sí. |
| RPO | 15 min | 4:15 / 6:21 / **16:14** | Excedido en el peor caso por 1 min 14 s | El RPO real no es el intervalo del Schedule: es **intervalo + duración del respaldo + granularidad de escritura** (≈ 18 min). Para garantizar 15 min: Schedule cada 10 min, o archivado continuo de WAL a GCS (WAL-G / pgBackRest) para bajar a ~1 min. |
| Pérdida de nodo | Servicio respondiendo | 4 fallas aisladas de 79 rondas (`000`, al desalojar) | Ninguna caída, pero sí errores puntuales | `preStop` con pausa de 5-10 s para que el pod siga atendiendo mientras se propagan los endpoints. |
| Componentes con estado | No declarado | PostgreSQL y RabbitMQ sin redundancia | SPOF | Réplica de PostgreSQL (CloudNativePG o `postgresql-ha`) y almacenamiento de red en lugar de `local`. |
| Retención | 72 h | Respaldos perdidos con > 3 días detenido | Riesgo no cubierto | TTL de 7 días y alerta si el último respaldo supera 30 min. |
