import React from 'react';
import {
  FileCode,
  ShieldCheck,
  RotateCcw,
  Maximize2,
  Minimize2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import CustomSelect from '../../CustomSelect';
import {
  LANGUAGE_OPTIONS,
  SAMPLE_VULNERABILITIES,
} from '../../../data/security/auditCodeSamples';
import styles from '../CodeAuditor.module.css';

interface CodeEditorPanelProps {
  code: string;
  onChangeCode: (code: string) => void;
  language: string;
  onChangeLanguage: (lang: string) => void;
  onSelectSample: (sampleId: string) => void;
  onScanHeuristics: () => void;
  onClearCode: () => void;
  onAuditWithAI: () => void;
  isAuditing: boolean;
  editorSize: 'normal' | 'expanded' | 'full';
  onToggleEditorSize: () => void;
}

export default function CodeEditorPanel({
  code,
  onChangeCode,
  language,
  onChangeLanguage,
  onSelectSample,
  onScanHeuristics,
  onClearCode,
  onAuditWithAI,
  isAuditing,
  editorSize,
  onToggleEditorSize,
}: CodeEditorPanelProps) {
  return (
    <div className={styles.editorCard}>
      {/* Top Controls */}
      <div className={styles.topBar}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <CustomSelect
            value=""
            placeholder="Sample Vulnerability Templates..."
            options={SAMPLE_VULNERABILITIES.map((s) => ({
              value: s.id,
              label: s.name,
              badge: s.language.toUpperCase(),
            }))}
            onChange={(val) => onSelectSample(val)}
            style={{ minWidth: '220px' }}
          />
          <CustomSelect
            value={language}
            options={LANGUAGE_OPTIONS}
            onChange={(val) => onChangeLanguage(val)}
            style={{ minWidth: '130px' }}
          />
        </div>

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onAuditWithAI}
          disabled={isAuditing}
        >
          {isAuditing ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Auditing with AI...
            </>
          ) : (
            <>
              <Sparkles size={14} /> Audit with AppSec AI
            </>
          )}
        </button>
      </div>

      {/* Target Code Header */}
      <div className={styles.cardHeader}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <FileCode size={14} /> Target Source Code
        </span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            className={styles.btn}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
            onClick={onScanHeuristics}
            title="Run instant client-side static security analysis"
          >
            <ShieldCheck size={11} color="#10b981" /> Scan Code
          </button>
          <button
            className={styles.btn}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
            onClick={onClearCode}
          >
            <RotateCcw size={11} /> Clear
          </button>
          <button
            className={styles.btn}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
            onClick={onToggleEditorSize}
            title={
              editorSize === 'normal'
                ? 'Expand editor height (420px)'
                : editorSize === 'expanded'
                ? 'Full height (620px)'
                : 'Reset height (260px)'
            }
          >
            {editorSize === 'full' ? (
              <>
                <Minimize2 size={11} /> Reset
              </>
            ) : (
              <>
                <Maximize2 size={11} /> {editorSize === 'normal' ? 'Expand' : 'Full'}
              </>
            )}
          </button>
        </div>
      </div>

      <textarea
        className={styles.codeArea}
        style={{
          minHeight:
            editorSize === 'full'
              ? '600px'
              : editorSize === 'expanded'
              ? '420px'
              : '260px',
          height:
            editorSize === 'full'
              ? '600px'
              : editorSize === 'expanded'
              ? '420px'
              : '260px',
        }}
        value={code}
        onChange={(e) => onChangeCode(e.target.value)}
        placeholder="// Paste source code to inspect for vulnerabilities and logic flaws..."
        spellCheck={false}
      />
    </div>
  );
}
