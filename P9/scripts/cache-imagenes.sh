#!/usr/bin/env bash
# Dia -1: cache de imagenes (pull-through) FUERA del cluster.
# Si el cache no esta disponible, containerd cae automaticamente al registry original.
set -euo pipefail
CACHE_DIR="$HOME/p9-cache"
docker network inspect kind >/dev/null 2>&1 || docker network create kind >/dev/null
declare -A REMOTO=( [dockerio]="https://registry-1.docker.io" [ghcrio]="https://ghcr.io" [quayio]="https://quay.io" [registryk8sio]="https://registry.k8s.io" )
declare -A HOST=(   [dockerio]="docker.io" [ghcrio]="ghcr.io" [quayio]="quay.io" [registryk8sio]="registry.k8s.io" )
for n in "${!REMOTO[@]}"; do
  c="kind-cache-$n"
  mkdir -p "$CACHE_DIR/data/$n" "$CACHE_DIR/certs.d/${HOST[$n]}"
  if ! docker inspect "$c" >/dev/null 2>&1; then
    docker run -d --restart=always --name "$c" --network kind \
      -e REGISTRY_PROXY_REMOTEURL="${REMOTO[$n]}" \
      -v "$CACHE_DIR/data/$n:/var/lib/registry" registry:2 >/dev/null
  fi
  docker start "$c" >/dev/null
  printf 'server = "%s"\n\n[host."http://%s:5000"]\n  capabilities = ["pull", "resolve"]\n' "${REMOTO[$n]}" "$c" > "$CACHE_DIR/certs.d/${HOST[$n]}/hosts.toml"
done
docker ps --filter name=kind-cache --format '{{.Names}}\t{{.Status}}'
