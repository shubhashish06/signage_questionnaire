import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { getBasePath } from './utils/basePath.js';

const STATES = { IDLE: 'idle', SESSION_ACTIVE: 'session_active', QUESTION: 'question', THANK_YOU: 'thank_you' };

function QuestionDisplay({ question, options, timerSeconds, startedAt }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, timerSeconds - Math.floor((Date.now() - startedAt) / 1000))
  );

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, timerSeconds - Math.floor((Date.now() - startedAt) / 1000));
      setRemaining(r);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timerSeconds, startedAt]);

  return (
    <div className="text-center px-8 space-y-10">
      <h2 className="text-5xl font-light text-white tracking-tight">{question}</h2>
      {options.length > 0 && (
        <div className="flex flex-wrap justify-center gap-4">
          {options.map((opt, i) => (
            <span key={i} className="px-6 py-3 bg-white/20 rounded-xl text-xl font-light text-white">
              {opt}
            </span>
          ))}
        </div>
      )}
      <div className="flex justify-center items-baseline gap-2">
        <span className="text-8xl font-light text-white tabular-nums">{remaining}</span>
        <span className="text-3xl font-light text-white/80">sec</span>
      </div>
    </div>
  );
}

function App() {
  const [state, setState] = useState(STATES.IDLE);
  const [signageId, setSignageId] = useState('DEFAULT');
  const [questionData, setQuestionData] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [userName, setUserName] = useState('');
  const [resultBand, setResultBand] = useState(null);
  const [backgroundConfig, setBackgroundConfig] = useState({ type: 'gradient', colors: ['#be185d', '#831843', '#500724'] });
  const [logoUrl, setLogoUrl] = useState(null);
  const [textConfig, setTextConfig] = useState({
    idleHeading: 'Are you ready to play?',
    idleSubtitle: 'Scan to begin',
    sessionActiveMessage: 'Session in progress — use your phone',
    thankYouMessage: 'Thank you!',
    footerText: 'Use your phone camera to scan'
  });
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const tokenRefreshRef = useRef(null);
  const thankYouTimeoutRef = useRef(null);

  const generateQRCode = async (id = signageId) => {
    try {
      const base = getBasePath();
      const baseUrl = window.location.origin;
      const tokenRes = await fetch(`${baseUrl}${base}/api/token/generate?signageId=${id}`);
      if (!tokenRes.ok) return;
      const { token } = await tokenRes.json();
      if (token) {
        const formUrl = `${baseUrl}${base}/play/?id=${id}&token=${token}`;
        const url = await QRCode.toDataURL(formUrl, { width: 400, margin: 2 });
        setQrCodeUrl(url);
      }
    } catch (err) {
      console.error('QR code error:', err);
      setQrCodeUrl('');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || 'DEFAULT';
    setSignageId(id);
    generateQRCode(id);

    fetch(`${window.location.origin}${getBasePath()}/api/signage/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.logo_url) setLogoUrl(data.logo_url);
        if (data.text_config) setTextConfig(t => ({ ...t, ...data.text_config }));
        if (data.background_config) setBackgroundConfig(data.background_config);
      })
      .catch(() => {});

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const base = getBasePath();
    const ws = new WebSocket(`${protocol}//${window.location.host}${base}/ws/signage/${id}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'questionnaire_submitted') {
          setQuestionData(null);
          setUserName(msg.userName || 'Someone');
          setResultBand(msg.resultBand || null);
          setState(STATES.THANK_YOU);
          if (thankYouTimeoutRef.current) clearTimeout(thankYouTimeoutRef.current);
          thankYouTimeoutRef.current = setTimeout(() => {
            setState(STATES.IDLE);
            setUserName('');
            setResultBand(null);
            generateQRCode(id);
          }, 8000);
        } else if (msg.type === 'session_started') {
          setQuestionData(null);
          setState(STATES.SESSION_ACTIVE);
        } else if (msg.type === 'question_display') {
          setQuestionData({
            question: msg.question,
            options: msg.options || [],
            timerSeconds: msg.timerSeconds || 10,
            startedAt: msg.startedAt || Date.now()
          });
          setState(STATES.QUESTION);
        } else if (msg.type === 'question_clear') {
          setQuestionData(null);
          setState(STATES.SESSION_ACTIVE);
        } else if (msg.type === 'background_update') {
          setBackgroundConfig(msg.background_config);
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      reconnectRef.current = setTimeout(() => window.location.reload(), 3000);
    };

    tokenRefreshRef.current = setInterval(() => generateQRCode(id), 10 * 60 * 1000);

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (tokenRefreshRef.current) clearInterval(tokenRefreshRef.current);
      if (thankYouTimeoutRef.current) clearTimeout(thankYouTimeoutRef.current);
      ws.close();
    };
  }, []);

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

  if (state === STATES.QUESTION && questionData) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center relative" style={getBackgroundStyle()}>
        {logoUrl && <img src={logoUrl} alt="Logo" className="absolute top-6 right-6 max-h-16 max-w-32 object-contain opacity-90" />}
        <QuestionDisplay
          question={questionData.question}
          options={questionData.options}
          timerSeconds={questionData.timerSeconds}
          startedAt={questionData.startedAt}
        />
      </div>
    );
  }

  if (state === STATES.SESSION_ACTIVE) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center relative" style={getBackgroundStyle()}>
        {logoUrl && <img src={logoUrl} alt="Logo" className="absolute top-6 right-6 max-h-16 max-w-32 object-contain opacity-90" />}
        <div className="max-w-5xl w-full text-center px-8 space-y-8">
          <div className="space-y-4">
            <h1 className="text-7xl font-light text-white tracking-tight">{textConfig.idleHeading}</h1>
            <p className="text-2xl font-light text-white/90">{textConfig.sessionActiveMessage || 'Session in progress — use your phone'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === STATES.THANK_YOU) {
    const signage = resultBand?.signage || {};
    const emoji = signage.emoji || '💕';
    const message = signage.message || textConfig.thankYouMessage || 'Thank you!';
    const subtext = signage.subtext || '';
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center relative" style={getBackgroundStyle()}>
        {logoUrl && <img src={logoUrl} alt="Logo" className="absolute top-6 right-6 max-h-16 max-w-32 object-contain opacity-90" />}
        <div className="text-center px-8 space-y-8">
          <div className="text-8xl animate-pulse">{emoji}</div>
          <h1 className="text-6xl font-light text-white tracking-tight">{message}</h1>
          <p className="text-3xl font-light text-white/90">{userName}</p>
          {subtext && <p className="text-2xl font-light text-white/80">{subtext}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center relative" style={getBackgroundStyle()}>
      {logoUrl && <img src={logoUrl} alt="Logo" className="absolute top-6 right-6 max-h-16 max-w-32 object-contain opacity-90" />}
      <div className="max-w-5xl w-full text-center px-8 space-y-12">
        <div className="space-y-4">
          <h1 className="text-7xl font-light text-white tracking-tight">{textConfig.idleHeading}</h1>
          <p className="text-2xl font-light text-white/90">{textConfig.idleSubtitle}</p>
        </div>
        {qrCodeUrl && (
          <div className="flex justify-center">
            <div className="bg-white p-8 rounded-2xl shadow-lg">
              <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
            </div>
          </div>
        )}
        <p className="text-lg font-light text-white/80">{textConfig.footerText}</p>
      </div>
    </div>
  );
}

export default App;
