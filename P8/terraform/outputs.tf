output "namespaces_creados" {
  value = [for ns in kubernetes_namespace.ambiente : ns.metadata[0].name]
}

output "service_accounts_creados" {
  value = [for sa in kubernetes_service_account.sa : "${sa.metadata[0].namespace}/${sa.metadata[0].name}"]
}
