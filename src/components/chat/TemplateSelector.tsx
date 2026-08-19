import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Bookmark,
  Plus,
  Trash2,
  Edit2,
  Check,
  X as LucideX,
  Download,
  Upload,
} from 'lucide-react';
import {
  PRESET_TEMPLATES,
  getCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  exportTemplates,
  importTemplates,
} from '../../lib/templates';
import { sanitizePlainText } from '../../lib/sanitize';
import type { PromptTemplate } from '../../types';
import styles from './TemplateSelector.module.css';

interface TemplateSelectorProps {
  currentPrompt: string;
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

type View = 'list' | 'edit' | 'create';

export default function TemplateSelector({
  currentPrompt,
  onSelect,
  disabled,
}: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<PromptTemplate[]>(() =>
    getCustomTemplates()
  );
  const [view, setView] = useState<View>('list');
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setView('list');
    setEditingTemplate(null);
    setStatusMsg('');
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, close]);

  useEffect(() => {
    if (!appliedName) return;
    const t = setTimeout(() => setAppliedName(''), 2500);
    return () => clearTimeout(t);
  }, [appliedName]);

  const refresh = () => setCustomTemplates(getCustomTemplates());

  const handleToggle = () => {
    if (open) {
      close();
    } else if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom + 8, left: rect.left });
      setOpen(true);
    }
  };

  const handleSelect = (template: PromptTemplate) => {
    onSelect(template.prompt);
    setAppliedName(template.name);
    setTimeout(() => close(), 600);
  };

  const openEdit = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditPrompt(template.prompt);
    setView('edit');
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setEditName('');
    setEditPrompt(currentPrompt || '');
    setView('create');
  };

  const handleSaveEdit = () => {
    const name = sanitizePlainText(editName);
    const prompt = editPrompt.trim();
    if (!name || !prompt) return;
    if (editingTemplate) {
      saveCustomTemplate({ ...editingTemplate, name, prompt });
    } else {
      saveCustomTemplate({
        id: `custom_${Date.now()}`,
        name,
        prompt,
      });
    }
    refresh();
    close();
  };

  const handleDelete = (id: string) => {
    deleteCustomTemplate(id);
    refresh();
  };

  const handleExport = () => {
    const json = exportTemplates();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexus_templates.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const count = importTemplates(event.target?.result as string);
        refresh();
        setStatusMsg(`Imported ${count} template${count !== 1 ? 's' : ''}`);
        setTimeout(() => setStatusMsg(''), 3000);
      } catch (err) {
        setStatusMsg(err instanceof Error ? err.message : 'Import failed');
        setTimeout(() => setStatusMsg(''), 3000);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearPrompt = () => {
    onSelect('');
    close();
  };

  const popoverContent = open ? (
    <>
      <div className={styles.backdrop} onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 99998 }} />
      <div
        ref={popoverRef}
        className={styles.popover}
        style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left, zIndex: 99999 }}
      >
        <div className={styles.popoverHeader}>
          {view !== 'list' ? (
            <button onClick={() => { setView('list'); setEditingTemplate(null); }} className={styles.backBtn}>
              ← Back
            </button>
          ) : (
            <span className={styles.popoverTitle}>Prompt Templates</span>
          )}
          <button onClick={close} className={styles.closeBtn}>
            <LucideX size={14} />
          </button>
        </div>

        {statusMsg && <div className={styles.statusMsg}>{statusMsg}</div>}

        {view === 'list' && (
          <>
            <div className={styles.section}>
              {currentPrompt.trim() && (
                <button onClick={clearPrompt} className={styles.clearBtn}>
                  Clear system prompt
                </button>
              )}

              <div className={styles.sectionLabel}>Presets</div>
              {PRESET_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => handleSelect(t)} className={`${styles.templateItem} ${currentPrompt === t.prompt ? styles.templateItemActive : ''}`}>
                  <span className={styles.templateIcon}>{t.icon}</span>
                  <div className={styles.templateInfo}>
                    <div className={styles.templateName}>{t.name}</div>
                    <div className={styles.templatePreview}>{t.prompt.slice(0, 60)}…</div>
                  </div>
                  {currentPrompt === t.prompt && <Check size={14} className={styles.activeCheck} />}
                </button>
              ))}
            </div>

            <div className={styles.divider} />
            <div className={styles.section}>
              <div className={styles.sectionLabelRow}>
                <span className={styles.sectionLabel}>Custom</span>
                <button onClick={openCreate} className={styles.addBtn} title="Create new template">
                  <Plus size={13} /> New
                </button>
              </div>

              {customTemplates.length === 0 ? (
                <div className={styles.emptyMsg}>No custom templates yet</div>
              ) : (
                customTemplates.map((t) => (
                  <div key={t.id} className={styles.templateItemRow}>
                    <button
                      onClick={() => handleSelect(t)}
                      className={`${styles.templateItem} ${styles.templateItemFlex} ${currentPrompt === t.prompt ? styles.templateItemActive : ''}`}
                    >
                      <div className={styles.templateInfo}>
                        <div className={styles.templateName}>{t.name}</div>
                        <div className={styles.templatePreview}>{t.prompt.slice(0, 60)}…</div>
                      </div>
                      {currentPrompt === t.prompt && (
                        <Check size={14} className={styles.activeCheck} />
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                      className={styles.editBtn}
                      title="Edit template"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                      className={styles.deleteBtn}
                      title="Delete template"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}

              <div className={styles.importExportRow}>
                <button onClick={handleExport} className={styles.ieBtn} title="Export custom templates">
                  <Download size={13} /> Export
                </button>
                <button onClick={() => fileInputRef.current?.click()} className={styles.ieBtn} title="Import templates from JSON">
                  <Upload size={13} /> Import
                </button>
              </div>
            </div>
          </>
        )}

        {(view === 'edit' || view === 'create') && (
          <div className={styles.section}>
            <div className={styles.editorField}>
              <label className={styles.editorLabel}>Name</label>
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Template name…"
                className={styles.editorInput}
              />
            </div>
            <div className={styles.editorField}>
              <label className={styles.editorLabel}>System Prompt</label>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="You are a helpful assistant that…"
                className={styles.editorTextarea}
                rows={6}
              />
            </div>
            <div className={styles.editorActions}>
              <button onClick={handleSaveEdit} className={styles.useBtn} disabled={!editName.trim() || !editPrompt.trim()}>
                {editingTemplate ? 'Save changes' : 'Create template'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  ) : null;

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`${styles.triggerBtn} ${open || currentPrompt.trim() ? styles.triggerBtnActive : ''}`}
        title={currentPrompt.trim() ? 'Template active' : 'Prompt templates'}
      >
        <Bookmark size={14} />
        <span>{currentPrompt.trim() ? 'Template Set' : 'Templates'}</span>
      </button>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        accept=".json"
        style={{ display: 'none' }}
      />

      {createPortal(popoverContent, document.body)}

      {appliedName && createPortal(
        <div
          className={styles.appliedToast}
          style={{ position: 'fixed', top: popoverPos.top - 44, left: popoverPos.left, zIndex: 99999 }}
        >
          <Check size={13} />
          <span>{appliedName} applied</span>
        </div>,
        document.body
      )}
    </div>
  );
}
