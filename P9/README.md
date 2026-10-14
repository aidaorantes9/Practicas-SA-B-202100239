# Práctica 9: Continuidad operativa y recuperación ante desastres

**Alejandra · 202100239 · Sección B · Software Avanzado, USAC**

El sistema de la Práctica 8 (5 microservicios, PostgreSQL y RabbitMQ en Kubernetes, desplegado con GitOps) convertido en un sistema **recuperable**: se reconstruye completo desde cero con un solo comando, sus datos se respaldan fuera del clúster, sus secretos sobreviven a la pérdida del clúster, y resiste la pérdida de un nodo. Todo se demostró destruyéndolo con el cronómetro corriendo.

## Tabla de enlaces obligatoria

| Ítem | Enlace o dato requerido |
|---|---|
| **Repositorio GitOps** | https://github.com/aidaorantes9/P8_GITOPS_202100239 |
| **Aplicación raíz en ArgoCD** | `root-app`, namespace `argocd`. Apunta a la carpeta [`argocd/`](https://github.com/aidaorantes9/P8_GITOPS_202100239/tree/main/argocd) del repo GitOps. La instala Terraform: [`P9/terraform/argocd.tf`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/terraform/argocd.tf) y [`valores/root-app.yaml`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/terraform/valores/root-app.yaml) |
| **Punto de entrada del bootstrap** | [`P9/bootstrap.sh`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/bootstrap.sh), ejecutado como `./P9/bootstrap.sh` desde la raíz del repositorio |
| **Backend remoto de Terraform** | Google Cloud Storage, bucket `sa-p9-202100239-tfstate`, prefijo `p9/cluster`, con bloqueo nativo de GCS y versionado. Definido en [`P9/terraform/versions.tf`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/terraform/versions.tf). Sin archivos de estado ni credenciales en el repositorio |
| **Schedule de Velero** | `velero-production-cada-15min` (`*/15 * * * *`, retención 72 h, volúmenes de PostgreSQL y RabbitMQ con Kopia). Destino: `gs://sa-p9-202100239-velero` (GCS, fuera del clúster). Definido en [`argocd/plataforma-velero.yaml`](https://github.com/aidaorantes9/P8_GITOPS_202100239/blob/main/argocd/plataforma-velero.yaml) |
| **Reconstrucción cronometrada** | Destrucción: [`P9/evidencias/reconstruccion/desastre-20261012-152025.log`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/reconstruccion/desastre-20261012-152025.log). Reconstrucción: [`P9/evidencias/bootstrap/bootstrap-20261012-152057.log`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/bootstrap/bootstrap-20261012-152057.log) |
| **Restauración de datos** | [`P9/evidencias/restauracion/restauracion-20261012-144818.log`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/restauracion/restauracion-20261012-144818.log), con las filas [antes](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/restauracion/filas-antes-20261012-144818.csv) y [después](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/restauracion/filas-despues-20261012-144818.csv) |
| **Prueba de pérdida de nodo** | [`P9/evidencias/drenaje/drenaje-sa-p9-worker-20261012-141236.log`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/drenaje/drenaje-sa-p9-worker-20261012-141236.log), con el detalle de la sonda en [`sonda-sa-p9-worker-20261012-141236.log`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/drenaje/sonda-sa-p9-worker-20261012-141236.log) |
| **RTO y RPO declarados** | **RTO objetivo 30 min, medido 27 min 39 s.** **RPO objetivo 15 min, medido 4 min 15 s** (restauración de datos) y **6 min 21 s** (reconstrucción total); en un intento previo, 16 min 14 s. Declarados antes de las pruebas en [`P9/docs/objetivos-rto-rpo.md`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/docs/objetivos-rto-rpo.md) |
| **Video demostrativo** | https://drive.google.com/drive/folders/1mUooPvAoX-iW_HNugKlVhRjbObBHF5vU?usp=sharing (contenido en la sección "Video") |

## Resultados

| Prueba | Fecha y hora (GMT-6) | Resultado |
|---|---|---|
| Pérdida de nodo | 12/10/2026 14:13 | Drenaje de `sa-p9-worker` con una sonda consultando los 5 servicios: **ningún servicio dejó de responder**; 4 fallas aisladas (`000`) en 79 rondas, al momento de desalojar los pods |
| Restauración de datos | 12/10/2026 14:48 | `DROP TABLE` y restauración con Velero: **23 filas recuperadas idénticas** (id y hora); 2 perdidas; RPO 4 min 15 s; datos listos en 1 min 37 s |
| Reconstrucción total | 12/10/2026 15:20 | Pérdida de los 3 nodos y todos los volúmenes: **sistema completo en 27 min 39 s**, con 13/13 Applications sanas, secretos descifrados con la llave original, políticas de Kyverno activas y los datos restaurados |

El análisis completo, con los puntos únicos de fallo encontrados y el plan para cerrar las brechas, está en el [informe de la prueba de DR](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/docs/informe-dr.md).

## Documentación

| Documento | Contenido |
|---|---|
| [Informe de la prueba de DR](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/docs/informe-dr.md) | Los 6 campos de la plantilla: objetivos, escenario, tiempos, pérdida, puntos únicos de fallo, y brecha y plan |
| [Runbook de recuperación](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/docs/runbook.md) | Procedimiento paso a paso para un tercero: reconstrucción total, restauración de datos, pérdida de nodo, reanudación y errores conocidos |
| [Diagrama del bootstrap](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/docs/diagrama-bootstrap.md) | Orden de reconstrucción, dependencias, y qué es automático y qué es manual |
| [Objetivos de RTO y RPO](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/docs/objetivos-rto-rpo.md) | Objetivos y su justificación, declarados antes de las pruebas |
| [Escaneo de secretos](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/docs/escaneo-secretos.md) | Revisión del historial con gitleaks antes de hacer público el repositorio |

## Cómo funciona

```
./P9/bootstrap.sh
  Fase 0  cache de imagenes y reconciliacion del estado remoto
  Fase 1  Terraform crea el cluster kind (1 control-plane + 2 workers)
  Fase 2  Terraform instala Calico, restaura la llave de Sealed Secrets y las
          credenciales de Velero desde GCP Secret Manager, crea la base de P8
          (namespaces, quotas, RBAC) e instala ArgoCD con la app raiz
  Fase 3  ArgoCD (app-of-apps) levanta todo por sync waves:
          -3 sealed-secrets, argo-rollouts, kyverno, velero
          -2 politicas de Kyverno
          -1 secretos (SealedSecret descifrado con la llave original)
           0 PostgreSQL, RabbitMQ y CronJobs
           1 los 5 servicios (Rollouts canary, 2 replicas, PDB, anti-afinidad)
  Fase 4  si el cluster es nuevo, Velero restaura PostgreSQL desde el ultimo
          respaldo anterior al desastre
```

El único paso manual de una recuperación es ejecutar `./P9/bootstrap.sh`. Los prerrequisitos de día menos 1 (buckets, secretos y cuenta de servicio en GCP) se crean una sola vez y viven fuera del clúster; están descritos en el [runbook](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/docs/runbook.md).

## Estructura de la carpeta

| Ruta | Contenido |
|---|---|
| [`bootstrap.sh`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/bootstrap.sh) | Punto de entrada único de la reconstrucción |
| [`terraform/`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/tree/main/P9/terraform) | Clúster kind, Calico, llaves desde Secret Manager, base de P8, StorageClass, ArgoCD y app raíz |
| [`scripts/simular-desastre.sh`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/scripts/simular-desastre.sh) | Destruye el clúster completo (inicio del cronómetro del RTO) |
| [`scripts/restaurar-datos.sh`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/scripts/restaurar-datos.sh) | Restaura PostgreSQL desde el último respaldo anterior a un instante dado |
| [`scripts/prueba-restauracion.sh`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/scripts/prueba-restauracion.sh) | Prueba de restauración de datos con verificación fila por fila y cálculo del RPO |
| [`scripts/prueba-drenaje.sh`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/scripts/prueba-drenaje.sh) | Prueba de pérdida de nodo con sonda de disponibilidad |
| [`scripts/cache-imagenes.sh`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/scripts/cache-imagenes.sh) | Caché de imágenes fuera del clúster, para acelerar la reconstrucción |
| [`evidencias/`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/tree/main/P9/evidencias) | Registros con marcas de tiempo de cada prueba, y capturas de pantalla |
| [`docs/`](https://github.com/aidaorantes9/Practicas-SA-B-202100239/tree/main/P9/docs) | Informe de DR, runbook, diagrama, objetivos y escaneo de secretos |

## Capturas de evidencia

| # | Captura | Qué muestra |
|---|---|---|
| 01 | [Buckets en GCS](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/capturas/01-buckets-gcs.png) | Buckets de estado y de respaldos, fuera del clúster |
| 02 | [Clúster de 3 nodos](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/capturas/02-kind-3-nodos-calico.png) | Nodos `Ready` y Calico funcionando |
| 03 | [Estado remoto](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/capturas/03-estado-remoto-gcs.png) | Estado en GCS y ningún estado local |
| 04 | [Bloqueo del estado](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/capturas/04-bloqueo-estado-gcs.png) | Un segundo Terraform rechazado por el bloqueo |
| 05 | [Velero y Schedule](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/capturas/05-velero-bsl-schedule.png) | Destino `Available` y Schedule cada 15 min con retención de 72 h |
| 06 | [Respaldo con datos](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/capturas/06-velero-backup-con-datos.png) | Volúmenes de PostgreSQL y RabbitMQ incluidos |
| 07 | [Réplicas, anti-afinidad y PDB](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/capturas/07-replicas-antiafinidad-pdb.png) | Una réplica de cada servicio en cada worker |
| 08 | [Drenaje de nodo](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/capturas/08-drenaje-nodo-resumen.png) | Servicios respondiendo durante el drenaje |
| 09 | [Restauración de datos](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/capturas/09-restauracion-datos-rpo.png) | Filas idénticas y RPO medido |
| 10 | [Reconstrucción cronometrada](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/capturas/10-reconstruccion-rto.png) | Línea de tiempo del desastre al sistema completo |
| 11 | [Verificación posterior](https://github.com/aidaorantes9/Practicas-SA-B-202100239/blob/main/P9/evidencias/capturas/11-verificacion-post-reconstruccion.png) | Llave original, secretos descifrados, Kyverno activo y datos restaurados |

## Video

**Enlace:** https://drive.google.com/drive/folders/1mUooPvAoX-iW_HNugKlVhRjbObBHF5vU?usp=sharing

El video recorre, en orden, las tres pruebas de recuperación y la verificación final:

1. **Pérdida de nodo:** se drena el worker `sa-p9-worker` mientras una sonda consulta cada pocos segundos el `/health` de los 5 servicios. Las réplicas se reprograman en el otro worker respetando los PodDisruptionBudget, y RabbitMQ queda en `Pending` por su volumen atado al nodo. El resumen muestra que ningún servicio dejó de responder.
2. **Restauración de datos:** se borra la tabla `cron_executions` y se restaura PostgreSQL con Velero desde el último respaldo programado. Incluye el primer intento fallido (el volumen quedó `Pending` por no restaurar los `persistentvolumes`), su diagnóstico y corrección, y la corrida oficial: 23 filas idénticas recuperadas y un RPO de 4 min 15 s.
3. **Reconstrucción cronometrada:** se destruyen los 3 nodos del clúster con todos sus volúmenes y se ejecuta `./P9/bootstrap.sh`. Terraform crea el clúster e instala ArgoCD, la app raíz levanta todo por sync waves y Velero restaura los datos. El sistema queda completo en 27 min 39 s.
4. **Verificación posterior:** una sola llave de Sealed Secrets (la restaurada desde Secret Manager), el SealedSecret de la Práctica 8 descifrado, Kyverno rechazando una imagen `latest`, los Rollouts sanos con 2 réplicas y los datos restaurados desde días anteriores.
