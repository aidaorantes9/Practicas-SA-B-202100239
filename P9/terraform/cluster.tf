resource "kind_cluster" "this" {
  name            = var.cluster_name
  node_image      = "kindest/node:v1.31.0"
  kubeconfig_path = pathexpand(var.kubeconfig_path)
  wait_for_ready  = false # sin CNI los nodos no quedan Ready hasta instalar Calico

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    networking {
      disable_default_cni = true
      pod_subnet          = "192.168.0.0/16"
    }

    node { role = "control-plane" }
    node { role = "worker" }
    node { role = "worker" }
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
}

resource "terraform_data" "nodos_listos" {
  depends_on = [helm_release.calico]
  provisioner "local-exec" {
    command = "kubectl --kubeconfig ${kind_cluster.this.kubeconfig_path} wait --for=condition=Ready nodes --all --timeout=900s"
  }
}
