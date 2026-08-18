// consultas sql relacionadas a las notificaciones

const { pool } = require("../db");

async function createNotification({ appointmentId, clientId, message }) {
  const query = `
    INSERT INTO notifications (appointment_id, client_id, message, status)
    VALUES ($1, $2, $3, 'enviado')
    RETURNING *;
  `;
  const result = await pool.query(query, [appointmentId, clientId, message]);
  return result.rows[0];
}

async function findByClientId(clientId) {
  const result = await pool.query(
    "SELECT * FROM notifications WHERE client_id = $1 ORDER BY created_at DESC",
    [clientId]
  );
  return result.rows;
}

module.exports = { createNotification, findByClientId };