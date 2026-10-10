#!/usr/bin/env bash
# P9 - Punto de entrada UNICO de la reconstruccion (dia 0).
# Requisitos: ver P9/docs/runbook.md (gcloud ADC, docker, kind, terraform, kubectl).
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$RAIZ/evidencias/bootstrap"; mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/bootstrap-$(TZ=America/Guatemala date +%Y%m%d-%H%M%S).log"
export KUBECONFIG="$HOME/.kube/kind-sa-p9.yaml"
marca() { echo "[$(TZ=America/Guatemala date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
trap 'marca "ERROR en la linea $LINENO, ultimas lineas del log:"; tail -n 15 "$LOG"' ERR
T0=$(date +%s)

marca "INICIO bootstrap"
marca "Fase 0: cache de imagenes"
"$RAIZ/scripts/cache-imagenes.sh" >>"$LOG" 2>&1

cd "$RAIZ/terraform"
terraform init -input=false >>"$LOG" 2>&1
# el provider de kind no detecta un cluster eliminado: si falta, se reconcilia el estado
if terraform state list 2>/dev/null | grep -qx 'kind_cluster.this' && ! kind get clusters 2>/dev/null | grep -qx 'sa-p9'; then
  marca "Cluster ausente pero registrado en el estado remoto: se reconcilia"
  terraform state rm kind_cluster.this >>"$LOG" 2>&1
fi

marca "Fase 1: Terraform crea el cluster kind (3 nodos)"
terraform apply -target=kind_cluster.this -auto-approve -input=false >>"$LOG" 2>&1
marca "Fase 2: Terraform instala Calico, llaves, base P8, ArgoCD y la app raiz"
terraform apply -auto-approve -input=false >>"$LOG" 2>&1
marca "Terraform terminado: ArgoCD toma el control"

marca "Fase 3: esperando que todas las Applications esten Synced y Healthy"
LIMITE=$((SECONDS + 2700))
while :; do
  ESTADO=$(kubectl get applications -n argocd -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.sync.status}{" "}{.status.health.status}{"\n"}{end}' 2>/dev/null || true)
  TOTAL=$(printf '%s\n' "$ESTADO" | grep -c . || true)
  OK=$(printf '%s\n' "$ESTADO" | grep -c ' Synced Healthy$' || true)
  marca "Applications sanas: $OK/$TOTAL"
  if [ "$TOTAL" -gt 1 ] && [ "$OK" -eq "$TOTAL" ]; then break; fi
  if [ "$SECONDS" -gt "$LIMITE" ]; then marca "TIEMPO AGOTADO"; printf '%s\n' "$ESTADO" | tee -a "$LOG"; exit 1; fi
  sleep 30
done
printf '%s\n' "$ESTADO" >>"$LOG"
T1=$(date +%s)
marca "FIN bootstrap: sistema completo en $(( (T1-T0)/60 )) min $(( (T1-T0)%60 )) s"
