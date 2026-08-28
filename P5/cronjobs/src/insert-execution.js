// cronjob 1: se ejecuta cada 2 minutos
// inserta un registro con la fecha y hora de ejecucion en gmt-6 y el carne

const { pool, initDb } = require("./db");

const CARNET = process.env.STUDENT_CARNET || "202100239";

async function main() {
  await initDb();

  // gmt-6 es guatemala, restamos 6 horas a la hora utc actual
  const ahora = new Date();
  const gmtMenos6 = new Date(ahora.getTime() - 6 * 60 * 60 * 1000);

  await pool.query(
    "INSERT INTO cron_executions (executed_at, carnet) VALUES ($1, $2)",
    [gmtMenos6, CARNET]
  );

  console.log(`cronjob-1: registro insertado a las ${gmtMenos6.toISOString()} (gmt-6), carne ${CARNET}`);

  await pool.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("cronjob-1: error", error.message);
  process.exit(1);
});