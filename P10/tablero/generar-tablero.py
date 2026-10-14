import json
P={"type":"prometheus","uid":"prometheus"}
L={"type":"loki","uid":"loki"}
pid=[0]
def nid():
    pid[0]+=1; return pid[0]
def row(t,y): return {"type":"row","title":t,"id":nid(),"collapsed":False,"gridPos":{"h":1,"w":24,"x":0,"y":y},"panels":[]}
def stat(t,expr,x,y,w=4,unit="percentunit",thr=None,desc="",dec=2):
    return {"type":"stat","title":t,"id":nid(),"description":desc,"datasource":P,"gridPos":{"h":5,"w":w,"x":x,"y":y},
      "targets":[{"refId":"A","expr":expr,"datasource":P}],
      "options":{"reduceOptions":{"calcs":["lastNotNull"]},"colorMode":"background","graphMode":"none","textMode":"value"},
      "fieldConfig":{"defaults":{"unit":unit,"decimals":dec,"thresholds":{"mode":"absolute","steps":thr or [{"color":"green","value":None}]}},"overrides":[]}}
def ts(t,targets,x,y,w=12,unit="short",desc="",h=8):
    return {"type":"timeseries","title":t,"id":nid(),"description":desc,"datasource":P,"gridPos":{"h":h,"w":w,"x":x,"y":y},
      "targets":[dict(refId=chr(65+i),expr=e,legendFormat=l,datasource=P) for i,(e,l) in enumerate(targets)],
      "options":{"legend":{"displayMode":"list","placement":"bottom"},"tooltip":{"mode":"multi"}},
      "fieldConfig":{"defaults":{"unit":unit,"custom":{"lineWidth":2,"fillOpacity":10}},"overrides":[]}}
