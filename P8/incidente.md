# Informe de incidente — Fallo inducido en `auth-service`

## Qué falló
Se modificó deliberadamente el endpoint `/health` de `auth-service` (commit `a48685d`, tag `v0.1.6`) para que devolviera un código HTTP 500 en lugar de 200, simulando un defecto de código que llega a producción sin ser detectado por las pruebas unitarias.

## Cómo se detectó
El `readinessProbe` de Kubernetes, configurado contra `/health`, comenzó a fallar inmediatamente después de que el pod canary (`v0.1.6`) arrancó. Al no lograr ponerse `Ready` dentro del `progressDeadlineSeconds` configurado, Argo Rollouts marcó automáticamente el `Rollout` como `Degraded` con el mensaje `ProgressDeadlineExceeded: ReplicaSet "auth-service-production-8568966b4f" has timed out progressing`. De forma independiente, el `AnalysisTemplate` (smoke test que ejecuta `curl` contra `/health` 5 veces) también quedó disponible como segunda capa de validación para el mismo escenario.

## Cómo se contuvo
Argo Rollouts nunca desplazó tráfico hacia la versión defectuosa: la estrategia canary mantuvo el `ReplicaSet` estable (`v0.1.5`) como el único activo y sirviendo el 100% del tráfico real durante todo el incidente. El pod canary permaneció aislado en estado `CrashLoopBackOff` sin recibir tráfico de usuarios. Al confirmar el fallo, se ejecutó `kubectl argo rollouts abort`, lo que escaló el `ReplicaSet` canario a 0 réplicas (`ScaledDown`) de forma inmediata.
**Porcentaje de tráfico afectado: 0%.**

## Tiempo de recuperación
Desde la publicación del tag `v0.1.6` (disparo del pipeline) hasta la confirmación del estado `RolloutAborted` con el `stable` restaurado como único servidor de tráfico: aproximadamente **10 minutos**, correspondientes al tiempo de build/push/firma del pipeline (~3 min) más el tiempo de detección por parte de Argo Rollouts (`progressDeadlineSeconds`, configurado en varios minutos para dar margen a los tiempos de arranque de este entorno académico).

## Cómo prevenirlo
Agregar una etapa de **prueba de humo previa al build** dentro del pipeline de CI (`p8-gitops.yml`): antes de construir la imagen, ejecutar los tests unitarios existentes más una prueba de integración ligera que levante el servicio localmente (o en un contenedor efímero) y verifique que `/health` responda 200 antes de continuar con Trivy, la firma y la publicación. Esto habría bloqueado el defecto en la etapa de CI, sin necesidad de llegar siquiera a crear un Pull Request al repositorio GitOps.
