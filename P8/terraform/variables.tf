variable "namespaces" {
  description = "Los dos ambientes de la plataforma: staging y production"
  type        = list(string)
  default     = ["staging", "production"]
}

variable "services" {
  description = "Los 5 microservicios que necesitan su propio ServiceAccount y Role"
  type        = list(string)
  default     = ["auth-service", "artists-service", "appointments-service", "notification-service", "api-gateway"]
}

# mismos valores que ya se usaron y probaron en la practica 5
variable "quota_requests_cpu" {
  default = "2"
}
variable "quota_requests_memory" {
  default = "2Gi"
}
variable "quota_limits_cpu" {
  default = "4"
}
variable "quota_limits_memory" {
  default = "4Gi"
}
variable "quota_max_pods" {
  default = "30"
}

variable "limit_default_cpu" {
  default = "200m"
}
variable "limit_default_memory" {
  default = "128Mi"
}
variable "limit_default_request_cpu" {
  default = "50m"
}
variable "limit_default_request_memory" {
  default = "64Mi"
}