red=lambda v:{"color":"red","value":v}; yel=lambda v:{"color":"orange","value":v}; grn=lambda v:{"color":"green","value":v}
H='http_request_duration_seconds'
panels=[]; y=0
panels.append(row("SLO y presupuesto de error (ventana 7 dias)",y)); y+=1
panels+= [
 stat("SLI agendar cita (objetivo 99 %)","slo:citas_sli:ratio_rate7d",0,y,thr=[red(None),yel(0.99),grn(0.995)],desc="Proporcion de intentos de agendar cita sin error del sistema en 7 dias. Los rechazos de negocio cuentan como buenos."),
 stat("Presupuesto restante: citas","slo:citas_presupuesto:restante",4,y,thr=[red(None),yel(0.25),grn(0.5)],desc="1 = presupuesto intacto, 0 = agotado."),
 stat("SLI latencia gateway < 0,5 s (objetivo 95 %)","slo:gateway_latencia_sli:ratio_rate7d",8,y,thr=[red(None),yel(0.95),grn(0.975)]),
 stat("Presupuesto restante: latencia","slo:gateway_latencia_presupuesto:restante",12,y,thr=[red(None),yel(0.25),grn(0.5)]),
 stat("Alertas de SLO activas",'count(ALERTS{alertstate="firing",slo!=""}) or vector(0)',16,y,unit="none",dec=0,thr=[grn(None),red(1)],desc="Alertas de burn rate disparadas. Cada una trae su runbook_url."),
 stat("Tasa de error de citas (5 min)","slo:citas_error:ratio_rate5m",20,y,thr=[grn(None),yel(0.01),red(0.144)],desc="Umbral de quema rapida: 14,4 %."),
]; y+=5
panels.append(ts("Consumo del presupuesto: tasa de error de citas por ventana",[("slo:citas_error:ratio_rate5m","5 min"),("slo:citas_error:ratio_rate1h","1 h"),("vector(0.144)","umbral quema rapida (14,4 %)"),("vector(0.06)","umbral quema lenta (6 %)")],0,y,unit="percentunit",desc="Las alertas disparan cuando la ventana larga y la corta superan el mismo umbral."))
panels.append(ts("Consumo del presupuesto: peticiones lentas del gateway por ventana",[("slo:gateway_lentas:ratio_rate5m","5 min"),("slo:gateway_lentas:ratio_rate1h","1 h"),("vector(0.72)","umbral quema rapida (72 %)"),("vector(0.30)","umbral quema lenta (30 %)")],12,y,unit="percentunit")); y+=8
panels.append(row("Latencia (senal de oro 1)",y)); y+=1
panels.append(ts("Latencia p95 por servicio",[(f'histogram_quantile(0.95, sum by (app, le) (rate({H}_bucket[2m])))',"{{app}} p95")],0,y,unit="s"))
panels.append(ts("Latencia p50 y p99 del gateway",[(f'histogram_quantile(0.50, sum by (le) (rate({H}_bucket{{app="api-gateway"}}[2m])))',"p50"),(f'histogram_quantile(0.99, sum by (le) (rate({H}_bucket{{app="api-gateway"}}[2m])))',"p99"),("vector(0.5)","objetivo 0,5 s")],12,y,unit="s")); y+=8
panels.append(row("Trafico (senal de oro 2)",y)); y+=1
panels.append(ts("Peticiones por segundo por servicio",[(f'sum by (app) (rate({H}_count[2m]))',"{{app}}")],0,y,unit="reqps"))
panels.append(ts("Peticiones por segundo por ruta y version (hash del pod)",[(f'sum by (app, route, rollouts_pod_template_hash) (rate({H}_count[2m]))',"{{app}} {{route}} {{rollouts_pod_template_hash}}")],12,y,unit="reqps",desc="Durante un canary se ven por separado la version estable y la candidata.")); y+=8
panels.append(row("Errores (senal de oro 3)",y)); y+=1
panels.append(ts("Proporcion de respuestas 5xx por servicio",[(f'sum by (app) (rate({H}_count{{status_code=~"5.."}}[2m])) / sum by (app) (rate({H}_count[2m]))',"{{app}}")],0,y,unit="percentunit"))
panels.append(ts("Respuestas por codigo HTTP",[(f'sum by (app, status_code) (rate({H}_count[2m]))',"{{app}} {{status_code}}")],12,y,unit="reqps",desc="GraphQL responde 200 aunque falle; por eso los errores de negocio se miden aparte.")); y+=8
panels.append(row("Saturacion (senal de oro 4)",y)); y+=1
panels.append(ts("CPU por pod",[('sum by (pod) (rate(process_cpu_seconds_total{namespace="production"}[2m]))',"{{pod}}")],0,y,w=8,unit="short",desc="Nucleos usados. El limite de cada contenedor es 200m."))
panels.append(ts("Memoria residente por pod",[('process_resident_memory_bytes{namespace="production"}',"{{pod}}")],8,y,w=8,unit="bytes"))
panels.append(ts("Retraso del event loop de Node (p99)",[('nodejs_eventloop_lag_p99_seconds{namespace="production"}',"{{pod}}")],16,y,w=8,unit="s",desc="Si sube, el proceso esta saturado aunque la CPU no lo parezca.")); y+=8
panels.append(row("Negocio",y)); y+=1
panels.append(ts("Intentos de agendar cita por resultado",[('sum by (resultado) (rate(citas_intentos_total[2m]))',"{{resultado}}")],0,y,unit="ops",desc="exitosa, rechazada (regla del estudio) o error (falla del sistema)."))
panels.append(ts("Inicios de sesion por resultado",[('sum by (resultado) (rate(inicios_sesion_total[2m]))',"{{resultado}}")],12,y,unit="ops")); y+=8
panels.append(row("Logs con error (clic en trace_id para abrir la traza en Tempo)",y)); y+=1
panels.append({"type":"logs","title":"Logs warn y error de produccion","id":nid(),"datasource":L,"gridPos":{"h":10,"w":24,"x":0,"y":y},
  "targets":[{"refId":"A","datasource":L,"expr":'{namespace="production"} | json | level=~"warn|error"'}],
  "options":{"showTime":True,"wrapLogMessage":True,"sortOrder":"Descending","enableLogDetails":True}})
d={"title":"P10 Senales de oro","uid":"p10-senales-de-oro","tags":["p10","slo"],"timezone":"browser","schemaVersion":39,"version":1,
   "refresh":"30s","time":{"from":"now-1h","to":"now"},"editable":True,"panels":panels,"annotations":{"list":[]},"templating":{"list":[]}}
json.dump(d,open("tablero-senales-de-oro.json","w"),indent=2,ensure_ascii=True)
