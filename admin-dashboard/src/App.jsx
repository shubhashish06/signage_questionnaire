import { useState, useEffect } from 'react';
import { getBasePath } from './utils/basePath.js';
import { getToken, getSignageId, clearAuth, setToken } from './utils/auth.js';
import { apiFetch } from './utils/api.js';
import StatsOverview from './components/StatsOverview';
import UsersList from './components/UsersList';
import SessionsList from './components/SessionsList';
import BackgroundManager from './components/BackgroundManager';
import ValidationConfigManager from './components/ValidationConfigManager';
import TextManager from './components/TextManager';
import QuestionnaireConfigManager from './components/QuestionnaireConfigManager';
import SuperAdmin from './components/SuperAdmin';
import LoginPage from './components/LoginPage';

function App() {
  const isSuperAdmin = window.location.pathname.includes('/super') || window.location.pathname.includes('/superadmin');

  if (isSuperAdmin) return <SuperAdmin />;

  const params = new URLSearchParams(window.location.search);
  const initialSignageId = params.get('id') || 'DEFAULT';
  const urlToken = params.get('token');
  const urlError = params.get('error');

  const [adminAuthenticated, setAdminAuthenticated] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [signageId, setSignageId] = useState(initialSignageId);
  const [signageInfo, setSignageInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (urlToken) {
      setToken(urlToken, 'admin', initialSignageId);
      const base = getBasePath();
      window.history.replaceState({}, '', `${window.location.origin}${base}/admin?id=${encodeURIComponent(initialSignageId)}`);
    }
  }, [urlToken, initialSignageId]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAdminAuthenticated(false);
      return;
    }
    apiFetch('/api/auth/verify')
      .then(r => r.json())
      .then(data => {
        const ok = data.role === 'superadmin' || (data.role === 'admin' && data.signageId === initialSignageId);
        setAdminAuthenticated(ok);
      })
      .catch(() => setAdminAuthenticated(false));
  }, [initialSignageId]);

  useEffect(() => {
    if (adminAuthenticated !== true) return;
    loadSignageInfo();
  }, [signageId, adminAuthenticated]);

  const loadSignageInfo = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/signage/${signageId}`);
      if (res.ok) setSignageInfo(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (adminAuthenticated === false) {
    return <LoginPage mode="admin" signageId={initialSignageId} onSuccess={() => setAdminAuthenticated(true)} urlError={urlError} />;
  }
  if (adminAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900" />
          <p className="mt-4 text-sm font-light text-gray-600">Verifying...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'questionnaire', label: 'Questions', icon: '📋' },
    { id: 'text', label: 'Text', icon: '✏️' },
    { id: 'background', label: 'Background', icon: '🎨' },
    { id: 'validation', label: 'Rules', icon: '🔒' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'sessions', label: 'Sessions', icon: '📝' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-light text-gray-900 tracking-tight">Questionnaire</h1>
              {signageInfo && <span className="text-sm font-light text-gray-600">{signageInfo.location_name}</span>}
              {signageId && <span className="text-xs font-light text-gray-400">({signageId})</span>}
            </div>
            <button
              onClick={() => { clearAuth(); window.location.reload(); }}
              className="text-sm font-light text-gray-600 hover:text-gray-900 transition-colors"
            >
              Logout
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-gray-600 hover:text-gray-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>
        <div className="hidden lg:block border-t border-gray-200/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-1 overflow-x-auto">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3 text-sm font-light border-b-2 transition-colors ${activeTab === tab.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/20" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed top-16 left-0 right-0 bg-white border-b border-gray-200">
            <nav className="px-4 py-2 space-y-1">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-light rounded-lg ${activeTab === tab.id ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <span className="mr-2">{tab.icon}</span>{tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      <main className="pt-16 lg:pt-32 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900" />
            </div>
          ) : !signageInfo ? (
            <div className="text-center py-12">
              <div className="text-red-600 mb-4 font-light">Instance not found: {signageId}</div>
              <a href={`${window.location.origin}${getBasePath()}/superadmin`} className="text-gray-900 hover:underline font-light">Go to Super Admin</a>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6 sm:p-8">
              {activeTab === 'overview' && <StatsOverview signageId={signageId} />}
              {activeTab === 'users' && <UsersList signageId={signageId} timezone={signageInfo?.timezone || 'UTC'} />}
              {activeTab === 'sessions' && <SessionsList signageId={signageId} timezone={signageInfo?.timezone || 'UTC'} />}
              {activeTab === 'questionnaire' && <QuestionnaireConfigManager signageId={signageId} signageInfo={signageInfo} onUpdate={loadSignageInfo} />}
              {activeTab === 'background' && <BackgroundManager signageId={signageId} />}
              {activeTab === 'text' && <TextManager signageId={signageId} />}
              {activeTab === 'validation' && <ValidationConfigManager signageId={signageId} />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
