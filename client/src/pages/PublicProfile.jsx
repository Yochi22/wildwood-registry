import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useBrand, Logo } from '../components/Brand.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import Icon, { DogGlyph } from '../components/Icon.jsx';

const STYLE = {
  active: { bg: '#DDEFE4', fg: '#1F5E40', icon: 'check' },
  lifetime: { bg: '#FBE9C2', fg: '#6E4600', icon: 'infinity' },
  pending: { bg: '#DCE8F5', fg: '#1E4E80', icon: 'clock' },
  expired: { bg: '#FBE0D2', fg: '#8F3509', icon: 'alert', stamp: true },
  inactive: { bg: '#E4E7E5', fg: '#2E3632', icon: 'minus', stamp: true },
};

export default function PublicProfile() {
  const { code } = useParams();
  const { t, fmtLong, fmtDateTime, country } = useI18n();
  const { brand } = useBrand();
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    document.title = 'Wildwood Registry';
    api(`/api/public/dogs/${encodeURIComponent(code)}`)
      .then((r) => {
        setData(r);
        document.title = `${r.dog.dog_name} ${r.dog.reg_number}`;
      })
      .catch(() => setMissing(true));
  }, [code]);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: data.dog.dog_name, url: location.href });
      else await navigator.clipboard.writeText(location.href);
    } catch {}
  };

  const header = (
    <header className="pub-top no-print">
      <div className="pub-top-in">
        <a href={brand.siteUrl} className="brand" style={{ padding: 0 }}>
          <Logo size={34} />
        </a>
        <LangSwitch />
      </div>
    </header>
  );

  if (missing)
    return (
      <div className="pub">
        {header}
        <main className="pub-main" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 60 }}>
          <span className="state-icon" style={{ background: '#FBE0D2', color: '#8F3509' }}><Icon name="alert" size={24} stroke={2.4} /></span>
          <h1 className="display" style={{ margin: 0, fontSize: 26 }}>{t('pub.notFound')}</h1>
          <p className="muted" style={{ margin: 0 }}>{t('pub.notFoundText')}</p>
        </main>
      </div>
    );
  if (!data) return <div className="pub">{header}</div>;

  const { dog: d, state } = data;
  const s = STYLE[state];
  const desc = t(`pub.${state}`, { date: fmtLong(state === 'pending' ? d.issue_date : d.expiry_date), brand: brand.name });
  const items = [
    [t('fields.owner'), d.owner_name],
    [t('fields.ownerDocument'), d.owner_document],
    [t('fields.microchip'), d.microchip],
    [t('fields.country'), country(d.country)],
    [t('fields.issueDate'), fmtLong(d.issue_date)],
    [t('fields.expiryShort'), d.lifetime ? t('pub.lifetimeValue') : fmtLong(d.expiry_date), state === 'expired' ? s.fg : state === 'lifetime' ? s.fg : undefined],
  ].filter(([, v]) => v);

  return (
    <div className="pub">
      {header}
      <main className="pub-main">
        <div className="state-banner" style={{ background: s.bg, color: s.fg }} role="status">
          <span className="state-icon" style={{ background: s.fg, color: s.bg }}>
            <Icon name={s.icon} size={24} stroke={2.8} />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="display" style={{ fontSize: 22, letterSpacing: '.04em' }}>{t(`states.${state}`)}</span>
            <span style={{ fontWeight: 500 }}>{desc}</span>
          </span>
        </div>

        <article className="cred">
          <div className="cred-side">
            <div className="cred-photo" role="img" aria-label={t('pub.photoAlt', { name: d.dog_name })} style={{ backgroundImage: d.photo_url ? `url(${d.photo_url})` : undefined, filter: state === 'inactive' ? 'grayscale(1)' : undefined }}>
              {!d.photo_url && <DogGlyph size={80} />}
            </div>
            <div>
              <h1 className="display" style={{ margin: 0, fontSize: 30, lineHeight: 1.05 }}>{d.dog_name}</h1>
              {d.breed && <div style={{ color: '#cfe3d7', marginTop: 4 }}>{d.breed}</div>}
            </div>
            <span className="badge" style={{ background: '#FBE9C2', color: '#6E4600', fontSize: 12 }}>
              <Icon name="shield" size={13} stroke={2.4} />
              {t(`specialties.${d.specialty}`)}
            </span>
          </div>
          <div className="cred-body">
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>{t('fields.regNumber')}</div>
              <div className="code" style={{ fontSize: 26 }}>{d.reg_number}</div>
            </div>
            <dl className="dl">
              {items.map(([k, v, color]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd style={{ color }}>{v}</dd>
                </div>
              ))}
            </dl>
            {d.tasks.length > 0 && (
              <div style={{ borderTop: '1px dashed var(--line-strong)', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>{t('fields.tasks')}</div>
                <ul className="task-list">
                  {d.tasks.map((x, i) => (
                    <li key={i}>
                      <Icon name="check" size={16} stroke={3} style={{ flex: 'none', marginTop: 2, color: 'var(--sage)' }} />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button type="button" className="btn" onClick={() => window.print()}>
                <Icon name="print" size={17} />
                {t('common.print')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={share}>
                <Icon name="share" size={17} />
                {t('pub.share')}
              </button>
            </div>
          </div>
          {s.stamp && (
            <div className="stamp" aria-hidden="true" style={{ color: s.fg }}>
              {t(`states.${state}`)}
            </div>
          )}
        </article>
        <p className="muted" style={{ margin: 0, fontSize: 12.5, textAlign: 'center', lineHeight: 1.6 }}>
          {t('pub.checked', { date: fmtDateTime(data.checkedAt) })}
          <br />
          {t('pub.footer', { brand: brand.name })}
        </p>
      </main>
    </div>
  );
}
