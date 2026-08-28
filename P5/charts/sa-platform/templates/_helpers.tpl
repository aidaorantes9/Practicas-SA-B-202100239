{{- define "sa-platform.configmapData" -}}
DB_HOST: "{{ .Release.Name }}-postgresql"
DB_PORT: "5432"
JWT_EXPIRES_IN_SECONDS: "3600"
AUTH_SERVICE_URL: "http://{{ .Release.Name }}-auth-service:4000"
ARTISTS_SERVICE_URL: "http://{{ .Release.Name }}-artists-service:4001"
APPOINTMENTS_SERVICE_URL: "http://{{ .Release.Name }}-appointments-service:4002"
NOTIFICATION_SERVICE_URL: "http://{{ .Release.Name }}-notification-service:4003"
RABBITMQ_HOST: "{{ .Release.Name }}-rabbitmq"
RABBITMQ_PORT: "5672"
{{- end -}}

{{- define "sa-platform.fullname" -}}
{{ .Release.Name }}
{{- end -}}