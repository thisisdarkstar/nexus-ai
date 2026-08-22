import React, { useState, useRef } from 'react';
import {
  FileText,
  CreditCard,
  Image as ImageIcon,
  Square,
  Trash2,
  Copy,
  Sparkles,
  Palette,
  Plus,
  X,
  Upload,
} from 'lucide-react';
import type { MindmapNode, NodeColor } from '../../types/mindmap';
import styles from './MindmapNodeView.module.css';

interface MindmapNodeViewProps {
  node: MindmapNode;
  isSelected: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onUpdate: (id: string, updates: Partial<MindmapNode>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAIExpand?: (node: MindmapNode) => void;
  onStartConnect: (nodeId: string, handle: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  onStartDrag: (nodeId: string, e: React.MouseEvent) => void;
  onStartResize: (nodeId: string, direction: string, e: React.MouseEvent) => void;
}

const COLOR_PRESETS: { color: NodeColor; hex: string; label: string }[] = [
  { color: 'emerald', hex: '#10b981', label: 'Emerald' },
  { color: 'blue', hex: '#3b82f6', label: 'Blue' },
  { color: 'purple', hex: '#a855f7', label: 'Purple' },
  { color: 'amber', hex: '#f59e0b', label: 'Amber' },
  { color: 'rose', hex: '#f43f5e', label: 'Rose' },
  { color: 'slate', hex: '#64748b', label: 'Slate' },
];

export default function MindmapNodeView({
  node,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onAIExpand,
  onStartConnect,
  onStartDrag,
  onStartResize,
}: MindmapNodeViewProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id, e);
    onStartDrag(node.id, e);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      const currentTags = node.tags || [];
      if (!currentTags.includes(newTag.trim())) {
        onUpdate(node.id, { tags: [...currentTags, newTag.trim()] });
      }
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = node.tags || [];
    onUpdate(node.id, { tags: currentTags.filter((t) => t !== tagToRemove) });
  };

  const handleAddCheckItem = () => {
    const currentList = node.checklist || [];
    const newItem = {
      id: 'check_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      text: '',
      done: false,
    };
    onUpdate(node.id, { checklist: [...currentList, newItem] });
  };

  const handleUpdateCheckItem = (itemId: string, updates: { text?: string; done?: boolean }) => {
    const currentList = node.checklist || [];
    onUpdate(node.id, {
      checklist: currentList.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
    });
  };

