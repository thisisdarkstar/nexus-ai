import React from 'react';
import { Globe, Sparkles } from 'lucide-react';
import styles from '../ReconHub.module.css';

interface ReconTargetBarProps {
  targetDomain: string;
  onChangeTargetDomain: (val: string) => void;
  cleanDomain: string;
  onSendToAI: () => void;
}

export default function ReconTargetBar({
  targetDomain,
  onChangeTargetDomain,
  cleanDomain,
  onSendToAI,
}: ReconTargetBarProps) {
  return (
    <div className={styles.topBar}>
      <div className={styles.targetRow}>
        <Globe size={18} color="var(--accent-color)" />
        <span className={styles.targetLabel}>Target Domain:</span>
        <input
          type="text"
          className={styles.targetInput}
          value={targetDomain}
          onChange={(e) => onChangeTargetDomain(e.target.value)}
          placeholder="e.g. example.com or app.target.io"
        />
        <span className={styles.cleanDomainBadge}>Active Scope: {cleanDomain}</span>

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onSendToAI}
          title="Generate AI End-to-End OSINT & Reconnaissance Playbook"
        >
          <Sparkles size={13} /> AI OSINT Strategy
        </button>
      </div>
    </div>
  );
}
