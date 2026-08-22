import React from 'react';
import { Sparkles, X } from 'lucide-react';
import styles from './MindmapStudio.module.css';

interface MindmapAiModalProps {
  isOpen: boolean;
  prompt: string;
  onChangePrompt: (value: string) => void;
  onExecute: () => void;
  onClose: () => void;
}

export default function MindmapAiModal({
  isOpen,
  prompt,
  onChangePrompt,
  onExecute,
  onClose,
}: MindmapAiModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.aiModal}>
      <div className={styles.aiModalHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={16} />
          <span>AI Mindmap Expansion</span>
        </div>
        <button
          style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <input
        type="text"
        value={prompt}
        onChange={(e) => onChangePrompt(e.target.value)}
        className={styles.aiInput}
        placeholder="AI prompt for branching ideas..."
        onKeyDown={(e) => {
          if (e.key === 'Enter') onExecute();
          if (e.key === 'Escape') onClose();
        }}
        autoFocus
      />

      <button className={styles.aiSubmitBtn} onClick={onExecute}>
        <Sparkles size={14} /> Generate & Connect Sub-Nodes
      </button>
    </div>
  );
}
