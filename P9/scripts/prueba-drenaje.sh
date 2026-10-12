#!/usr/bin/env bash
# P9 - Prueba de perdida de nodo: drena un worker mientras una sonda consulta /health en rondas
# de los 5 servicios (5 consultas por ronda + 1 s de pausa), y cuenta las respuestas distintas de 200.
# Uso: ./prueba-drenaje.sh [nodo]   (por defecto sa-p9-worker)
set -euo pipefail
NODO="${1:-sa-p9-worker}"
NS=production
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$RAIZ/evidencias/drenaje"; mkdir -p "$DIR"
TS=$(TZ=America/Guatemala date +%Y%m%d-%H%M%S)
LOG="$DIR/drenaje-$NODO-$TS.log"
SONDA_LOG="$DIR/sonda-$NODO-$TS.log"
export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/kind-sa-p9.yaml}"
marca() { echo "[$(TZ=America/Guatemala date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
estado() { kubectl get pods -n $NS --no-headers -o custom-columns=POD:.metadata.name,FASE:.status.phase,NODO:.spec.nodeName | grep -vE "smoke|cron|sonda" | awk '{printf "  %-52s %-10s %s\n",$1,$2,$3}' | tee -a "$LOG"; }

marca "INICIO prueba de drenaje del nodo $NODO"
kubectl delete pod sonda-drenaje -n $NS --ignore-not-found >/dev/null
kubectl apply -f - >/dev/null <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: sonda-drenaje
  namespace: $NS
  labels:
    role: smoke-test
spec:
  nodeSelector:
    kubernetes.io/hostname: sa-p9-control-plane
  tolerations:
    - key: node-role.kubernetes.io/control-plane
      operator: Exists
      effect: NoSchedule
  restartPolicy: Never
  securityContext:
    runAsNonRoot: true
    runAsUser: 100
  containers:
    - name: sonda
      image: curlimages/curl:8.10.1
      env:
        - name: TZ
          value: CST6
      resources:
        requests: {cpu: 50m, memory: 32Mi}
        limits: {cpu: 100m, memory: 64Mi}
      securityContext:
        runAsNonRoot: true
        runAsUser: 100
        allowPrivilegeEscalation: false
      command: ["sh", "-c"]
      args:
        - |
          while true; do
            l="\$(date +%H:%M:%S)"
            for s in api-gateway:3000 auth-service:4000 artists-service:4001 appointments-service:4002 notification-service:4003; do
              c=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://\${s%%:*}-production:\${s##*:}/health || true)
              l="\$l \${s%%-*}=\$c"
            done
            echo "\$l"; sleep 1
          done
EOF
kubectl wait --for=condition=Ready pod/sonda-drenaje -n $NS --timeout=120s >/dev/null
marca "Sonda lista en el control-plane; 20 s de linea base"
sleep 20
marca "Estado ANTES del drenaje:"; estado

marca "DRAIN de $NODO: inicia"
kubectl drain "$NODO" --ignore-daemonsets --delete-emptydir-data --timeout=300s 2>&1 | tee -a "$LOG" || marca "drain termino con advertencias (ver arriba)"
marca "DRAIN de $NODO: completado; se observa 60 s con el nodo fuera de servicio"
sleep 60
marca "Estado DURANTE (nodo $NODO cordoned):"; estado

kubectl uncordon "$NODO" | tee -a "$LOG"
marca "UNCORDON de $NODO; 30 s finales de observacion"
sleep 30
kubectl logs sonda-drenaje -n $NS > "$SONDA_LOG"
kubectl delete pod sonda-drenaje -n $NS --wait=false >/dev/null

TOTAL=$(grep -c . "$SONDA_LOG")
D=$(( $(date -d "$(tail -1 "$SONDA_LOG" | cut -d' ' -f1)" +%s) - $(date -d "$(head -1 "$SONDA_LOG" | cut -d' ' -f1)" +%s) ))
marca "RESUMEN: $TOTAL rondas en ${D} s (una ronda de 5 consultas cada ~$(( D / TOTAL )) s)"
for s in api auth artists appointments notification; do
  F=$(grep -o " $s=[0-9]*" "$SONDA_LOG" | grep -vc "=200$" || true)
  marca "  $s: $F respuestas distintas de 200"
done
marca "FIN. Detalle segundo a segundo: $SONDA_LOG"
