const TOKEN_KEY = 'questionnaire_admin_token';
const AUTH_ROLE_KEY = 'questionnaire_admin_role';
const AUTH_SIGNAGE_KEY = 'questionnaire_admin_signage';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token, role, signageId = null) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(AUTH_ROLE_KEY, role || '');
  localStorage.setItem(AUTH_SIGNAGE_KEY, signageId || '');
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(AUTH_ROLE_KEY);
  localStorage.removeItem(AUTH_SIGNAGE_KEY);
}

export function getAuthHeaders() {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function isSuperAdmin() {
  return localStorage.getItem(AUTH_ROLE_KEY) === 'superadmin';
}

export function getSignageId() {
  return localStorage.getItem(AUTH_SIGNAGE_KEY) || '';
}

/** Decode JWT payload (no verification). Returns { exp } or null. */
export function getTokenExpiry(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return payload.exp ? payload.exp * 1000 : null; // ms since epoch
  } catch {
    return null;
  }
}
