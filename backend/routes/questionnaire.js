import { pool } from '../database/init.js';
import { broadcastToSignage } from '../websocket/server.js';
import { normalizeEmail, normalizePhone } from '../utils/validation.js';
import { activeTokens } from './tokens.js';

export async function broadcastQuestion(req, res) {
  const { signageId, token, clear, sessionStarted, questionIndex, question, options, timerSeconds } = req.body;

  if (!signageId || !token) {
    return res.status(400).json({ error: 'signageId and token required' });
  }

  const tokenData = activeTokens.get(token);
  if (!tokenData || Date.now() > tokenData.expiresAt || tokenData.signageId !== signageId) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  if (sessionStarted) {
    broadcastToSignage(signageId, { type: 'session_started' });
    return res.json({ success: true });
  }

  if (clear) {
    broadcastToSignage(signageId, { type: 'question_clear' });
    return res.json({ success: true });
  }

  if (questionIndex == null || !question) {
    return res.status(400).json({ error: 'questionIndex and question required when not clearing' });
  }

  const timer = Math.max(1, Math.min(60, timerSeconds ?? 10));
  broadcastToSignage(signageId, {
    type: 'question_display',
    questionIndex,
    question,
    options: options || [],
    timerSeconds: timer,
    startedAt: Date.now()
  });
  res.json({ success: true });
}

