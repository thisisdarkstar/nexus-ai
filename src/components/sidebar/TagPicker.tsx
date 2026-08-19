import { useState, useRef, useEffect } from 'react';
import { Tag, X, Plus } from 'lucide-react';
import { TAG_PRESETS, getTagColor } from '../../lib/tags';
import styles from './TagPicker.module.css';

interface TagPickerProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagPicker({ tags, onChange }: TagPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const toggleTag = (name: string) => {
    if (tags.includes(name)) {
      onChange(tags.filter((t) => t !== name));
    } else {
      onChange([...tags, name]);
    }
  };

  const addCustomTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setNewTag('');
    }
  };

  const allTags = [...new Set([...TAG_PRESETS.map((t) => t.name), ...tags])];

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={`${styles.trigger} ${tags.length > 0 ? styles.triggerActive : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Manage tags"
      >
        <Tag size={12} />
      </button>
      {isOpen && (
        <div className={styles.popover}>
          <div className={styles.popoverHeader}>Tags</div>
          <div className={styles.tagList}>
            {allTags.map((name) => {
              const color = getTagColor(name);
              const active = tags.includes(name);
              return (
                <button
                  key={name}
                  className={`${styles.tagItem} ${active ? styles.tagItemActive : ''}`}
                  onClick={() => toggleTag(name)}
                >
                  <span className={styles.tagDot} style={{ background: color }} />
                  <span className={styles.tagName}>{name}</span>
                  {active && <span className={styles.tagCheck}>✓</span>}
                </button>
              );
            })}
          </div>
          <div className={styles.addRow}>
            <input
              className={styles.addInput}
              placeholder="Custom tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCustomTag();
              }}
            />
            <button className={styles.addBtn} onClick={addCustomTag} disabled={!newTag.trim()}>
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TagPills({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className={styles.pills}>
      {tags.map((t) => (
        <span
          key={t}
          className={styles.pill}
          style={{
            background: getTagColor(t),
            color: '#fff',
          }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}
