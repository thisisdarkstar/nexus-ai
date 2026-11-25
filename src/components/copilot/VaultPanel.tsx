import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Eye,
  FileText,
  FolderArchive,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { vaultStore, type VaultDocument } from '../../lib/rag/vaultStore';
import styles from './CopilotDrawer.module.css';

interface VaultPanelProps {
  activeWorkbenchName: string;
  hasCustomSystemPrompt: boolean;
  messageCount: number;
}

/**
 * Local engagement document ingestion, RAG chunk inspector, and retrieval testing panel.
 */
export default function VaultPanel({
  activeWorkbenchName,
  hasCustomSystemPrompt,
  messageCount,
}: VaultPanelProps) {
  const vaultFileInputRef = useRef<HTMLInputElement>(null);
  const [vaultDocs, setVaultDocs] = useState<VaultDocument[]>(() => vaultStore.getDocuments());
  const [previewDoc, setPreviewDoc] = useState<VaultDocument | null>(null);
  const [vaultSearchQuery, setVaultSearchQuery] = useState('');

  useEffect(() => {
    return vaultStore.subscribe(setVaultDocs);
  }, []);

  const handleVaultFilesUpload = async (fileList: FileList | File[]) => {
    for (const file of Array.from(fileList)) {
      try {
        const text = await file.text();
        await vaultStore.addDocument(file.name, text);
      } catch (err) {
        console.error('Failed to read vault file:', err);
      }
    }
  };

  const testSearchResults = useMemo(() => {
    if (!vaultSearchQuery.trim()) return [];
    return vaultStore.search(vaultSearchQuery, 3);
  }, [vaultSearchQuery, vaultDocs]);

  return (
    <>
      <div className={styles.subTabContent}>
        <input
          type="file"
          ref={vaultFileInputRef}
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) void handleVaultFilesUpload(e.target.files);
            e.target.value = '';
          }}
        />

        <div className={styles.vaultCard}>
          <div className={styles.telemetryCardTitle}>
            <FolderArchive size={15} color="#38bdf8" />
            <span>Engagement Evidence & Document Vault</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Ingest scan logs, target source code, or vulnerability evidence. Copilot chunks and indexes files into an offline semantic store for grounded answers with verified citations.
          </p>

          {/* Ingestion Dropzone */}
          <div
            className={styles.vaultDropzone}
            onClick={() => vaultFileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) void handleVaultFilesUpload(e.dataTransfer.files);
            }}
          >
            <UploadCloud size={24} color="#38bdf8" />
            <div>
              <strong>Click or drop security documents to index</strong>
              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                Burp XML, Nuclei YAML, Nmap XML/txt, SARIF, JSON logs, or source code
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className={styles.vaultStatsRow}>
            <div className={styles.vaultStatBadge}>
              <span>Documents:</span>
              <strong>{vaultDocs.length}</strong>
            </div>
            <div className={styles.vaultStatBadge}>
              <span>Active Chunks:</span>
              <strong style={{ color: '#10b981' }}>{vaultStore.getActiveChunks().length}</strong>
            </div>
            <div className={styles.vaultStatBadge}>
              <span>Indexed Tokens:</span>
              <strong style={{ color: '#38bdf8' }}>~{vaultStore.getActiveTokenCount().toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* Indexed Documents Manager */}
        {vaultDocs.length > 0 && (
          <div className={styles.vaultCard}>
            <div className={styles.vaultDocHeader}>
              <div className={styles.telemetryCardTitle}>
                <BookOpen size={15} color="#10b981" />
                <span>Indexed Documents ({vaultDocs.length})</span>
              </div>
              <button
                type="button"
                className={`${styles.vaultActionBtn} ${styles.vaultActionBtnDanger}`}
                onClick={() => vaultStore.clearAll()}
                title="Remove all documents from knowledge vault"
              >
                <Trash2 size={12} /> Clear All
              </button>
            </div>

            {/* Retrieval Sandbox / Search Bar */}
            <div className={styles.vaultSearchTestGroup}>
              <Search size={13} color="#94a3b8" />
              <input
                type="text"
                className={styles.vaultSearchTestInput}
                placeholder="Test semantic retrieval against vault (e.g. port 8080, cwe-79, admin endpoint)..."
                value={vaultSearchQuery}
                onChange={(e) => setVaultSearchQuery(e.target.value)}
              />
              {vaultSearchQuery && (
                <button
                  type="button"
                  className={styles.vaultActionBtn}
                  onClick={() => setVaultSearchQuery('')}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Live Match Preview */}
            {testSearchResults.length > 0 && (
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: '6px',
                  padding: '0.6rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 600 }}>
                  Top Retrieval Match (Score: {testSearchResults[0].score.toFixed(2)} · {testSearchResults[0].docName})
                </div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: '#e2e8f0',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '100px',
                    overflowY: 'auto',
                  }}
                >
                  {testSearchResults[0].text.slice(0, 240)}...
                </div>
              </div>
            )}

            {/* Document Cards List */}
            <div className={styles.vaultDocsList}>
              {vaultDocs.map((doc) => (
                <div
                  key={doc.id}
                  className={`${styles.vaultDocCard} ${!doc.enabled ? styles.vaultDocCardDisabled : ''}`}
                >
                  <div className={styles.vaultDocHeader}>
                    <div className={styles.vaultDocTitleGroup}>
                      <FileText size={15} color={doc.enabled ? '#38bdf8' : '#64748b'} />
                      <span className={styles.vaultDocName} title={doc.name}>
                        {doc.name}
                      </span>
                    </div>
                    <div className={styles.vaultDocActions}>
                      <button
                        type="button"
                        className={styles.vaultActionBtn}
                        onClick={() => vaultStore.toggleDocumentScope(doc.id)}
                        title={
                          doc.scope === 'global'
                            ? 'Shared across all engagements (click to scope to current project)'
                            : 'Scoped to current engagement (click to share globally as playbook)'
                        }
                        style={{
                          fontSize: '0.66rem',
                          padding: '0.18rem 0.45rem',
                          color: doc.scope === 'global' ? '#f59e0b' : '#38bdf8',
                        }}
                      >
                        {doc.scope === 'global' ? 'Global' : 'Project'}
                      </button>
                      <button
                        type="button"
                        className={`${styles.vaultToggleBtn} ${!doc.enabled ? styles.vaultToggleBtnDisabled : ''}`}
                        onClick={() => vaultStore.toggleDocument(doc.id)}
                        title={doc.enabled ? 'Click to mute document for RAG' : 'Click to enable for RAG'}
                      >
                        {doc.enabled ? '✓ RAG Active' : 'Muted'}
                      </button>
                      <button
                        type="button"
                        className={styles.vaultActionBtn}
                        onClick={() => setPreviewDoc(doc)}
                        title="Inspect Chunks"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.vaultActionBtn} ${styles.vaultActionBtnDanger}`}
                        onClick={() => vaultStore.removeDocument(doc.id)}
                        title="Delete from Vault"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className={styles.vaultDocBadges}>
                    <span className={styles.vaultDocBadge}>{(doc.size / 1024).toFixed(1)} KB</span>
                    <span className={styles.vaultDocBadge}>
                      {doc.chunks.length} chunk{doc.chunks.length > 1 ? 's' : ''}
                    </span>
                    <span className={styles.vaultDocBadge}>~{doc.tokenCount.toLocaleString()} tokens</span>
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                      {new Date(doc.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.vaultCard}>
          <div className={styles.telemetryCardTitle}>
            <CheckCircle2 size={15} color="#10b981" />
            <span>Active Engagement Telemetry</span>
          </div>
          <div
            style={{
              fontSize: '0.74rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div className={styles.telemetryStatsRow}>
              <span>Active Workbench Module:</span>
              <strong style={{ color: '#38bdf8' }}>{activeWorkbenchName}</strong>
            </div>
            <div className={styles.telemetryStatsRow}>
              <span>Current Chat System Prompt:</span>
              <span>{hasCustomSystemPrompt ? 'Customized' : 'Default Global'}</span>
            </div>
            <div className={styles.telemetryStatsRow}>
              <span>Messages in Thread:</span>
              <strong>{messageCount}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Document Chunks Inspector Modal */}
      {previewDoc && (
        <div className={styles.citationModalOverlay} onClick={() => setPreviewDoc(null)}>
          <div
            className={styles.citationModal}
            role="dialog"
            aria-modal="true"
            aria-label="Document Chunks"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.citationModalHeader}>
              <div className={styles.citationModalTitleGroup}>
                <FileText size={16} color="#38bdf8" />
                <span className={styles.citationModalTitle}>{previewDoc.name}</span>
                <span className={styles.citationChunkBadge}>
                  {previewDoc.chunks.length} Chunks (~{previewDoc.tokenCount.toLocaleString()} tokens)
                </span>
              </div>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setPreviewDoc(null)}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>
            <div className={styles.citationModalBody}>
              {previewDoc.chunks.map((chk, ci) => (
                <div
                  key={chk.id}
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#38bdf8' }}>
                    <strong>
                      Chunk #{ci + 1} of {chk.totalChunks}
                    </strong>
                    <span>~{chk.tokenEstimate} tokens</span>
                  </div>
                  <pre className={styles.citationExcerptText} style={{ maxHeight: '180px' }}>
                    {chk.text}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
