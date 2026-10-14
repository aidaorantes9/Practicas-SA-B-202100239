{{- define "sa-platform.configmapData" -}}
DB_HOST: "{{ .Release.Name }}-postgresql"
DB_PORT: "5432"
JWT_EXPIRES_IN_SECONDS: "3600"
AUTH_SERVICE_URL: "http://{{ include "sa-platform.svcName" (dict "ctx" . "svc" "auth-service") }}:4000"
ARTISTS_SERVICE_URL: "http://{{ include "sa-platform.svcName" (dict "ctx" . "svc" "artists-service") }}:4001"
APPOINTMENTS_SERVICE_URL: "http://{{ include "sa-platform.svcName" (dict "ctx" . "svc" "appointments-service") }}:4002"
NOTIFICATION_SERVICE_URL: "http://{{ include "sa-platform.svcName" (dict "ctx" . "svc" "notification-service") }}:4003"
RABBITMQ_HOST: "{{ .Release.Name }}-rabbitmq"
RABBITMQ_PORT: "5672"
{{- end -}}

{{- define "sa-platform.fullname" -}}
{{ .Release.Name }}
{{- end -}}
{{/* P10: nombre del Service de cada microservicio. Sin sufijo: <release>-<servicio> (P5 a P8).
     Con sufijo (GitOps, una app por servicio): <servicio><sufijo>, p. ej. auth-service-production */}}
{{- define "sa-platform.svcName" -}}
{{- if .ctx.Values.serviciosSufijo -}}{{ .svc }}{{ .ctx.Values.serviciosSufijo }}{{- else -}}{{ .ctx.Release.Name }}-{{ .svc }}{{- end -}}
{{- end -}}
