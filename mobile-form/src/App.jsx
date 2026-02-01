import { useState, useEffect, useCallback, useRef } from 'react';
import { getBasePath } from './utils/basePath.js';

const STEPS = { OPTION: 'option', QUESTIONS: 'questions', CONTACT: 'contact', DONE: 'done' };

function ContactForm({ onSubmit, error, loading, hasQuestions, setError }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const validate = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneDigits = (phone || '').replace(/\D/g, '');
    if (!name?.trim()) { setError?.('Name is required'); return null; }
    if (!email?.trim()) { setError?.('Email is required'); return null; }
    if (!emailRegex.test(email.trim())) { setError?.('Invalid email'); return null; }
    if (!phone?.trim()) { setError?.('Phone is required'); return null; }
    if (phoneDigits.length < 10) { setError?.('Phone must have at least 10 digits'); return null; }
    setError?.('');
    return { name: name.trim(), email: email.trim(), phone: phone.trim() };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = validate();
    if (data) onSubmit(data);
  };

  const inputClass = 'w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 focus:border-white/50 outline-none';
  return (
    <div className="max-w-md w-full space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-light text-white tracking-tight">{hasQuestions ? 'Enter your details' : 'Almost done!'}</h1>
        <p className="text-white/90 font-light">{hasQuestions ? 'Enter your details to continue' : 'Submit your response'}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white/10 rounded-2xl p-6 border border-white/20">
        <input type="text" placeholder="Name *" value={name} onChange={e => setName(e.target.value)} autoComplete="name" autoCorrect="off" autoCapitalize="words" spellCheck={false} required className={inputClass} />
        <input type="email" placeholder="Email *" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" autoCorrect="off" autoCapitalize="none" spellCheck={false} inputMode="email" required className={inputClass} />
        <input type="tel" placeholder="Phone *" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" autoCorrect="off" autoCapitalize="none" spellCheck={false} inputMode="tel" required className={inputClass} />
        {error && <div className="bg-red-900/40 border border-red-300/50 text-red-200 px-4 py-3 rounded-xl text-sm text-center">{error}</div>}
        <button type="submit" disabled={loading} className="w-full bg-white/30 text-white font-light py-4 rounded-xl hover:bg-white/40 disabled:opacity-50 border border-white/30">
          {loading ? 'Submitting...' : hasQuestions ? 'Continue' : 'Submit'}
        </button>
      </form>
    </div>
  );
}

