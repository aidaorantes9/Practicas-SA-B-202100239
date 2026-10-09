locals {
  cache_certs_d = pathexpand("~/p9-cache/certs.d")
}

resource "kind_cluster" "this" {
  name            = var.cluster_name
  node_image      = "kindest/node:v1.31.0"
  kubeconfig_path = pathexpand(var.kubeconfig_path)
  wait_for_ready  = false # sin CNI los nodos no quedan Ready hasta instalar Calico

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    # los nodos buscan imagenes primero en el cache local (scripts/cache-imagenes.sh)
    containerd_config_patches = [
      <<-TOML
      [plugins."io.containerd.grpc.v1.cri".registry]
        config_path = "/etc/containerd/certs.d"
      TOML
    ]

    networking {
      disable_default_cni = true
      pod_subnet          = "192.168.0.0/16"
    }

    node {
      role = "control-plane"
      extra_mounts {
        host_path      = local.cache_certs_d
        container_path = "/etc/containerd/certs.d"
      }
    }
    node {
      role = "worker"
      extra_mounts {
        host_path      = local.cache_certs_d
        container_path = "/etc/containerd/certs.d"
      }
    }
    node {
      role = "worker"
      extra_mounts {
        host_path      = local.cache_certs_d
        container_path = "/etc/containerd/certs.d"
      }
    }
  }
}

resource "helm_release" "calico" {
  name             = "calico"
  repository       = "https://docs.tigera.io/calico/charts"
  chart            = "tigera-operator"
  version          = "v3.29.3"
  namespace        = "tigera-operator"
  create_namespace = true
  timeout          = 900

  set {
    name  = "apiServer.enabled"
    value = "false"
  }
}

# espera la salud real de Calico, no solo que los nodos digan Ready
resource "terraform_data" "nodos_listos" {
  depends_on       = [helm_release.calico]
  triggers_replace = [kind_cluster.this.endpoint]
  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<-CMD
      export KUBECONFIG=${kind_cluster.this.kubeconfig_path}
      timeout 600 bash -c 'until kubectl get tigerastatus calico >/dev/null 2>&1; do sleep 5; done'
      kubectl wait --for=condition=Available tigerastatus/calico --timeout=900s
      kubectl wait --for=condition=Ready nodes --all --timeout=300s
    CMD
  }
}
