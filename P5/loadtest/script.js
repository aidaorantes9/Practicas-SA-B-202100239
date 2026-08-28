// script de carga con k6, golpea el api gateway con concurrencia creciente
// usa el catalogo de artistas via graphql, no necesita login

import http from "k6/http";
import { check, sleep } from "k6";

// concurrencia creciente en etapas, para poder ver el hpa reaccionar
export const options = {
  stages: [
    { duration: "30s", target: 10 },  // sube a 10 usuarios en 30s
    { duration: "1m", target: 30 },   // sube a 30 usuarios en 1min
    { duration: "1m", target: 50 },   // sube a 50 usuarios, aqui deberia escalar el hpa
    { duration: "1m", target: 50 },   // se mantiene en 50 para ver el escalado sostenido
    { duration: "30s", target: 0 },   // baja a 0, para ver el hpa bajar despues
  ],
};

const URL = "http://sa-platform.local/api/artists/graphql";

export default function () {
  const payload = JSON.stringify({
    query: "query { artists { id name specialty available } }",
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const res = http.post(URL, payload, params);

  check(res, {
    "status es 200": (r) => r.status === 200,
  });

  sleep(0.5);
}