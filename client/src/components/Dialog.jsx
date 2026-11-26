import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import { useI18n } from '../i18n/index.jsx';

export default function Dialog({ open, title, onClose, children, footer }) {
  const ref = useRef(null);
  const { t } = useI18n();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onCancel={onClose} aria-labelledby="dlg-title">
      {open && (
        <>
          <div className="dialog-head">
            <h2 id="dlg-title">{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
              <Icon name="x" />
            </button>
          </div>
          <div className="dialog-body">{children}</div>
          {footer && <div className="dialog-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, title, text, confirmLabel, danger, busy, onConfirm, onClose, children }) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={danger ? 'btn btn-danger-solid' : 'btn btn-primary'} onClick={onConfirm} disabled={busy}>
            {confirmLabel || t('common.confirm')}
          </button>
        </>
      }
    >
      {text && <p style={{ margin: 0 }}>{text}</p>}
      {children}
    </Dialog>
  );
}
