import { pool } from '../database/init.js';
import XLSX from 'xlsx';
import { formatTimestamp } from '../utils/timezone.js';

export async function getUsers(req, res) {
  try {
    await pool.query('SELECT 1');
  } catch {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { signageId, limit = 100, offset = 0 } = req.query;
  let query = `
    SELECT u.id, u.name, u.email, u.phone, u.gender, u.partner_name, u.partner_email, u.partner_phone, u.partner_gender,
           u.signage_id, (u.timestamp AT TIME ZONE 'UTC')::timestamptz as timestamp, si.timezone
    FROM users u
    LEFT JOIN signage_instances si ON u.signage_id = si.id
  `;
  const params = [];
  let n = 1;
  if (signageId) { query += ` WHERE u.signage_id = $${n++}`; params.push(signageId); }
  query += ` ORDER BY u.timestamp DESC LIMIT $${n++} OFFSET $${n}`;
  params.push(parseInt(limit), parseInt(offset));

  const result = await pool.query(query, params);
  res.json(result.rows);
}

export async function getSessions(req, res) {
  try {
    await pool.query('SELECT 1');
  } catch {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { signageId, status, limit = 100, offset = 0 } = req.query;
  let query = `
    SELECT qs.id, qs.user_id, qs.signage_id, qs.status, qs.questionnaire_answers,
           (qs.timestamp AT TIME ZONE 'UTC')::timestamptz as timestamp,
           u.name, u.email, u.phone, u.gender, u.partner_name, u.partner_email, u.partner_phone, u.partner_gender,
           si.timezone
    FROM questionnaire_sessions qs
    LEFT JOIN users u ON qs.user_id = u.id
    LEFT JOIN signage_instances si ON qs.signage_id = si.id
    WHERE 1=1
  `;
  const params = [];
  let n = 1;
  if (signageId) { query += ` AND qs.signage_id = $${n++}`; params.push(signageId); }
  if (status) { query += ` AND qs.status = $${n++}`; params.push(status); }
  query += ` ORDER BY qs.timestamp DESC LIMIT $${n++} OFFSET $${n}`;
  params.push(parseInt(limit), parseInt(offset));

  const result = await pool.query(query, params);
  res.json(result.rows);
}

export async function exportUsers(req, res) {
  try {
    const { signageId, format = 'csv' } = req.query;
    let query = `
      SELECT u.id, u.name, u.email, u.phone, u.gender, u.partner_name, u.partner_email, u.partner_phone, u.partner_gender,
             (u.timestamp AT TIME ZONE 'UTC')::timestamptz as registered_at, u.signage_id, si.location_name, si.timezone
      FROM users u
      LEFT JOIN signage_instances si ON u.signage_id = si.id
    `;
    const params = [];
    if (signageId) { query += ` WHERE u.signage_id = $1`; params.push(signageId); }
    query += ` ORDER BY u.timestamp DESC`;

    const result = await pool.query(query, params);
    const users = result.rows;

    const rows = users.map(u => ({
      'User ID': u.id,
      'Name': u.name,
      'Email': u.email,
      'Phone': u.phone,
      'Gender': u.gender || '',
      'Partner Name': u.partner_name || '',
      'Partner Email': u.partner_email || '',
      'Partner Phone': u.partner_phone || '',
      'Partner Gender': u.partner_gender || '',
      'Registered At': formatTimestamp(u.registered_at, u.timezone || 'UTC'),
      'Signage ID': u.signage_id,
      'Location': u.location_name || '-'
    }));

    if (format === 'xlsx' || format === 'xls') {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Users');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=users_${new Date().toISOString().split('T')[0]}.xlsx`);
      res.send(buf);
    } else {
      const headers = Object.keys(rows[0] || {});
      const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=users_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    }
  } catch (err) {
    console.error('Export users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function exportSessions(req, res) {
  try {
    const { signageId, status, format = 'csv' } = req.query;
    let query = `
      SELECT qs.id as session_id, qs.status, (qs.timestamp AT TIME ZONE 'UTC')::timestamptz as session_date,
             u.name, u.email, u.phone, u.gender, u.partner_name, u.partner_email, u.partner_phone, u.partner_gender,
             qs.questionnaire_answers, qs.signage_id, si.location_name, si.timezone
      FROM questionnaire_sessions qs
      LEFT JOIN users u ON qs.user_id = u.id
      LEFT JOIN signage_instances si ON qs.signage_id = si.id
      WHERE 1=1
    `;
    const params = [];
    let n = 1;
    if (signageId) { query += ` AND qs.signage_id = $${n++}`; params.push(signageId); }
    if (status) { query += ` AND qs.status = $${n++}`; params.push(status); }
    query += ` ORDER BY qs.timestamp DESC`;

    const result = await pool.query(query, params);
    const sessions = result.rows;

    const rows = sessions.map(s => ({
      'Session ID': s.session_id,
      'Status': s.status,
      'Date': formatTimestamp(s.session_date, s.timezone || 'UTC'),
      'Name': s.name,
      'Email': s.email,
      'Phone': s.phone,
      'Gender': s.gender || '',
      'Partner Name': s.partner_name || '',
      'Partner Email': s.partner_email || '',
      'Partner Phone': s.partner_phone || '',
      'Partner Gender': s.partner_gender || '',
      'Answers': JSON.stringify(s.questionnaire_answers || {}),
      'Signage ID': s.signage_id,
      'Location': s.location_name || '-'
    }));

    if (format === 'xlsx' || format === 'xls') {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Sessions');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=sessions_${new Date().toISOString().split('T')[0]}.xlsx`);
      res.send(buf);
    } else {
      const headers = Object.keys(rows[0] || {});
      const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=sessions_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    }
  } catch (err) {
    console.error('Export sessions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
