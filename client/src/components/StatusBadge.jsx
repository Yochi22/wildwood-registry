import { useI18n } from '../i18n/index.jsx';
import Icon from './Icon.jsx';

export default function StatusBadge({ state, expiring }) {
  const { t } = useI18n();
  const key = state === 'active' && expiring ? 'expiring' : state;
  return (
    <span className={`badge badge-${key}`}>
      {key === 'lifetime' && <Icon name="infinity" size={12} stroke={2.6} />}
      {t(`states.${key}`)}
    </span>
  );
}
