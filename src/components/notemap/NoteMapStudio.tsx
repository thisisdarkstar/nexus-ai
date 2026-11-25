import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Brain,
  FileText,
  Columns2,
  Plus,
  Trash2,
  Download,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  PanelLeft,
  Sparkles,
  X,
} from 'lucide-react';
import MindmapCanvas from './MindmapCanvas';
import NoteEditor from './NoteEditor';
import { buildMindmapSvg } from '../../lib/notemap/layout';
import {
  createBlankDocument,
  loadNoteMapWorkspace,
  markdownToMindmap,
  mindmapToMarkdownOutline,
  saveNoteMapWorkspace,
} from '../../lib/notemap/storage';
import type { MindmapState, NoteMapDocument, NoteMapViewMode, NoteMapWorkspaceData } from '../../lib/notemap/types';
import styles from './NoteMapStudio.module.css';

interface NoteMapStudioProps {
  projectId: string;
  onSendToAI?: (prompt: string) => void;
}

const FAB_POS_KEY = 'nexus_notemap_fab_pos';

function getInitialFabPos(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 18, y: 680 };
  try {
    const raw = window.localStorage.getItem(FAB_POS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return {
          x: Math.min(Math.max(12, parsed.x), Math.max(12, window.innerWidth - 190)),
          y: Math.min(Math.max(64, parsed.y), Math.max(64, window.innerHeight - 54)),
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return { x: 18, y: Math.max(80, window.innerHeight - 58) };
}

export default function NoteMapStudio({ projectId, onSendToAI }: NoteMapStudioProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [workspace, setWorkspace] = useState<NoteMapWorkspaceData>(() => loadNoteMapWorkspace());

  // Reload workspace when engagement project changes
  const prevProjectRef = useRef(projectId);
  useEffect(() => {
    if (prevProjectRef.current !== projectId) {
      prevProjectRef.current = projectId;
      setWorkspace(loadNoteMapWorkspace());
    }
  }, [projectId]);

  // Persist workspace automatically
  useEffect(() => {
    saveNoteMapWorkspace(workspace);
  }, [workspace]);

  // Mount overlay lazily on first open and keep mounted across close/reopen
  useEffect(() => {
    if (isOpen) setHasMounted(true);
  }, [isOpen]);

  // Global toggle shortcut: Ctrl+Shift+M / Cmd+Shift+M
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'TEXTAREA' && activeTag !== 'INPUT') {
          setIsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Draggable Floating Action Button state
  const [fabPos, setFabPos] = useState<{ x: number; y: number }>(getInitialFabPos);
  const fabDragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    dragged: boolean;
  } | null>(null);

  useEffect(() => {
    const onResize = () => {
      setFabPos((prev) => ({
        x: Math.min(Math.max(12, prev.x), Math.max(12, window.innerWidth - 190)),
        y: Math.min(Math.max(64, prev.y), Math.max(64, window.innerHeight - 54)),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = fabDragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        drag.dragged = true;
      }
      if (!drag.dragged) return;
      const next = {
        x: Math.min(Math.max(12, drag.origX + dx), Math.max(12, window.innerWidth - 190)),
        y: Math.min(Math.max(64, drag.origY + dy), Math.max(64, window.innerHeight - 54)),
      };
      setFabPos(next);
    };

    const onUp = () => {
      const drag = fabDragRef.current;
      if (!drag) return;
      if (drag.dragged) {
        setFabPos((curr) => {
          try {
            window.localStorage.setItem(FAB_POS_KEY, JSON.stringify(curr));
          } catch {
            // ignore
          }
          return curr;
        });
      }
      setTimeout(() => {
        fabDragRef.current = null;
      }, 0);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const activeDoc =
    workspace.documents.find((d) => d.id === workspace.activeDocId) || workspace.documents[0];

  const updateActiveDoc = useCallback(
    (updater: (doc: NoteMapDocument) => NoteMapDocument) => {
      setWorkspace((prev) => {
        const targetId = prev.activeDocId || prev.documents[0]?.id;
        if (!targetId) return prev;
        return {
          ...prev,
          documents: prev.documents.map((doc) =>
            doc.id === targetId ? { ...updater(doc), updatedAt: Date.now() } : doc
          ),
        };
      });
    },
    []
  );

  const handleCreateDoc = (mode: NoteMapViewMode) => {
    const doc = createBlankDocument(mode);
    setWorkspace((prev) => ({
      ...prev,
      activeDocId: doc.id,
      documents: [doc, ...prev.documents],
    }));
  };

  const handleDeleteDoc = (id: string) => {
    setWorkspace((prev) => {
      const remaining = prev.documents.filter((d) => d.id !== id);
      if (remaining.length === 0) {
        const replacement = createBlankDocument('mindmap', 'Attack Surface & Notes');
        return { ...prev, activeDocId: replacement.id, documents: [replacement] };
      }
      return {
        ...prev,
        activeDocId: prev.activeDocId === id ? remaining[0].id : prev.activeDocId,
        documents: remaining,
      };
    });
  };

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredDocs = workspace.documents.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      d.noteContent.toLowerCase().includes(q) ||
      Object.values(d.mindmap.nodes).some((n) => n.text.toLowerCase().includes(q))
    );
  });

  const slugTitle = (activeDoc?.title || 'security_notemap')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  return (
    <>
      {/* Draggable Floating Launcher Button (accessible from anywhere) */}
      <button
        type="button"
        aria-label={isOpen ? 'Close Notes & Mindmap' : 'Open Notes & Mindmap'}
        title="Notes & Attack Mindmap (Ctrl+Shift+M) · Drag to reposition"
        className={`${styles.floatingTrigger} ${isOpen ? styles.floatingTriggerOpen : ''}`}
        style={{ left: `${fabPos.x}px`, top: `${fabPos.y}px` }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          fabDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: fabPos.x,
            origY: fabPos.y,
            dragged: false,
          };
        }}
        onClick={() => {
          if (fabDragRef.current?.dragged) return;
          setIsOpen((prev) => !prev);
        }}
      >
        <Brain size={15} />
        <span>Notes &amp; Map</span>
        <span className={styles.shortcutPill}>Ctrl+Shift+M</span>
      </button>

      {/* Persistent Floating Studio Window */}
      {hasMounted && activeDoc && (
        <div
          className={styles.backdrop}
          style={{ display: isOpen ? 'flex' : 'none' }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Nexus Notes and Mindmap Studio"
            className={`${styles.windowShell} ${isMaximized ? styles.windowShellMaximized : ''}`}
          >
            {/* Header Bar */}
            <header className={styles.topBar}>
              <div className={styles.topLeft}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => setShowSidebar((s) => !s)}
                  title="Toggle documents sidebar"
                  aria-label="Toggle documents sidebar"
                >
                  <PanelLeft size={14} />
                </button>
                <span className={styles.brandTitle}>
                  <Brain size={16} color="#10b981" /> Notes &amp; Attack Mindmap
                </span>

                <div className={styles.modeTabs} role="tablist" aria-label="NoteMap View Mode">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeDoc.mode === 'mindmap'}
                    className={`${styles.modeTab} ${activeDoc.mode === 'mindmap' ? styles.modeTabActive : ''}`}
                    onClick={() => updateActiveDoc((d) => ({ ...d, mode: 'mindmap' }))}
                  >
                    <Brain size={13} /> Mindmap
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeDoc.mode === 'note'}
                    className={`${styles.modeTab} ${activeDoc.mode === 'note' ? styles.modeTabActive : ''}`}
                    onClick={() => updateActiveDoc((d) => ({ ...d, mode: 'note' }))}
                  >
                    <FileText size={13} /> Notepad
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeDoc.mode === 'split'}
                    className={`${styles.modeTab} ${activeDoc.mode === 'split' ? styles.modeTabActive : ''}`}
                    onClick={() => updateActiveDoc((d) => ({ ...d, mode: 'split' }))}
                  >
                    <Columns2 size={13} /> Split
                  </button>
                </div>
              </div>

              <div className={styles.topRight}>
                <input
                  type="search"
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes & nodes..."
                  aria-label="Search notes and mindmap nodes"
                />

                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() =>
                    triggerDownload(
                      buildMindmapSvg(activeDoc.mindmap, activeDoc.title),
                      `${slugTitle || 'mindmap'}.svg`,
                      'image/svg+xml'
                    )
                  }
                  title="Export Mindmap as SVG"
                >
                  <ImageIcon size={13} /> SVG
                </button>

                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => {
                    const md =
                      activeDoc.mode === 'note'
                        ? `# ${activeDoc.title}\n\n${activeDoc.noteContent}`
                        : mindmapToMarkdownOutline(activeDoc.mindmap, activeDoc.title);
                    triggerDownload(md, `${slugTitle || 'notes'}.md`, 'text/markdown');
                  }}
                  title="Export as Markdown"
                >
                  <Download size={13} /> .md
                </button>

                {onSendToAI && (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => {
                      const outline = mindmapToMarkdownOutline(activeDoc.mindmap, activeDoc.title);
                      onSendToAI(
                        `Review my current engagement notes and attack mindmap below, highlight blind spots, and suggest next offensive/defensive validation steps:\n\n${outline}\n\n### Notes\n${activeDoc.noteContent}`
                      );
                      setIsOpen(false);
                    }}
                    title="Send active note & mindmap to AI Copilot"
                  >
                    <Sparkles size={13} color="#10b981" /> Copilot
                  </button>
                )}

                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => setIsMaximized((m) => !m)}
                  aria-label={isMaximized ? 'Restore studio size' : 'Maximize studio'}
                  title={isMaximized ? 'Restore window size' : 'Maximize window'}
                >
                  {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>

                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => setIsOpen(false)}
                  aria-label="Close studio"
                  title="Close (Esc)"
                >
                  <X size={14} />
                </button>
              </div>
            </header>

            {/* Body: Sidebar + Active Canvas/Notepad */}
            <div className={styles.workspaceBody}>
              {showSidebar && (
                <aside className={styles.sidebar} aria-label="Saved notes and mindmaps">
                  <div className={styles.sidebarActions}>
                    <button
                      type="button"
                      className={styles.newBtn}
                      onClick={() => handleCreateDoc('mindmap')}
                    >
                      <Plus size={12} /> Map
                    </button>
                    <button
                      type="button"
                      className={styles.newBtn}
                      onClick={() => handleCreateDoc('note')}
                    >
                      <Plus size={12} /> Note
                    </button>
                  </div>

                  <div className={styles.docList}>
                    {filteredDocs.map((doc) => {
                      const isActive = doc.id === activeDoc.id;
                      return (
                        <div
                          key={doc.id}
                          role="button"
                          tabIndex={0}
                          className={`${styles.docItem} ${isActive ? styles.docItemActive : ''}`}
                          onClick={() => setWorkspace((prev) => ({ ...prev, activeDocId: doc.id }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setWorkspace((prev) => ({ ...prev, activeDocId: doc.id }));
                            }
                          }}
                        >
                          {doc.mode === 'note' ? <FileText size={13} /> : <Brain size={13} />}
                          <span className={styles.docItemTitle}>{doc.title || 'Untitled'}</span>
                          <button
                            type="button"
                            className={styles.docDeleteBtn}
                            aria-label={`Delete ${doc.title}`}
                            title="Delete document"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDoc(doc.id);
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </aside>
              )}

              <div className={styles.contentArea}>
                <div
                  className={styles.splitHalf}
                  style={{
                    display: activeDoc.mode === 'mindmap' || activeDoc.mode === 'split' ? 'flex' : 'none',
                  }}
                >
                  <MindmapCanvas
                    mindmap={activeDoc.mindmap}
                    searchQuery={searchQuery}
                    onChange={(nextMap: MindmapState) =>
                      updateActiveDoc((d) => ({ ...d, mindmap: nextMap }))
                    }
                    onSendToAI={
                      onSendToAI
                        ? (prompt) => {
                            onSendToAI(prompt);
                            setIsOpen(false);
                          }
                        : undefined
                    }
                  />
                </div>

                {activeDoc.mode === 'split' && <div className={styles.splitDivider} />}

                <div
                  className={styles.splitHalf}
                  style={{
                    display: activeDoc.mode === 'note' || activeDoc.mode === 'split' ? 'flex' : 'none',
                  }}
                >
                  <NoteEditor
                    title={activeDoc.title}
                    content={activeDoc.noteContent}
                    onChangeTitle={(title) => updateActiveDoc((d) => ({ ...d, title }))}
                    onChangeContent={(noteContent) => updateActiveDoc((d) => ({ ...d, noteContent }))}
                    onSyncToMindmap={() =>
                      updateActiveDoc((d) => ({
                        ...d,
                        mindmap: markdownToMindmap(d.noteContent, d.title),
                        mode: d.mode === 'note' ? 'split' : d.mode,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
