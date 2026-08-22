import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Paperclip, X as LucideX } from 'lucide-react';
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

  const handleAttach = () => {
    let text = '';
    for (const f of files) {
      const ext = f.name.split('.').pop();
      text += `\n\n\`\`\`${ext}\n// ${f.name}\n${f.content}\n\`\`\``;
    }
    onAttach(text);
    onClose();
  };

  return createPortal(
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
    </div>,
    document.body
  );
}
