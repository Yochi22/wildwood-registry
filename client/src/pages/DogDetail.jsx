import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../lib/auth.jsx';
import { can, addYears, todayISO } from '../lib/constants.js';
import { useToast } from '../components/Toast.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Icon, { DogGlyph } from '../components/Icon.jsx';
import Menu from '../components/Menu.jsx';
import { ConfirmDialog } from '../components/Dialog.jsx';
import { whenLabel } from './Dashboard.jsx';

const BADGE = { create: 'active', update: 'pending', renew: 'lifetime', activate: 'active', deactivate: 'inactive' };

export default function DogDetail() {
  const { id } = useParams();
  const { t, fmtDate, fmtDateTime, country } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [confirmName, setConfirmName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api(`/api/dogs/${id}`)
      .then(setData)
      .catch(() => setError(true));
  useEffect(() => {
    load();
  }, [id]);

  if (error) return <div className="empty">{t('dog.notFound')} <Link to="/registros">{t('nav.records')}</Link></div>;
  if (!data) return <div className="empty">{t('common.loading')}</div>;
  const d = data.dog;
  const editor = can(user, 'editor');
  const renewBase = d.expiry_date && d.expiry_date > todayISO() ? d.expiry_date : todayISO();

  async function act(fn, msg) {
    setBusy(true);
    try {
      await fn();
      toast(msg);
      setDialog(null);
      load();
    } catch (e) {
      toast(e.body?.error === 'confirm_mismatch' ? t('dog.deleteText', { name: d.dog_name }) : t('common.error'), 'err');
    } finally {
      setBusy(false);
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.profile_url);
      toast(t('common.copied'));
    } catch {
      toast(d.profile_url);
    }
  };

  const rows = [
    [t('fields.regNumber'), <span className="code">{d.reg_number}</span>],
    [t('fields.dogName'), d.dog_name],
    [t('fields.breed'), d.breed],
    [t('fields.microchip'), d.microchip],
    [t('fields.owner'), d.owner_name],
    [t('fields.ownerDocument'), d.owner_document],
    [t('fields.country'), country(d.country)],
    [t('fields.specialty'), t(`specialties.${d.specialty}`)],
    [t('fields.issueDate'), fmtDate(d.issue_date)],
    [t('fields.expiryDate'), d.lifetime ? <span style={{ color: '#6e4600', display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="infinity" size={15} stroke={2.4} />{t('states.lifetime')}</span> : fmtDate(d.expiry_date)],
  ];

  return (
    <>
      <nav className="crumbs" aria-label="Ruta">
        <Link to="/registros">{t('nav.records')}</Link>
        <span aria-hidden="true">/</span>
        <span>{d.dog_name}</span>
      </nav>

      <section className="dog-head">
        <div className="dog-photo" style={{ backgroundImage: d.photo_url ? `url(${d.photo_url})` : undefined }} role="img" aria-label={d.dog_name}>
          {!d.photo_url && <DogGlyph size={54} />}
        </div>
        <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px' }}>
            <h1 className="display" style={{ margin: 0, fontSize: 32, lineHeight: 1 }}>{d.dog_name}</h1>
            <StatusBadge state={d.state} expiring={d.expiring} />
            {d.state === 'active' && <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{t('dog.expiresIn', { when: whenLabel(t, d.days_left) })}</span>}
          </div>
          <span style={{ color: 'var(--ink-2)' }}>
            {[d.breed, t(`specialties.${d.specialty}`), d.owner_name].filter(Boolean).join(' · ')}
          </span>
          <span className="code">{d.reg_number}</span>
        </div>
        {editor && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Link to={`/registros/${d.id}/editar`} className="btn btn-primary">
              <Icon name="edit" size={16} />
              {t('common.edit')}
            </Link>
            {!d.lifetime && (
              <button type="button" className="btn" onClick={() => setDialog('renew')}>
                {t('dog.renew')}
              </button>
            )}
            {d.status === 'active' ? (
              <button type="button" className="btn" onClick={() => setDialog('deactivate')}>{t('dog.deactivate')}</button>
            ) : (
              <button type="button" className="btn" onClick={() => act(() => api(`/api/dogs/${d.id}/status`, { method: 'POST', body: { status: 'active' } }), t('dog.updated'))}>
                {t('dog.activate')}
              </button>
            )}
            {can(user, 'admin') && (
              <Menu label={t('common.more')} trigger={(p) => <button type="button" className="btn" style={{ padding: 0, width: 44 }} {...p}><Icon name="dots" size={20} stroke={3} /></button>}>
                <button role="menuitem" type="button" className="danger" onClick={() => (setConfirmName(''), setDialog('delete'))}>
                  {t('common.delete')}
                </button>
              </Menu>
            )}
          </div>
        )}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section className="panel">
            <div className="panel-head"><h2>{t('dog.data')}</h2></div>
            <table className="kv">
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row">{k}</th>
                    <td>{v || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>{t('dog.tasks')} · {d.tasks.length}</h2></div>
            {d.tasks.length ? (
              <ol style={{ margin: 0, padding: '8px 16px 10px 38px', lineHeight: 1.5 }}>
                {d.tasks.map((x, i) => (
                  <li key={i} style={{ padding: '5px 0' }}>{x}</li>
                ))}
              </ol>
            ) : (
              <div className="empty" style={{ padding: 20 }}>{t('dog.noTasks')}</div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head"><h2>{t('dog.history')}</h2></div>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 520 }}>
                <thead>
                  <tr>
                    <th>{t('dog.date')}</th>
                    <th>{t('dog.user')}</th>
                    <th>{t('dog.action')}</th>
                    <th>{t('dog.detail')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((h, i) => (
                    <tr key={i}>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(h.created_at)}</td>
                      <td style={{ fontWeight: 600 }}>{h.user_name || '—'}</td>
                      <td><span className={`badge badge-${BADGE[h.action] || 'inactive'}`}>{t(`actions.${h.action}`)}</span></td>
                      <td className="muted">
                        {h.details?.changed?.length
                          ? h.details.changed.map((c) => t(`fields.${{ dog_name: 'dogName', owner_name: 'owner', owner_document: 'ownerDocument', issue_date: 'issueDate', expiry_date: 'expiryDate' }[c] || c}`)).join(', ')
                          : h.details?.expiry_date
                            ? fmtDate(h.details.expiry_date)
                            : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section className="qr-panel" aria-label={t('dog.qr')}>
            <img src={`/api/dogs/${d.id}/qr.svg`} alt={`${t('dog.qr')} · ${d.reg_number}`} />
            <span style={{ fontSize: 12.5, color: '#cfe3d7', wordBreak: 'break-all', textAlign: 'center' }}>{d.profile_url}</span>
            <div className="qr-actions">
              <a className="btn" href={`/api/dogs/${d.id}/qr.png?download=1`}>PNG</a>
              <a className="btn" href={`/api/dogs/${d.id}/qr.svg?download=1`}>SVG</a>
              <a className="btn btn-gold" style={{ gridColumn: 'span 2' }} href={`/api/dogs/${d.id}/card.pdf`}>
                <Icon name="download" size={16} stroke={2.4} />
                {t('dog.card')}
              </a>
              <button type="button" className="btn btn-line" onClick={copy}>
                <Icon name="link" size={16} />
                {t('dog.copyLink')}
              </button>
              <a className="btn btn-line" href={`/v/${d.reg_number}`} target="_blank" rel="noopener">
                <Icon name="external" size={16} />
                {t('dog.openProfile')}
              </a>
            </div>
          </section>
          {d.notes && (
            <section className="panel">
              <div className="panel-head"><h2>{t('dog.notes')}</h2></div>
              <p style={{ margin: 0, padding: 16, whiteSpace: 'pre-wrap', color: 'var(--ink-2)' }}>{d.notes}</p>
            </section>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={dialog === 'renew'}
        title={t('dog.renewTitle')}
        text={t('dog.renewText', { date: fmtDate(addYears(renewBase, 1)) })}
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() => act(() => api(`/api/dogs/${d.id}/renew`, { method: 'POST', body: { years: 1 } }), t('dog.updated'))}
      />
      <ConfirmDialog
        open={dialog === 'deactivate'}
        title={t('dog.deactivate')}
        text={t('dog.deactivateText')}
        busy={busy}
        danger
        confirmLabel={t('dog.deactivate')}
        onClose={() => setDialog(null)}
        onConfirm={() => act(() => api(`/api/dogs/${d.id}/status`, { method: 'POST', body: { status: 'inactive' } }), t('dog.updated'))}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title={t('dog.deleteTitle')}
        text={t('dog.deleteText', { name: d.dog_name })}
        busy={busy || confirmName.trim().toLowerCase() !== d.dog_name.trim().toLowerCase()}
        danger
        confirmLabel={t('common.delete')}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api(`/api/dogs/${d.id}`, { method: 'DELETE', body: { confirm: confirmName } });
            toast(t('dog.deleted'));
            nav('/registros', { replace: true });
          } catch {
            toast(t('common.error'), 'err');
            setBusy(false);
          }
        }}
      >
        <input className="input" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} aria-label={d.dog_name} autoFocus />
      </ConfirmDialog>
    </>
  );
}
