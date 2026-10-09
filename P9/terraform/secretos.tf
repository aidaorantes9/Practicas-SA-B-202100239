data "google_secret_manager_secret_version" "ss_crt" { secret = "sealed-secrets-tls-crt" }
data "google_secret_manager_secret_version" "ss_key" { secret = "sealed-secrets-tls-key" }
data "google_secret_manager_secret_version" "velero" { secret = "velero-gcp-credentials" }

# Llave original de Sealed Secrets: se crea ANTES del controlador para que la adopte
resource "kubernetes_secret" "sealed_secrets_key" {
  metadata {
    name      = "sealed-secrets-key-restaurada"
    namespace = "kube-system"
    labels    = { "sealedsecrets.bitnami.com/sealed-secrets-key" = "active" }
  }
  type = "kubernetes.io/tls"
  data = {
    "tls.crt" = data.google_secret_manager_secret_version.ss_crt.secret_data
    "tls.key" = data.google_secret_manager_secret_version.ss_key.secret_data
  }
}

resource "kubernetes_namespace" "velero" {
  metadata { name = "velero" }
}

resource "kubernetes_secret" "velero_credentials" {
  metadata {
    name      = "velero-gcp-credentials"
    namespace = kubernetes_namespace.velero.metadata[0].name
  }
  data = { cloud = data.google_secret_manager_secret_version.velero.secret_data }
}
