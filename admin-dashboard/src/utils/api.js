import { getBasePath } from './basePath.js';
import { getAuthHeaders } from './auth.js';

export function apiFetch(path, options = {}) {
  const base = getBasePath();
  const url = `${window.location.origin}${base}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...options.headers
  };
  return fetch(url, { ...options, headers });
}
