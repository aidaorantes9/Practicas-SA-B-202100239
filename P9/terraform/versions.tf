terraform {
  required_version = ">= 1.10"

  # Estado remoto en GCS: versionado y con bloqueo nativo
  backend "gcs" {
    bucket = "sa-p9-202100239-tfstate"
    prefix = "p9/cluster"
  }

  required_providers {
    kind       = { source = "tehcyx/kind", version = "~> 0.6" }
    google     = { source = "hashicorp/google", version = ">= 6.0, < 8.0" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.31" }
    helm       = { source = "hashicorp/helm", version = "~> 2.17" }
  }
}
