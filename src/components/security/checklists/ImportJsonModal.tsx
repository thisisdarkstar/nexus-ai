import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  FileJson,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import styles from '../ChecklistTracker.module.css';

interface ImportJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  jsonInput: string;
  onChangeJsonInput: (value: string) => void;
  importMode: 'replace' | 'append' | 'new_suite';
  onChangeImportMode: (mode: 'replace' | 'append' | 'new_suite') => void;
  newSuiteName: string;
  onChangeSuiteName: (name: string) => void;
  importError: string | null;
  parsedCount: number | null;
  uploadedFileName: string | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInsertSample: () => void;
  onExecuteImport: () => void;
}

export default function ImportJsonModal({
  isOpen,
  onClose,
  jsonInput,
  onChangeJsonInput,
  importMode,
  onChangeImportMode,
  newSuiteName,
  onChangeSuiteName,
  importError,
  parsedCount,
  uploadedFileName,
  onFileUpload,
  onInsertSample,
  onExecuteImport,
}: ImportJsonModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.importModalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileJson size={18} color="#3b82f6" />
            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
              Import Custom JSON Checklist
            </span>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <p className={styles.importSubtext}>
          Import your own penetration testing checklists, OWASP verification suites, or compliance requirements.
        </p>

        {/* Import Mode Selector */}
        <div className={styles.importModeGroup}>
          <label className={styles.importModeLabel}>
            <input
              type="radio"
              name="import_mode"
              value="replace"
              checked={importMode === 'replace'}
              onChange={() => onChangeImportMode('replace')}
            />
            <span>Replace Active Checklist</span>
          </label>
          <label className={styles.importModeLabel}>
            <input
              type="radio"
              name="import_mode"
              value="append"
              checked={importMode === 'append'}
              onChange={() => onChangeImportMode('append')}
            />
            <span>Append to Current</span>
          </label>
          <label className={styles.importModeLabel}>
            <input
              type="radio"
              name="import_mode"
              value="new_suite"
              checked={importMode === 'new_suite'}
              onChange={() => onChangeImportMode('new_suite')}
            />
            <span>Save as New Suite in Dropdown</span>
          </label>
        </div>

        {importMode === 'new_suite' && (
          <div style={{ marginBottom: '0.6rem' }}>
            <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
              New Suite Display Name
            </label>
            <input
              type="text"
              className={styles.suiteNameInput}
              placeholder="e.g. PCI-DSS v4.0 Web Application Suite"
              value={newSuiteName}
              onChange={(e) => onChangeSuiteName(e.target.value)}
            />
          </div>
        )}

        {/* File Upload or JSON Editor */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={onFileUpload}
            />
            <button
              className={styles.btn}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={12} /> {uploadedFileName ? `File: ${uploadedFileName}` : 'Choose .json File'}
            </button>
            <button
              className={styles.btn}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
              onClick={onInsertSample}
            >
              <FileText size={12} /> Insert Sample Template
            </button>
          </div>

          {parsedCount !== null && (
            <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <CheckCircle2 size={12} /> {parsedCount} valid tests detected
            </span>
          )}
        </div>

        <textarea
          className={styles.jsonTextarea}
          placeholder='[&#10;  {&#10;    "code": "AUTH-01",&#10;    "title": "Test for IDOR / Broken Object Authorization",&#10;    "category": "Authorization",&#10;    "description": "Verify access controls on sensitive resources.",&#10;    "status": "untested"&#10;  }&#10;]'
          value={jsonInput}
          onChange={(e) => onChangeJsonInput(e.target.value)}
          spellCheck={false}
        />

        {importError && (
          <div className={styles.errorBanner}>
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            <span>{importError}</span>
          </div>
        )}

        <div className={styles.modalFooter}>
          <button className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={onExecuteImport}
            disabled={!jsonInput.trim() || importError !== null}
          >
            Import Checklist Items
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
