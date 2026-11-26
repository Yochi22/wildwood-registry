import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
      <h1 className="display" style={{ margin: 0, fontSize: 28 }}>{t('notFound.title')}</h1>
      <Link to="/" className="btn">{t('notFound.back')}</Link>
    </div>
  );
}
