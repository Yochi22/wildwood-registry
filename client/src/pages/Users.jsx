import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../lib/auth.jsx';
import { ROLES, initials } from '../lib/constants.js';
import { useToast } from '../components/Toast.jsx';
import DataTable from '../components/DataTable.jsx';
import Dialog from '../components/Dialog.jsx';
import Icon from '../components/Icon.jsx';

const isLocked = (u) => u.locked_until && new Date(u.locked_until + 'Z') > new Date();

function UserDialog({ user, onClose, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const creating = !user.id;
  const [v, setV] = useState({ name: user.name || '', email: user.email || '', role: user.role || 'editor', active: user.active !== 0, password: '' });
  const [flags, setFlags] = useState({ revokeSessions: false, unlock: false, reset2fa: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (creating) await api('/api/users', { method: 'POST', body: v });
      else {
        const body = { name: v.name, role: v.role, active: v.active, ...Object.fromEntries(Object.entries(flags).filter(([, x]) => x)) };
        if (v.password) body.password = v.password;
        await api(`/api/users/${user.id}`, { method: 'PUT', body });
      }
      toast(creating ? t('users.created') : t('users.saved'));
      onSaved();
    } catch (err) {
      const k = err.body?.error;
      setError(['email_taken', 'last_admin', 'self_demote', 'weak_password'].includes(k) ? t(`users.${k}`) : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      title={creating ? t('users.new') : t('users.editTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="user-form" className="btn btn-primary" disabled={busy}>{t('common.save')}</button>
        </>
      }
    >
      <form id="user-form" onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <div role="alert" className="error" style={{ fontSize: 14 }}>{error}</div>}
        <div className="field">
          <label htmlFor="u-name">{t('users.name')}</label>
          <input id="u-name" className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required />
        </div>
        <div className="field">
          <label htmlFor="u-email">{t('users.email')}</label>
          <input id="u-email" className="input" type="email" value={v.email} disabled={!creating} onChange={(e) => setV({ ...v, email: e.target.value })} required />
        </div>
        <div className="field">
          <label htmlFor="u-role">{t('users.role')}</label>
          <select id="u-role" className="select" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{t(`roles.${r}`)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="u-pw">{creating ? t('users.password') : t('users.newPasswordOpt')}</label>
          <input id="u-pw" className="input" type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} required={creating} />
          <span className="muted" style={{ fontSize: 12.5 }}>{t('users.weak_password')}</span>
        </div>
        {!creating && (
          <>
            <label className="check"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />{t('users.isActive')}</label>
            <label className="check"><input type="checkbox" checked={flags.revokeSessions} onChange={(e) => setFlags({ ...flags, revokeSessions: e.target.checked })} />{t('users.revoke')}</label>
            {isLocked(user) && <label className="check"><input type="checkbox" checked={flags.unlock} onChange={(e) => setFlags({ ...flags, unlock: e.target.checked })} />{t('users.unlock')}</label>}
            {!!user.totp_enabled && <label className="check"><input type="checkbox" checked={flags.reset2fa} onChange={(e) => setFlags({ ...flags, reset2fa: e.target.checked })} />{t('users.reset2fa')}</label>}
          </>
        )}
      </form>
    </Dialog>
  );
}

export default function Users() {
  const { t, fmtDateTime } = useI18n();
  const { user: me } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = () => api('/api/users').then((r) => setItems(r.items)).finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  const status = (u) =>
    !u.active ? <span className="badge badge-inactive">{t('users.disabled')}</span> : isLocked(u) ? <span className="badge badge-expired">{t('users.locked')}</span> : <span className="badge badge-active">{t('users.active')}</span>;

  const columns = [
    { key: 'name', header: t('users.name'), render: (u) => <span className="dog-cell"><span className="dog-thumb">{initials(u.name)}</span>{u.name}</span> },
    { key: 'email', header: t('users.email') },
    { key: 'role', header: t('users.role'), render: (u) => t(`roles.${u.role}`) },
    { key: 'totp', header: t('users.twoFA'), render: (u) => (u.totp_enabled ? <Icon name="check" size={16} stroke={3} style={{ color: 'var(--sage)' }} /> : null) },
    { key: 'last', header: t('users.lastLogin'), tdStyle: { whiteSpace: 'nowrap' }, render: (u) => (u.last_login_at ? fmtDateTime(u.last_login_at) : t('users.never')) },
    { key: 'status', header: t('users.status'), render: status },
    { key: 'edit', header: <span className="sr-only">{t('common.actions')}</span>, tdStyle: { textAlign: 'right' }, render: (u) => <button type="button" className="icon-btn" onClick={() => setEditing(u)} aria-label={`${t('common.edit')}: ${u.name}`}><Icon name="edit" /></button> },
  ];

  return (
    <>
      <div className="page-head">
        <h1 className="display">{t('nav.users')}</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
          <Icon name="plus" size={17} stroke={2.6} />
          {t('users.new')}
        </button>
      </div>
      <section className="panel">
        <DataTable
          label={t('nav.users')}
          columns={columns}
          rows={items}
          loading={loading}
          minWidth={820}
          empty={t('common.noData')}
          onRowClick={setEditing}
          renderMobile={(u) => (
            <button type="button" className="mobile-row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => setEditing(u)}>
              <span className="dog-thumb" style={{ width: 40, height: 40 }}>{initials(u.name)}</span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <b>{u.name}</b>
                <span className="muted" style={{ fontSize: 13 }}>{u.email}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>{t(`roles.${u.role}`)}</span>
              </span>
              {status(u)}
            </button>
          )}
        />
      </section>
      {editing && <UserDialog user={editing} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), load())} />}
    </>
  );
}
