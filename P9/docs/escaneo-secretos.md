# Escaneo de secretos antes de publicar el repositorio

Herramienta: gitleaks (imagen zricethezav/gitleaks), sobre todo el historial (46 commits), con `--redact`.
Fecha: 2026-10-08. Resultado: 3 hallazgos, ninguno es un secreto vigente.

| # | Archivo | Regla | Analisis | Veredicto |
|---|---|---|---|---|
| 1 | P5/charts/sa-platform/cookies.txt (commit f533e45) | jwt | Cookie de prueba de curl para el dominio local `sa-platform.local`; el token vencio el 2026-08-28. El archivo se elimino del repo en el commit e558a1e. | Sin riesgo vigente |
| 2 | P5/charts/sa-platform/values.example.yaml | generic-api-key | Valor de ejemplo; se verifico que es distinto de la llave real (values-secrets.yaml, ignorado por git). | Falso positivo |
| 3 | P2/auth-service/.env.example | generic-api-key | Valor de ejemplo; se verifico que es distinto del .env real y de values-secrets.yaml. | Falso positivo |

Los secretos reales nunca se versionan en texto plano: viven cifrados como SealedSecrets en el repositorio GitOps,
y la llave de descifrado se respalda en GCP Secret Manager (ver runbook).