export async function submitQuestionnaire(req, res) {
  try {
    await pool.query('SELECT 1');
  } catch (dbError) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { signageId, token, mode, person1, person2, questionnaireAnswers } = req.body;

  if (token) {
    const tokenData = activeTokens.get(token);
    if (!tokenData || Date.now() > tokenData.expiresAt || tokenData.signageId !== signageId) {
      return res.status(401).json({ error: 'Invalid or expired token. Please scan the QR code again.' });
    }
  } else {
    return res.status(401).json({ error: 'Access token required. Please scan the QR code.' });
  }

  if (!signageId || !person1) {
    return res.status(400).json({ error: 'signageId and person1 (name, email, gender, phone) are required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneDigits = (p) => (p?.phone || '').replace(/\D/g, '');
  const validPhone = (p) => phoneDigits(p).length >= 10;

  if (!person1.name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!person1.email?.trim()) return res.status(400).json({ error: 'Email is required' });
  if (!emailRegex.test(person1.email.trim())) return res.status(400).json({ error: 'Invalid email' });
  if (!person1.phone?.trim()) return res.status(400).json({ error: 'Phone is required' });
  if (!validPhone(person1)) return res.status(400).json({ error: 'Phone must have at least 10 digits' });

  const isCouple = mode === 'couple' && person2;
  if (isCouple) {
    if (!person2.name?.trim()) return res.status(400).json({ error: 'Partner name is required' });
    if (!person2.email?.trim()) return res.status(400).json({ error: 'Partner email is required' });
    if (!emailRegex.test(person2.email.trim())) return res.status(400).json({ error: 'Invalid partner email' });
    if (!person2.phone?.trim()) return res.status(400).json({ error: 'Partner phone is required' });
    if (!validPhone(person2)) return res.status(400).json({ error: 'Partner phone must have at least 10 digits' });
  }

  const signageResult = await pool.query(
    'SELECT id, is_active, questionnaire_config, text_config FROM signage_instances WHERE id = $1',
    [signageId]
  );
  if (signageResult.rows.length === 0) {
    return res.status(404).json({ error: 'Signage not found' });
  }
  if (!signageResult.rows[0].is_active) {
    return res.status(400).json({ error: 'Signage is not active' });
  }

  const qc = signageResult.rows[0].questionnaire_config || {};
  const questionsByGender = qc.questions_by_gender || {};
  const resultBands = qc.result_bands || [];
  const opts = qc.initial_options || [];
  const firstOptId = opts[0]?.id || 'yes';
  const gender = person1.gender?.trim() || firstOptId;
  const questions = questionsByGender[gender] || [];

  const answers = questionnaireAnswers || {};
  let totalPoints = 0;
  for (const q of questions) {
    const answer = answers[q.id];
    if (answer == null) {
      totalPoints += 1;
      continue;
    }
    const opts = q.options || [];
    let found = false;
    for (const opt of opts) {
      const label = typeof opt === 'string' ? opt : opt?.label;
      const points = typeof opt === 'object' && opt != null ? (opt.points ?? 1) : 1;
      if (String(label) === String(answer)) {
        totalPoints += points;
        found = true;
        break;
      }
    }
    if (!found) totalPoints += 1;
  }

  const tc = signageResult.rows[0].text_config || {};
  const defaultMobile = {
    emoji: tc.resultMobileEmoji || '💕',
    heading: tc.resultMobileHeading || 'Thank You!',
    message: tc.resultMobileMessage || 'Your response has been submitted.'
  };
  const defaultBand = {
    signage: { emoji: defaultMobile.emoji, message: 'Thank you!', subtext: '' },
    mobile: { emoji: defaultMobile.emoji, heading: defaultMobile.heading, message: defaultMobile.message }
  };
  let band = resultBands.find(b => totalPoints >= (b.min_score ?? 0) && totalPoints <= (b.max_score ?? 999))
    || resultBands[0]
    || defaultBand;

  // Avoid redundant heading+message: if both say "Thank you" (any variant), clear message
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[!?.]+\s*$/, '').trim();
  const mobile = band.mobile || {};
  if (mobile.message && norm(mobile.message) === norm(mobile.heading || 'Thank You!')) {
    band = { ...band, mobile: { ...mobile, message: '' } };
  }

  const normalizedEmail = normalizeEmail(person1.email);
  const normalizedPhone = normalizePhone(person1.phone);
  if (!normalizedEmail || !normalizedPhone) {
    return res.status(400).json({ error: 'Invalid email or phone format' });
  }

  const configResult = await pool.query(
    'SELECT allow_multiple_submissions, max_submissions_per_email FROM validation_config WHERE signage_id = $1',
    [signageId]
  );
  const config = configResult.rows[0] || { allow_multiple_submissions: false, max_submissions_per_email: 1 };

  if (!config.allow_multiple_submissions) {
    const existing = await pool.query(
      `SELECT 1 FROM users u
       JOIN questionnaire_sessions qs ON u.id = qs.user_id
       WHERE (u.email_normalized = $1 OR u.phone_normalized = $2) AND qs.signage_id = $3
       LIMIT 1`,
      [normalizedEmail, normalizedPhone, signageId]
    );
    if (existing.rows.length > 0) {
      return res.status(403).json({ error: 'You have already submitted. Each person can only submit once.' });
    }
  }

  const userResult = await pool.query(
    `INSERT INTO users (name, email, phone, email_normalized, phone_normalized, gender, partner_name, partner_email, partner_phone, partner_gender, signage_id, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, (NOW() AT TIME ZONE 'UTC')::timestamp)
     RETURNING id`,
    [
      person1.name.trim(),
      person1.email.trim(),
      person1.phone?.trim() || null,
      normalizedEmail,
      normalizedPhone,
      person1.gender?.trim() || null,
      isCouple ? person2.name?.trim() : null,
      isCouple ? person2.email?.trim() : null,
      isCouple ? person2.phone?.trim() : null,
      isCouple ? person2.gender?.trim() : null,
      signageId
    ]
  );
  const userId = userResult.rows[0].id;
  await pool.query(
    `INSERT INTO questionnaire_sessions (user_id, signage_id, questionnaire_answers, status)
     VALUES ($1, $2, $3, 'submitted')`,
    [userId, signageId, JSON.stringify(answers)]
  );

  broadcastToSignage(signageId, {
    type: 'questionnaire_submitted',
    userName: person1.name,
    isCouple,
    totalPoints,
    resultBand: band
  });

  res.json({
    success: true,
    message: 'Thank you for your submission!',
    totalPoints,
    resultBand: band
  });
}
