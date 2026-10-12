#!/usr/bin/env bash
# P9 - Simula la perdida TOTAL del cluster: elimina los 3 nodos de kind (y con ellos los volumenes).
# La hora que imprime es el inicio del RTO. Luego se recupera con: ./P9/bootstrap.sh
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$RAIZ/evidencias/reconstruccion"; mkdir -p "$DIR"
LOG="$DIR/desastre-$(TZ=America/Guatemala date +%Y%m%d-%H%M%S).log"
marca() { echo "[$(TZ=America/Guatemala date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
export KUBECONFIG="$HOME/.kube/kind-sa-p9.yaml"

marca "Estado ANTES del desastre:"
kubectl get nodes 2>&1 | tee -a "$LOG"
kubectl get applications -n argocd --no-headers 2>&1 | awk '{print "  "$1, $2, $3}' | tee -a "$LOG"
marca "DESASTRE: se eliminan los 3 nodos del cluster (perdida total, incluidos los volumenes)"
kind delete cluster --name sa-p9 2>&1 | tee -a "$LOG"
marca "Verificacion:"
docker ps -a --format '{{.Names}}' | grep sa-p9 | tee -a "$LOG" || marca "  ningun nodo sa-p9 existe"
kubectl get nodes 2>&1 | head -1 | tee -a "$LOG" || true
marca "CLUSTER DESTRUIDO. Inicio del cronometro del RTO. Recuperar con: ./P9/bootstrap.sh"
