# Práctica 8 — GitOps, entrega progresiva y seguridad de la cadena de suministro

## 1. Descripción general

Esta práctica evoluciona el pipeline de CI/CD de la Práctica 7 hacia un modelo GitOps completo: el repositorio de código nunca despliega directamente al clúster. En su lugar, el pipeline construye, prueba, escanea y firma las imágenes, y abre un Pull Request automático a un repositorio de manifiestos independiente. **ArgoCD** es el único componente que aplica cambios al clúster, y **Argo Rollouts** ejecuta la entrega progresiva (canary) condicionada al resultado de un análisis automatizado.

- Repositorio de código: [Practicas-SA-B-202100239](https://github.com/aidaorantes9/Practicas-SA-B-202100239)
- Repositorio de manifiestos GitOps: [P8_GITOPS_202100239](https://github.com/aidaorantes9/P8_GITOPS_202100239)

## 2. Infraestructura como código (Terraform)

Namespaces (`staging`, `production`), ResourceQuota, LimitRange, ServiceAccounts y RBAC de mínimo privilegio, todo declarado en [`P8/terraform/`](terraform/). Evidencia de `plan` y `apply` en [`P8/docs/`](docs/).

## 3. Empaquetado con Helm

El chart de la Práctica 5 ([`P5/charts/sa-platform/`](../P5/charts/sa-platform/)) se adaptó para esta práctica:
- Cada uno de los 5 microservicios usa `Rollout` (Argo Rollouts) en vez de `Deployment`, con estrategia canary de 3 pasos de promoción (`setWeight: 20 → analysis → setWeight: 50 → analysis → setWeight: 100`).
- Cada servicio tiene su propio `AnalysisTemplate`, que ejecuta un smoke test real contra `/health`.
- El chart puede instalarse completo (como en la Práctica 7) o solo como infraestructura compartida (Postgres/RabbitMQ), habilitando/deshabilitando cada servicio individualmente vía `<servicio>.enabled`.
- Validado con `helm lint --with-subcharts`.

## 4. GitOps con ArgoCD

10 `Application` (uno por servicio y ambiente) más 2 `Application` de infraestructura compartida y 2 de gestión de secretos, todos en [`P8_GITOPS_202100239/argocd/`](https://github.com/aidaorantes9/P8_GITOPS_202100239/tree/main/argocd).

## 5. Pipeline CI/CD ([`p8-gitops.yml`](../.github/workflows/p8-gitops.yml))

Build → test → `helm lint` → Trivy (bloquea CVE críticas) → build y push de la imagen a GHCR → firma con Cosign (keyless, identidad OIDC de GitHub Actions) → SBOM → Pull Request automático al repositorio GitOps con `peter-evans/create-pull-request`.

**Evidencia de ejecución exitosa:** [run #35292983668](https://github.com/aidaorantes9/Practicas-SA-B-202100239/actions/runs/35292983668) (tag `v0.1.5`).

## 6. Gestión de secretos

Sealed Secrets: los secretos de la aplicación (credenciales de base de datos, JWT, claves de cifrado) están sellados con `kubeseal` y viven en [`P8_GITOPS_202100239/secrets/`](https://github.com/aidaorantes9/P8_GITOPS_202100239/tree/main/secrets) como `SealedSecret`, nunca en texto plano. El controlador los desencripta dentro del clúster.

## 7. Entrega progresiva y reversión automática

*(Sección en construcción — pendiente demostrar el fallo inducido)*

## 8. Cadena de suministro y políticas (Kyverno)

*(Sección pendiente — aún no se ha instalado Kyverno ni las 3 políticas obligatorias)*

## 9. Informe de incidente

*(Pendiente — se completará una vez ejecutado el fallo inducido)*

## 10. Preguntas teóricas

*(Se responderán en vivo durante la calificación, según lo indicado en el foro del curso)*

## Tabla de enlaces obligatoria

| Ítem | Enlace o dato |
|---|---|
| Repositorio GitOps | https://github.com/aidaorantes9/P8_GITOPS_202100239 |
| Aplicación en ArgoCD | `auth-service-production`, namespace `production` |
| Ejecución exitosa del pipeline | https://github.com/aidaorantes9/Practicas-SA-B-202100239/actions/runs/35292983668 |
| Reversión automática | *(pendiente)* |
| Despliegue rechazado por política | *(pendiente)* |
| Bloqueo por vulnerabilidad crítica | *(pendiente — se agregará el PR bloqueado por Trivy)* |
| Imagen firmada | `ghcr.io/aidaorantes9/sa-practica-auth-service:v0.1.5` |
| Reporte de prueba de carga | *(no aplica — el auxiliar indicó en el foro que esta sección queda anulada)* |
| Video demostrativo | *(pendiente)* |

## Diagrama del flujo GitOps

*(Pendiente)*
