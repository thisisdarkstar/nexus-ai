import React from 'react';
import CustomSelect from '../../CustomSelect';
import type { VulnerabilityFinding, VulnerabilitySeverity } from '../../../types';
import styles from '../CodeAuditor.module.css';

interface AddFindingFormProps {
  newFinding: Partial<VulnerabilityFinding>;
  onChangeFinding: (updates: Partial<VulnerabilityFinding>) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function AddFindingForm({
  newFinding,
  onChangeFinding,
  onSave,
  onCancel,
}: AddFindingFormProps) {
  return (
    <div
      className={styles.findingCard}
      style={{
        borderLeftColor: '#3b82f6',
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(255,255,255,0.12)',
        gap: '0.6rem',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#60a5fa' }}>
        📝 Record Custom Vulnerability Finding
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
            Finding Title
          </label>
          <input
            style={{
              width: '100%',
              padding: '0.35rem 0.5rem',
              fontSize: '0.75rem',
              background: '#020617',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              borderRadius: '5px',
              boxSizing: 'border-box',
            }}
            placeholder="e.g. Broken Access Control in Controller"
            value={newFinding.title || ''}
            onChange={(e) => onChangeFinding({ title: e.target.value })}
          />
        </div>

        <div>
          <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
            Severity &amp; CWE ID
          </label>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <CustomSelect
              value={newFinding.severity || 'high'}
              options={[
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
                { value: 'info', label: 'Info' },
              ]}
              onChange={(val) => onChangeFinding({ severity: val as VulnerabilitySeverity })}
              style={{ flex: 1 }}
            />
            <input
              style={{
                width: '90px',
                padding: '0.35rem 0.5rem',
                fontSize: '0.75rem',
                background: '#020617',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                borderRadius: '5px',
                boxSizing: 'border-box',
              }}
              placeholder="CWE-89"
              value={newFinding.cweId || ''}
              onChange={(e) => onChangeFinding({ cweId: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div>
        <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
          Description &amp; Impact
        </label>
        <textarea
          style={{
            width: '100%',
            padding: '0.35rem 0.5rem',
            fontSize: '0.75rem',
            background: '#020617',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff',
            borderRadius: '5px',
            boxSizing: 'border-box',
            resize: 'vertical',
          }}
          rows={2}
          placeholder="Explain the security risk and exploit scenario..."
          value={newFinding.description || ''}
          onChange={(e) => onChangeFinding({ description: e.target.value })}
        />
      </div>

      <div>
        <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
          Remediation Guidance
        </label>
        <input
          style={{
            width: '100%',
            padding: '0.35rem 0.5rem',
            fontSize: '0.75rem',
            background: '#020617',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff',
            borderRadius: '5px',
            boxSizing: 'border-box',
          }}
          placeholder="How to fix this issue securely..."
          value={newFinding.remediation || ''}
          onChange={(e) => onChangeFinding({ remediation: e.target.value })}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <label style={{ fontSize: '0.7rem', color: '#f87171', display: 'block', marginBottom: '0.2rem' }}>
            Original Insecure Lines (Diff Before)
          </label>
          <textarea
            style={{
              width: '100%',
              padding: '0.35rem 0.5rem',
              fontSize: '0.72rem',
              fontFamily: 'monospace',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#fff',
              borderRadius: '5px',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
            rows={3}
            placeholder="Lines of code before fix..."
            value={newFinding.patchDiff?.original || ''}
            onChange={(e) =>
              onChangeFinding({
                patchDiff: {
                  original: e.target.value,
                  patched: newFinding.patchDiff?.patched || '',
                },
              })
            }
          />
        </div>

        <div>
          <label style={{ fontSize: '0.7rem', color: '#34d399', display: 'block', marginBottom: '0.2rem' }}>
            Secured Replacement Lines (Diff After)
          </label>
          <textarea
            style={{
              width: '100%',
              padding: '0.35rem 0.5rem',
              fontSize: '0.72rem',
              fontFamily: 'monospace',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#fff',
              borderRadius: '5px',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
            rows={3}
            placeholder="Secure replacement code..."
            value={newFinding.patchDiff?.patched || ''}
            onChange={(e) =>
              onChangeFinding({
                patchDiff: {
                  original: newFinding.patchDiff?.original || '',
                  patched: e.target.value,
                },
              })
            }
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
        <button
          className={styles.btn}
          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
          onClick={onSave}
          disabled={!newFinding.title?.trim()}
        >
          Save Finding
        </button>
      </div>
    </div>
  );
}
