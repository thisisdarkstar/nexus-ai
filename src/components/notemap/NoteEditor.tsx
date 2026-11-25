import { useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Code,
  CheckSquare,
  Heading1,
  Heading2,
  List,
  Quote,
  GitBranch,
} from 'lucide-react';
import { renderMarkdown } from '../../lib/markdown';
import styles from './NoteEditor.module.css';

interface NoteEditorProps {
  title: string;
  content: string;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onSyncToMindmap: () => void;
}

export default function NoteEditor({
  title,
  content,
  onChangeTitle,
  onChangeContent,
  onSyncToMindmap,
}: NoteEditorProps) {
  const [viewMode, setViewMode] = useState<'write' | 'split' | 'preview'>('split');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertSnippet = (before: string, after = '', placeholder = 'text') => {
    const el = textareaRef.current;
    if (!el) {
      onChangeContent(`${content}${before}${placeholder}${after}`);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const selected = content.slice(start, end) || placeholder;
    const next = content.slice(0, start) + before + selected + after + content.slice(end);
    onChangeContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + before.length;
      el.setSelectionRange(cursorStart, cursorStart + selected.length);
    });
  };

  const insertLinePrefix = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChangeContent(`${content}\n${prefix}`);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const lineStart = content.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const next = content.slice(0, lineStart) + prefix + content.slice(lineStart);
    onChangeContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const taskTotal = (content.match(/^[-*]\s+\[[ xX]\]/gm) || []).length;
  const taskDone = (content.match(/^[-*]\s+\[[xX]\]/gm) || []).length;

  return (
    <div className={styles.editorRoot}>
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => insertLinePrefix('# ')}
            title="Heading 1"
          >
            <Heading1 size={13} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => insertLinePrefix('## ')}
            title="Heading 2"
          >
            <Heading2 size={13} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => insertSnippet('**', '**', 'bold')}
            title="Bold"
          >
            <Bold size={13} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => insertSnippet('*', '*', 'italic')}
            title="Italic"
          >
            <Italic size={13} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => insertSnippet('`', '`', 'payload')}
            title="Inline Code"
          >
            <Code size={13} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => insertLinePrefix('- ')}
            title="Bullet List"
          >
            <List size={13} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => insertLinePrefix('- [ ] ')}
            title="Task Checklist"
          >
            <CheckSquare size={13} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => insertLinePrefix('> ')}
            title="Blockquote"
          >
            <Quote size={13} />
          </button>
          <button
            type="button"
            className={`${styles.toolBtn} ${styles.toolBtnAccent}`}
            onClick={onSyncToMindmap}
            title="Convert Markdown headings and bullets into the active Mindmap tree"
          >
            <GitBranch size={13} /> Sync Headings → Map
          </button>
        </div>

        <div className={styles.viewSwitch} role="group" aria-label="Note view mode">
          {(['write', 'split', 'preview'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`${styles.viewBtn} ${viewMode === mode ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode(mode)}
            >
              {mode === 'write' ? 'Write' : mode === 'split' ? 'Split' : 'Preview'}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.bodyGrid}>
        {viewMode !== 'preview' && (
          <div className={styles.paneWrite}>
            <input
              type="text"
              className={styles.titleInput}
              value={title}
              placeholder="Note title..."
              aria-label="Note title"
              onChange={(e) => onChangeTitle(e.target.value)}
            />
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={content}
              placeholder="Capture engagement notes, attack hypotheses, commands, or Markdown checklists (- [ ] test)..."
              aria-label="Security note markdown content"
              spellCheck={false}
              onChange={(e) => onChangeContent(e.target.value)}
            />
          </div>
        )}

        {viewMode !== 'write' && (
          <div
            className={styles.panePreview}
            aria-label="Rendered note preview"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(`# ${title || 'Untitled Note'}\n\n${content}`),
            }}
          />
        )}
      </div>

      <div className={styles.footer}>
        <span>
          {wordCount} words · {content.length} chars
          {taskTotal > 0 ? ` · ${taskDone}/${taskTotal} tasks done` : ''}
        </span>
        <span>Markdown + GFM Checklists supported</span>
      </div>
    </div>
  );
}
