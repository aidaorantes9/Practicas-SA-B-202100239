# Runbook de recuperación: Práctica 9

Procedimiento para recuperar el sistema de microservicios del estudio de tatuajes (5 servicios, PostgreSQL y RabbitMQ sobre Kubernetes) **sin ayuda del autor**. Cada paso indica el comando exacto, qué resultado esperar y qué hacer si no ocurre.

| | |
|---|---|
| **Autora** | Alejandra, 202100239, Sección B, Software Avanzado, USAC |
| **Repositorio de código** | https://github.com/aidaorantes9/Practicas-SA-B-202100239 (carpeta `P9/`) |
| **Repositorio GitOps** | https://github.com/aidaorantes9/P8_GITOPS_202100239 |
| **Punto de entrada único** | `./P9/bootstrap.sh` |
| **Tiempo esperado** | 25 a 30 min para una reconstrucción total (medido: 27 min 39 s) |

## 0. Elegir el procedimiento

| Síntoma | Procedimiento |
|---|---|
| El clúster no existe o está irrecuperable (nodos caídos, `kubectl` no conecta, se borró) | **A. Reconstrucción total** |
| El clúster funciona pero se borraron o dañaron datos de PostgreSQL | **B. Restauración de datos** |
| Un nodo se cae o hay que darle mantenimiento | **C. Pérdida de un nodo** |
| La VM estuvo suspendida o apagada varios días y hay pods atascados | **D. Reanudación tras una suspensión** |
| Un comando falla con un mensaje concreto | **Sección 6: Errores conocidos** |

## 1. Qué sobrevive a un desastre y dónde está

Todo lo necesario para reconstruir vive **fuera del clúster**. Si cualquiera de estos elementos falta, la reconstrucción no es posible y hay que recrearlo antes (sección 2).

| Elemento | Ubicación | Para qué |
|---|---|---|
| Estado de Terraform (con bloqueo) | `gs://sa-p9-202100239-tfstate/p9/cluster/` | Saber qué infraestructura existe |
| Respaldos de Velero | `gs://sa-p9-202100239-velero/` | Datos de PostgreSQL y RabbitMQ |
| Llave de Sealed Secrets | GCP Secret Manager: `sealed-secrets-tls-crt` y `sealed-secrets-tls-key` | Descifrar los secretos del repo GitOps |
| Credenciales de Velero | GCP Secret Manager: `velero-gcp-credentials` | Que Velero lea y escriba en el bucket |
| Código y manifiestos | Los dos repositorios de GitHub | Todo lo demás |
| Caché de imágenes | Contenedores `kind-cache-*` en la VM | Solo acelera; si falta, se descarga de internet |

**Ningún secreto está en los repositorios.** Terraform los lee de Secret Manager en cada ejecución.

## 2. Requisitos previos (día menos 1)

Se configuran una sola vez y **no se destruyen** en un desastre. Verifícalos antes de cualquier procedimiento.

### 2.1 Máquina anfitriona (Windows con VirtualBox)

El hipervisor de Windows debe estar **apagado**. Si está encendido, VirtualBox corre en un modo de compatibilidad varias veces más lento y la reconstrucción no termina a tiempo.

En PowerShell:

```powershell
(Get-CimInstance Win32_ComputerSystem).HypervisorPresent
```

**Esperado:** `False`. Si dice `True`, en PowerShell como administrador corre `bcdedit /set hypervisorlaunchtype off` y reinicia Windows.

La VM debe tener al menos 6 CPU y 10 GB de RAM:

```powershell
& "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" showvminfo "Linux Mint - Practica1" | Select-String "Memory size|Number of CPUs"
```

### 2.2 VM Linux: herramientas

```bash
for t in docker kind terraform kubectl helm velero gcloud gh argocd kubectl-argo-rollouts; do printf "%-24s" "$t"; command -v $t >/dev/null && echo OK || echo FALTA; done
cat /proc/sys/fs/inotify/max_user_instances
```

**Esperado:** todas `OK`, y el límite de inotify en `512` o más. Si es menor:

