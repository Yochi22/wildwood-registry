import { Component } from 'react';
import { useI18n } from '../i18n/index.jsx';

function Fallback() {
  const { t } = useI18n();
  return (
    <div className="empty" role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <span>{t('common.error')}</span>
      <button type="button" className="btn" onClick={() => window.location.reload()}>
        {t('common.reload')}
      </button>
    </div>
  );
}

/** Si una pantalla falla, muestra un aviso en lugar de dejar la página en blanco. */
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error(error);
  }
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    return this.state.error ? <Fallback /> : this.props.children;
  }
}
