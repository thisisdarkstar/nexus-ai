import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileCheck,
  X,
  Target,
  FileText,
  Globe,
  AlertTriangle,
  CheckCircle,
  Radar,
} from 'lucide-react';
import { parseSecurityArtifact, type ParsedArtifactResult } from '../../lib/security/artifactParsers';
import { ingestionService } from '../../services/IngestionService';
import { workbenchBridge } from '../../lib/security/workbenchBridge';
import styles from './ArtifactIngestModal.module.css';

interface ArtifactIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (summary: string) => void;
}

export default function ArtifactIngestModal({ isOpen, onClose, onSuccess }: ArtifactIngestModalProps) {
  const [parsedResult, setParsedResult] = useState<ParsedArtifactResult | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    setFileName(file.name);
    setIsProcessing(true);
    setProgressMessage(`Reading ${file.name}...`);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (text) {
        try {
          const result = await ingestionService.ingestFile(text, file.name, {
            onProgress: (p) => setProgressMessage(p.message),
          });
          setParsedResult(result);
        } catch (err) {
          console.error('Ingestion failed:', err);
        } finally {
          setIsProcessing(false);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedResult) return;

    // 1. Import Scope Items
    if (parsedResult.scopeItems.length > 0) {
      workbenchBridge.addScopeItems(parsedResult.scopeItems);
    }

    // 2. Import Findings
    if (parsedResult.findings.length > 0) {
      parsedResult.findings.forEach((f) => workbenchBridge.addFinding(f));
    }

    // 3. Import Recon Assets
    if (parsedResult.reconAssets && parsedResult.reconAssets.length > 0) {
      workbenchBridge.addReconAssets(parsedResult.reconAssets);
    }

    // 4. Load first request into HTTP Studio if present
    if (parsedResult.rawRequests.length > 0) {
      workbenchBridge.loadHttp(parsedResult.rawRequests[0]);
    }

    if (onSuccess) {
      onSuccess(parsedResult.summary);
    }

    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>
            <UploadCloud size={20} color="#38bdf8" />
            <span>Ingest Security Scan Artifact</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {!parsedResult ? (
            <div
              className={`${styles.dropzone} ${isDragging ? styles.active : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".xml,.json,.jsonl,.txt,.nmap,.sarif,.yaml,.yml"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />
              <UploadCloud size={40} className={styles.dropzoneIcon} />
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
                Drop security report, or click to browse
              </div>
              <div className={styles.supportedFormats}>
                Supported formats: <strong>Burp Suite XML</strong>, <strong>Nmap XML (-oX)</strong>, <strong>Nuclei JSONL</strong>, <strong>Httpx (JSON/CLI)</strong>, <strong>Subdomains & Endpoints (.txt)</strong>, <strong>SARIF 2.1</strong>, <strong>OpenAPI</strong>
              </div>
            </div>
          ) : (
            <div className={styles.previewCard}>
              <div className={styles.previewHeader}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>
                  {fileName}
                </span>
                <span className={styles.badge}>{parsedResult.sourceType}</span>
              </div>

              <div className={styles.summaryText}>
                {parsedResult.summary}
              </div>

              <div className={styles.statsRow}>
                {parsedResult.reconAssets && parsedResult.reconAssets.length > 0 && (
                  <div className={styles.statBadge}>
                    <Radar size={14} color="#a855f7" />
                    <span>{parsedResult.reconAssets.length} Recon Assets</span>
                  </div>
                )}
                {parsedResult.scopeItems.length > 0 && (
                  <div className={styles.statBadge}>
                    <Target size={14} color="#38bdf8" />
                    <span>{parsedResult.scopeItems.length} Targets</span>
                  </div>
                )}
                {parsedResult.findings.length > 0 && (
                  <div className={styles.statBadge}>
                    <FileText size={14} color="#f87171" />
                    <span>{parsedResult.findings.length} Findings</span>
                  </div>
                )}
                {parsedResult.rawRequests.length > 0 && (
                  <div className={styles.statBadge}>
                    <Globe size={14} color="#34d399" />
                    <span>{parsedResult.rawRequests.length} HTTP Requests</span>
                  </div>
                )}
              </div>

              {parsedResult.sourceType === 'unknown' && (
                <div style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertTriangle size={14} /> Format not recognized. Please provide a standard tool output.
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          {parsedResult && parsedResult.sourceType !== 'unknown' && (
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleConfirmImport}>
              <CheckCircle size={14} style={{ marginRight: '0.4rem' }} /> Import to Active Engagement
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