  const handleRemoveCheckItem = (itemId: string) => {
    const currentList = node.checklist || [];
    onUpdate(node.id, {
      checklist: currentList.filter((item) => item.id !== itemId),
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        if (typeof loadEvt.target?.result === 'string') {
          onUpdate(node.id, { imageUrl: loadEvt.target.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const getNodeIcon = () => {
    switch (node.type) {
      case 'note':
        return <FileText size={14} className={styles.nodeIcon} />;
      case 'card':
        return <CreditCard size={14} className={styles.nodeIcon} />;
      case 'image':
        return <ImageIcon size={14} className={styles.nodeIcon} />;
      case 'frame':
        return <Square size={14} className={styles.nodeIcon} />;
    }
  };

  const isFrame = node.type === 'frame';

  return (
    <div
      className={`${styles.nodeWrapper} ${isSelected ? styles.nodeSelected : ''}`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: `${node.width}px`,
        height: `${node.height}px`,
        zIndex: node.zIndex || (isSelected ? 50 : 10),
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id, e);
      }}
    >
      <div
        className={`${styles.nodeContainer} ${styles['color_' + node.color]} ${
          isFrame ? styles.frameContainer : ''
        }`}
      >
        {/* Node Header & Drag Bar */}
        <div className={styles.nodeHeader} onMouseDown={handleHeaderMouseDown}>
          <div className={styles.headerLeft}>
            {getNodeIcon()}
            <input
              type="text"
              value={node.title ?? ''}
              onChange={(e) => onUpdate(node.id, { title: e.target.value })}
              placeholder={isFrame ? 'Section Title' : node.type === 'note' ? 'Sticky Note' : 'Card Title'}
              className={styles.titleInput}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>

          <div className={styles.headerActions} onMouseDown={(e) => e.stopPropagation()}>
            {onAIExpand && (
              <button
                className={styles.actionBtn}
                onClick={() => onAIExpand(node)}
                title="AI Expand / Brainstorm child nodes"
              >
                <Sparkles size={13} color="#10b981" />
              </button>
            )}

            <div style={{ position: 'relative' }}>
              <button
                className={styles.actionBtn}
                onClick={() => setShowColorPicker((p) => !p)}
                title="Change Color Theme"
              >
                <Palette size={13} />
              </button>
              {showColorPicker && (
                <div className={styles.colorPickerPopover}>
                  {COLOR_PRESETS.map((p) => (
                    <div
                      key={p.color}
                      className={`${styles.colorSwatch} ${
                        node.color === p.color ? styles.colorSwatchActive : ''
                      }`}
                      style={{ background: p.hex }}
                      onClick={() => {
                        onUpdate(node.id, { color: p.color });
                        setShowColorPicker(false);
                      }}
                      title={p.label}
                    />
                  ))}
                </div>
              )}
            </div>

            <button
              className={styles.actionBtn}
              onClick={() => onDuplicate(node.id)}
              title="Duplicate Node"
            >
              <Copy size={13} />
            </button>

            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => onDelete(node.id)}
              title="Delete Node"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Node Content Body */}
        {!isFrame && (
          <div className={styles.nodeBody}>
            {/* Note & Card Content */}
            {(node.type === 'note' || node.type === 'card') && (
              <textarea
                value={node.content}
                onChange={(e) => onUpdate(node.id, { content: e.target.value })}
                placeholder="Write your note or markdown here..."
                className={styles.contentTextarea}
                onMouseDown={(e) => e.stopPropagation()}
              />
            )}

            {/* Card Specific Tags & Checklist */}
            {node.type === 'card' && (
              <>
                <div className={styles.tagsRow} onMouseDown={(e) => e.stopPropagation()}>
                  {(node.tags || []).map((tag) => (
                    <span key={tag} className={styles.tagBadge}>
                      #{tag}
                      <button
                        className={styles.tagRemoveBtn}
                        onClick={() => handleRemoveTag(tag)}
                        title="Remove tag"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="+ tag"
                    className={styles.addTagInput}
                  />
                </div>

                <div className={styles.checklistSection} onMouseDown={(e) => e.stopPropagation()}>
                  {(node.checklist || []).map((item) => (
                    <div key={item.id} className={styles.checkItem}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={(e) =>
                          handleUpdateCheckItem(item.id, { done: e.target.checked })
                        }
                        className={styles.checkbox}
                      />
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) =>
                          handleUpdateCheckItem(item.id, { text: e.target.value })
                        }
                        placeholder="Task description..."
                        className={`${styles.checkItemText} ${
                          item.done ? styles.checkItemTextDone : ''
                        }`}
                      />
                      <button
                        className={styles.tagRemoveBtn}
                        onClick={() => handleRemoveCheckItem(item.id)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button className={styles.addCheckItemBtn} onClick={handleAddCheckItem}>
                    <Plus size={12} /> Add checklist item
                  </button>
                </div>
              </>
            )}

            {/* Image Node Content */}
            {node.type === 'image' && (
              <div className={styles.imageWrapper}>
                {node.imageUrl ? (
                  <img
                    src={node.imageUrl}
                    alt={node.title || 'Mindmap Visual'}
                    className={styles.imageContent}
                  />
                ) : (
                  <div
                    className={styles.imagePlaceholder}
                    onClick={() => fileInputRef.current?.click()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Upload size={24} />
                    <span>Upload Image or Enter URL</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                    <div className={styles.imageUrlInputRow} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        placeholder="https://..."
                        className={styles.imageUrlInput}
                      />
                      <button
                        className={styles.imageApplyBtn}
                        onClick={() => {
                          if (imageUrlInput.trim()) {
                            onUpdate(node.id, { imageUrl: imageUrlInput.trim() });
                          }
                        }}
                      >
                        Set
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4 Connection Ports (Top, Right, Bottom, Left) */}
      <div
        className={`${styles.port} ${styles.portTop}`}
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnect(node.id, 'top', e);
        }}
        title="Drag connector from Top"
      />
      <div
        className={`${styles.port} ${styles.portRight}`}
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnect(node.id, 'right', e);
        }}
        title="Drag connector from Right"
      />
      <div
        className={`${styles.port} ${styles.portBottom}`}
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnect(node.id, 'bottom', e);
        }}
        title="Drag connector from Bottom"
      />
      <div
        className={`${styles.port} ${styles.portLeft}`}
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnect(node.id, 'left', e);
        }}
        title="Drag connector from Left"
      />

      {/* 8 Resize Handles */}
      {isSelected && (
        <>
          <div
            className={`${styles.resizeHandle} ${styles.resizeNW}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(node.id, 'nw', e);
            }}
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeNE}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(node.id, 'ne', e);
            }}
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeSW}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(node.id, 'sw', e);
            }}
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeSE}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(node.id, 'se', e);
            }}
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeN}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(node.id, 'n', e);
            }}
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeS}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(node.id, 's', e);
            }}
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeE}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(node.id, 'e', e);
            }}
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeW}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartResize(node.id, 'w', e);
            }}
          />
        </>
      )}
    </div>
  );
}
