import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, qs } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../lib/auth.jsx';
import { can, SPECIALTIES } from '../lib/constants.js';
import { useDebounced, useStored } from '../lib/hooks.js';
import { useToast } from '../components/Toast.jsx';
import DataTable from '../components/DataTable.jsx';
import Pagination from '../components/Pagination.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import DogThumb from '../components/DogThumb.jsx';
import Icon from '../components/Icon.jsx';
import Menu from '../components/Menu.jsx';

const STATES = ['valid', 'active', 'lifetime', 'expiring', 'pending', 'expired', 'inactive'];
const HIDEABLE = ['breed', 'microchip', 'specialty', 'country', 'issue'];

export default function Records() {
  const { t, fmtDate, fmtNum, country } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ items: [], total: 0, countries: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [hidden, setHidden] = useStored('records.hiddenCols', ['breed', 'issue']);
  const [search, setSearch] = useState(params.get('q') || '');
  const [showFilters, setShowFilters] = useState(false);
  const debounced = useDebounced(search, 300);

  const f = {
    q: params.get('q') || '',
    state: params.get('state') || '',
    specialty: params.get('specialty') || '',
    country: params.get('country') || '',
    expires: params.get('expires') || '',
    sort: params.get('sort') || 'created',
    dir: params.get('dir') || 'desc',
    page: Number(params.get('page')) || 1,
    pageSize: Number(params.get('pageSize')) || 25,
  };

  const update = useCallback(
    (patch, resetPage = true) => {
      const next = new URLSearchParams(params);
      for (const [k, v] of Object.entries(patch)) (v === '' || v == null ? next.delete(k) : next.set(k, v));
      if (resetPage && !('page' in patch)) next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  useEffect(() => {
    if (debounced !== f.q) update({ q: debounced });
  }, [debounced]);

  const query = qs(f);
  const load = useCallback(() => {
    setLoading(true);
    return api(`/api/dogs${query}`)
      .then((r) => setData(r))
      .catch(() => toast(t('common.error'), 'err'))
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => setSelected(new Set()), [query]);

  const onSort = (key) => update({ sort: key, dir: f.sort === key && f.dir === 'asc' ? 'desc' : 'asc' }, false);
  const filtered = f.q || f.state || f.specialty || f.country || f.expires;

  async function bulk(action) {
    try {
      const r = await api('/api/dogs/bulk', { method: 'POST', body: { ids: [...selected], action } });
      toast(t('records.bulkDone', { n: r.changed }));
      setSelected(new Set());
      load();
    } catch {
      toast(t('common.error'), 'err');
    }
  }

  async function setStatus(d, status) {
    try {
      await api(`/api/dogs/${d.id}/status`, { method: 'POST', body: { status } });
      toast(t('dog.updated'));
      load();
    } catch {
      toast(t('common.error'), 'err');
    }
  }

  const columns = useMemo(
    () =>
      [
        { key: 'reg', header: t('fields.regNumber'), sortKey: 'reg', render: (d) => <Link to={`/registros/${d.id}`} className="code" style={{ fontSize: 13.5 }}>{d.reg_number}</Link> },
        { key: 'dog', header: t('fields.dog'), sortKey: 'dog', render: (d) => <span className="dog-cell nowrap"><DogThumb dog={d} />{d.dog_name}</span> },
        { key: 'breed', header: t('fields.breed'), sortKey: 'breed', render: (d) => <span style={{ color: 'var(--ink-2)' }}>{d.breed || '—'}</span> },
        { key: 'owner', header: t('fields.owner'), sortKey: 'owner', tdStyle: { whiteSpace: 'nowrap' }, render: (d) => d.owner_name },
        { key: 'microchip', header: t('fields.microchip'), sortKey: 'microchip', render: (d) => <span style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{d.microchip || '—'}</span> },
        { key: 'specialty', header: t('fields.specialty'), sortKey: 'specialty', tdStyle: { whiteSpace: 'nowrap' }, render: (d) => t(`specialties.${d.specialty}`) },
        { key: 'country', header: t('fields.countryShort'), sortKey: 'country', tdStyle: { whiteSpace: 'nowrap' }, render: (d) => country(d.country) },
        { key: 'issue', header: t('fields.issueShort'), sortKey: 'issue', tdStyle: { whiteSpace: 'nowrap' }, render: (d) => fmtDate(d.issue_date) },
        {
          key: 'expiry',
          header: t('fields.expiryShort'),
          sortKey: 'expiry',
          tdStyle: { whiteSpace: 'nowrap', fontWeight: 600 },
          render: (d) => (d.lifetime ? <span style={{ color: '#6e4600' }}>{t('states.lifetime')}</span> : <span style={{ color: d.expiring || d.state === 'expired' ? 'var(--danger)' : undefined }}>{fmtDate(d.expiry_date)}</span>),
        },
        { key: 'state', header: t('fields.status'), render: (d) => <StatusBadge state={d.state} expiring={d.expiring} /> },
        {
          key: 'actions',
          header: <span className="sr-only">{t('common.actions')}</span>,
          tdStyle: { textAlign: 'right', paddingTop: 4, paddingBottom: 4 },
          render: (d) => (
            <span style={{ display: 'inline-flex', gap: 2 }}>
              <a className="icon-btn" href={`/api/dogs/${d.id}/qr.png?download=1`} aria-label={`${t('records.downloadQr')} · ${d.dog_name}`} title={t('records.downloadQr')}>
                <Icon name="qr" />
              </a>
              {can(user, 'editor') && (
                <Link className="icon-btn" to={`/registros/${d.id}/editar`} aria-label={`${t('common.edit')} · ${d.dog_name}`} title={t('common.edit')}>
                  <Icon name="edit" />
                </Link>
              )}
              <Menu label={`${t('common.more')} · ${d.dog_name}`} trigger={(p) => <button type="button" className="icon-btn" {...p}><Icon name="dots" size={20} stroke={3} /></button>}>
                <Link role="menuitem" to={`/registros/${d.id}`}>{t('dog.data')}</Link>
                <a role="menuitem" href={`/v/${d.reg_number}`} target="_blank" rel="noopener">{t('records.viewProfile')}</a>
                <a role="menuitem" href={`/api/dogs/${d.id}/card.pdf`}>{t('records.downloadCard')}</a>
                {can(user, 'editor') &&
                  (d.status === 'active' ? (
                    <button role="menuitem" type="button" onClick={() => setStatus(d, 'inactive')}>{t('records.deactivate')}</button>
                  ) : (
                    <button role="menuitem" type="button" onClick={() => setStatus(d, 'active')}>{t('records.activate')}</button>
                  ))}
              </Menu>
            </span>
          ),
        },
      ].filter((c) => !hidden.includes(c.key)),
    [t, hidden, user]
  );

  const mobileRow = (d) => (
    <Link to={`/registros/${d.id}`} className="mobile-row">
      <DogThumb dog={d} size={44} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <b style={{ fontSize: 15.5 }}>{d.dog_name}</b>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: d.expiring || d.state === 'expired' ? 'var(--danger)' : 'var(--ink-2)', whiteSpace: 'nowrap' }}>{d.lifetime ? t('states.lifetime') : fmtDate(d.expiry_date)}</span>
        </span>
        <span style={{ fontSize: 13, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {d.owner_name} · {t(`specialties.${d.specialty}`)}
        </span>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <span className="code" style={{ fontSize: 12 }}>{d.reg_number}</span>
          <StatusBadge state={d.state} expiring={d.expiring} />
        </span>
      </span>
    </Link>
  );

  return (
    <>
      <div className="page-head">
        <h1 className="display" style={{ flex: '0 1 auto' }}>{t('nav.records')}</h1>
        <span className="muted num" style={{ flex: 1 }}>{t('records.count', { n: fmtNum(data.total) })}</span>
        {can(user, 'editor') && (
          <a className="btn" href={`/api/dogs/export.csv${qs({ ...f, page: undefined, pageSize: undefined })}`}>
            <Icon name="download" size={16} stroke={2.4} />
            {t('records.export')}
          </a>
        )}
        {can(user, 'editor') && (
          <Link to="/registros/nuevo" className="btn btn-primary">
            <Icon name="plus" size={17} stroke={2.6} />
            {t('nav.newRecord')}
          </Link>
        )}
      </div>

      <section className="panel">
        <div className={`toolbar ${showFilters ? 'show-filters' : ''}`}>
          <div className="search" role="search">
            <Icon name="search" size={17} />
            <input aria-label={t('records.searchPh')} placeholder={t('records.searchPh')} value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setSearch('')} aria-label={t('records.clear')}>
                <Icon name="x" size={15} />
              </button>
            )}
          </div>
          <button type="button" className="btn btn-sm filters-toggle" style={{ minHeight: 42 }} aria-expanded={showFilters} onClick={() => setShowFilters((x) => !x)}>
            <Icon name="list" size={16} />
            {t('records.filters')}{[f.state, f.specialty, f.country, f.expires].filter(Boolean).length ? ` · ${[f.state, f.specialty, f.country, f.expires].filter(Boolean).length}` : ''}
          </button>
          <label className={`filter ${f.state ? 'on' : ''}`}>
            <span>{t('fields.status')}</span>
            <select value={f.state} onChange={(e) => update({ state: e.target.value })}>
              <option value="">{t('common.all')}</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{t(`states.${s}`)}</option>
              ))}
            </select>
          </label>
          <label className={`filter ${f.specialty ? 'on' : ''}`}>
            <span>{t('fields.specialty')}</span>
            <select value={f.specialty} onChange={(e) => update({ specialty: e.target.value })}>
              <option value="">{t('common.all')}</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{t(`specialties.${s}`)}</option>
              ))}
            </select>
          </label>
          <label className={`filter ${f.country ? 'on' : ''}`}>
            <span>{t('fields.countryShort')}</span>
            <select value={f.country} onChange={(e) => update({ country: e.target.value })}>
              <option value="">{t('common.all')}</option>
              {data.countries.map((c) => (
                <option key={c} value={c}>{country(c)}</option>
              ))}
            </select>
          </label>
          <label className={`filter ${f.expires ? 'on' : ''}`}>
            <span>{t('records.expires')}</span>
            <select value={f.expires} onChange={(e) => update({ expires: e.target.value })}>
              <option value="">{t('records.anyDate')}</option>
              <option value="30">{t('records.in30')}</option>
              <option value="60">{t('records.in60')}</option>
              <option value="90">{t('records.in90')}</option>
            </select>
          </label>
          <Menu label={t('records.columns')} trigger={(p) => <button type="button" className="btn btn-sm cols-btn" style={{ minHeight: 42, borderWidth: 1.5, borderColor: 'var(--line-strong)' }} {...p}><Icon name="columns" size={16} />{t('records.columns')}</button>}>
            {HIDEABLE.map((k) => (
              <label key={k} className="check" style={{ padding: '8px 12px' }} onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={!hidden.includes(k)} onChange={() => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]))} />
                {t({ breed: 'fields.breed', microchip: 'fields.microchip', specialty: 'fields.specialty', country: 'fields.countryShort', issue: 'fields.issueShort' }[k])}
              </label>
            ))}
          </Menu>
          {filtered && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setSearch(''), setParams({}, { replace: true }))}>
              {t('records.clear')}
            </button>
          )}
        </div>

        {selected.size > 0 && can(user, 'editor') && (
          <div className="bulkbar">
            <b>{t('records.selected', { n: selected.size })}</b>
            <button type="button" className="btn" onClick={() => bulk('deactivate')}>{t('records.deactivate')}</button>
            <button type="button" className="btn" onClick={() => bulk('activate')}>{t('records.activate')}</button>
            <button type="button" className="btn" onClick={() => bulk('renew')}>{t('records.renew1')}</button>
            <button type="button" className="btn" style={{ marginLeft: 'auto', borderColor: 'transparent' }} onClick={() => setSelected(new Set())}>{t('records.clearSel')}</button>
          </div>
        )}

        <DataTable
          label={t('nav.records')}
          columns={columns}
          rows={data.items}
          loading={loading}
          sort={{ key: f.sort, dir: f.dir }}
          onSort={onSort}
          selectable={can(user, 'editor')}
          selected={selected}
          onSelect={setSelected}
          onRowClick={(d) => nav(`/registros/${d.id}`)}
          renderMobile={mobileRow}
          empty={t('records.empty')}
          minWidth={1080}
        />
        <Pagination page={f.page} pageSize={f.pageSize} total={data.total} onPage={(p) => update({ page: p }, false)} onPageSize={(s) => update({ pageSize: s })} />
      </section>
    </>
  );
}