```bash
printf 'fs.inotify.max_user_instances=512\nfs.inotify.max_user_watches=524288\n' | sudo tee /etc/sysctl.d/99-kind.conf && sudo sysctl --system
```

### 2.3 Acceso a GCP

```bash
gcloud config configurations activate sa-p9
gcloud auth application-default print-access-token >/dev/null && echo "ADC OK"
gcloud storage ls gs://sa-p9-202100239-tfstate/p9/cluster/ gs://sa-p9-202100239-velero/
gcloud secrets list --project sa-p9-202100239 --format="value(name)"
```

**Esperado:** `ADC OK`; el bucket de estado muestra `default.tfstate`; el de Velero muestra `backups/` y `kopia/`; y existen los 3 secretos (`sealed-secrets-tls-crt`, `sealed-secrets-tls-key`, `velero-gcp-credentials`).

**Si falla `ADC OK`:** `gcloud auth application-default login` y luego `gcloud auth application-default set-quota-project sa-p9-202100239`.

**Si falta algún bucket o secreto:** no se puede continuar. Los datos de ese elemento se perdieron; consulta la sección 7.

### 2.4 Repositorio local

```bash
cd /media/sf_compartida/SA/Practicas_SA_B_202100239 2>/dev/null || { git clone https://github.com/aidaorantes9/Practicas-SA-B-202100239.git ~/Practicas-SA-B-202100239 && cd ~/Practicas-SA-B-202100239; }
git pull --ff-only && git log --oneline -1
```

**Todos los comandos siguientes se ejecutan desde la raíz de este repositorio.**

## A. Reconstrucción total del clúster

### A.1 Confirmar que no hay otro Terraform ejecutándose

Dos ejecuciones simultáneas corromperían el estado. El bloqueo lo impide, pero conviene confirmarlo:

```bash
gcloud storage ls gs://sa-p9-202100239-tfstate/p9/cluster/
```

**Esperado:** solo `default.tfstate`. **Si aparece `default.tflock`**, otra persona o un proceso interrumpido tiene el bloqueo. Ve a la sección 6, error "Error acquiring the state lock", **antes de seguir**.

### A.2 Ejecutar el bootstrap

```bash
./P9/bootstrap.sh
```

El script no requiere ninguna intervención. Imprime una línea con hora por cada fase y deja un registro completo en `P9/evidencias/bootstrap/bootstrap-<fecha>.log`.

| Fase | Mensaje en pantalla | Duración típica |
|---|---|---|
| 0 | `Fase 0: cache de imagenes` | menos de 1 min |
| | `Cluster ausente pero registrado en el estado remoto: se reconcilia` (solo si el clúster desapareció) | segundos |
| 1 | `Fase 1: Terraform crea el cluster kind (3 nodos)` | 1 a 2 min |
| 2 | `Fase 2: Terraform instala Calico, llaves, base P8, ArgoCD y la app raiz` | 6 a 8 min |
| 3 | `Applications sanas: X/13`, cada 30 s | 12 a 16 min |
| 4 | `Fase 4: cluster nuevo -> restauracion de datos...` | 2 a 3 min |
| Fin | `FIN bootstrap: sistema completo en X min Y s` | |

**Orden interno, para entender qué espera a qué:**

1. **Terraform** crea el clúster kind (3 nodos) y espera a que Calico esté disponible.
2. **Terraform** crea en el clúster la llave de Sealed Secrets y las credenciales de Velero (leídas de Secret Manager), los namespaces, quotas y RBAC, e instala ArgoCD.
3. **Terraform** instala la aplicación raíz `root-app` (namespace `argocd`), que apunta a la carpeta `argocd/` del repo GitOps.
4. **ArgoCD** crea el resto por *sync waves*; cada wave espera a que la anterior esté sana:
   - Wave -3: `sealed-secrets`, `argo-rollouts`, `kyverno`, `velero`.
   - Wave -2: `kyverno-policies`.
   - Wave -1: `secrets-production` (requiere el controlador de Sealed Secrets y la llave).
   - Wave 0: `infra-production` (PostgreSQL, RabbitMQ y CronJobs; requiere el secreto descifrado).
   - Wave 1: los 5 servicios (requieren la base de datos y Argo Rollouts).
