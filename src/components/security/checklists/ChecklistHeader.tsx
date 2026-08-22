import React from 'react';
import {
  CheckSquare,
  Plus,
  FileJson,
  Download,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import CustomSelect from '../../CustomSelect';
import styles from '../ChecklistTracker.module.css';

interface ChecklistHeaderProps {
  progressPercent: number;
  testedCount: number;
  total: number;
  failCount: number;
  suiteOptions: { value: string; label: string; badge?: string }[];
  onLoadSuite: (suiteKey: string) => void;
  showAddForm: boolean;
  onToggleAddForm: () => void;
  onOpenImportModal: () => void;
  onExportJson: () => void;
  onResetChecklist: () => void;
  onAiGapAnalysis: () => void;
}

export default function ChecklistHeader({
  progressPercent,
  testedCount,
  total,
  failCount,
  suiteOptions,
  onLoadSuite,
  showAddForm,
  onToggleAddForm,
  onOpenImportModal,
  onExportJson,
  onResetChecklist,
  onAiGapAnalysis,
}: ChecklistHeaderProps) {
  return (
    <div className={styles.topBar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <CheckSquare size={16} color="var(--accent-color)" />
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
          VAPT Methodology &amp; Checklist Tracker
        </span>
        <span style={{ fontSize: '0.75rem', color: '#10b981' }}>
          {progressPercent}% Complete ({testedCount}/{total})
        </span>
        {failCount > 0 && (
          <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>
            ({failCount} Vulnerabilities Found)
          </span>
        )}
        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: '3px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '2px',
          marginTop: '0.35rem',
          overflow: 'hidden',
          flexBasis: '100%',
        }}>
          <div style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: failCount > 0
              ? `linear-gradient(to right, #10b981 ${((testedCount - failCount) / Math.max(total, 1)) * 100}%, #ef4444 0%)`
              : 'linear-gradient(135deg, #059669, #10b981)',
            borderRadius: '2px',
            transition: 'width 0.4s ease',
            minWidth: progressPercent > 0 ? '4px' : '0',
          }} />
        </div>
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        {/* Suite Loader Selector */}
        <CustomSelect
          value=""
          placeholder="📂 Load Standard Suite..."
          options={suiteOptions}
          onChange={(val) => onLoadSuite(val)}
          style={{ minWidth: '190px' }}
        />

        <button
          className={styles.btn}
          onClick={onToggleAddForm}
          title="Add Single Custom Item"
        >
          <Plus size={12} /> {showAddForm ? 'Cancel' : 'Add Item'}
        </button>

        <button
          className={styles.btn}
          onClick={onOpenImportModal}
          title="Upload or paste custom JSON checklist"
        >
          <FileJson size={12} /> Import JSON
        </button>

        <button
          className={styles.btn}
          onClick={onExportJson}
          title="Export current checklist as JSON"
        >
          <Download size={12} /> Export
        </button>

        <button
          className={styles.btn}
          onClick={onResetChecklist}
          title="Reset all test statuses back to untested"
        >
          <RotateCcw size={12} /> Reset
        </button>

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onAiGapAnalysis}
          title="AI Methodology Advisor & Gap Analysis"
        >
          <Sparkles size={12} /> AI Gap Analysis
        </button>
      </div>
    </div>
  );
}
