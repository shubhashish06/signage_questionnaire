import { useState } from 'react';
import { getBasePath } from '../utils/basePath.js';
import { setToken } from '../utils/auth.js';

const GOOGLE_ERROR_MESSAGES = {
  no_code: 'Google sign-in was cancelled or failed.',
  no_email: 'Could not get email from Google account.',
  no_admin: 'No admin configured for this instance. Contact SuperAdmin.',
  unauthorized: 'This Google account is not authorized for this instance.',
  login_failed: 'Google sign-in failed. Please try again.',
  google_not_configured: 'Google login is not configured. Use email and password.'
};

export default function LoginPage({ mode = 'admin', signageId = '', onSuccess, urlError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(urlError ? (GOOGLE_ERROR_MESSAGES[urlError] || 'Login failed') : '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const base = getBasePath();
      const url = mode === 'superadmin'
        ? `${window.location.origin}${base}/api/auth/superadmin/login`
        : `${window.location.origin}${base}/api/auth/admin/login`;
      const body = mode === 'superadmin'
        ? { email, password }
        : { email, password, signageId };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      setToken(data.token, data.role, data.signageId || null);
      onSuccess?.();
      window.location.reload();
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'superadmin' ? 'SuperAdmin Login' : 'Admin Login';
  const subtitle = mode === 'superadmin'
    ? 'Sign in to manage all instances'
    : 'Sign in to continue';

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-light text-gray-900 tracking-tight">{title}</h1>
          <p className="text-sm font-light text-gray-600 mt-2">{subtitle}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-light text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900 text-base font-light"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-light text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900 text-base font-light"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm font-light">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gray-900 text-white rounded-lg font-light hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          {mode === 'admin' && (
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500 font-light">or</span>
              </div>
            </div>
          )}
          {mode === 'admin' && (
            <a
              href={`${window.location.origin}${getBasePath()}/api/auth/google?signageId=${encodeURIComponent(signageId || 'DEFAULT')}`}
              className="flex items-center justify-center gap-2 w-full py-3 border border-gray-300 rounded-lg font-light text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </a>
          )}
        </form>
      </div>
    </div>
  );
}