5. **Fase 4:** si el clúster es nuevo, la base de datos está vacía, y el script restaura PostgreSQL desde **el último respaldo programado anterior al inicio del bootstrap**.

**Si el script se detiene** con `ERROR en la linea N`, muestra las últimas líneas del registro. Busca el mensaje en la sección 6, corrígelo y **vuelve a ejecutar `./P9/bootstrap.sh`**: es seguro repetirlo, porque no destruye nada que ya exista.

**Si muestra `TIEMPO AGOTADO`** (45 min en la fase 3), imprime qué Applications no están sanas. Busca su nombre en la sección 6.

### A.3 Verificar la reconstrucción

Ejecuta cada bloque y compara con el resultado esperado.

**1. Plataforma completa:**

```bash
export KUBECONFIG=$HOME/.kube/kind-sa-p9.yaml
kubectl get nodes
kubectl get applications -n argocd | grep -v "Synced        Healthy"
```

**Esperado:** 3 nodos `Ready`, y la segunda lista vacía (solo el encabezado).

**2. Secretos descifrados con la llave original:**

```bash
kubectl get secrets -n kube-system -l sealedsecrets.bitnami.com/sealed-secrets-key --no-headers
kubectl get sealedsecret,secret -n production --no-headers | grep sa-p8-app-secrets
```

**Esperado:** **una sola** llave, llamada `sealed-secrets-key-restaurada`; el SealedSecret en `True` y el Secret existente. Si aparece una segunda llave con otro nombre, el controlador generó una nueva: los secretos del repo no se podrán descifrar (sección 6).

**3. Datos restaurados:**

```bash
kubectl exec -n production sa-p8-postgresql-0 -c postgresql -- bash -c 'PGPASSWORD="${POSTGRES_PASSWORD:-$(cat "$POSTGRES_PASSWORD_FILE" 2>/dev/null)}" psql -U app_user -d cronjobs_db -tAc "SELECT count(*), min(executed_at), max(executed_at) FROM cron_executions;"'
```

**Esperado:** varias filas; la más antigua es de días anteriores, y la más reciente, de minutos antes del desastre. Si devuelve `0` o `relation does not exist`, la fase 4 no restauró: ejecuta el procedimiento B.

**4. Políticas y entrega progresiva:**

```bash
kubectl run prueba-latest --image=nginx:latest -n production --dry-run=server 2>&1 | grep -c "blocked"
kubectl argo rollouts list rollouts -n production
velero schedule get
```

**Esperado:** `1` (Kyverno bloquea `latest`); 5 Rollouts `Healthy` con `2/2`; el Schedule `velero-production-cada-15min` en `Enabled`.

## B. Restauración de datos de PostgreSQL

Usa este procedimiento cuando el clúster funciona pero los datos se borraron o dañaron.

### B.1 Elegir el respaldo

```bash
export KUBECONFIG=$HOME/.kube/kind-sa-p9.yaml
kubectl get backups.velero.io -n velero -l velero.io/schedule-name=velero-production-cada-15min --sort-by=.status.startTimestamp -o custom-columns=NOMBRE:.metadata.name,FASE:.status.phase,INICIO:.status.startTimestamp | tail -5
```

Las horas están en UTC (hora de Guatemala + 6). **Elige el último `Completed` anterior al momento del daño.** Un respaldo tomado después del daño contiene los datos ya dañados.

### B.2 Restaurar

Opción automática: el script elige el último respaldo anterior a un instante dado (en segundos epoch; sin argumento, usa el instante actual):

```bash
./P9/scripts/restaurar-datos.sh "$(date -d '2026-10-12 14:30' +%s)"
```

Cambia la fecha por el momento del daño. El script pausa ArgoCD, elimina el volumen dañado, restaura, espera a PostgreSQL y reactiva ArgoCD.

Opción manual, con el respaldo elegido en B.1:

