import { useEffect } from 'react';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';
import styles from './ConfirmModal.module.css';

export interface ConfirmModalProps {
  isOpen?: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'warning' | 'info';
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen = true,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  showCancel = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const IconComponent =
    variant === 'danger'
      ? AlertCircle
      : variant === 'warning'
      ? AlertTriangle
      : Info;

  const iconColor =
    variant === 'danger'
      ? '#ef4444'
      : variant === 'warning'
      ? '#f59e0b'
      : '#10b981';

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        className={styles.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.headerRow}>
          <div className={styles.iconCircle} style={{ background: `${iconColor}20`, color: iconColor }}>
            <IconComponent size={20} />
          </div>
          <h3 id="confirm-title" className={styles.title}>
            {title}
          </h3>
        </div>

        <p id="confirm-message" className={styles.message}>
          {message}
        </p>

        <div className={styles.actions}>
          {showCancel && (
            <button onClick={onCancel} className={styles.cancelBtn}>
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`${styles.confirmBtn} ${styles[`confirm_${variant}`]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
