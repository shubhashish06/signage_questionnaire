import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../database/init.js';

const JWT_SECRET = process.env.JWT_SECRET || 'valentines-questionnaire-secret-change-in-production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const SUPERADMIN_JWT_EXPIRY = process.env.SUPERADMIN_JWT_EXPIRY || '30m';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireSuperAdmin(req, res, next) {
  if (!req.auth || req.auth.role !== 'superadmin') {
    return res.status(403).json({ error: 'SuperAdmin access required' });
  }
  next();
}

export function requireAdminOrSuperAdmin(signageIdParam = 'id') {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.auth.role === 'superadmin') return next();
    if (req.auth.role === 'admin' && req.auth.signageId === req.params[signageIdParam]) return next();
    return res.status(403).json({ error: 'Access denied for this instance' });
  };
}

export async function loginSuperAdmin(req, res) {
  const { email, password } = req.body || {};
  const superEmail = process.env.SUPERADMIN_EMAIL?.trim();
  const superPassword = process.env.SUPERADMIN_PASSWORD;
  if (!superEmail || !superPassword) {
    return res.status(503).json({ error: 'SuperAdmin not configured. Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD.' });
  }
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (email.trim().toLowerCase() !== superEmail.toLowerCase()) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  let match = false;
  if (superPassword.startsWith('$2')) {
    match = await bcrypt.compare(password, superPassword).catch(() => false);
  } else {
    match = password === superPassword;
  }
  if (!match) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ role: 'superadmin' }, JWT_SECRET, { expiresIn: SUPERADMIN_JWT_EXPIRY });
  res.json({ token, role: 'superadmin' });
}

export async function loginAdmin(req, res) {
  const { email, password, signageId } = req.body || {};
  if (!email || !password || !signageId) {
    return res.status(400).json({ error: 'Email, password, and signageId required' });
  }
  const result = await pool.query(
    'SELECT email, password_hash FROM instance_admin_credentials WHERE signage_id = $1',
    [signageId]
  );
  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'No admin configured for this instance. Contact SuperAdmin.' });
  }
  const row = result.rows[0];
  if (row.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const match = await bcrypt.compare(password, row.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ role: 'admin', signageId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  res.json({ token, role: 'admin', signageId });
}

export async function verifyAuth(req, res) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ role: decoded.role, signageId: decoded.signageId || null });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Redirect to Google OAuth. Admin only. Requires signageId in query. */
export function initiateGoogleAuth(req, res) {
  const signageId = req.query.signageId?.trim() || 'DEFAULT';
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect(buildAdminUrl(req, signageId, 'error=google_not_configured'));
  }
  const basePath = (process.env.BASE_PATH || '').replace(/\/$/, '');
  const redirectUri = `${req.protocol}://${req.get('host')}${basePath}/api/auth/google/callback`;
  const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['email', 'profile', 'openid'],
    state: signageId,
    prompt: 'select_account'
  });
  res.redirect(authUrl);
}

/** Handle Google OAuth callback. Exchange code, verify email in instance_admin_credentials, issue JWT, redirect to admin. */
export async function googleAuthCallback(req, res) {
  const signageId = (req.query.state || 'DEFAULT').toString().trim();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect(buildAdminUrl(req, signageId, 'error=google_not_configured'));
  }
  const { code } = req.query;
  if (!code) {
    return res.redirect(buildAdminUrl(req, signageId, 'error=no_code'));
  }
  const basePath = (process.env.BASE_PATH || '').replace(/\/$/, '');
  const redirectUri = `${req.protocol}://${req.get('host')}${basePath}/api/auth/google/callback`;
  const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
  try {
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const email = payload?.email?.trim()?.toLowerCase();
    if (!email) {
      return res.redirect(buildAdminUrl(req, signageId, 'error=no_email'));
    }
    const result = await pool.query(
      'SELECT email FROM instance_admin_credentials WHERE signage_id = $1',
      [signageId]
    );
    if (result.rows.length === 0) {
      return res.redirect(buildAdminUrl(req, signageId, 'error=no_admin'));
    }
    const adminEmail = result.rows[0].email?.trim()?.toLowerCase();
    if (adminEmail !== email) {
      return res.redirect(buildAdminUrl(req, signageId, 'error=unauthorized'));
    }
    const token = jwt.sign({ role: 'admin', signageId }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRY || '7d' });
    return res.redirect(buildAdminUrl(req, signageId, null, token));
  } catch (err) {
    console.error('Google auth callback error:', err.message);
    return res.redirect(buildAdminUrl(req, signageId, 'error=login_failed'));
  }
}

function buildAdminUrl(req, signageId, errorParam = null, token = null) {
  const basePath = (process.env.BASE_PATH || '').replace(/\/$/, '');
  const origin = `${req.protocol}://${req.get('host')}`;
  let url = `${origin}${basePath}/admin?id=${encodeURIComponent(signageId)}`;
  if (token) url += `&token=${encodeURIComponent(token)}`;
  if (errorParam) url += `&${errorParam}`;
  return url;
}
