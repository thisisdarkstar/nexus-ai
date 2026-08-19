import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Settings,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X as CloseIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  Pin,
  PinOff,
} from 'lucide-react';
import WorkspaceSelector from './sidebar/WorkspaceSelector';
import { TagPicker, TagPills } from './sidebar/TagPicker';
import { sanitizePlainText } from '../lib/sanitize';
import type { Chat, Project } from '../types';
import styles from './Sidebar.module.css';

interface SidebarProps {
  chats: Chat[];
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string) => Promise<void>;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, newName: string) => Promise<void>;
  currentChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => Promise<void>;
  onPinChat: (id: string) => void;
  onUpdateChatTags: (id: string, tags: string[]) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({
  chats,
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
  currentChatId,
  onSelectChat,
  onNewChat,
  onOpenSettings,
  onDeleteChat,
  onRenameChat,
  onPinChat,
  onUpdateChatTags,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const filteredChats = (debouncedQuery.trim()
    ? chats.filter(
        (c) =>
          c.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          c.messages?.some((m) => m.content?.toLowerCase().includes(debouncedQuery.toLowerCase()))
      )
    : chats
  ).filter((c) => !filterTag || c.tags?.includes(filterTag))
  .sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  const getSnippet = (chat: Chat) => {
    const q = debouncedQuery.toLowerCase();
    if (!q || chat.title.toLowerCase().includes(q)) return null;
    const msg = chat.messages?.find((m) => m.content?.toLowerCase().includes(q));
    if (!msg) return null;
    const idx = msg.content.toLowerCase().indexOf(q);
    const start = Math.max(0, idx - 18);
    const end = Math.min(msg.content.length, idx + q.length + 38);
    return (
      (start > 0 ? '…' : '') + msg.content.slice(start, end) + (end < msg.content.length ? '…' : '')
    );
  };

  const handleEditClick = (e: React.MouseEvent, chat: Chat) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const handleEditSave = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const cleaned = sanitizePlainText(editTitle);
    if (cleaned) await onRenameChat(id, cleaned);
    setEditingChatId(null);
  };

  const handleEditCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(null);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteChat(id);
  };

  if (collapsed) {
    return (
      <aside className={`${styles.sidebar} glass-panel ${styles.collapsed}`}>
        <button
          onClick={onToggleCollapse}
          className={`${styles.iconBtn} ${styles.iconBtnMd}`}
          title="Expand sidebar"
        >
          <ChevronRight size={20} />
        </button>
        <button onClick={onNewChat} className={styles.newChatBtn} title="New Conversation">
          <Plus size={20} />
        </button>
        <button onClick={onOpenSettings} className={styles.settingsBtn} title="Settings">
          <Settings size={18} />
        </button>
      </aside>
    );
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onToggleCollapse} />
      <aside className={`${styles.sidebar} glass-panel ${styles.expanded}`}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <h2 className={styles.logo}>
            Nexus<span className={styles.logoDot}>.AI</span>
          </h2>
          <button
            onClick={onToggleCollapse}
            className={`${styles.iconBtn} ${styles.iconBtnSm}`}
            title="Collapse sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <button onClick={onNewChat} className={styles.newChatFull}>
          <Plus size={16} /> New Chat
        </button>

        <div className={styles.searchWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className={styles.searchInput}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDebouncedQuery('');
              }}
              className={styles.searchClear}
            >
              <CloseIcon size={13} />
            </button>
          )}
        </div>
        </div>

        {(() => {
          const allTags = [...new Set(chats.flatMap((c) => c.tags || []))];
          if (allTags.length === 0) return null;
          return (
            <div className={styles.tagFilterBar}>
              {filterTag && (
                <button className={styles.tagFilterClear} onClick={() => setFilterTag(null)}>
                  ×
                </button>
              )}
              {allTags.map((t) => (
                <button
                  key={t}
                  className={`${styles.tagFilterPill} ${filterTag === t ? styles.tagFilterPillActive : ''}`}
                  onClick={() => setFilterTag(filterTag === t ? null : t)}
                >
                  {t}
                </button>
              ))}
            </div>
          );
        })()}

      <div className={styles.chatListContainer}>
        <WorkspaceSelector
          projects={projects}
          currentProjectId={currentProjectId}
          onSelectProject={onSelectProject}
          onCreateProject={onCreateProject}
          onDeleteProject={onDeleteProject}
          onRenameProject={onRenameProject}
        />

        <h3 className={styles.historyTitle}>History</h3>

        {debouncedQuery && filteredChats.length === 0 && (
          <p className={styles.noResults}>No results</p>
        )}

        <ul className={styles.chatList}>
          {filteredChats.map((chat) => {
            const snippet = getSnippet(chat);
            return (
            <li
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              onMouseEnter={() => setHoveredChatId(chat.id)}
              onMouseLeave={() => setHoveredChatId(null)}
              className={`${styles.chatItem} ${chat.id === currentChatId ? styles.chatItemActive : ''}`}
            >
              {editingChatId === chat.id ? (
                <div className={styles.editRow} onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        handleEditSave(e as unknown as React.MouseEvent, chat.id);
                      else if (e.key === 'Escape')
                        handleEditCancel(e as unknown as React.MouseEvent);
                    }}
                    className={styles.editInput}
                  />
                  <button
                    onClick={(e) => handleEditSave(e, chat.id)}
                    className={styles.editSaveBtn}
                  >
                    <Check size={14} />
                  </button>
                  <button onClick={handleEditCancel} className={styles.editCancelBtn}>
                    <CloseIcon size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <MessageSquare
                    size={16}
                    opacity={chat.id === currentChatId ? 1 : 0.5}
                    style={{ flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.chatItemTitle}>{chat.title}</div>
                    <TagPills tags={chat.tags || []} />
                    {snippet && <div className={styles.chatSnippet}>{snippet}</div>}
                  </div>
                  {hoveredChatId === chat.id && (
                    <div className={styles.chatActions}>
                      <TagPicker
                        tags={chat.tags || []}
                        onChange={(tags) => onUpdateChatTags(chat.id, tags)}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPinChat(chat.id);
                        }}
                        className={styles.chatActionBtn}
                        title={chat.pinned ? 'Unpin' : 'Pin'}
                      >
                        {chat.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                      <button
                        onClick={(e) => handleEditClick(e, chat)}
                        className={styles.chatActionBtn}
                        title="Rename"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, chat.id)}
                        className={styles.chatDeleteBtn}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  {!hoveredChatId && chat.pinned && (
                    <Pin size={12} className={styles.pinnedIndicator} />
                  )}
                </>
              )}
            </li>
          );
          })}
        </ul>
      </div>

      <div className={styles.footer}>
        <button onClick={onOpenSettings} className={styles.settingsFullBtn}>
          <Settings size={18} /> System Settings
        </button>
      </div>
      </aside>
    </>
  );
}
