import { useState } from 'react';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Account() {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwErr, setPwErr] = useState('');
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [disablePw, setDisablePw] = useState('');
  const [mfaErr, setMfaErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function changePw(e) {
    e.preventDefault();
    setPwErr('');
    setBusy(true);
    try {
      await api('/api/auth/password', { method: 'POST', body: pw });
      setPw({ current: '', next: '' });
      toast(t('account.changed'));
    } catch (err) {
      setPwErr(err.body?.error === 'wrong_password' ? t('account.wrong_password') : err.body?.error === 'weak_password' ? t('users.weak_password') : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  async function startSetup() {
    setMfaErr('');
    try {
      setSetup(await api('/api/auth/2fa/setup', { method: 'POST' }));
    } catch {
      setMfaErr(t('common.error'));
    }
  }
  async function enable(e) {
    e.preventDefault();
    try {
      await api('/api/auth/2fa/enable', { method: 'POST', body: { code } });
      toast(t('account.enabled'));
      setSetup(null);
      setCode('');
      refresh();
    } catch {
      setMfaErr(t('login.invalid_code'));
    }
  }
  async function disable(e) {
    e.preventDefault();
    try {
      await api('/api/auth/2fa/disable', { method: 'POST', body: { password: disablePw } });
      toast(t('account.disabledMsg'));
      setDisablePw('');
      refresh();
    } catch {
      setMfaErr(t('account.wrong_password'));
    }
  }

  return (
    <>
      <div className="page-head">
        <h1 className="display">{t('nav.account')}</h1>
      </div>
      {user.mfaSetupRequired && (
        <div role="alert" style={{ background: '#FBE9C2', color: '#6E4600', borderRadius: 8, padding: '14px 16px', fontWeight: 600 }}>
          {t('account.required')}
        </div>
      )}
      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>{t('account.profile')}</h2></div>
          <table className="kv">
            <tbody>
              <tr><th scope="row">{t('users.name')}</th><td>{user.name}</td></tr>
              <tr><th scope="row">{t('users.email')}</th><td>{user.email}</td></tr>
              <tr><th scope="row">{t('users.role')}</th><td>{t(`roles.${user.role}`)}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>{t('account.changePassword')}</h2></div>
          <form className="panel-body" onSubmit={changePw} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {pwErr && <div role="alert" className="error" style={{ fontSize: 14 }}>{pwErr}</div>}
            <div className="field">
              <label htmlFor="cur">{t('account.current')}</label>
              <input id="cur" type="password" className="input" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="new">{t('account.next')}</label>
              <input id="new" type="password" className="input" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              <span className="muted" style={{ fontSize: 12.5 }}>{t('users.weak_password')}</span>
            </div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy || !pw.current || !pw.next}>{t('account.update')}</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>{t('account.twoFA')}</h2>
            <span className={`badge ${user.totpEnabled ? 'badge-active' : 'badge-inactive'}`}>{user.totpEnabled ? t('account.on') : t('account.off')}</span>
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mfaErr && <div role="alert" className="error" style={{ fontSize: 14 }}>{mfaErr}</div>}
            {user.totpEnabled ? (
              <form onSubmit={disable} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field">
                  <label htmlFor="dpw">{t('account.confirmPassword')}</label>
                  <input id="dpw" type="password" className="input" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-danger" style={{ alignSelf: 'flex-start' }} disabled={!disablePw}>{t('account.disable')}</button>
              </form>
            ) : !setup ? (
              <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={startSetup}>{t('account.enable')}</button>
            ) : (
              <form onSubmit={enable} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0 }}>{t('account.scan')}</p>
                <img src={setup.qr} alt="QR 2FA" width="200" height="200" style={{ border: '1px solid var(--line)', borderRadius: 6 }} />
                <span className="muted" style={{ fontSize: 12.5, wordBreak: 'break-all' }}>{t('account.secret')}: <code>{setup.secret}</code></span>
                <div className="field" style={{ maxWidth: 220 }}>
                  <label htmlFor="otp">{t('login.mfaTitle')}</label>
                  <input id="otp" className="input num" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={code.length !== 6}>{t('account.enable')}</button>
              </form>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
