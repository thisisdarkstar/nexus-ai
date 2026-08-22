import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Network,
  X,
  Plus,
  StickyNote,
  CreditCard,
  Image as ImageIcon,
  Square,
  Sparkles,
  Download,
  Upload,
  Trash2,
  Workflow,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Redo2,
} from 'lucide-react';
import type { MindmapBoard, MindmapNodeType, NodeColor } from '../../types/mindmap';
import styles from './MindmapStudio.module.css';

interface MindmapTopBarProps {
  boards: MindmapBoard[];
  activeBoardId: string;
  onSelectBoard: (id: string) => void;
  onAddBoard: () => void;
  onRenameBoard: (id: string, name: string) => void;
  onDeleteBoard: (id: string) => void;
  onAddNode: (type: MindmapNodeType, color?: NodeColor) => void;
  onAutoLayout: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onOpenAiModal: () => void;
  onClearCanvas: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onClose: () => void;
}

export default function MindmapTopBar({
  boards,
  activeBoardId,
  onSelectBoard,
  onAddBoard,
  onRenameBoard,
  onDeleteBoard,
  onAddNode,
  onAutoLayout,
  onExportJson,
  onImportJson,
  onOpenAiModal,
  onClearCanvas,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClose,
}: MindmapTopBarProps) {
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingBoardName, setEditingBoardName] = useState('');
  const boardTabsRef = useRef<HTMLDivElement>(null);
  const [showLeftChevron, setShowLeftChevron] = useState(false);
  const [showRightChevron, setShowRightChevron] = useState(false);

  const checkTabOverflow = useCallback(() => {
    const el = boardTabsRef.current;
    if (el) {
      setShowLeftChevron(el.scrollLeft > 5);
      setShowRightChevron(el.scrollLeft + el.clientWidth < el.scrollWidth - 5);
    }
  }, []);

  useEffect(() => {
    checkTabOverflow();
    window.addEventListener('resize', checkTabOverflow);
    return () => window.removeEventListener('resize', checkTabOverflow);
  }, [boards, checkTabOverflow]);

  const handleTabsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = boardTabsRef.current;
    if (el && (e.deltaY !== 0 || e.deltaX !== 0)) {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      el.scrollBy({ left: delta, behavior: 'smooth' });
      setTimeout(checkTabOverflow, 150);
    }
  };

  const handleScrollTabs = (direction: 'left' | 'right') => {
    const el = boardTabsRef.current;
    if (el) {
      el.scrollBy({ left: direction === 'left' ? -180 : 180, behavior: 'smooth' });
      setTimeout(checkTabOverflow, 200);
    }
  };

  const handleStartRename = (board: MindmapBoard, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBoardId(board.id);
    setEditingBoardName(board.name);
  };

  const handleSaveRename = (boardId: string) => {
    if (editingBoardName.trim()) {
      onRenameBoard(boardId, editingBoardName.trim());
    }
    setEditingBoardId(null);
  };

  return (
    <div className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <div className={styles.brandLogo}>
          <Network size={20} color="#34d399" />
          <span>Mindmap Studio</span>
        </div>

        {/* Board Tabs with scroll chevrons and rename/delete support */}
        <div className={styles.boardTabsWrapper}>
          {showLeftChevron && (
            <button
              className={styles.tabScrollBtn}
              onClick={() => handleScrollTabs('left')}
              title="Scroll tabs left"
            >
              <ChevronLeft size={14} />
            </button>
          )}

          <div
            className={styles.boardTabsContainer}
            ref={boardTabsRef}
            onScroll={checkTabOverflow}
            onWheel={handleTabsWheel}
          >
            {boards.map((b) => {
              const isActive = b.id === activeBoardId;
              const isEditing = editingBoardId === b.id;

              return (
                <div
                  key={b.id}
                  className={`${styles.boardTab} ${isActive ? styles.boardTabActive : ''}`}
                  onClick={() => onSelectBoard(b.id)}
                  title={b.name}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      className={styles.boardTabInput}
                      value={editingBoardName}
                      autoFocus
                      onChange={(e) => setEditingBoardName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(b.id);
                        if (e.key === 'Escape') setEditingBoardId(null);
                      }}
                      onBlur={() => handleSaveRename(b.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className={styles.boardTabName}
                      onDoubleClick={(e) => handleStartRename(b, e)}
                    >
                      {b.name}
                    </span>
                  )}

                  {isActive && !isEditing && (
                    <button
                      className={styles.boardTabActionBtn}
                      onClick={(e) => handleStartRename(b, e)}
                      title="Rename Board"
                    >
                      <Pencil size={11} />
                    </button>
                  )}

                  {boards.length > 1 && !isEditing && (
                    <button
                      className={`${styles.boardTabActionBtn} ${styles.boardTabDeleteBtn}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBoard(b.id);
                      }}
                      title="Delete Board"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {showRightChevron && (
            <button
              className={styles.tabScrollBtn}
              onClick={() => handleScrollTabs('right')}
              title="Scroll tabs right"
            >
              <ChevronRight size={14} />
            </button>
          )}

          <button className={styles.newBoardBtn} onClick={onAddBoard} title="New Board">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Palette Tools & Canvas Actions */}
      <div className={styles.paletteContainer}>
        <button
          className={styles.toolBtn}
          onClick={() => onAddNode('note', 'blue')}
          title="Add Sticky Note"
        >
          <StickyNote size={15} color="#38bdf8" /> Note
        </button>
        <button
          className={styles.toolBtn}
          onClick={() => onAddNode('card', 'emerald')}
          title="Add Feature Card"
        >
          <CreditCard size={15} color="#34d399" /> Card
        </button>
        <button
          className={styles.toolBtn}
          onClick={() => onAddNode('image', 'purple')}
          title="Add Image Node"
        >
          <ImageIcon size={15} color="#a855f7" /> Image
        </button>
        <button
          className={styles.toolBtn}
          onClick={() => onAddNode('frame', 'slate')}
          title="Add Group Section Frame"
        >
          <Square size={15} color="#f59e0b" /> Frame
        </button>
        <button
          className={styles.toolBtn}
          onClick={onAutoLayout}
          title="Auto-organize Mindmap Hierarchy"
        >
          <Workflow size={15} color="#34d399" /> Auto Layout
        </button>
      </div>

      {/* Right Action Tools */}
      <div className={styles.topBarRight}>
        <button
          className={`${styles.iconBtn} ${!canUndo ? styles.iconBtnDisabled : ''}`}
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          className={`${styles.iconBtn} ${!canRedo ? styles.iconBtnDisabled : ''}`}
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={16} />
        </button>
        <button
          className={styles.iconBtn}
          onClick={onOpenAiModal}
          title="AI Brainstorm & Expand"
        >
          <Sparkles size={16} color="#a855f7" />
        </button>
        <button
          className={styles.iconBtn}
          onClick={onClearCanvas}
          title="Clear Current Board Canvas"
        >
          <Trash2 size={16} />
        </button>
        <button
          className={styles.iconBtn}
          onClick={onExportJson}
          title="Export Mindmap as JSON"
        >
          <Download size={16} />
        </button>
        <button
          className={styles.iconBtn}
          onClick={onImportJson}
          title="Import Mindmap JSON"
        >
          <Upload size={16} />
        </button>
        <button
          className={`${styles.iconBtn} ${styles.iconBtnClose}`}
          onClick={onClose}
          title="Close Mindmap (Esc)"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
