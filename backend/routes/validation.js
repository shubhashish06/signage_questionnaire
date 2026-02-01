import { pool } from '../database/init.js';

export async function getValidationConfig(req, res) {
  try {
    await pool.query('SELECT 1');
  } catch {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { signageId } = req.params;
  const result = await pool.query('SELECT * FROM validation_config WHERE signage_id = $1', [signageId]);

  if (result.rows.length === 0) {
    return res.json({
      signage_id: signageId,
      allow_multiple_submissions: false,
      max_submissions_per_email: 1,
      max_submissions_per_phone: 1,
      time_window_hours: null,
      check_signage_ids: null
    });
  }
  res.json(result.rows[0]);
}

export async function updateValidationConfig(req, res) {
  try {
    await pool.query('SELECT 1');
  } catch {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { signageId } = req.params;
  const { allow_multiple_submissions, max_submissions_per_email, max_submissions_per_phone, time_window_hours, check_signage_ids } = req.body;

  const result = await pool.query(`
    INSERT INTO validation_config (signage_id, allow_multiple_submissions, max_submissions_per_email, max_submissions_per_phone, time_window_hours, check_signage_ids, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    ON CONFLICT (signage_id) DO UPDATE SET
      allow_multiple_submissions = COALESCE($2, validation_config.allow_multiple_submissions),
      max_submissions_per_email = COALESCE($3, validation_config.max_submissions_per_email),
      max_submissions_per_phone = COALESCE($4, validation_config.max_submissions_per_phone),
      time_window_hours = $5,
      check_signage_ids = $6,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [
    signageId,
    allow_multiple_submissions ?? false,
    max_submissions_per_email ?? 1,
    max_submissions_per_phone ?? 1,
    time_window_hours || null,
    check_signage_ids || null
  ]);

  res.json(result.rows[0]);
}
