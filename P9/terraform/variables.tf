variable "gcp_project" {
  type    = string
  default = "sa-p9-202100239"
}

variable "cluster_name" {
  type    = string
  default = "sa-p9"
}

variable "kubeconfig_path" {
  type    = string
  default = "~/.kube/kind-sa-p9.yaml"
}
