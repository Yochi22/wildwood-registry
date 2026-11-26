import { useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import Icon, { Star } from '../components/Icon.jsx';
import { Logo } from '../components/Brand.jsx';
import LangSwitch from '../components/LangSwitch.jsx';

export default function Login() {
  const { user, setUser } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [mfaToken, setMfaToken] = useState(null);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const boxes = useRef([]);

  if (user) return <Navigate to={loc.state?.from || '/'} replace />;

  const done = (u) => {
    setUser(u);
    nav(loc.state?.from || '/', { replace: true });
  };

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      if (r.mfaRequired) {
        setMfaToken(r.mfaToken);
        setTimeout(() => boxes.current[0]?.focus(), 50);
      } else done(r.user);
    } catch (err) {
      setError(t(`login.${err.body?.error || 'invalid_credentials'}`));
    } finally {
      setBusy(false);
    }
  }

  async function verify(digits) {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/auth/mfa', { method: 'POST', body: { mfaToken, code: digits } });
      done(r.user);
    } catch (err) {
      const k = err.body?.error || 'invalid_code';
      setError(t(`login.${k}`));
      if (k === 'mfa_expired') setMfaToken(null);
      setCode(['', '', '', '', '', '']);
      boxes.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  function setDigit(i, v) {
    const clean = v.replace(/\D/g, '');
    const next = [...code];
    if (clean.length > 1) {
      clean.slice(0, 6).split('').forEach((d, j) => (next[j] = d));
    } else next[i] = clean;
    setCode(next);
    const joined = next.join('');
    if (joined.length === 6) return verify(joined);
    if (clean && i < 5) boxes.current[Math.min(5, clean.length > 1 ? clean.length : i + 1)]?.focus();
  }

  return (
    <div className="auth">
      <section className="auth-side">
        <span className="brand" style={{ padding: 0 }}>
          <Logo size={44} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
          <Star size={52} color="#F2B33D" />
          <h1 className="display" style={{ margin: 0, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.05 }}>
            {t('login.panel')}
          </h1>
        </div>
        <a href="https://wildwood-training.com/" style={{ color: '#F2B33D' }}>
          wildwood-training.com
        </a>
      </section>
      <section className="auth-main">
        {!mfaToken ? (
          <form className="auth-form" onSubmit={submit} noValidate>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{t('login.title')}</h2>
              <LangSwitch className="lang lang-light" />
            </div>
            {error && (
              <div role="alert" className="error" style={{ fontSize: 14, background: 'var(--danger-bg)', padding: '10px 12px', borderRadius: 6 }}>
                {error}
              </div>
            )}
            <div className="field">
              <label htmlFor="email">{t('login.email')}</label>
              <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label htmlFor="pw">{t('login.password')}</label>
              <div style={{ position: 'relative' }}>
                <input id="pw" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 48 }} />
                <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? t('login.hide') : t('login.show')} style={{ position: 'absolute', right: 3, top: 3 }}>
                  <Icon name={show ? 'eyeOff' : 'eye'} />
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || !email || !password} style={{ minHeight: 50 }}>
              {t('login.submit')}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={(e) => (e.preventDefault(), verify(code.join('')))}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{t('login.mfaTitle')}</h2>
            <p className="muted" style={{ margin: 0 }}>{t('login.mfaHint')}</p>
            {error && (
              <div role="alert" className="error" style={{ fontSize: 14 }}>
                {error}
              </div>
            )}
            <div className="otp" role="group" aria-label={t('login.mfaTitle')}>
              {code.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (boxes.current[i] = el)}
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  maxLength={i === 0 ? 6 : 1}
                  value={d}
                  aria-label={`${i + 1}`}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => e.key === 'Backspace' && !code[i] && i > 0 && boxes.current[i - 1]?.focus()}
                />
              ))}
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || code.join('').length < 6}>
              {t('login.verify')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => (setMfaToken(null), setError(''))}>
              {t('login.back')}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