```bash
B=NOMBRE_DEL_RESPALDO
for a in root-app infra-production; do kubectl patch application $a -n argocd --type merge -p '{"spec":{"syncPolicy":{"automated":null}}}'; done
kubectl delete sts sa-p8-postgresql -n production --wait=true
kubectl delete pvc data-sa-p8-postgresql-0 -n production --wait=true
velero restore create restore-manual-$(date +%H%M) --from-backup "$B" --selector "app.kubernetes.io/name=postgresql,app.kubernetes.io/instance=sa-p8" --include-resources statefulsets,pods,persistentvolumeclaims,persistentvolumes --wait
kubectl wait --for=condition=Ready pod/sa-p8-postgresql-0 -n production --timeout=600s
for a in root-app infra-production; do kubectl patch application $a -n argocd --type merge -p '{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}'; done
```

**Importante:**
- **ArgoCD se pausa antes** de borrar: si no, recrea un PostgreSQL vacío mientras Velero restaura.
- **`persistentvolumes` debe estar en la lista.** Sin él, el volumen restaurado queda `Pending` para siempre (sección 6).
- **No olvides reactivar ArgoCD** al final. Mientras esté pausado, no aplica cambios de Git.

### B.3 Verificar

```bash
velero restore get | tail -1
kubectl exec -n production sa-p8-postgresql-0 -c postgresql -- bash -c 'PGPASSWORD="${POSTGRES_PASSWORD:-$(cat "$POSTGRES_PASSWORD_FILE" 2>/dev/null)}" psql -U app_user -d cronjobs_db -tAc "SELECT count(*), max(executed_at) FROM cron_executions;"'
kubectl get applications -n argocd | grep -v "Synced        Healthy"
```

**Esperado:** restore en `Completed`; filas con la última poco antes del respaldo; ninguna Application fuera de `Synced Healthy`.

**Pérdida esperada:** los datos escritos entre el respaldo elegido y el daño (hasta unos 15 a 18 min).

## C. Pérdida de un nodo

Los 5 servicios tienen 2 réplicas en nodos distintos y un PodDisruptionBudget, así que **siguen respondiendo** si se pierde un worker. PostgreSQL y RabbitMQ tienen 1 réplica con volumen atado a su nodo: **si su nodo cae, quedan `Pending` hasta que el nodo vuelva.**

Para un mantenimiento planificado:

```bash
export KUBECONFIG=$HOME/.kube/kind-sa-p9.yaml
kubectl get pods -n production -o custom-columns=POD:.metadata.name,NODO:.spec.nodeName | grep -E "postgres|rabbit"
kubectl drain NODO --ignore-daemonsets --delete-emptydir-data --timeout=300s
```

Al terminar el mantenimiento:

```bash
kubectl uncordon NODO
kubectl get pods -n production | grep -vE "Running|Completed"
```

**Esperado:** tras el `uncordon`, ningún pod fuera de `Running` o `Completed` en 1 a 2 minutos.

**Si un nodo no vuelve** y ahí vivía PostgreSQL: los datos siguen en el respaldo. Ejecuta el procedimiento A (reconstrucción total), que restaura desde el último respaldo.

Para medir la disponibilidad durante un drenaje: `./P9/scripts/prueba-drenaje.sh sa-p9-worker`.

## D. Reanudación tras una suspensión

Al reanudar la VM tras varios días:

```bash
export KUBECONFIG=$HOME/.kube/kind-sa-p9.yaml
kubectl get nodes
kubectl get pods -A | grep -vE "Running|Completed"
velero backup get | head -4
```

- **Pods en `Terminating` o `ContainerCreating` por más de 2 minutos:** el token de red de Calico venció. Ejecuta `kubectl delete pod -n calico-system -l k8s-app=calico-node`, espera 1 minuto y repite el segundo comando.
- **Sin respaldos, o el último tiene más de 15 minutos:** los respaldos vencen a las 72 horas. Si la VM estuvo detenida más tiempo, Velero los borró. Crea uno inmediatamente:

```bash
velero backup create manual-$(date +%Y%m%d-%H%M) --from-schedule velero-production-cada-15min --wait
```