function App() {
  const [signageId, setSignageId] = useState('');
  const [token, setToken] = useState(null);
  const [tokenValidated, setTokenValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(STEPS.OPTION);
  const [selectedOption, setSelectedOption] = useState(null);
  const [initialOptions, setInitialOptions] = useState([{ id: 'yes', label: 'Yes!' }, { id: 'ready', label: "Let's go!" }]);
  const [optionHeading, setOptionHeading] = useState('Are you ready to play?');
  const [questionsByGender, setQuestionsByGender] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState({});
  const [timer, setTimer] = useState(10);
  const [person1, setPerson1] = useState({ name: '', email: '', phone: '' });
  const [resultBand, setResultBand] = useState(null);
  const [backgroundConfig, setBackgroundConfig] = useState({ type: 'gradient', colors: ['#be185d', '#831843', '#500724'] });
  const submitRef = useRef(null);
  const submittingRef = useRef(false);

  const getBackgroundStyle = () => {
    if (!backgroundConfig?.type) return { background: '#be185d' };
    if (backgroundConfig.type === 'gradient') {
      const colors = backgroundConfig.colors || ['#be185d', '#831843', '#500724'];
      return { background: `linear-gradient(to bottom right, ${colors.join(', ')})` };
    }
    if (backgroundConfig.type === 'solid') return { background: backgroundConfig.color || '#be185d' };
    if (backgroundConfig.type === 'image' && backgroundConfig.url) {
      return {
        backgroundImage: `url("${backgroundConfig.url}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    return { background: '#be185d' };
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || 'DEFAULT';
    const urlToken = params.get('token');
    setSignageId(id);
    setToken(urlToken);
    if (urlToken) validateToken(urlToken, id);
    else { setError('Access denied. Please scan the QR code.'); setTokenValidated(false); setLoading(true); }
  }, []);

  useEffect(() => {
    if (signageId && tokenValidated) {
      const base = getBasePath();
      fetch(`${window.location.origin}${base}/api/signage/${signageId}`)
        .then(r => r.json())
        .then(data => {
          const qc = data.questionnaire_config || {};
          const tc = data.text_config || {};
          if (data.background_config) setBackgroundConfig(data.background_config);
          setInitialOptions(qc.initial_options?.length ? qc.initial_options : [{ id: 'yes', label: 'Yes!' }, { id: 'ready', label: "Let's go!" }]);
          setOptionHeading(tc.idleHeading || 'Are you ready to play?');
          const qbg = qc.questions_by_gender || {};
          if (Object.keys(qbg).length === 0 && qc.questions?.length) {
            const opts = qc.initial_options?.length ? qc.initial_options : [{ id: 'yes', label: 'Yes!' }, { id: 'ready', label: "Let's go!" }];
            const byGender = {};
            opts.forEach(o => { byGender[o.id] = [...qc.questions]; });
            setQuestionsByGender(byGender);
          } else {
            setQuestionsByGender(qbg);
          }
        })
        .catch(() => {});
    }
  }, [signageId, tokenValidated]);

  const validateToken = async (tokenValue, idValue) => {
    try {
      const base = getBasePath();
      const res = await fetch(`${window.location.origin}${base}/api/token/validate?token=${tokenValue}`);
      const data = await res.json();
      if (data.valid && data.signageId === idValue) {
        setError(''); setTokenValidated(true); setLoading(false);
      } else {
        setError(data.error || 'Invalid token.'); setTokenValidated(false); setLoading(true);
      }
    } catch {
      setError('Failed to validate.'); setTokenValidated(false); setLoading(true);
    }
  };

  const questions = (selectedOption ? (questionsByGender[selectedOption] || []) : []);
  const currentQuestion = questions[questionIndex];
  const timerSeconds = currentQuestion?.timer_seconds ?? 10;

  useEffect(() => {
    if (step !== STEPS.QUESTIONS || !currentQuestion || !token || !signageId) return;
    const opts = (currentQuestion.options || []).map(o => typeof o === 'object' && o ? o.label : o);
    const base = getBasePath();
    fetch(`${window.location.origin}${base}/api/questionnaire/broadcast-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signageId,
        token,
        questionIndex,
        question: currentQuestion.label,
        options: opts,
        timerSeconds
      })
    }).catch(() => {});
  }, [step, questionIndex, currentQuestion?.id, token, signageId]);

  useEffect(() => {
    if (step === STEPS.OPTION && token && signageId) {
      const base = getBasePath();
      fetch(`${window.location.origin}${base}/api/questionnaire/broadcast-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signageId, token, sessionStarted: true })
      }).catch(() => {});
    }
  }, [step, token, signageId]);

  useEffect(() => {
    if (step !== STEPS.CONTACT || !token || !signageId) return;
    const base = getBasePath();
    fetch(`${window.location.origin}${base}/api/questionnaire/broadcast-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signageId, token, clear: true })
    }).catch(() => {});
  }, [step, token, signageId]);

  useEffect(() => {
    if (step !== STEPS.QUESTIONS || !currentQuestion) return;
    setTimer(timerSeconds);
    const qId = currentQuestion.id;
    const isLastQuestion = questionIndex >= questions.length - 1;
    const interval = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(interval);
          setQuestionnaireAnswers(a => ({ ...a, [qId]: null }));
          if (!isLastQuestion) {
            setQuestionIndex(i => i + 1);
          } else {
            setTimeout(() => submitRef.current?.({ [qId]: null }), 0);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step, questionIndex, currentQuestion?.id, timerSeconds, questions.length]);

  const handleAnswer = useCallback((questionId, value) => {
    const updated = { ...questionnaireAnswers, [questionId]: value };
    setQuestionnaireAnswers(updated);
    if (questionIndex < questions.length - 1) {
      setQuestionIndex(i => i + 1);
    } else {
      submitRef.current?.({ [questionId]: value });
    }
  }, [questionIndex, questions.length, questionnaireAnswers]);

  const validateContact = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneDigits = (person1?.phone || '').replace(/\D/g, '');
    if (!person1?.name?.trim()) { setError('Name is required'); return false; }
    if (!person1?.email?.trim()) { setError('Email is required'); return false; }
    if (!emailRegex.test(person1.email.trim())) { setError('Invalid email'); return false; }
    if (!person1?.phone?.trim()) { setError('Phone is required'); return false; }
    if (phoneDigits.length < 10) { setError('Phone must have at least 10 digits'); return false; }
    setError('');
    return true;
  };

  const handleSubmitFromQuestions = useCallback(async (answerOverrides = {}) => {
    if (submittingRef.current) return;
    if (!validateContact()) {
      setError('Please fill in your contact details');
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    setError('');
    const answersToSubmit = { ...questionnaireAnswers, ...answerOverrides, selectedOption };
    try {
      const base = getBasePath();
      const res = await fetch(`${window.location.origin}${base}/api/submit-questionnaire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signageId,
          token,
          mode: 'single',
          person1: { name: person1.name, email: person1.email, phone: person1.phone, gender: selectedOption },
          questionnaireAnswers: answersToSubmit
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setResultBand(data.resultBand || null);
      setStep(STEPS.DONE);
    } catch (err) {
      setError(err.message || 'Something went wrong');
      submittingRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [signageId, token, person1, selectedOption, questionnaireAnswers]);
  submitRef.current = handleSubmitFromQuestions;

  if (!tokenValidated && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" style={getBackgroundStyle()}>
        <div className="text-center text-white/90 font-light max-w-md w-full">{error || 'Validating...'}</div>
      </div>
    );
  }

  if (step === STEPS.DONE) {
    const mobile = resultBand?.mobile || {};
    const heading = mobile.heading || 'Thank You!';
    const message = mobile.message || 'Your response has been submitted.';
    const emoji = mobile.emoji ?? resultBand?.signage?.emoji ?? '💕';
    return (
      <div className="min-h-screen flex items-center justify-center p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" style={getBackgroundStyle()}>
        <div className="max-w-md w-full text-center space-y-8">
          <div className="text-7xl">{emoji}</div>
          <h2 className="text-3xl font-light text-white tracking-tight">{heading}</h2>
          {message && <p className="text-lg text-white/90 font-light">{message}</p>}
        </div>
      </div>
    );
  }

  if (step === STEPS.OPTION) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" style={getBackgroundStyle()}>
        <div className="max-w-md w-full space-y-8 flex flex-col items-center text-center">
          <div className="text-center space-y-2 w-full">
            <h1 className="text-4xl font-light text-white tracking-tight">{optionHeading}</h1>
            <p className="text-white/90 font-light">Choose an option to begin</p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-4 w-fit mx-auto">
            {initialOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => {
                  setSelectedOption(opt.id);
                  setStep(STEPS.CONTACT);
                  setQuestionIndex(0);
                }}
                className="min-w-[140px] py-8 px-8 bg-white/20 rounded-2xl border border-white/30 hover:bg-white/30 transition-all text-2xl font-light text-white flex items-center justify-center text-center"
              >
                {opt.label}
              </button>
            ))}
          </div>
          {error && <div className="w-full bg-red-900/40 border border-red-300/50 text-red-200 px-4 py-3 rounded-xl text-sm text-center">{error}</div>}
        </div>
      </div>
    );
  }

  if (step === STEPS.QUESTIONS && currentQuestion) {
    const options = currentQuestion.options || [];
    const getLabel = (o) => typeof o === 'object' && o ? o.label : o;
    return (
      <div className="relative min-h-screen flex flex-col p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" style={getBackgroundStyle()}>
        {loading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-2 border-white/30 border-t-white mb-4" />
              <p className="text-white/90 font-light">Submitting...</p>
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
          <span className="text-sm text-white/80 mb-4 block font-light">Question {questionIndex + 1} of {questions.length}</span>
          <h2 className="text-2xl font-light text-white tracking-tight mb-8">{currentQuestion.label}</h2>
          <div className="space-y-3">
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(currentQuestion.id, getLabel(opt))}
                disabled={loading}
                className="w-full py-4 px-6 bg-white/20 rounded-xl border border-white/30 hover:bg-white/30 text-left text-lg font-light text-white transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {getLabel(opt)}
              </button>
            ))}
          </div>
          {error && <div className="mt-4 bg-red-900/40 border border-red-300/50 text-red-200 px-4 py-3 rounded-xl text-sm text-center">{error}</div>}
        </div>
      </div>
    );
  }

  const handleContactSubmit = (contactData) => {
    setPerson1(contactData);
    setError('');
    if (questions.length > 0) {
      setStep(STEPS.QUESTIONS);
    } else {
      handleSubmitWithData(contactData);
    }
  };

  const handleSubmitWithData = async (contactData) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      const base = getBasePath();
      const res = await fetch(`${window.location.origin}${base}/api/submit-questionnaire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signageId,
          token,
          mode: 'single',
          person1: { ...contactData, gender: selectedOption },
          questionnaireAnswers: { ...questionnaireAnswers, selectedOption }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setResultBand(data.resultBand || null);
      setStep(STEPS.DONE);
    } catch (err) {
      setError(err.message || 'Something went wrong');
      submittingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  if (step === STEPS.CONTACT) {
    const hasQuestions = questions.length > 0;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" style={getBackgroundStyle()}>
        <ContactForm
          error={error}
          setError={setError}
          loading={loading}
          hasQuestions={hasQuestions}
          onSubmit={handleContactSubmit}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" style={getBackgroundStyle()}>
      <div className="text-center text-white/90 font-light max-w-md w-full">Loading...</div>
    </div>
  );
}

export default App;
