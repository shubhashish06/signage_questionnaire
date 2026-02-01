import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';

function TextManager({ signageId }) {
  const [textConfig, setTextConfig] = useState({
    idleHeading: 'Are you ready to play?',
    idleSubtitle: 'Scan to begin',
    sessionActiveMessage: 'Session in progress — use your phone',
    footerText: 'Use your phone camera to scan',
    resultMobileHeading: 'Thank You!',
    resultMobileMessage: 'Your response has been submitted.',
    resultMobileEmoji: '💕',
    textColorPrimary: '#111827',
    textColorSecondary: '#4B5563',
    textColorTertiary: '#6B7280'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [hasResultBands, setHasResultBands] = useState(false);

  useEffect(() => {
    loadTextConfig();
  }, [signageId]);

  const loadTextConfig = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/signage/${signageId}`);
      if (res.ok) {
        const data = await res.json();
        const bands = data.questionnaire_config?.result_bands || [];
        setHasResultBands(Array.isArray(bands) && bands.length > 0);
        if (data.text_config && typeof data.text_config === 'object') {
          setTextConfig({
            idleHeading: data.text_config.idleHeading || 'Are you ready to play?',
            idleSubtitle: data.text_config.idleSubtitle || 'Scan to begin',
            sessionActiveMessage: data.text_config.sessionActiveMessage || 'Session in progress — use your phone',
            footerText: data.text_config.footerText || 'Use your phone camera to scan',
            resultMobileHeading: data.text_config.resultMobileHeading || 'Thank You!',
            resultMobileMessage: data.text_config.resultMobileMessage || 'Your response has been submitted.',
            resultMobileEmoji: data.text_config.resultMobileEmoji || '💕',
            textColorPrimary: data.text_config.textColorPrimary || '#111827',
            textColorSecondary: data.text_config.textColorSecondary || '#4B5563',
            textColorTertiary: data.text_config.textColorTertiary || '#6B7280'
          });
        }
      }
    } catch (err) {
      console.error('Failed to load text config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/signage/${signageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ text_config: textConfig })
      });

      if (res.ok) {
        showMessage('success', 'Text settings updated successfully!');
      } else {
        const error = await res.json();
        showMessage('error', error.error || 'Failed to update text settings');
      }
    } catch (err) {
      console.error('Failed to save text config:', err);
      showMessage('error', 'Failed to save text settings');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleChange = (field, value) => {
    setTextConfig({ ...textConfig, [field]: value });
  };

  if (loading) {
    return <div className="text-center py-12">Loading text settings...</div>;
  }

  return (
    <div>
      {/* Message Banner */}
      {message.text && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-300' 
            : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Text</h2>
          <p className="text-sm text-gray-500 mt-1">Signage and participant screen copy</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="space-y-8">
        {/* QR Code Screen */}
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-4">QR Code Screen</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Main Heading
              </label>
              <input
                type="text"
                value={textConfig.idleHeading}
                onChange={(e) => handleChange('idleHeading', e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Questionnaire"
              />
              <p className="text-xs text-gray-500 mt-1">Main heading when QR is shown</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subtitle
              </label>
              <input
                type="text"
                value={textConfig.idleSubtitle}
                onChange={(e) => handleChange('idleSubtitle', e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Scan to participate"
              />
              <p className="text-xs text-gray-500 mt-1">Subtitle below heading</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Footer Text
              </label>
              <input
                type="text"
                value={textConfig.footerText}
                onChange={(e) => handleChange('footerText', e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Use your phone camera to scan"
              />
              <p className="text-xs text-gray-500 mt-1">Footer text</p>
            </div>
          </div>
        </div>

        {/* Participant Result Screen - hidden when score-based result bands exist */}
        {hasResultBands ? (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-600">Result messages are configured in the <strong>Questions</strong> tab (score-based).</p>
        </div>
        ) : (
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-1">After Submit (Participant)</h3>
          <p className="text-xs text-gray-500 mb-4">Default thank-you screen. Add result bands in Questions tab for score-based messages.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Emoji</label>
              <input
                type="text"
                value={textConfig.resultMobileEmoji || ''}
                onChange={(e) => handleChange('resultMobileEmoji', e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="💕"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Heading</label>
              <input
                type="text"
                value={textConfig.resultMobileHeading || ''}
                onChange={(e) => handleChange('resultMobileHeading', e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Thank You!"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
              <input
                type="text"
                value={textConfig.resultMobileMessage || ''}
                onChange={(e) => handleChange('resultMobileMessage', e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Your response has been submitted."
              />
            </div>
          </div>
        </div>
        )}

        {/* Session Active */}
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-4">While Participant Fills Form</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Signage Message
            </label>
            <input
              type="text"
              value={textConfig.sessionActiveMessage || ''}
              onChange={(e) => handleChange('sessionActiveMessage', e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Session in progress — use your phone"
            />
            <p className="text-xs text-gray-500 mt-1">Shown when someone is filling the form on their phone</p>
          </div>
        </div>

        {/* Text Colors - Advanced */}
        <details className="bg-gray-50 rounded-xl border border-gray-200">
          <summary className="p-4 cursor-pointer text-base font-semibold text-gray-900">Text Colors</summary>
          <div className="px-4 pb-4 pt-0 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Text Color (Headings)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={textConfig.textColorPrimary || '#111827'}
                  onChange={(e) => handleChange('textColorPrimary', e.target.value)}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={textConfig.textColorPrimary || '#111827'}
                  onChange={(e) => handleChange('textColorPrimary', e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                  placeholder="#111827"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Main headings</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Secondary Text Color (Subtitles)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={textConfig.textColorSecondary || '#4B5563'}
                  onChange={(e) => handleChange('textColorSecondary', e.target.value)}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={textConfig.textColorSecondary || '#4B5563'}
                  onChange={(e) => handleChange('textColorSecondary', e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                  placeholder="#4B5563"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Subtitles</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tertiary Text Color (Footer)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={textConfig.textColorTertiary || '#6B7280'}
                  onChange={(e) => handleChange('textColorTertiary', e.target.value)}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={textConfig.textColorTertiary || '#6B7280'}
                  onChange={(e) => handleChange('textColorTertiary', e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                  placeholder="#6B7280"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Footer and less prominent text</p>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

export default TextManager;
