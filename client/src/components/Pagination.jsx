import Icon from './Icon.jsx';
import { useI18n } from '../i18n/index.jsx';

function pages(cur, n) {
  const out = new Set([1, n, cur - 1, cur, cur + 1]);
  const list = [...out].filter((p) => p >= 1 && p <= n).sort((a, b) => a - b);
  const res = [];
  list.forEach((p, i) => {
    if (i && p - list[i - 1] > 1) res.push('…' + p);
    res.push(p);
  });
  return res;
}

export default function Pagination({ page, pageSize, total, onPage, onPageSize, sizes = [10, 25, 50, 100], compact }) {
  const { t, fmtNum } = useI18n();
  const n = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  if (compact) {
    return (
      <div className="pager">
        <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t('records.prev')}
        </button>
        <span className="num">{t('records.page', { p: page, n })}</span>
        <button type="button" className="btn btn-sm" disabled={page >= n} onClick={() => onPage(page + 1)}>
          {t('records.next')}
        </button>
      </div>
    );
  }
  return (
    <div className="pager">
      {onPageSize && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t('records.rowsPerPage')}
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
            {sizes.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      )}
      <span className="num">{t('records.range', { from: fmtNum(from), to: fmtNum(to), total: fmtNum(total) })}</span>
      <nav aria-label="Paginación">
        <button type="button" className="pbtn" disabled={page <= 1} onClick={() => onPage(1)} aria-label={t('records.first')}>
          <Icon name="chevsL" size={15} />
        </button>
        <button type="button" className="pbtn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t('records.prev')}>
          <Icon name="chevL" size={15} />
        </button>
        {pages(page, n).map((p) =>
          typeof p === 'string' ? (
            <span key={p} style={{ padding: '0 4px' }}>
              …
            </span>
          ) : (
            <button key={p} type="button" className="pbtn num" aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>
              {p}
            </button>
          )
        )}
        <button type="button" className="pbtn" disabled={page >= n} onClick={() => onPage(page + 1)} aria-label={t('records.next')}>
          <Icon name="chevR" size={15} />
        </button>
        <button type="button" className="pbtn" disabled={page >= n} onClick={() => onPage(n)} aria-label={t('records.last')}>
          <Icon name="chevsR" size={15} />
        </button>
      </nav>
    </div>
  );
}
