import { pool } from '../database/init.js';
import { broadcastToSignage } from '../websocket/server.js';
import { getDefaultBackgroundConfig, getDefaultQuestionnaireConfig } from '../utils/signage.js';

export async function getSignageConfig(req, res) {
  try {
    await pool.query('SELECT 1');
  } catch (dbError) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { id } = req.params;
  const result = await pool.query(
    `SELECT id, location_name, qr_code_url, is_active, background_config, timezone, logo_url, text_config,
            questionnaire_config,
            (created_at AT TIME ZONE 'UTC')::timestamptz as created_at 
     FROM signage_instances WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Signage not found' });
  }

  const signage = result.rows[0];
  const backgroundConfig = signage.background_config || { type: 'solid', color: '#ffffff' };
  const rawQc = signage.questionnaire_config;
  const questionnaireConfig = (rawQc && (rawQc.initial_options?.length > 0 || Object.keys(rawQc.questions_by_gender || {}).length > 0))
    ? rawQc
    : getDefaultQuestionnaireConfig();

  res.json({
    ...signage,
    background_config: backgroundConfig,
    questionnaire_config: questionnaireConfig
  });
}

export async function getSignageStats(req, res) {
  try {
    await pool.query('SELECT 1');
  } catch (dbError) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { id } = req.params;
  const stats = await pool.query(
    `SELECT 
      COUNT(DISTINCT u.id) as total_users,
      COUNT(DISTINCT qs.id) as total_sessions
     FROM signage_instances si
     LEFT JOIN users u ON u.signage_id = si.id
     LEFT JOIN questionnaire_sessions qs ON qs.signage_id = si.id
     WHERE si.id = $1`,
    [id]
  );

  res.json(stats.rows[0]);
}

export async function updateSignageBackground(req, res) {
  try {
    await pool.query('SELECT 1');
  } catch (dbError) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { id } = req.params;
  const { background_config } = req.body;
  if (!background_config?.type) return res.status(400).json({ error: 'background_config.type required' });

  const validTypes = ['gradient', 'solid', 'image'];
  if (!validTypes.includes(background_config.type)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
  }

  const result = await pool.query(
    `UPDATE signage_instances SET background_config = $1 WHERE id = $2 RETURNING *`,
    [JSON.stringify(background_config), id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Signage not found' });

  broadcastToSignage(id, { type: 'background_update', background_config });
  res.json(result.rows[0]);
}

export async function getSignageBackground(req, res) {
  try {
    await pool.query('SELECT 1');
  } catch (dbError) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { id } = req.params;
  const result = await pool.query('SELECT background_config FROM signage_instances WHERE id = $1', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Signage not found' });

  let bg = result.rows[0].background_config;
  if (typeof bg === 'string') try { bg = JSON.parse(bg); } catch (e) { bg = null; }
  if (!bg || typeof bg !== 'object') {
    bg = { type: 'gradient', colors: ['#be185d', '#831843', '#500724'] };
  }
  res.json(bg);
}

export async function listSignageInstances(req, res) {
  try {
    await pool.query('SELECT 1');
  } catch (dbError) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const result = await pool.query(
    `SELECT id, location_name, is_active, timezone, logo_url,
            (created_at AT TIME ZONE 'UTC')::timestamptz as created_at 
     FROM signage_instances ORDER BY created_at DESC`
  );
  res.json(result.rows.map(r => ({ ...r, created_at: r.created_at?.toISOString?.() || r.created_at })));
}

export async function createSignageInstance(req, res) {
  try {
    await pool.query('SELECT 1');
  } catch (dbError) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { id, location_name, timezone = 'UTC', is_active = true, background_config } = req.body;
  if (!id || !location_name) return res.status(400).json({ error: 'id and location_name required' });

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    return res.status(400).json({ error: `Invalid timezone: ${timezone}` });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(id)) {
    return res.status(400).json({ error: 'id must be alphanumeric and underscores only' });
  }

  const bgConfig = background_config || getDefaultBackgroundConfig();
  const qcConfig = getDefaultQuestionnaireConfig();
  const textConfig = JSON.stringify({
    idleHeading: 'Are you ready to play?',
    idleSubtitle: 'Scan to begin',
    sessionActiveMessage: 'Session in progress — use your phone',
    footerText: 'Use your phone camera to scan',
    resultMobileHeading: 'Thank You!',
    resultMobileMessage: 'Your response has been submitted.',
    resultMobileEmoji: '💕'
  });
  const result = await pool.query(
    `INSERT INTO signage_instances (id, location_name, timezone, is_active, background_config, questionnaire_config, text_config, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, (NOW() AT TIME ZONE 'UTC')::timestamp)
     RETURNING id, location_name, timezone, is_active, background_config, questionnaire_config, text_config, (created_at AT TIME ZONE 'UTC')::timestamptz as created_at`,
    [id, location_name, timezone, is_active, JSON.stringify(bgConfig), JSON.stringify(qcConfig), textConfig]
  );

  await pool.query(
    `INSERT INTO validation_config (signage_id, allow_multiple_submissions, max_submissions_per_email)
     VALUES ($1, false, 1)`,
    [id]
  );

  const row = result.rows[0];
  res.status(201).json({ ...row, created_at: row.created_at?.toISOString?.() || row.created_at });
}

export async function updateSignageInstance(req, res) {
  try {
    await pool.query('SELECT 1');
  } catch (dbError) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { id } = req.params;
  const { location_name, is_active, timezone, logo_url, text_config, questionnaire_config } = req.body;

  const isSuperAdmin = req.auth?.role === 'superadmin';
  const updates = [];
  const values = [];
  let n = 1;

  if (location_name !== undefined && isSuperAdmin) { updates.push(`location_name = $${n++}`); values.push(location_name); }
  if (is_active !== undefined && isSuperAdmin) { updates.push(`is_active = $${n++}`); values.push(is_active); }
  if (timezone !== undefined && isSuperAdmin) { updates.push(`timezone = $${n++}`); values.push(timezone); }
  if (logo_url !== undefined) { updates.push(`logo_url = $${n++}`); values.push(logo_url); }
  if (text_config !== undefined) { updates.push(`text_config = $${n++}`); values.push(JSON.stringify(text_config)); }
  if (questionnaire_config !== undefined) { updates.push(`questionnaire_config = $${n++}`); values.push(JSON.stringify(questionnaire_config)); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(id);
  const result = await pool.query(
    `UPDATE signage_instances SET ${updates.join(', ')} WHERE id = $${n} RETURNING *`,
    values
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Signage not found' });
  res.json(result.rows[0]);
}

export async function deleteSignageInstance(req, res) {
  try {
    await pool.query('SELECT 1');
  } catch (dbError) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { id } = req.params;
  const check = await pool.query('SELECT id FROM signage_instances WHERE id = $1', [id]);
  if (check.rows.length === 0) return res.status(404).json({ error: 'Signage not found' });

  await pool.query('DELETE FROM questionnaire_sessions WHERE signage_id = $1', [id]);
  await pool.query('DELETE FROM users WHERE signage_id = $1', [id]);
  await pool.query('DELETE FROM validation_config WHERE signage_id = $1', [id]);
  await pool.query('DELETE FROM instance_admin_credentials WHERE signage_id = $1', [id]);
  await pool.query('DELETE FROM signage_instances WHERE id = $1', [id]);

  res.json({ success: true, message: 'Instance deleted' });
}
