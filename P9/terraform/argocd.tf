resource "helm_release" "argocd" {
  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  version          = "10.10.1"
  namespace        = "argocd"
  create_namespace = true
  timeout          = 900
  values           = [file("${path.module}/valores/argocd.yaml")]
  depends_on       = [terraform_data.nodos_listos]
}

# app-of-apps: a partir de aqui ArgoCD es el unico que aplica cambios al cluster
resource "helm_release" "root_app" {
  name       = "root-app"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argocd-apps"
  version    = "2.0.6"
  namespace  = "argocd"
  values     = [file("${path.module}/valores/root-app.yaml")]
  depends_on = [
    helm_release.argocd,
    kubernetes_secret.sealed_secrets_key,
    kubernetes_secret.velero_credentials,
    kubernetes_resource_quota.quota,
    kubernetes_limit_range.limits,
    kubernetes_role_binding.enlace,
  ]
}
