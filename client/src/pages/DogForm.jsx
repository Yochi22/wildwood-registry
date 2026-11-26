import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useToast } from '../components/Toast.jsx';
import { SPECIALTIES, COUNTRIES, todayISO, addYears, computeState } from '../lib/constants.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Icon, { DogGlyph } from '../components/Icon.jsx';

const EMPTY = {
  dog_name: '', breed: '', microchip: '', owner_name: '', country: '', specialty: '',
  issue_date: todayISO(), expiry_date: addYears(todayISO(), 1), lifetime: false, status: 'active', tasks: [], notes: '',
};

export default function DogForm() {
  const { id } = useParams();
  const editing = !!id;
  const { t, fmtDate, country, locale } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const [v, setV] = useState(EMPTY);
  const [mode, setMode] = useState('1');
  const [photo, setPhoto] = useState({ file: null, url: null, remove: false });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [task, setTask] = useState('');
  const [loaded, setLoaded] = useState(!editing);
  const fileRef = useRef(null);
  const camRef = useRef(null);

  useEffect(() => {
    if (!editing) return;
    api(`/api/dogs/${id}`)
      .then(({ dog }) => {
        setV({
          dog_name: dog.dog_name, breed: dog.breed || '', microchip: dog.microchip || '', owner_name: dog.owner_name,
          country: dog.country, specialty: dog.specialty, issue_date: dog.issue_date,
          expiry_date: dog.expiry_date || '', lifetime: dog.lifetime, status: dog.status, tasks: dog.tasks, notes: dog.notes || '',
          reg_number: dog.reg_number,
        });
        setMode(dog.lifetime ? 'lifetime' : 'custom');
        setPhoto({ file: null, url: dog.photo_url, remove: false });
        setLoaded(true);
      })
      .catch(() => nav('/registros', { replace: true }));
  }, [id]);

  const countries = useMemo(() => COUNTRIES.map((c) => [c, country(c)]).sort((a, b) => a[1].localeCompare(b[1], locale)), [locale]);

  const set = (k) => (e) => {
    const val = e?.target ? e.target.value : e;
    setV((x) => {
      const next = { ...x, [k]: val };
      if (k === 'issue_date' && (mode === '1' || mode === '2') && /^\d{4}-\d{2}-\d{2}$/.test(val)) next.expiry_date = addYears(val, Number(mode));
      return next;
    });
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  function pickMode(m) {
    setMode(m);
    setV((x) => ({
      ...x,
      lifetime: m === 'lifetime',
      expiry_date: m === '1' || m === '2' ? addYears(x.issue_date, Number(m)) : m === 'custom' ? x.expiry_date || addYears(x.issue_date, 1) : x.expiry_date,
    }));
    setErrors((er) => ({ ...er, expiry_date: undefined }));
  }

  function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return setErrors((er) => ({ ...er, photo: 'too_large' }));
    setPhoto({ file: f, url: URL.createObjectURL(f), remove: false });
    setErrors((er) => ({ ...er, photo: undefined }));
  }

  function addTask(text) {
    const s = (text ?? task).trim();
    if (!s || v.tasks.includes(s)) return;
    setV((x) => ({ ...x, tasks: [...x.tasks, s] }));
    setTask('');
  }
  const moveTask = (i, dir) =>
    setV((x) => {
      const tasks = [...x.tasks];
      const j = i + dir;
      if (j < 0 || j >= tasks.length) return x;
      [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
      return { ...x, tasks };
    });

  async function submit(e) {
    e.preventDefault();
    const form = new FormData();
    for (const k of ['dog_name', 'breed', 'microchip', 'owner_name', 'country', 'specialty', 'issue_date', 'status', 'notes']) form.append(k, v[k] ?? '');
    form.append('lifetime', v.lifetime ? 'true' : 'false');
    form.append('expiry_date', v.lifetime ? '' : v.expiry_date || '');
    form.append('tasks', JSON.stringify(v.tasks));
    if (photo.file) form.append('photo', photo.file);
    if (photo.remove) form.append('remove_photo', '1');
    setBusy(true);
    try {
      const r = await api(editing ? `/api/dogs/${id}` : '/api/dogs', { method: editing ? 'PUT' : 'POST', form });
      toast(t('form.saved'));
      nav(`/registros/${r.dog.id}`, { replace: true });
    } catch (err) {
      if (err.body?.fields) {
        setErrors(err.body.fields);
        toast(t('form.checkFields'), 'err');
        setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 30);
      } else toast(t('common.error'), 'err');
    } finally {
      setBusy(false);
    }
  }

  const err = (k) => errors[k] && <span className="error" id={`${k}-err`}>{t(`form.errors.${errors[k]}`) || t('form.errors.invalid')}</span>;
  const inv = (k) => ({ 'aria-invalid': errors[k] ? 'true' : undefined, 'aria-describedby': errors[k] ? `${k}-err` : undefined });
  const state = computeState(v);
  const suggestions = v.specialty ? t(`suggestions.${v.specialty}`) : [];

  if (!loaded) return <div className="empty">{t('common.loading')}</div>;

  return (
    <>
      <nav className="crumbs" aria-label="Ruta">
        <Link to="/registros">{t('nav.records')}</Link>
        <span aria-hidden="true">/</span>
        {editing ? <Link to={`/registros/${id}`}>{v.dog_name}</Link> : <span>{t('form.newTitle')}</span>}
      </nav>
      <div className="page-head">
        <h1 className="display">{editing ? t('form.editTitle') : t('form.newTitle')}</h1>
        {editing && <span className="code">{v.reg_number}</span>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
        <form className="panel" style={{ flex: '999 1 560px' }} onSubmit={submit} noValidate>
          <div className="form-section">
            <h2>{t('form.secDog')}</h2>
            <div className="fields">
              <div className="photo-pick">
                <div className="photo-box" style={{ backgroundImage: photo.url && !photo.remove ? `url(${photo.url})` : undefined }}>
                  {(!photo.url || photo.remove) && <DogGlyph size={48} />}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button type="button" className="btn" onClick={() => fileRef.current.click()}>
                    <Icon name="image" size={17} />
                    {t('form.uploadPhoto')}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => camRef.current.click()}>
                    <Icon name="camera" size={17} />
                    {t('form.camera')}
                  </button>
                  {photo.url && !photo.remove && (
                    <button type="button" className="btn btn-ghost" onClick={() => setPhoto((p) => ({ file: null, url: p.file ? null : p.url, remove: !p.file }))}>
                      {t('form.removePhoto')}
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={onFile} />
                <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
                {err('photo')}
              </div>
              <div className="fields-grid">
                <div className="field">
                  <label htmlFor="dog_name">{t('fields.dogName')} *</label>
                  <input id="dog_name" className="input" value={v.dog_name} onChange={set('dog_name')} required maxLength={80} {...inv('dog_name')} />
                  {err('dog_name')}
                </div>
                <div className="field">
                  <label htmlFor="breed">{t('fields.breed')}</label>
                  <input id="breed" className="input" value={v.breed} onChange={set('breed')} maxLength={100} />
                </div>
                <div className="field">
                  <label htmlFor="microchip">{t('fields.microchip')}</label>
                  <input id="microchip" className="input num" inputMode="numeric" value={v.microchip} onChange={set('microchip')} maxLength={40} placeholder="N/A" {...inv('microchip')} />
                  {err('microchip')}
                </div>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>{t('form.secOwner')}</h2>
            <div className="fields">
              <div className="fields-grid">
                <div className="field">
                  <label htmlFor="owner_name">{t('fields.ownerFull')} *</label>
                  <input id="owner_name" className="input" value={v.owner_name} onChange={set('owner_name')} required maxLength={150} autoComplete="off" {...inv('owner_name')} />
                  {err('owner_name')}
                </div>
                <div className="field">
                  <label htmlFor="country">{t('fields.country')} *</label>
                  <select id="country" className="select" value={v.country} onChange={set('country')} required {...inv('country')}>
                    <option value="">{t('common.choose')}</option>
                    {countries.map(([c, n]) => (
                      <option key={c} value={c}>{n}</option>
                    ))}
                  </select>
                  {err('country')}
                </div>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>{t('form.secCert')}</h2>
            <div className="fields">
              <div className="field">
                <label htmlFor="specialty">{t('fields.specialty')} *</label>
                <select id="specialty" className="select" value={v.specialty} onChange={set('specialty')} required {...inv('specialty')}>
                  <option value="">{t('common.choose')}</option>
                  {SPECIALTIES.map((s) => (
                    <option key={s} value={s}>{t(`specialties.${s}`)}</option>
                  ))}
                </select>
                {err('specialty')}
              </div>
              <div className="fields-grid">
                <div className="field">
                  <label htmlFor="issue_date">{t('fields.issueDate')} *</label>
                  <input id="issue_date" type="date" className="input" value={v.issue_date} onChange={set('issue_date')} required {...inv('issue_date')} />
                  {err('issue_date')}
                </div>
                <div className="field">
                  <span className="label" id="validity-label">{t('fields.expiryShort')} *</span>
                  <div className="segmented" role="radiogroup" aria-labelledby="validity-label">
                    {[['1', t('form.y1')], ['2', t('form.y2')], ['custom', t('form.custom')], ['lifetime', t('form.lifetime')]].map(([m, l]) => (
                      <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => pickMode(m)}>
                        {l}
                      </button>
                    ))}
                  </div>
                  {mode === 'custom' && (
                    <input type="date" className="input" aria-labelledby="validity-label" value={v.expiry_date} min={v.issue_date} onChange={set('expiry_date')} {...inv('expiry_date')} />
                  )}
                  {err('expiry_date')}
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: v.lifetime ? '#6e4600' : 'var(--ink-2)' }}>
                    {v.lifetime ? t('form.neverExpires') : v.expiry_date ? t('form.expiresOn', { date: fmtDate(v.expiry_date) }) : ''}
                  </span>
                </div>
              </div>
              <label className="check">
                <input type="checkbox" checked={v.status === 'active'} onChange={(e) => setV((x) => ({ ...x, status: e.target.checked ? 'active' : 'inactive' }))} />
                <b>{t('form.activeCheck')}</b>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h2>{t('form.secTasks')}</h2>
            <div className="fields">
              <ul className="tasks">
                {v.tasks.map((x, i) => (
                  <li key={x}>
                    <span>{x}</span>
                    <button type="button" className="icon-btn" onClick={() => moveTask(i, -1)} disabled={i === 0} aria-label={`${t('form.moveUp')}: ${x}`}>
                      <Icon name="up" size={15} />
                    </button>
                    <button type="button" className="icon-btn" onClick={() => moveTask(i, 1)} disabled={i === v.tasks.length - 1} aria-label={`${t('form.moveDown')}: ${x}`}>
                      <Icon name="down" size={15} />
                    </button>
                    <button type="button" className="icon-btn" onClick={() => setV((s) => ({ ...s, tasks: s.tasks.filter((_, j) => j !== i) }))} aria-label={`${t('form.remove')}: ${x}`}>
                      <Icon name="x" size={15} />
                    </button>
                  </li>
                ))}
                <li style={{ padding: 8 }}>
                  <input className="input" style={{ borderStyle: 'dashed' }} placeholder={t('form.taskPh')} aria-label={t('form.taskPh')} value={task} maxLength={200} onChange={(e) => setTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTask())} />
                  <button type="button" className="btn" onClick={() => addTask()} disabled={!task.trim()}>
                    {t('form.addTask')}
                  </button>
                </li>
              </ul>
              {Array.isArray(suggestions) && suggestions.filter((s) => !v.tasks.includes(s)).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span className="muted" style={{ fontSize: 12.5 }}>{t('form.suggested')}:</span>
                  {suggestions
                    .filter((s) => !v.tasks.includes(s))
                    .map((s) => (
                      <button key={s} type="button" className="chip-add" onClick={() => addTask(s)}>
                        + {s}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <h2>{t('form.secNotes')}</h2>
            <div className="fields">
              <textarea className="textarea" aria-label={t('form.secNotes')} value={v.notes} onChange={set('notes')} maxLength={2000} />
            </div>
          </div>

          <div className="form-foot">
            <Link to={editing ? `/registros/${id}` : '/registros'} className="btn btn-ghost">
              {t('common.cancel')}
            </Link>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {editing ? t('form.saveEdit') : t('form.saveCreate')}
            </button>
          </div>
        </form>

        <aside aria-label={t('form.preview')} style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, position: 'sticky', top: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', color: 'var(--muted)', textTransform: 'uppercase' }}>{t('form.preview')}</span>
          <div className="panel" style={{ overflow: 'hidden' }}>
            <div style={{ background: 'var(--forest)', color: '#fff', padding: 16, display: 'flex', gap: 14, alignItems: 'center', position: 'relative' }}>
              <div className="photo-box" style={{ width: 64, height: 64, boxShadow: '0 0 0 2px #F2B33D', backgroundImage: photo.url && !photo.remove ? `url(${photo.url})` : undefined }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span className="display" style={{ fontSize: 20, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.dog_name}</span>
                <span style={{ fontSize: 13, color: '#cfe3d7' }}>{v.breed}</span>
              </span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <StatusBadge state={state} />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <tbody>
                  {[
                    [t('fields.owner'), v.owner_name],
                    [t('fields.specialty'), v.specialty ? t(`specialties.${v.specialty}`) : ''],
                    [t('fields.expiryShort'), v.lifetime ? t('states.lifetime') : fmtDate(v.expiry_date)],
                    [t('fields.tasks'), v.tasks.length],
                  ].map(([k, val]) => (
                    <tr key={k} style={{ borderTop: '1px solid var(--row-line)' }}>
                      <th scope="row" style={{ textAlign: 'left', padding: '6px 0', color: 'var(--muted)', fontWeight: 600 }}>{k}</th>
                      <td style={{ padding: '6px 0', fontWeight: 600, textAlign: 'right' }}>{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
