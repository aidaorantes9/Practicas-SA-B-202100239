#!/usr/bin/env bash
# P9 - Restaura PostgreSQL desde el ultimo respaldo PROGRAMADO de Velero anterior a un instante limite.
# Uso: ./restaurar-datos.sh [epoch_limite]   (por defecto: ahora). bootstrap.sh lo invoca en la fase 4.
set -euo pipefail
NS=production
SCHEDULE=velero-production-cada-15min
SEL="app.kubernetes.io/name=postgresql,app.kubernetes.io/instance=sa-p8"
LIMITE="${1:-$(date +%s)}"
export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/kind-sa-p9.yaml}"
marca() { echo "[$(TZ=America/Guatemala date '+%Y-%m-%d %H:%M:%S')] $*"; }
autosync() {
  local p='{"spec":{"syncPolicy":{"automated":null}}}'
  [ "$1" = on ] && p='{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}'
  kubectl patch application root-app -n argocd --type merge -p "$p" >/dev/null
  kubectl patch application infra-production -n argocd --type merge -p "$p" >/dev/null
}
pg() { kubectl exec -n $NS sa-p8-postgresql-0 -c postgresql -- bash -c 'PGPASSWORD="${POSTGRES_PASSWORD:-$(cat "$POSTGRES_PASSWORD_FILE" 2>/dev/null)}" psql -U app_user -d cronjobs_db -tAc "$0"' "$1"; }

# 1. en un cluster nuevo, Velero tarda en descubrir los respaldos que ya existen en GCS
marca "Esperando que Velero sincronice los respaldos existentes en el bucket"
for i in $(seq 1 40); do
  N=$(kubectl get backups.velero.io -n velero -l velero.io/schedule-name=$SCHEDULE --no-headers 2>/dev/null | wc -l)
  [ "$N" -gt 0 ] && break; sleep 15
done
sleep 20
marca "Respaldos programados visibles: $N"

# 2. ultimo respaldo programado Completed, ANTERIOR al limite, con el volumen de PostgreSQL
B=""; B_INICIO=""
while read -r nombre fase inicio; do
  [ "$fase" = Completed ] || continue
  [[ "$nombre" == "$SCHEDULE-"* ]] || continue
  [ "$(date -d "$inicio" +%s)" -lt "$LIMITE" ] || continue
  PVB=$(kubectl get podvolumebackups.velero.io -n velero -l velero.io/backup-name=$nombre -o jsonpath='{range .items[*]}{.spec.pod.name}{"/"}{.spec.volume}{"/"}{.status.phase}{"\n"}{end}')
  if [ -z "$PVB" ] || grep -qx "sa-p8-postgresql-0/data/Completed" <<<"$PVB"; then B=$nombre; B_INICIO=$inicio; fi
done < <(kubectl get backups.velero.io -n velero -l velero.io/schedule-name=$SCHEDULE --sort-by=.status.startTimestamp -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.phase}{" "}{.status.startTimestamp}{"\n"}{end}')
[ -n "$B" ] || { marca "ERROR: no hay respaldo programado anterior al limite"; exit 1; }
marca "Respaldo elegido: $B (iniciado $(TZ=America/Guatemala date -d "$B_INICIO" '+%Y-%m-%d %H:%M:%S') hora local)"

# 3. restauracion (procedimiento validado en la prueba de restauracion)
marca "Pauso la sincronizacion automatica de ArgoCD"
autosync off
kubectl delete sts sa-p8-postgresql -n $NS --ignore-not-found --wait=true >/dev/null
kubectl wait --for=delete pod/sa-p8-postgresql-0 -n $NS --timeout=120s >/dev/null 2>&1 || true
kubectl delete pvc data-sa-p8-postgresql-0 -n $NS --ignore-not-found --wait=true --timeout=120s >/dev/null
R="restore-pg-$(TZ=America/Guatemala date +%Y%m%d-%H%M%S)"
marca "Velero restaura PostgreSQL ($R)"
velero restore create "$R" --from-backup "$B" --selector "$SEL" --include-resources statefulsets,pods,persistentvolumeclaims,persistentvolumes --wait >/dev/null
marca "Estado del restore: $(velero restore get "$R" | awk 'NR==2{print $3}')"
timeout 300 bash -c "until kubectl get pod sa-p8-postgresql-0 -n $NS >/dev/null 2>&1; do sleep 3; done"
kubectl wait --for=condition=Ready pod/sa-p8-postgresql-0 -n $NS --timeout=600s >/dev/null
marca "Reactivo la sincronizacion automatica de ArgoCD"
autosync on
marca "Datos restaurados: $(pg "SELECT count(*) || ' filas en cron_executions, ultima ' || max(executed_at) FROM cron_executions;")"
