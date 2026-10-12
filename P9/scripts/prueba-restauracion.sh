#!/usr/bin/env bash
# P9 - Prueba de restauracion de datos con Velero.
# 1) guarda las filas de cronjobs_db.cron_executions   2) DESASTRE: DROP TABLE
# 3) restaura PostgreSQL desde el ULTIMO respaldo PROGRAMADO   4) compara fila por fila y mide el RPO
set -euo pipefail
NS=production
SCHEDULE=velero-production-cada-15min
SEL="app.kubernetes.io/name=postgresql,app.kubernetes.io/instance=sa-p8"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$RAIZ/evidencias/restauracion"; mkdir -p "$DIR"
TS=$(TZ=America/Guatemala date +%Y%m%d-%H%M%S)
LOG="$DIR/restauracion-$TS.log"; ANTES="$DIR/filas-antes-$TS.csv"; DESPUES="$DIR/filas-despues-$TS.csv"
export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/kind-sa-p9.yaml}"
marca() { echo "[$(TZ=America/Guatemala date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
trap 'marca "ERROR en la linea $LINENO. ArgoCD puede haber quedado en pausa a proposito; reactivarlo con: kubectl patch application root-app -n argocd --type merge -p {\"spec\":{\"syncPolicy\":{\"automated\":{\"prune\":true,\"selfHeal\":true}}}}"' ERR
pg() { kubectl exec -n $NS sa-p8-postgresql-0 -c postgresql -- bash -c 'PGPASSWORD="${POSTGRES_PASSWORD:-$(cat "$POSTGRES_PASSWORD_FILE" 2>/dev/null)}" psql -U app_user -d cronjobs_db -tAc "$0"' "$1"; }
autosync() {
  local p='{"spec":{"syncPolicy":{"automated":null}}}'
  [ "$1" = on ] && p='{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}'
  kubectl patch application root-app -n argocd --type merge -p "$p" >/dev/null
  kubectl patch application infra-production -n argocd --type merge -p "$p" >/dev/null
}
seg() { TZ=America/Guatemala date -d "$1" +%s; }
dur() { echo "$(( $1 / 60 )) min $(( $1 % 60 )) s"; }

marca "INICIO prueba de restauracion de datos"
# 1. ultimo respaldo PROGRAMADO completado que contenga el volumen de PostgreSQL
B=""
for b in $(kubectl get backups.velero.io -n velero -l velero.io/schedule-name=$SCHEDULE --sort-by=.status.startTimestamp -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.phase}{"\n"}{end}' | awk -v s="$SCHEDULE-" '$2=="Completed" && index($1,s)==1 {print $1}' | tac); do
  if kubectl get podvolumebackups.velero.io -n velero -l velero.io/backup-name=$b -o jsonpath='{range .items[*]}{.spec.pod.name}{"/"}{.spec.volume}{"/"}{.status.phase}{"\n"}{end}' | grep -qx "sa-p8-postgresql-0/data/Completed"; then B=$b; break; fi
done
[ -n "$B" ] || { marca "No hay respaldo programado con el volumen de PostgreSQL"; exit 1; }
B_INICIO=$(TZ=America/Guatemala date -d "$(kubectl get backups.velero.io $B -n velero -o jsonpath='{.status.startTimestamp}')" '+%Y-%m-%d %H:%M:%S')
marca "Respaldo a usar: $B (iniciado $B_INICIO hora local)"

# 2. evidencia ANTES del desastre
pg "COPY (SELECT id, executed_at FROM cron_executions ORDER BY id) TO STDOUT WITH CSV" > "$ANTES"
marca "ANTES: $(wc -l < "$ANTES") filas en cron_executions; ultima: $(tail -1 "$ANTES")"

# 3. DESASTRE
T_DESASTRE=$(TZ=America/Guatemala date '+%Y-%m-%d %H:%M:%S'); E_DESASTRE=$(date +%s)
pg "DROP TABLE cron_executions;" >/dev/null
marca "DESASTRE: DROP TABLE cron_executions"
[ "$(pg "SELECT to_regclass('cron_executions') IS NULL;")" = "t" ] && marca "Verificado: la tabla ya no existe"

# 4. RECUPERACION
marca "RECUPERACION: pauso la sincronizacion automatica de ArgoCD (root-app e infra-production)"
autosync off
marca "Elimino el StatefulSet y el volumen de PostgreSQL para restaurarlos desde el respaldo"
kubectl delete sts sa-p8-postgresql -n $NS --wait=true >/dev/null
kubectl wait --for=delete pod/sa-p8-postgresql-0 -n $NS --timeout=120s >/dev/null 2>&1 || true
kubectl delete pvc data-sa-p8-postgresql-0 -n $NS --wait=true --timeout=120s >/dev/null
R="restore-pg-$TS"
marca "Velero restaura PostgreSQL desde $B (restore $R)"
velero restore create "$R" --from-backup "$B" --selector "$SEL" --include-resources statefulsets,pods,persistentvolumeclaims,persistentvolumes --wait >> "$LOG" 2>&1
marca "Estado del restore: $(velero restore get "$R" | awk 'NR==2{print $3}')"
timeout 300 bash -c "until kubectl get pod sa-p8-postgresql-0 -n $NS >/dev/null 2>&1; do sleep 3; done"
kubectl wait --for=condition=Ready pod/sa-p8-postgresql-0 -n $NS --timeout=600s >/dev/null
E_RESTAURADO=$(date +%s)
marca "PostgreSQL restaurado y listo"
marca "Reactivo la sincronizacion automatica de ArgoCD"
autosync on

# 5. VERIFICACION y RPO
pg "COPY (SELECT id, executed_at FROM cron_executions WHERE executed_at <= '$T_DESASTRE' ORDER BY id) TO STDOUT WITH CSV" > "$DESPUES"
N_A=$(wc -l < "$ANTES"); N_D=$(wc -l < "$DESPUES"); PERDIDAS=$(( N_A - N_D ))
if head -n "$N_D" "$ANTES" | cmp -s - "$DESPUES"; then
  marca "CONTENIDO VERIFICADO: las $N_D filas restauradas son IDENTICAS (id y hora) a las primeras $N_D de antes del desastre"
else
  marca "CONTENIDO CON DIFERENCIAS: comparar $ANTES y $DESPUES"
fi
ULT=$(tail -1 "$DESPUES" | cut -d, -f2)
marca "Ultima fila restaurada: $ULT"
marca "Filas perdidas: $PERDIDAS (escritas despues del respaldo): $(tail -n "$PERDIDAS" "$ANTES" | cut -d, -f2 | cut -c12-19 | tr '\n' ' ')"
marca "RPO MEDIDO (desastre - ultimo dato recuperado): $(dur $(( E_DESASTRE - $(seg "$ULT") )))"
marca "Antiguedad del respaldo al momento del desastre: $(dur $(( E_DESASTRE - $(seg "$B_INICIO") )))"
marca "Tiempo de restauracion de datos (desastre -> PostgreSQL listo): $(dur $(( E_RESTAURADO - E_DESASTRE )))"
marca "FIN. Evidencia: $LOG, $ANTES, $DESPUES"
