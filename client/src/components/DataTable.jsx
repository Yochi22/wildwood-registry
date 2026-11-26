import Icon from './Icon.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useMedia } from '../lib/hooks.js';

/**
 * Tabla de datos genérica: orden por columna, selección por filas y
 * vista apilada en móvil (renderMobile) en lugar de scroll horizontal.
 */
export default function DataTable({ columns, rows, rowKey = 'id', sort, onSort, selectable, selected, onSelect, onRowClick, renderMobile, loading, empty, minWidth = 900, label }) {
  const { t } = useI18n();
  const mobile = useMedia('(max-width: 760px)');

  if (loading && !rows.length) return <div className="empty">{t('common.loading')}</div>;
  if (!rows.length) return <div className="empty">{empty}</div>;

  if (mobile && renderMobile) {
    return (
      <ul className="mobile-list" aria-label={label} style={{ opacity: loading ? 0.6 : 1 }}>
        {rows.map((r) => (
          <li key={r[rowKey]}>{renderMobile(r)}</li>
        ))}
      </ul>
    );
  }

  const allSel = selectable && rows.every((r) => selected.has(r[rowKey]));
  const toggleAll = () => {
    const next = new Set(selected);
    rows.forEach((r) => (allSel ? next.delete(r[rowKey]) : next.add(r[rowKey])));
    onSelect(next);
  };
  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelect(next);
  };

  return (
    <div className="table-wrap">
      <table className="table" style={{ minWidth, opacity: loading ? 0.6 : 1 }} aria-label={label}>
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: 28 }}>
                <input type="checkbox" className="check" checked={allSel} onChange={toggleAll} aria-label={t('records.selectAll')} style={{ width: 17, height: 17, accentColor: '#3E7D5E' }} />
              </th>
            )}
            {columns.map((c) => {
              const on = sort?.key === c.sortKey;
              return (
                <th key={c.key} style={c.thStyle} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sortKey && onSort ? (
                    <button type="button" className={`sort ${on ? 'on' : ''}`} onClick={() => onSort(c.sortKey)}>
                      {c.header}
                      <Icon name={on ? (sort.dir === 'asc' ? 'up' : 'down') : 'sort'} size={12} stroke={2.6} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const id = r[rowKey];
            const isSel = selectable && selected.has(id);
            return (
              <tr key={id} className={`${isSel ? 'selected' : ''} ${onRowClick ? 'clickable' : ''}`} onClick={onRowClick ? (e) => !e.target.closest('button,a,input,label') && onRowClick(r) : undefined}>
                {selectable && (
                  <td>
                    <input type="checkbox" checked={isSel} onChange={() => toggle(id)} aria-label={t('records.select', { name: r.dog_name || r.name || id })} style={{ width: 17, height: 17, accentColor: '#3E7D5E' }} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} style={c.tdStyle}>
                    {c.render ? c.render(r) : r[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
