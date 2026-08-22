import React from 'react';
import { Check, X as XIcon, HelpCircle, Trash2 } from 'lucide-react';
import type { SecurityChecklistItem } from '../../../types';
import styles from '../ChecklistTracker.module.css';

interface ChecklistItemCardProps {
  item: SecurityChecklistItem;
  onStatusChange: (id: string, newStatus: SecurityChecklistItem['status']) => void;
  onDeleteItem: (id: string, code: string) => void;
}

export default function ChecklistItemCard({
  item,
  onStatusChange,
  onDeleteItem,
}: ChecklistItemCardProps) {
  const getStatusBorderClass = (status: SecurityChecklistItem['status']) => {
    switch (status) {
      case 'pass':
        return styles.statusPass;
      case 'fail':
        return styles.statusFail;
      default:
        return styles.statusUntested;
    }
  };

  return (
    <div className={`${styles.itemCard} ${getStatusBorderClass(item.status)}`}>
      <div className={styles.itemHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span className={styles.itemCode}>{item.code}</span>
          <span className={styles.itemCategory}>{item.category}</span>
          <span className={styles.itemTitle}>{item.title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div className={styles.statusButtons}>
            <button
              className={`${styles.statusBtn} ${item.status === 'pass' ? styles.statusBtnPassActive : ''}`}
              onClick={() => onStatusChange(item.id, 'pass')}
              title="Mark as Passed / Secure"
            >
              <Check size={11} /> Pass
            </button>
            <button
              className={`${styles.statusBtn} ${item.status === 'fail' ? styles.statusBtnFailActive : ''}`}
              onClick={() => onStatusChange(item.id, 'fail')}
              title="Mark as Vulnerable / Failed"
            >
              <XIcon size={11} /> Fail
            </button>
            <button
              className={`${styles.statusBtn} ${item.status === 'untested' ? styles.statusBtnUntestedActive : ''}`}
              onClick={() => onStatusChange(item.id, 'untested')}
              title="Mark as Untested"
            >
              <HelpCircle size={11} /> Untested
            </button>
          </div>

          <button
            className={styles.deleteItemBtn}
            onClick={() => onDeleteItem(item.id, item.code)}
            title="Delete Test Item"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <p className={styles.itemDesc}>{item.description}</p>
    </div>
  );
}
