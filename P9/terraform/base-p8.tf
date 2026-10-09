# Recursos base heredados de la Practica 8 (namespaces, quotas, LimitRange, ServiceAccounts y RBAC)
# los 2 namespaces de la plataforma
resource "kubernetes_namespace" "ambiente" {
  for_each = toset(var.namespaces)

  metadata {
    name = each.value
  }
}

# limita el consumo total de recursos en cada namespace
# mismos valores que se usaron en la practica 5
resource "kubernetes_resource_quota" "quota" {
  for_each = toset(var.namespaces)

  metadata {
    name      = "sa-p8-quota"
    namespace = each.value
  }

  spec {
    hard = {
      "requests.cpu"    = var.quota_requests_cpu
      "requests.memory" = var.quota_requests_memory
      "limits.cpu"      = var.quota_limits_cpu
      "limits.memory"   = var.quota_limits_memory
      "pods"            = var.quota_max_pods
    }
  }

  depends_on = [kubernetes_namespace.ambiente]
}

# valores por defecto si algun contenedor no especifica sus propios recursos
resource "kubernetes_limit_range" "limits" {
  for_each = toset(var.namespaces)

  metadata {
    name      = "sa-p8-limits"
    namespace = each.value
  }

  spec {
    limit {
      type = "Container"
      default = {
        cpu    = var.limit_default_cpu
        memory = var.limit_default_memory
      }
      default_request = {
        cpu    = var.limit_default_request_cpu
        memory = var.limit_default_request_memory
      }
    }
  }

  depends_on = [kubernetes_namespace.ambiente]
}

# una cuenta de servicio por cada combinacion de namespace x microservicio
locals {
  namespace_service_pairs = setproduct(var.namespaces, var.services)
}

resource "kubernetes_service_account" "sa" {
  for_each = { for pair in local.namespace_service_pairs : "${pair[0]}-${pair[1]}" => pair }

  metadata {
    name      = each.value[1]
    namespace = each.value[0]
  }

  depends_on = [kubernetes_namespace.ambiente]
}

# rol de minimo privilegio, con la regla mas minima posible (leer su propia identidad)
# ninguno de los 5 microservicios necesita hablarle a la api de kubernetes
resource "kubernetes_role" "rol" {
  depends_on = [kubernetes_namespace.ambiente]
  for_each   = { for pair in local.namespace_service_pairs : "${pair[0]}-${pair[1]}" => pair }

  metadata {
    name      = "${each.value[1]}-role"
    namespace = each.value[0]
  }

  rule {
    api_groups     = [""]
    resources      = ["serviceaccounts"]
    resource_names = [each.value[1]]
    verbs          = ["get"]
  }
}

resource "kubernetes_role_binding" "enlace" {
  depends_on = [kubernetes_namespace.ambiente]
  for_each   = { for pair in local.namespace_service_pairs : "${pair[0]}-${pair[1]}" => pair }

  metadata {
    name      = "${each.value[1]}-rolebinding"
    namespace = each.value[0]
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.rol[each.key].metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.sa[each.key].metadata[0].name
    namespace = each.value[0]
  }
}
