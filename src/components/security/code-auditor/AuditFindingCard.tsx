import React from 'react';
import {
  ShieldAlert,
  GitPullRequest,
  Check,
  Copy,
  Trash2,
} from 'lucide-react';
import type { VulnerabilityFinding } from '../../../types';
import styles from '../CodeAuditor.module.css';

interface AuditFindingCardProps {
  finding: VulnerabilityFinding;
  onDeleteFinding: (id: string) => void;
  onApplyPatch: (finding: VulnerabilityFinding) => void;
  isApplied: boolean;
  copiedId: string | null;
  onCopyPatch: (id: string, text: string) => void;
}

export default function AuditFindingCard({
  finding,
  onDeleteFinding,
  onApplyPatch,
  isApplied,
  copiedId,
  onCopyPatch,
}: AuditFindingCardProps) {
  const sevKey = (finding.severity || 'high').toLowerCase();

  return (
    <div className={`${styles.findingCard} ${styles[sevKey] || styles.high}`}>
      <div className={styles.findingHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <ShieldAlert size={14} color="var(--accent-color)" />
          <span className={styles.findingTitle}>{finding.title}</span>
          {finding.cweId && <span className={styles.cweTag}>{finding.cweId}</span>}
          {finding.owaspCategory && <span className={styles.owaspTag}>{finding.owaspCategory}</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className={`${styles.badge} ${styles[sevKey] || styles.high}`}>
            {finding.severity.toUpperCase()}
          </span>
          <button
            className={styles.deleteBtn}
            onClick={() => onDeleteFinding(finding.id)}
            title="Delete Finding"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <p className={styles.findingDesc}>{finding.description}</p>

      {finding.remediation && (
        <div className={styles.remediationBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#10b981', fontWeight: 600, fontSize: '0.76rem' }}>
            Remediation Guidance:
          </div>
          <div style={{ fontSize: '0.76rem', color: '#e2e8f0', marginTop: '0.2rem', lineHeight: 1.45 }}>
            {finding.remediation}
          </div>
        </div>
      )}

      {finding.patchDiff && (
        <div className={styles.diffContainer}>
          <div className={`${styles.diffBlock} ${styles.diffOriginal}`}>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: '#ef4444', fontSize: '0.72rem' }}>
              - Original Code (Vulnerable):
            </div>
            <code>{finding.patchDiff.original}</code>
          </div>

          <div className={`${styles.diffBlock} ${styles.diffPatched}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: 600, color: '#10b981', fontSize: '0.72rem' }}>
                + Remediated Patch (Secure):
              </span>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  className={styles.btn}
                  style={{ padding: '0.12rem 0.4rem', fontSize: '0.66rem' }}
                  onClick={() => onCopyPatch(finding.id, finding.patchDiff?.patched || '')}
                >
                  {copiedId === finding.id ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                  <span>{copiedId === finding.id ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  style={{ padding: '0.12rem 0.4rem', fontSize: '0.66rem' }}
                  onClick={() => onApplyPatch(finding)}
                >
                  {isApplied ? <Check size={10} /> : <GitPullRequest size={10} />}
                  <span>{isApplied ? 'Applied!' : 'Apply'}</span>
                </button>
              </div>
            </div>
            <code>{finding.patchDiff.patched}</code>
          </div>
        </div>
      )}
    </div>
  );
}
