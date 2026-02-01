import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';

function ValidationConfigManager({ signageId }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadConfig();
  }, [signageId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/validation/${signageId}`);
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load config' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await apiFetch(`/api/validation/${signageId}`, {
        method: 'PUT',
        body: JSON.stringify({
          allow_multiple_submissions: config.allow_multiple_submissions,
          max_submissions_per_email: config.max_submissions_per_email,
          max_submissions_per_phone: config.max_submissions_per_phone,
          time_window_hours: config.time_window_hours || null,
          check_signage_ids: config.check_signage_ids || null
        })
      });
      if (res.ok) {
        setConfig(await res.json());
        setMessage({ type: 'success', text: 'Validation rules updated!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Failed to update' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (!config) return <div className="text-center py-12 text-red-600">Failed to load config</div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Rules</h2>
        <p className="text-sm text-gray-500 mt-1">Submission limits and duplicate checks</p>
      </div>
      {message.text && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">Allow Multiple Submissions</label>
            <p className="text-xs text-gray-500 mt-1">Allow same email/phone to submit more than once</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={config.allow_multiple_submissions || false} onChange={e => setConfig({ ...config, allow_multiple_submissions: e.target.checked })} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600" />
          </label>
        </div>

        {config.allow_multiple_submissions && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Submissions Per Email</label>
              <input type="number" min="1" value={config.max_submissions_per_email ?? ''} onChange={e => setConfig({ ...config, max_submissions_per_email: e.target.value ? parseInt(e.target.value) : null })} inputMode="numeric" autoComplete="off" className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Unlimited if empty" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Submissions Per Phone</label>
              <input type="number" min="1" value={config.max_submissions_per_phone ?? ''} onChange={e => setConfig({ ...config, max_submissions_per_phone: e.target.value ? parseInt(e.target.value) : null })} inputMode="numeric" autoComplete="off" className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Unlimited if empty" />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Time Window (hours)</label>
          <select value={config.time_window_hours ?? ''} onChange={e => setConfig({ ...config, time_window_hours: e.target.value ? parseInt(e.target.value) : null })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option value="">No restriction</option>
            <option value="24">24 hours</option>
            <option value="48">48 hours</option>
            <option value="168">1 week</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Check Duplicates Across Signages</label>
          <input type="text" placeholder="DEFAULT, store_1 (comma-separated)" value={config.check_signage_ids || ''} onChange={e => setConfig({ ...config, check_signage_ids: e.target.value })} autoComplete="off" autoCorrect="off" spellCheck={false} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>

        <button type="submit" disabled={saving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  );
}

export default ValidationConfigManager;
