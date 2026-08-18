// agrupa las consultas sql relacionadas a las citas
// equivalente al repository de las practicas anteriores

const { pool } = require("../db");

async function createAppointment({ artistId, clientId, date, bodyPart, design, durationMinutes }) {
  const query = `
    INSERT INTO appointments (artist_id, client_id, date, body_part, design, duration_minutes, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'pendiente_anticipo')
    RETURNING *;
  `;
  const values = [artistId, clientId, date, bodyPart, design, durationMinutes || 60];
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function findAll() {
  const result = await pool.query("SELECT * FROM appointments ORDER BY date ASC");
  return result.rows;
}

// busca si ya existe una cita del mismo artista que choca en horario
// con la nueva cita que se quiere crear
// dos citas chocan si sus rangos de tiempo se traslapan
async function findOverlapping(artistId, date, durationMinutes) {
  const query = `
    SELECT * FROM appointments
    WHERE artist_id = $1
      AND status != 'cancelada'
      AND date < ($2::timestamp + ($3 * interval '1 minute'))
      AND (date + (duration_minutes * interval '1 minute')) > $2::timestamp
  `;
  const result = await pool.query(query, [artistId, date, durationMinutes]);
  return result.rows;
}

async function findById(id) {
  const result = await pool.query("SELECT * FROM appointments WHERE id = $1", [id]);
  return result.rows[0] || null;
}

async function updateStatus(id, status) {
  const result = await pool.query(
    "UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *",
    [status, id]
  );
  return result.rows[0] || null;
}

// registra que el cliente pago el anticipo
// si el pago es correcto, la cita pasa automaticamente de pendiente_anticipo a agendada
async function registerDeposit(id, amount) {
  const query = `
    UPDATE appointments
    SET deposit_amount = $1, deposit_paid = true, status = 'agendada'
    WHERE id = $2
    RETURNING *;
  `;
  const result = await pool.query(query, [amount, id]);
  return result.rows[0] || null;
}

module.exports = { createAppointment, findAll, findById, updateStatus, findOverlapping, registerDeposit };