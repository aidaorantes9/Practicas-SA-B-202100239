# Velero (File System Backup) NO respalda volumenes hostPath y los omite sin error.
# Con esta anotacion, local-path crea PVs de tipo "local", que Velero si respalda.
resource "kubernetes_annotations" "sc_local" {
  api_version = "storage.k8s.io/v1"
  kind        = "StorageClass"
  metadata {
    name = "standard"
  }
  annotations = {
    "defaultVolumeType" = "local"
  }
  depends_on = [terraform_data.nodos_listos]
}