## 6. Errores conocidos

| Mensaje o síntoma | Causa | Solución |
|---|---|---|
| `Error acquiring the state lock` | Un Terraform anterior se interrumpió y dejó el bloqueo | Confirma que **nadie** más ejecuta Terraform. Luego `cd P9/terraform && terraform force-unlock -force <ID>`, con el ID que muestra el mensaje |
| `could not locate any control plane nodes for cluster named 'sa-p9'` | El estado registra un clúster que ya no existe | El bootstrap lo corrige solo. A mano: `cd P9/terraform && terraform state rm kind_cluster.this` |
| `Kubernetes cluster unreachable` o `dial tcp 127.0.0.1:80` en Terraform | Se aplicó todo junto mientras el clúster se reemplazaba | Usa siempre `./P9/bootstrap.sh`, que aplica en dos fases |
| `kyverno` en `OutOfSync/Degraded` con `metadata.annotations: Too long` | Las CRDs de Kyverno son muy grandes | Ya corregido con `Replace=true`. Si reaparece: `kubectl patch application kyverno -n argocd --type merge -p '{"operation":{"sync":{"syncOptions":["CreateNamespace=true","ServerSide=true","Replace=true"]}}}'` |
| Una Application corrigió su error en Git pero sigue fallando | ArgoCD reintenta la versión anterior | `kubectl config set-context --current --namespace=argocd && argocd app terminate-op NOMBRE --core && kubectl config set-context --current --namespace=default` |
| PVC de PostgreSQL `Pending` tras restaurar | El restore no incluyó `persistentvolumes` | Repite B.2 incluyendo `persistentvolumes` |
| Pods `Terminating` o `ContainerCreating` sin avanzar; `Unauthorized` de Calico | Token de Calico vencido | `kubectl delete pod -n calico-system -l k8s-app=calico-node` |
| Recurso rechazado por `validate.kyverno.svc-fail` | El recurso incumple una política (`latest`, sin `limits`, o sin `runAsNonRoot` por contenedor) | Corrige el manifiesto en Git; **no** desactives la política |
| `load average` muy alto, `etcd` con timeouts, todo lento | Hipervisor de Windows activo (modo NEM) | Sección 2.1 |
| Segunda llave de Sealed Secrets, o SealedSecret sin descifrar | El controlador arrancó antes de que existiera la llave restaurada | Borra la llave nueva (`kubectl delete secret -n kube-system NOMBRE`), reinicia el controlador (`kubectl rollout restart deploy/sealed-secrets-controller -n kube-system`) y verifica A.3 paso 2 |

## 7. Si se pierde algo de la sección 1

| Pérdida | Consecuencia | Qué hacer |
|---|---|---|
| Bucket de estado de Terraform | Terraform no sabe qué existe | Recrear el bucket; `bootstrap.sh` crea todo desde cero. Si quedó un clúster vivo, eliminarlo antes con `kind delete cluster --name sa-p9` |
| Bucket de Velero | **Pérdida irreversible de los datos** | Reconstruir sin datos; no hay recuperación |
| Llave de Sealed Secrets en Secret Manager | Los secretos del repo GitOps son ilegibles | Generar valores nuevos, sellarlos con la llave nueva (`kubeseal`), subirlos al repo GitOps y guardar la llave nueva en Secret Manager |
| Repositorios de GitHub | Sin código ni manifiestos | Restaurar desde un clon local |

## 8. Lista para el día de la calificación

1. **Al menos 20 minutos antes**, enciende la VM y ejecuta el procedimiento D.
2. Crea un respaldo y verifica que existe: `velero backup create calificacion-$(date +%H%M) --from-schedule velero-production-cada-15min --wait && velero backup get | head -3`.
3. Verifica que todo esté sano: `kubectl get applications -n argocd | grep -v "Synced        Healthy"` (debe mostrar solo el encabezado).
4. Verifica que el estado no tenga bloqueo: `gcloud storage ls gs://sa-p9-202100239-tfstate/p9/cluster/` (solo `default.tfstate`).
