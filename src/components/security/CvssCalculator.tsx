import type { CVSSMetrics } from '../../types';
import styles from './ReportStudio.module.css';

interface CvssCalculatorProps {
  metrics: CVSSMetrics;
  onMetricChange: (metric: keyof CVSSMetrics, val: string) => void;
  onApply: () => void;
}

const CVSS_METRIC_ROWS: Array<{
  key: 'av' | 'ac' | 'pr' | 'ui' | 's' | 'c' | 'i' | 'a';
  label: string;
  options: Array<{ code: string; title: string }>;
}> = [
  {
    key: 'av',
    label: 'Attack Vector (AV)',
    options: [
      { code: 'N', title: 'Network' },
      { code: 'A', title: 'Adjacent' },
      { code: 'L', title: 'Local' },
      { code: 'P', title: 'Physical' },
    ],
  },
  {
    key: 'ac',
    label: 'Attack Complexity (AC)',
    options: [
      { code: 'L', title: 'Low' },
      { code: 'H', title: 'High' },
    ],
  },
  {
    key: 'pr',
    label: 'Privileges Required (PR)',
    options: [
      { code: 'N', title: 'None' },
      { code: 'L', title: 'Low' },
      { code: 'H', title: 'High' },
    ],
  },
  {
    key: 'ui',
    label: 'User Interaction (UI)',
    options: [
      { code: 'N', title: 'None' },
      { code: 'R', title: 'Required' },
    ],
  },
  {
    key: 's',
    label: 'Scope (S)',
    options: [
      { code: 'U', title: 'Unchanged' },
      { code: 'C', title: 'Changed' },
    ],
  },
  {
    key: 'c',
    label: 'Confidentiality (C)',
    options: [
      { code: 'N', title: 'None' },
      { code: 'L', title: 'Low' },
      { code: 'H', title: 'High' },
    ],
  },
  {
    key: 'i',
    label: 'Integrity (I)',
    options: [
      { code: 'N', title: 'None' },
      { code: 'L', title: 'Low' },
      { code: 'H', title: 'High' },
    ],
  },
  {
    key: 'a',
    label: 'Availability (A)',
    options: [
      { code: 'N', title: 'None' },
      { code: 'L', title: 'Low' },
      { code: 'H', title: 'High' },
    ],
  },
];

/**
 * Interactive CVSS v3.1 vector builder accordion for VAPT findings.
 */
export default function CvssCalculator({
  metrics,
  onMetricChange,
  onApply,
}: CvssCalculatorProps) {
  return (
    <div className={styles.cvssBox}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc' }}>
            CVSS v3.1 Score: {metrics.score} ({metrics.severity.toUpperCase()})
          </span>
          <code style={{ fontSize: '0.7rem', color: '#38bdf8' }}>{metrics.vectorString}</code>
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onApply}
        >
          Apply Score
        </button>
      </div>

      {CVSS_METRIC_ROWS.map((row) => (
        <div key={row.key} className={styles.cvssRow}>
          <span>{row.label}</span>
          <div className={styles.cvssBtnGroup}>
            {row.options.map((opt) => (
              <button
                key={opt.code}
                type="button"
                className={`${styles.cvssBtn} ${
                  metrics[row.key] === opt.code ? styles.cvssBtnActive : ''
                }`}
                title={`${row.label}: ${opt.title}`}
                onClick={() => onMetricChange(row.key, opt.code)}
              >
                {opt.code}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
