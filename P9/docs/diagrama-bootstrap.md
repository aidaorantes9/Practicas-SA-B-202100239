# Diagrama del bootstrap: Práctica 9

Orden de reconstrucción y dependencias entre componentes, desde la pérdida total del clúster hasta el sistema completo con sus datos. Los tiempos son los medidos en la reconstrucción cronometrada del 12/10/2026 (RTO total: 27 min 39 s).

**Leyenda:**

| Color | Significado |
|---|---|
| 🟥 Rojo | **Manual.** Solo dos acciones: los prerrequisitos de día menos 1 (una sola vez, nunca se destruyen) y ejecutar `./P9/bootstrap.sh` |
| 🟦 Azul | **Automático, Terraform** (estado remoto en GCS con bloqueo) |
| 🟩 Verde | **Automático, ArgoCD** (app-of-apps con sync waves) |
| 🟪 Morado | **Automático, Velero** (restauración de datos) |
| ⬜ Gris | **Externo al clúster.** Sobrevive al desastre |

Las flechas continuas indican **orden** (lo de abajo no empieza hasta que lo de arriba termina). Las punteadas indican **lectura de una dependencia externa**.

```mermaid
flowchart TD
    classDef manual fill:#fde2e2,stroke:#c0392b,stroke-width:2px,color:#000
    classDef tf fill:#dbe9fb,stroke:#2563eb,color:#000
    classDef argo fill:#dcf5e3,stroke:#16a34a,color:#000
    classDef velero fill:#ece0fb,stroke:#7c3aed,color:#000
    classDef ext fill:#eeeeee,stroke:#666,stroke-dasharray:4 3,color:#000

    subgraph D1["DIA MENOS 1: manual, una sola vez, no se destruye"]
        direction LR
        HOST["Host: VirtualBox con VT-x<br/>VM 6 CPU, 10 GB, inotify 512"]:::manual
        GCPSETUP["GCP sa-p9-202100239:<br/>2 buckets, 3 secretos,<br/>cuenta de servicio de Velero"]:::manual
    end

    subgraph EXT["EXTERNO AL CLUSTER: sobrevive al desastre"]
        direction LR
        TFSTATE[("GCS tfstate<br/>estado + bloqueo")]:::ext
        SM[("Secret Manager<br/>llave Sealed Secrets<br/>credenciales Velero")]:::ext
        BACKUPS[("GCS velero<br/>respaldos cada 15 min")]:::ext
        GIT[("GitHub<br/>repo codigo + repo GitOps")]:::ext
        CACHE[("Cache de imagenes<br/>kind-cache-*")]:::ext
    end

    D1 --> EXT

    DESASTRE(["DESASTRE 15:20:26<br/>se pierden los 3 nodos y todos los volumenes"]):::manual
    START["./P9/bootstrap.sh<br/>UNICO PASO MANUAL"]:::manual
    DESASTRE --> START

    subgraph F12["FASES 0 a 2: Terraform, 8 min 46 s"]
        F0["Fase 0: cache de imagenes<br/>y reconciliacion del estado"]:::tf
        F1["Fase 1: cluster kind<br/>1 control-plane + 2 workers"]:::tf
        CALICO["Calico: espera tigerastatus<br/>Available"]:::tf
        BASE["Llave Sealed Secrets restaurada<br/>Credenciales Velero<br/>StorageClass local<br/>Namespaces, quotas, RBAC P8"]:::tf
        ARGOCD["ArgoCD<br/>con salud de Applications"]:::tf
        ROOT["root-app en namespace argocd<br/>apunta a argocd/ del repo GitOps"]:::tf
        F0 --> F1 --> CALICO --> BASE --> ARGOCD --> ROOT
    end

    START --> F0

    subgraph F3["FASE 3: ArgoCD app-of-apps, 15 min 23 s"]
        W3["Wave -3: controladores<br/>sealed-secrets, argo-rollouts,<br/>kyverno, velero"]:::argo
        W2["Wave -2: kyverno-policies<br/>sin latest, limits, runAsNonRoot"]:::argo
        W1["Wave -1: secrets-production<br/>SealedSecret descifrado"]:::argo
        W0["Wave 0: infra-production<br/>PostgreSQL, RabbitMQ, CronJobs"]:::argo
        WS["Wave 1: 5 servicios<br/>Rollouts canary, 2 replicas,<br/>PDB y anti-afinidad"]:::argo
        W3 --> W2 --> W1 --> W0 --> WS
    end

    ROOT --> W3

    F4["FASE 4: Velero restaura PostgreSQL<br/>desde el ultimo respaldo<br/>anterior al desastre, 2 min 59 s"]:::velero
    FIN(["SISTEMA COMPLETO 15:48:05<br/>13/13 Applications Synced/Healthy<br/>con datos restaurados"]):::velero

    WS --> F4 --> FIN

    TFSTATE -.-> F0
    CACHE -.-> F1
    SM -.-> BASE
    GIT -.-> ROOT
    BACKUPS -.-> F4
```

## Dependencias críticas

| Componente | Depende de | Qué pasa si no se respeta el orden |
|---|---|---|
| Calico | Clúster kind sin CNI propio | Sin red, ningún pod arranca, incluido ArgoCD |
| Llave de Sealed Secrets | Secret Manager | Si el controlador arranca **antes** de que exista, genera una llave nueva y los SealedSecrets del repo quedan ilegibles. Por eso la crea Terraform, antes de la app raíz |
| StorageClass `local` | Clúster | Con el tipo por defecto (`hostPath`), Velero omite los volúmenes **sin error**: los respaldos quedan sin datos |
| kyverno-policies (wave -2) | CRDs de Kyverno (wave -3) | Las políticas fallan porque su tipo no existe |
| secrets-production (wave -1) | Controlador de Sealed Secrets (wave -3) | El SealedSecret no se descifra |
| infra-production (wave 0) | Secret descifrado (wave -1) | PostgreSQL y RabbitMQ no arrancan sin sus contraseñas |
| 5 servicios (wave 1) | Argo Rollouts (wave -3) y PostgreSQL (wave 0) | Sin el CRD `Rollout` no se crean; sin base de datos no pasan `/health` |
| Restauración de datos (fase 4) | Velero (wave -3) y el StatefulSet de PostgreSQL (wave 0) | Velero en un clúster nuevo debe sincronizar primero los respaldos que ya existen en GCS |

## Qué es automático y qué es manual

- **Manual, una sola vez (día menos 1):** configurar el host y la VM, y crear en GCP los buckets, los secretos y la cuenta de servicio de Velero. Nada de esto se pierde en un desastre del clúster.
- **Manual, en cada recuperación:** **solo** ejecutar `./P9/bootstrap.sh`.
- **Automático:** todo lo demás, incluida la reconciliación del estado de Terraform cuando el clúster desaparece y la restauración de los datos.
