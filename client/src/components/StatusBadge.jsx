import { useI18n } from '../i18n/index.jsx';
import { Star } from './Icon.jsx';

export default function StatusBadge({ state, expiring }) {
  const { t } = useI18n();
  const key = state === 'active' && expiring ? 'expiring' : state;
  return (
    <span className={`badge badge-${key}`}>
      {key === 'lifetime' && <Star size={10} />}
      {t(`states.${key}`)}
    </span>
  );
}
