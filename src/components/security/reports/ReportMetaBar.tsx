import React from 'react';
import CustomSelect from '../../CustomSelect';
import { ASSESSMENT_TYPE_OPTIONS } from '../../../data/security/reportTemplates';
import type { VAPTReport } from '../../../types';
import styles from '../ReportStudio.module.css';

interface ReportMetaBarProps {
  report: VAPTReport;
  onUpdateMeta: (updates: Partial<VAPTReport>) => void;
}

export default function ReportMetaBar({ report, onUpdateMeta }: ReportMetaBarProps) {
  return (
    <div className={styles.metaGrid}>
      <div className={styles.formGroup}>
        <label className={styles.label}>Client / Target Org</label>
        <input
          type="text"
          className={styles.input}
          value={report.clientName}
          onChange={(e) => onUpdateMeta({ clientName: e.target.value })}
          placeholder="e.g. Acme Corp"
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Assessment Scope</label>
        <input
          type="text"
          className={styles.input}
          value={report.targetScope}
          onChange={(e) => onUpdateMeta({ targetScope: e.target.value })}
          placeholder="e.g. *.example.com"
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Assessment Type</label>
        <CustomSelect
          value={report.assessmentType || 'web'}
          options={ASSESSMENT_TYPE_OPTIONS}
          onChange={(val) => onUpdateMeta({ assessmentType: val as VAPTReport['assessmentType'] })}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Lead Assessor</label>
        <input
          type="text"
          className={styles.input}
          value={report.leadTester}
          onChange={(e) => onUpdateMeta({ leadTester: e.target.value })}
          placeholder="e.g. Security Lead"
        />
      </div>
    </div>
  );
}
