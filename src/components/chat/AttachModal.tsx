import { useState, useRef, useEffect } from 'react';
import { Paperclip, X as LucideX, Database, FileText } from 'lucide-react';
import { vaultStore } from '../../lib/rag/vaultStore';
import styles from './AttachModal.module.css';

interface AttachModalProps {
  onAttach: (text: string) => void;
  onClose: () => void;
}

interface AttachedFile {
  name: string;
  content: string;
  size: number;
}

export default function AttachModal({ onAttach, onClose }: AttachModalProps) {
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [indexInVault, setIndexInVault] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const processFiles = (fileList: FileList) => {
    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFiles((prev) => [
          ...prev,
          { name: file.name, content: e.target?.result as string, size: file.size },
        ]);
      };
      reader.readAsText(file);
    });
  };

  const handleAttach = async () => {
    if (indexInVault) {
      for (const f of files) {
        await vaultStore.addDocument(f.name, f.content);
      }
      const names = files.map((f) => f.name).join(', ');
      onAttach(`Please review the security document(s) [${names}] now indexed in my Knowledge Vault.`);
    } else {
      let text = '';
      for (const f of files) {
        const ext = f.name.split('.').pop();
        text += `\n\n\`\`\`${ext}\n// ${f.name}\n${f.content}\n\`\`\``;
      }
      onAttach(text);
    }
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Attach Files"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 className={styles.headerTitle}>Attach Files</h3>
          <button onClick={onClose} className={styles.closeBtn}>
            <LucideX size={20} />
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            processFiles(e.dataTransfer.files);
          }}
          onClick={() => fileRef.current?.click()}
          className={`${styles.dropZone} ${isDragging ? styles.dropActive : ''}`}
        >
          <Paperclip size={32} className={styles.dropIcon} />
          <p className={styles.dropText}>Drop files here or click to browse</p>
          <p className={styles.dropHint}>
            Text files: .txt, .md, .js, .ts, .py, .html, .css, .json…
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          onChange={(e) => e.target.files && processFiles(e.target.files)}
          accept=".txt,.md,.js,.ts,.tsx,.jsx,.py,.html,.css,.json,.csv,.log,.yaml,.yml,.sh,.sql"
          style={{ display: 'none' }}
        />

        {files.length > 0 && (
          <div className={styles.fileList}>
            {files.map((f, i) => (
              <div key={i} className={styles.fileItem}>
                <span className={styles.fileName}>{f.name}</span>
                <span className={styles.fileSize}>{(f.size / 1024).toFixed(1)} KB</span>
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className={styles.fileRemove}
                >
                  <LucideX size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <input
            type="checkbox"
            id="indexVaultCheckbox"
            checked={indexInVault}
            onChange={(e) => setIndexInVault(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: '#38bdf8' }}
          />
          <label htmlFor="indexVaultCheckbox" style={{ fontSize: '0.74rem', color: '#e2e8f0', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, color: '#38bdf8' }}>Index into Knowledge Vault (Semantic RAG)</span>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Prevents context overflow by retrieving only relevant chunks with citations.</span>
          </label>
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.cancelBtn}>
            Cancel
          </button>
          <button
            onClick={handleAttach}
            disabled={files.length === 0}
            className={`${styles.attachBtn} ${files.length === 0 ? styles.attachBtnDisabled : ''}`}
          >
            Attach{files.length > 0 ? ` ${files.length} File${files.length > 1 ? 's' : ''}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
