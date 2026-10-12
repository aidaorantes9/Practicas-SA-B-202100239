#!/usr/bin/env bash
# P9 - Punto de entrada UNICO de la reconstruccion (dia 0).
# Fases: 0 cache | 1 cluster kind | 2 Calico, llaves, base P8, ArgoCD y app raiz
#        3 ArgoCD sincroniza todo | 4 datos desde Velero (solo si el cluster es nuevo)
# Requisitos de dia -1 y procedimiento completo: P9/docs/runbook.md
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$RAIZ/evidencias/bootstrap"; mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/bootstrap-$(TZ=America/Guatemala date +%Y%m%d-%H%M%S).log"
export KUBECONFIG="$HOME/.kube/kind-sa-p9.yaml"
marca() { echo "[$(TZ=America/Guatemala date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
trap 'marca "ERROR en la linea $LINENO, ultimas lineas del log:"; tail -n 15 "$LOG"' ERR
esperar_apps() {
  local limite=$((SECONDS + 2700)) estado total ok
  while :; do
    estado=$(kubectl get applications -n argocd -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.sync.status}{" "}{.status.health.status}{"\n"}{end}' 2>/dev/null || true)
    total=$(printf '%s\n' "$estado" | grep -c . || true)
    ok=$(printf '%s\n' "$estado" | grep -c ' Synced Healthy$' || true)
    marca "Applications sanas: $ok/$total"
    if [ "$total" -gt 1 ] && [ "$ok" -eq "$total" ]; then printf '%s\n' "$estado" >>"$LOG"; return 0; fi
    if [ "$SECONDS" -gt "$limite" ]; then marca "TIEMPO AGOTADO"; printf '%s\n' "$estado" | tee -a "$LOG"; return 1; fi
    sleep 30
  done
}

T0=$(date +%s)
marca "INICIO bootstrap"
NUEVO=si
kind get clusters 2>/dev/null | grep -qx sa-p9 && NUEVO=no
marca "Cluster nuevo (no existia al iniciar): $NUEVO"
marca "Fase 0: cache de imagenes"
"$RAIZ/scripts/cache-imagenes.sh" >>"$LOG" 2>&1

cd "$RAIZ/terraform"
terraform init -input=false >>"$LOG" 2>&1
# el provider de kind no detecta un cluster eliminado: si falta, se reconcilia el estado
if [ "$NUEVO" = si ] && terraform state list 2>/dev/null | grep -qx 'kind_cluster.this'; then
  marca "Cluster ausente pero registrado en el estado remoto: se reconcilia"
  terraform state rm kind_cluster.this >>"$LOG" 2>&1
fi

marca "Fase 1: Terraform crea el cluster kind (3 nodos)"
terraform apply -target=kind_cluster.this -auto-approve -input=false >>"$LOG" 2>&1
marca "Fase 2: Terraform instala Calico, llaves, base P8, ArgoCD y la app raiz"
terraform apply -auto-approve -input=false >>"$LOG" 2>&1
marca "Terraform terminado: ArgoCD toma el control"

marca "Fase 3: esperando que todas las Applications esten Synced y Healthy"
esperar_apps
if [ "$NUEVO" = si ]; then
  marca "Fase 4: cluster nuevo -> restauracion de datos desde el ultimo respaldo anterior al desastre"
  "$RAIZ/scripts/restaurar-datos.sh" "$T0" 2>&1 | tee -a "$LOG"
  marca "Fase 4: verificando que todo siga sano tras la restauracion"
  esperar_apps
else
  marca "Fase 4 omitida: el cluster ya existia y sus datos no se tocan"
fi
T1=$(date +%s)
marca "FIN bootstrap: sistema completo en $(( (T1-T0)/60 )) min $(( (T1-T0)%60 )) s"
