import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';

function normalizeOptions(opts) {
  return (opts || []).map(o => typeof o === 'string' ? { label: o, points: 1 } : { label: o?.label || '', points: Math.min(4, Math.max(1, o?.points ?? 1)) });
}

function QuestionnaireConfigManager({ signageId, signageInfo, onUpdate }) {
  const defaultInitialOptions = [{ id: 'yes', label: 'Yes!' }, { id: 'ready', label: "Let's go!" }];
  const [initialOptions, setInitialOptions] = useState([...defaultInitialOptions]);
  const [questionsByGender, setQuestionsByGender] = useState({ yes: [], ready: [] });
  const [resultBands, setResultBands] = useState([]);
  const [activeGender, setActiveGender] = useState('yes');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (signageInfo) {
      const qc = signageInfo.questionnaire_config || {};
      setInitialOptions(qc.initial_options?.length ? qc.initial_options : defaultInitialOptions);
      setResultBands(qc.result_bands || []);
      const qbg = qc.questions_by_gender || {};
      if (Object.keys(qbg).length === 0 && qc.questions?.length) {
        const shared = qc.questions.map(q => ({ ...q, options: normalizeOptions(q.options) }));
        const opts = qc.initial_options?.length ? qc.initial_options : defaultInitialOptions;
        const byGender = {};
        opts.forEach(o => { byGender[o.id] = [...shared]; });
        setQuestionsByGender(byGender);
      } else {
        const normalized = {};
        Object.keys(qbg).forEach(k => {
          normalized[k] = (qbg[k] || []).map(q => ({ ...q, options: normalizeOptions(q.options) }));
        });
        setQuestionsByGender(normalized);
      }
      if (qc.initial_options?.length) {
        setActiveGender(qc.initial_options[0].id);
      }
    }
  }, [signageInfo]);

  const questions = questionsByGender[activeGender] || [];

  const addQuestion = () => {
    const list = [...(questionsByGender[activeGender] || [])];
    list.push({
      id: `q_${activeGender}_${Date.now()}`,
      label: '',
      type: 'mcq',
      options: [{ label: 'Option A', points: 1 }, { label: 'Option B', points: 2 }, { label: 'Option C', points: 3 }],
      timer_seconds: 10
    });
    setQuestionsByGender({ ...questionsByGender, [activeGender]: list });
  };

  const updateQuestion = (idx, field, value) => {
    const list = [...(questionsByGender[activeGender] || [])];
    list[idx] = { ...list[idx], [field]: value };
    setQuestionsByGender({ ...questionsByGender, [activeGender]: list });
  };

  const updateQuestionOptions = (idx, options) => {
    const list = [...(questionsByGender[activeGender] || [])];
    list[idx] = { ...list[idx], options };
    setQuestionsByGender({ ...questionsByGender, [activeGender]: list });
  };

  const addOption = (qIdx) => {
    const list = [...(questionsByGender[activeGender] || [])];
    const opts = [...(list[qIdx].options || []), { label: `Option ${(list[qIdx].options?.length || 0) + 1}`, points: 1 }];
    list[qIdx] = { ...list[qIdx], options: opts };
    setQuestionsByGender({ ...questionsByGender, [activeGender]: list });
  };

  const removeOption = (qIdx, optIdx) => {
    const list = [...(questionsByGender[activeGender] || [])];
    const opts = (list[qIdx].options || []).filter((_, i) => i !== optIdx);
    list[qIdx] = { ...list[qIdx], options: opts };
    setQuestionsByGender({ ...questionsByGender, [activeGender]: list });
  };

  const updateOptionField = (qIdx, optIdx, field, value) => {
    const list = [...(questionsByGender[activeGender] || [])];
    const opts = [...(list[qIdx].options || [])];
    const current = typeof opts[optIdx] === 'object' && opts[optIdx] ? opts[optIdx] : { label: opts[optIdx] || '', points: 1 };
    opts[optIdx] = { ...current, [field]: field === 'points' ? Math.min(4, Math.max(1, parseInt(value) || 1)) : value };
    list[qIdx] = { ...list[qIdx], options: opts };
    setQuestionsByGender({ ...questionsByGender, [activeGender]: list });
  };

  const addResultBand = () => {
    const defaultStartId = activeGender || initialOptions[0]?.id || '';
    setResultBands([...resultBands, {
      start_id: defaultStartId,
      min_score: 0,
      max_score: 4,
      signage: { emoji: '💕', message: 'Thank you!', subtext: '' },
      mobile: { emoji: '💕', heading: 'Thank you!', message: 'Your response has been submitted.' }
    }]);
  };

  const updateResultBand = (idx, field, value) => {
    const bands = [...resultBands];
    if (field.startsWith('signage.')) {
      const sub = field.split('.')[1];
      bands[idx] = { ...bands[idx], signage: { ...(bands[idx].signage || {}), [sub]: value } };
    } else if (field.startsWith('mobile.')) {
      const sub = field.split('.')[1];
      bands[idx] = { ...bands[idx], mobile: { ...(bands[idx].mobile || {}), [sub]: value } };
    } else {
      bands[idx] = { ...bands[idx], [field]: value };
    }
    setResultBands(bands);
  };

  const removeResultBand = (idx) => {
    setResultBands(resultBands.filter((_, i) => i !== idx));
  };

  const removeQuestion = (idx) => {
    const list = (questionsByGender[activeGender] || []).filter((_, i) => i !== idx);
    setQuestionsByGender({ ...questionsByGender, [activeGender]: list });
  };

  const updateInitialOption = (idx, field, value) => {
    const opts = [...initialOptions];
    const oldId = opts[idx].id;
    opts[idx] = { ...opts[idx], [field]: value };
    if (field === 'id' && oldId !== value) {
      const qbg = { ...questionsByGender };
      if (qbg[oldId]) {
        qbg[value] = qbg[oldId];
        delete qbg[oldId];
      } else {
        qbg[value] = qbg[value] || [];
      }
      setQuestionsByGender(qbg);
      if (activeGender === oldId) setActiveGender(value);
    }
    setInitialOptions(opts);
  };

  const addInitialOption = () => {
    const id = `opt_${Date.now()}`;
    setInitialOptions([...initialOptions, { id, label: 'New option' }]);
    setQuestionsByGender({ ...questionsByGender, [id]: [] });
    setActiveGender(id);
  };

  const removeInitialOption = (idx) => {
    const opt = initialOptions[idx];
    const opts = initialOptions.filter((_, i) => i !== idx);
    if (opts.length === 0) return;
    const qbg = { ...questionsByGender };
    delete qbg[opt.id];
    setInitialOptions(opts);
    setQuestionsByGender(qbg);
    if (activeGender === opt.id) setActiveGender(opts[0].id);
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await apiFetch(`/api/signage/${signageId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          questionnaire_config: { initial_options: initialOptions, questions_by_gender: questionsByGender, result_bands: resultBands }
        })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Saved successfully' });
        onUpdate?.();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Questions</h2>
          <p className="text-sm text-gray-500 mt-1">Configure questions and result messages</p>
        </div>
        <button onClick={handleSave} disabled={loading} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium shrink-0">
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-base font-semibold text-gray-900">Start Options</h3>
          <button type="button" onClick={addInitialOption} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">+ Add</button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Participant selects one to begin. Add any number of options (e.g. Yes / Let&apos;s go).</p>
        <div className="space-y-2">
          {initialOptions.map((opt, idx) => (
            <div key={opt.id} className="flex gap-2 items-center">
              <input type="text" value={opt.id} onChange={e => updateInitialOption(idx, 'id', e.target.value)} placeholder="id (e.g. yes)" autoComplete="off" autoCorrect="off" spellCheck={false} className="w-24 px-3 py-2 border border-gray-200 rounded" />
              <input type="text" value={opt.label} onChange={e => updateInitialOption(idx, 'label', e.target.value)} placeholder="Label (e.g. Yes!)" autoComplete="off" autoCorrect="off" spellCheck={false} className="flex-1 px-3 py-2 border border-gray-200 rounded" />
              <button type="button" onClick={() => removeInitialOption(idx)} disabled={initialOptions.length <= 1} className="text-red-600 hover:text-red-700 px-2 disabled:opacity-40 disabled:cursor-not-allowed">×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-base font-semibold text-gray-900">Questions</h3>
          <button type="button" onClick={addQuestion} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">+ Add</button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Different questions per first choice. Options have points 1–4.</p>
        <div className="flex gap-2 mb-3">
          {initialOptions.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setActiveGender(opt.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${activeGender === opt.id ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div key={q.id} className="p-4 bg-white rounded-lg border border-gray-200 space-y-3">
              <div className="flex gap-2 items-center">
                <input type="text" value={q.label} onChange={e => updateQuestion(idx, 'label', e.target.value)} placeholder="Question text" autoComplete="off" autoCorrect="off" spellCheck={false} className="flex-1 px-3 py-2 border border-gray-200 rounded" />
                <input type="number" min="5" max="60" value={q.timer_seconds ?? 10} onChange={e => updateQuestion(idx, 'timer_seconds', parseInt(e.target.value) || 10)} inputMode="numeric" className="w-20 px-3 py-2 border border-gray-200 rounded" title="Timer (seconds)" />
                <span className="text-xs text-gray-500">sec</span>
                <button type="button" onClick={() => removeQuestion(idx)} className="text-red-600 hover:text-red-700 px-2">×</button>
              </div>
              <div className="pl-2 space-y-2">
                <span className="text-xs font-medium text-gray-600">Options (points 1–4):</span>
                {(q.options || []).map((opt, oIdx) => {
                  const o = typeof opt === 'object' && opt ? opt : { label: opt || '', points: 1 };
                  return (
                    <div key={oIdx} className="flex gap-2 items-center">
                      <input type="text" value={o.label} onChange={e => updateOptionField(idx, oIdx, 'label', e.target.value)} placeholder="Label" autoComplete="off" autoCorrect="off" spellCheck={false} className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm" />
                      <input type="number" min={1} max={4} value={o.points ?? 1} onChange={e => updateOptionField(idx, oIdx, 'points', e.target.value)} inputMode="numeric" title="Points (1-4)" className="w-16 px-2 py-2 border border-gray-200 rounded text-sm" />
                      <button type="button" onClick={() => removeOption(idx, oIdx)} className="text-red-500 text-sm">×</button>
                    </div>
                  );
                })}
                <button type="button" onClick={() => addOption(idx)} className="text-sm text-indigo-600 hover:text-indigo-700">+ Add option</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-base font-semibold text-gray-900">Result Messages (by score)</h3>
          <button type="button" onClick={addResultBand} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">+ Add</button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Different messages per score range. Signage = big screen, Participant = phone after submit.</p>
        <div className="space-y-4">
          {resultBands.map((b, idx) => (
            <div key={idx} className="p-4 bg-white rounded-lg border border-gray-200 space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={b.start_id ?? ''}
                  onChange={e => updateResultBand(idx, 'start_id', e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded text-sm"
                >
                  <option value="">All start options</option>
                  {initialOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                <input type="number" min={0} value={b.min_score ?? 0} onChange={e => updateResultBand(idx, 'min_score', parseInt(e.target.value) || 0)} inputMode="numeric" placeholder="Min score" className="w-24 px-3 py-2 border border-gray-200 rounded" />
                <span className="text-gray-500">–</span>
                <input type="number" min={0} value={b.max_score ?? 999} onChange={e => updateResultBand(idx, 'max_score', parseInt(e.target.value) || 999)} inputMode="numeric" placeholder="Max score" className="w-24 px-3 py-2 border border-gray-200 rounded" />
                <button type="button" onClick={() => removeResultBand(idx)} className="text-red-600 hover:text-red-700 px-2">×</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-medium text-gray-600">Signage:</span>
                  <input type="text" value={b.signage?.emoji ?? ''} onChange={e => updateResultBand(idx, 'signage.emoji', e.target.value)} placeholder="Emoji" autoComplete="off" autoCorrect="off" spellCheck={false} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded text-sm" />
                  <input type="text" value={b.signage?.message ?? ''} onChange={e => updateResultBand(idx, 'signage.message', e.target.value)} placeholder="Message" autoComplete="off" autoCorrect="off" spellCheck={false} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded text-sm" />
                  <input type="text" value={b.signage?.subtext ?? ''} onChange={e => updateResultBand(idx, 'signage.subtext', e.target.value)} placeholder="Subtext" autoComplete="off" autoCorrect="off" spellCheck={false} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded text-sm" />
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-600">Participant (phone):</span>
                  <input type="text" value={b.mobile?.emoji ?? ''} onChange={e => updateResultBand(idx, 'mobile.emoji', e.target.value)} placeholder="Emoji" autoComplete="off" autoCorrect="off" spellCheck={false} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded text-sm" />
                  <input type="text" value={b.mobile?.heading ?? ''} onChange={e => updateResultBand(idx, 'mobile.heading', e.target.value)} placeholder="Heading" autoComplete="off" autoCorrect="off" spellCheck={false} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded text-sm" />
                  <input type="text" value={b.mobile?.message ?? ''} onChange={e => updateResultBand(idx, 'mobile.message', e.target.value)} placeholder="Message" autoComplete="off" autoCorrect="off" spellCheck={false} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded text-sm" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default QuestionnaireConfigManager;
