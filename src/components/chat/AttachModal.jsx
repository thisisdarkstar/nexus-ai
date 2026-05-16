import { useState, useRef } from 'react';
import { Paperclip, X as LucideX } from 'lucide-react';

export default function AttachModal({ onAttach, onClose }) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef(null);

  const processFiles = (fileList) => {
    Array.from(fileList).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFiles(prev => [...prev, { name: file.name, content: e.target.result, size: file.size }]);
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

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 150 }}>
      <div style={{ background: 'var(--sidebar-glass)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', width: '500px', borderRadius: '24px', border: '1px solid var(--sidebar-border)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Attach Files</h3>
          <button onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          ><LucideX size={20} /></button>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); }}
          onDrop={e => { e.preventDefault(); setIsDragging(false); processFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${isDragging ? 'rgba(139,92,246,0.7)' : 'var(--card-border)'}`, borderRadius: '16px', padding: '32px', textAlign: 'center', cursor: 'pointer', background: isDragging ? 'rgba(139,92,246,0.07)' : 'var(--card-glass)', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
        >
          <Paperclip size={32} style={{ opacity: 0.4, color: 'var(--text-secondary)' }} />
          <p style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Drop files here or click to browse</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Text files: .txt, .md, .js, .ts, .py, .html, .css, .json…</p>
        </div>
        <input
          ref={fileRef} type="file" multiple
          onChange={e => processFiles(e.target.files)}
          accept=".txt,.md,.js,.ts,.tsx,.jsx,.py,.html,.css,.json,.csv,.log,.yaml,.yml,.sh,.sql"
          style={{ display: 'none' }}
        />

        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {files.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--card-glass)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <span style={{ flex: 1, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{f.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{(f.size / 1024).toFixed(1)} KB</span>
                <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                  onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                ><LucideX size={14} /></button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '10px 20px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--card-border)', borderRadius: '12px', cursor: 'pointer', fontWeight: 500 }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >Cancel</button>
          <button onClick={handleAttach} disabled={files.length === 0}
            style={{ padding: '10px 20px', background: files.length === 0 ? 'var(--card-glass)' : 'var(--accent-gradient)', color: files.length === 0 ? 'var(--text-muted)' : '#fff', border: files.length === 0 ? '1px solid var(--card-border)' : 'none', borderRadius: '12px', cursor: files.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 500 }}
          >
            Attach{files.length > 0 ? ` ${files.length} File${files.length > 1 ? 's' : ''}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
