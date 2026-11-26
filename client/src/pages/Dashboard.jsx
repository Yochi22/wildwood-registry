import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../lib/auth.jsx';
import { can } from '../lib/constants.js';
import { useToast } from '../components/Toast.jsx';
import Icon from '../components/Icon.jsx';
import DogThumb from '../components/DogThumb.jsx';

export function whenLabel(t, days) {
  if (days === 0) return t('when.today');
  if (days === 1) return t('when.tomorrow');
  return t('when.inDays', { n: days });
}

const ACTION_BADGE = { create: 'active', update: 'pending', renew: 'lifetime', activate: 'active', deactivate: 'inactive', delete: 'expired' };

export default function Dashboard() {
  const { t, fmtDate, fmtDateTime, monthShort, fmtNum } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');

  const load = () => api('/api/dogs/overview').then(setData).catch(() => toast(t('common.error'), 'err'));
  useEffect(() => {
    load();
  }, []);

  async function renew(d) {
    try {
      const r = await api(`/api/dogs/${d.id}/renew`, { method: 'POST', body: { years: 1 } });
      toast(t('dashboard.renewed', { date: fmtDate(r.dog.expiry_date) }));
      load();
    } catch {
      toast(t('common.error'), 'err');
    }
  }

  // Últimos 12 meses, incluidos los que no tienen registros.
  const months = [];
  if (data) {
    const [y, m] = data.today.split('-').map(Number);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      const k = d.toISOString().slice(0, 7);
      months.push({ k, n: data.byMonth.find((b) => b.k === k)?.n || 0 });
    }
  }
  const max = Math.max(1, ...months.map((m) => m.n));
  const total12 = months.reduce((s, m) => s + m.n, 0);

  return (
    <>
      <div className="page-head">
        <h1 className="display">{t('nav.dashboard')}</h1>
        <form
          className="search"
          style={{ flex: '1 1 320px', maxWidth: 520 }}
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            nav(`/registros?q=${encodeURIComponent(q)}`);
          }}
        >
          <Icon name="search" size={17} />
          <input aria-label={t('dashboard.quickSearch')} placeholder={t('dashboard.quickSearch')} value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        {can(user, 'editor') && (
          <Link to="/registros/nuevo" className="btn btn-primary">
            <Icon name="plus" size={17} stroke={2.6} />
            {t('nav.newRecord')}
          </Link>
        )}
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>{t('dashboard.expiring')}</h2>
            {data?.expiringCount > 0 && <Link to="/registros?expires=30&sort=expiry&dir=asc">{t('dashboard.seeAll', { n: fmtNum(data.expiringCount) })}</Link>}
          </div>
          {!data ? (
            <div className="empty">{t('common.loading')}</div>
          ) : !data.expiring.length ? (
            <div className="empty">{t('dashboard.noneExpiring')}</div>
          ) : (
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 480 }}>
                <thead>
                  <tr>
                    <th>{t('fields.dog')}</th>
                    <th>{t('fields.owner')}</th>
                    <th>{t('fields.expiryShort')}</th>
                    <th>
                      <span className="sr-only">{t('common.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.expiring.map((d) => (
                    <tr key={d.id} className="clickable" onClick={(e) => !e.target.closest('button,a') && nav(`/registros/${d.id}`)}>
                      <td>
                        <span className="dog-cell">
                          <DogThumb dog={d} />
                          <span style={{ display: 'flex', flexDirection: 'column' }}>
                            <Link to={`/registros/${d.id}`} style={{ color: 'var(--ink)' }}>{d.dog_name}</Link>
                            <span className="code" style={{ fontSize: 12 }}>{d.reg_number}</span>
                          </span>
                        </span>
                      </td>
                      <td>{d.owner_name}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{fmtDate(d.expiry_date)}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>{whenLabel(t, d.days_left)}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {can(user, 'editor') && (
                          <button type="button" className="btn btn-sm" onClick={() => renew(d)}>
                            {t('dashboard.renew')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>{t('dashboard.issued')}</h2>
            <span className="muted num" style={{ fontSize: 13 }}>{t('dashboard.last12', { n: fmtNum(total12) })}</span>
          </div>
          <div className="panel-body">
            <div role="img" aria-label={months.map((m) => `${monthShort(m.k)}: ${m.n}`).join(', ')} style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 190, borderBottom: '1px solid var(--line-strong)' }}>
              {months.map((m, i) => (
                <div key={m.k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 5, height: '100%' }}>
                  <span className="num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)' }}>{m.n || ''}</span>
                  <div style={{ width: '100%', maxWidth: 28, height: `${(m.n / max) * 150}px`, minHeight: m.n ? 3 : 0, background: i === 11 ? 'var(--gold)' : 'var(--sage)', borderRadius: '3px 3px 0 0' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, paddingTop: 6 }}>
              {months.map((m) => (
                <span key={m.k} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>
                  {monthShort(m.k).replace('.', '')}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>{t('dashboard.activity')}</h2>
          {can(user, 'admin') && <Link to="/actividad">{t('dashboard.seeLog')}</Link>}
        </div>
        {!data ? (
          <div className="empty">{t('common.loading')}</div>
        ) : !data.activity.length ? (
          <div className="empty">{t('dashboard.noActivity')}</div>
        ) : (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 560 }}>
              <tbody>
                {data.activity.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{a.user_name || '—'}</td>
                    <td>
                      <span className={`badge badge-${ACTION_BADGE[a.action] || 'inactive'}`}>{t(`actions.${a.action}`)}</span>
                    </td>
                    <td>
                      {a.dog_name ? (
                        <Link to={`/registros/${a.entity_id}`} style={{ color: 'var(--ink)' }}>
                          {a.dog_name} <span className="code" style={{ fontSize: 12 }}>{a.reg_number}</span>
                        </Link>
                      ) : (
                        <span className="code" style={{ fontSize: 12 }}>{a.reg_number || '—'}</span>
                      )}
                    </td>
                    <td className="muted num" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtDateTime(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
