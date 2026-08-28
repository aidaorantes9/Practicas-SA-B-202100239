# Prueba de carga

Ejecutar con:
    k6 run script.js

Mientras corre, en otra terminal observar el escalado:
    kubectl get hpa -n sa-p5 -w
    kubectl get pods -n sa-p5 -w