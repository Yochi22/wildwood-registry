import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useDebounced } from '../lib/hooks.js';
import DataTable from '../components/DataTable.jsx';
import Pagination from '../components/Pagination.jsx';
import Icon from '../components/Icon.jsx';

const ACTIONS = ['create', 'update', 'delete', 'activate', 'deactivate', 'renew', 'export', 'login', 'login_failed', 'account_locked', 'password_changed', '2fa_enabled', '2fa_disabled', 'user_create', 'user_update'];

export default function Activity() {
  const { t, fmtDateTime } = useI18n();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const dq = useDebounced(q);

  useEffect(() => setPage(1), [dq, action, pageSize]);
  useEffect(() => {
    setLoading(true);
    api(`/api/audit${qs({ q: dq, action, page, pageSize })}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [dq, action, page, pageSize]);

  const record = (a) => {
    const reg = a.details?.reg_number;
    if (a.entity === 'dog' && a.entity_id) return <Link to={`/registros/${a.entity_id}`} className="code">{reg || `#${a.entity_id}`}</Link>;
    if (a.entity === 'user') return <span className="muted">{a.details?.email || ''}</span>;
    if (a.details?.count != null) return <span className="muted num">{a.details.count}</span>;
    return '—';
  };

  const columns = [
    { key: 'date', header: t('activity.date'), tdStyle: { whiteSpace: 'nowrap' }, render: (a) => <span className="num">{fmtDateTime(a.created_at)}</span> },
    { key: 'user', header: t('activity.user'), render: (a) => <b>{a.user_name || a.user_email || '—'}</b> },
    { key: 'action', header: t('activity.action'), render: (a) => t(`actions.${a.action}`) },
    { key: 'record', header: t('activity.record'), render: record },
    { key: 'ip', header: t('activity.ip'), render: (a) => <span className="muted num">{a.ip || '—'}</span> },
  ];

  return (
    <>
      <div className="page-head">
        <h1 className="display">{t('nav.activity')}</h1>
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="search" role="search">
            <Icon name="search" size={17} />
            <input aria-label={t('activity.searchPh')} placeholder={t('activity.searchPh')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <label className={`filter ${action ? 'on' : ''}`}>
            <span>{t('activity.action')}</span>
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">{t('activity.allActions')}</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{t(`actions.${a}`)}</option>
              ))}
            </select>
          </label>
        </div>
        <DataTable
          label={t('nav.activity')}
          columns={columns}
          rows={data.items}
          loading={loading}
          minWidth={720}
          empty="—"
          renderMobile={(a) => (
            <div className="mobile-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>{a.user_name || a.user_email || '—'}</b>
                <span className="muted num" style={{ fontSize: 12.5 }}>{fmtDateTime(a.created_at)}</span>
              </span>
              <span style={{ fontSize: 13.5 }}>{t(`actions.${a.action}`)} {record(a)}</span>
            </div>
          )}
        />
        <Pagination page={page} pageSize={pageSize} total={data.total} onPage={setPage} onPageSize={setPageSize} sizes={[25, 50, 100]} />
      </section>
    </>
  );
}
