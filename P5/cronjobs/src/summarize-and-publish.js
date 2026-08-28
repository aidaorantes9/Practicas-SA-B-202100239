// cronjob 2: se ejecuta cada 10 minutos
// consulta los registros del cronjob 1, agrupa por hora, y publica el resumen

const { pool, initDb } = require("./db");
const { publishSummary } = require("./rabbitmq");

async function main() {
  await initDb();

  // agrupamos por hora usando date_trunc de postgres
  const resultado = await pool.query(`
    SELECT date_trunc('hour', executed_at) AS hora, COUNT(*) AS cantidad
    FROM cron_executions
    GROUP BY hora
    ORDER BY hora DESC
  `);

  const resumen = {
    generadoEn: new Date().toISOString(),
    ejecucionesPorHora: resultado.rows.map((fila) => ({
      hora: fila.hora,
      cantidad: parseInt(fila.cantidad, 10),
    })),
  };

  console.log("cronjob-2: resumen calculado", JSON.stringify(resumen));

  await publishSummary(resumen);

  await pool.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("cronjob-2: error", error.message);
  process.exit(1);
});