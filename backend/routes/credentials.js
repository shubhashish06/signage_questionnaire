import bcrypt from 'bcrypt';
import { pool } from '../database/init.js';

export async function setInstanceCredentials(req, res) {
  const { id } = req.params;
  const { email, password } = req.body || {};
  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const check = await pool.query('SELECT id FROM signage_instances WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    return res.status(404).json({ error: 'Instance not found' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO instance_admin_credentials (signage_id, email, password_hash, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (signage_id) DO UPDATE SET email = $2, password_hash = $3, updated_at = NOW()`,
    [id, email.trim().toLowerCase(), passwordHash]
  );
  res.json({ success: true, email: email.trim() });
}

export async function getInstanceCredentials(req, res) {
  const { id } = req.params;
  const result = await pool.query(
    'SELECT email FROM instance_admin_credentials WHERE signage_id = $1',
    [id]
  );
  if (result.rows.length === 0) {
    return res.json({ configured: false, email: null });
  }
  res.json({ configured: true, email: result.rows[0].email });
}
