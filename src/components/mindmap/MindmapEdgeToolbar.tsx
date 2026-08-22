import React from 'react';
import { Trash2, X } from 'lucide-react';
import type { MindmapEdge } from '../../types/mindmap';
import styles from './MindmapStudio.module.css';

interface MindmapEdgeToolbarProps {
  selectedEdge: MindmapEdge;
  onUpdateEdge: (edgeId: string, updates: Partial<MindmapEdge>) => void;
  onDeleteEdge: (edgeId: string) => void;
  onDeselect: () => void;
}

export default function MindmapEdgeToolbar({
  selectedEdge,
  onUpdateEdge,
  onDeleteEdge,
  onDeselect,
}: MindmapEdgeToolbarProps) {
  return (
    <div className={styles.edgeToolbar} onClick={(e) => e.stopPropagation()}>
      <span className={styles.edgeToolbarTitle}>Connection:</span>

      <input
        type="text"
        className={styles.edgeLabelInput}
        placeholder="Add label (e.g. leads to, invokes)..."
        value={selectedEdge.label || ''}
        onChange={(e) => onUpdateEdge(selectedEdge.id, { label: e.target.value })}
      />

      <div className={styles.edgeStyleGroup}>
        <button
          className={`${styles.edgeStyleBtn} ${
            (!selectedEdge.style || selectedEdge.style === 'solid') ? styles.edgeStyleBtnActive : ''
          }`}
          onClick={() => onUpdateEdge(selectedEdge.id, { style: 'solid' })}
          title="Solid Line"
        >
          Solid
        </button>
        <button
          className={`${styles.edgeStyleBtn} ${
            selectedEdge.style === 'dashed' ? styles.edgeStyleBtnActive : ''
          }`}
          onClick={() => onUpdateEdge(selectedEdge.id, { style: 'dashed' })}
          title="Dashed Line"
        >
          Dashed
        </button>
        <button
          className={`${styles.edgeStyleBtn} ${
            selectedEdge.style === 'dotted' ? styles.edgeStyleBtnActive : ''
          }`}
          onClick={() => onUpdateEdge(selectedEdge.id, { style: 'dotted' })}
          title="Dotted Line"
        >
          Dotted
        </button>
      </div>

      <button
        className={styles.edgeDeleteBtn}
        onClick={() => onDeleteEdge(selectedEdge.id)}
        title="Disconnect Arrow"
      >
        <Trash2 size={13} />
        <span>Disconnect</span>
      </button>

      <button
        className={styles.edgeCloseBtn}
        onClick={onDeselect}
        title="Close Inspector"
      >
        <X size={13} />
      </button>
    </div>
  );
}
