import { useState, useEffect, useRef } from 'react';
import { Plus, Settings, MessageSquare, Trash2, Edit2, Check, X as CloseIcon, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import WorkspaceSelector from './sidebar/WorkspaceSelector';

export default function Sidebar({
  chats, projects, currentProjectId,
  onSelectProject, onCreateProject, onDeleteProject, onRenameProject,
  currentChatId, onSelectChat, onNewChat, onOpenSettings, onDeleteChat, onRenameChat,
  collapsed, onToggleCollapse
}) {
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [hoveredChatId, setHoveredChatId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  const filteredChats = debouncedQuery.trim()
    ? chats.filter(c =>
        c.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        c.messages?.some(m => m.content?.toLowerCase().includes(debouncedQuery.toLowerCase()))
      )
    : chats;

  const getSnippet = (chat) => {
    const q = debouncedQuery.toLowerCase();
    if (!q || chat.title.toLowerCase().includes(q)) return null;
    const msg = chat.messages?.find(m => m.content?.toLowerCase().includes(q));
    if (!msg) return null;
    const idx = msg.content.toLowerCase().indexOf(q);
    const start = Math.max(0, idx - 18);
    const end = Math.min(msg.content.length, idx + q.length + 38);
    return (start > 0 ? '…' : '') + msg.content.slice(start, end) + (end < msg.content.length ? '…' : '');
  };

  const handleEditClick = (e, chat) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const handleEditSave = async (e, id) => {
    e.stopPropagation();
    if (editTitle.trim()) await onRenameChat(id, editTitle.trim());
    setEditingChatId(null);
  };

  const handleEditCancel = (e) => {
    e.stopPropagation();
    setEditingChatId(null);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    onDeleteChat(id);
  };

  if (collapsed) {
    return (
      <aside className="glass-panel" style={{ width: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', gap: '12px' }}>
        <button
          onClick={onToggleCollapse}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', display: 'flex', borderRadius: '8px' }}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          title="Expand sidebar"
        >
          <ChevronRight size={20} />
        </button>
        <button
          onClick={onNewChat}
          style={{ width: '40px', height: '40px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}
          title="New Conversation"
        >
          <Plus size={20} />
        </button>
        <button
          onClick={onOpenSettings}
          style={{ width: '40px', height: '40px', background: 'var(--card-glass)', color: 'var(--text-secondary)', border: '1px solid var(--sidebar-border)', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Settings"
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <Settings size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="glass-panel" style={{ width: '280px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>
            Nexus<span style={{ fontWeight: 300, color: 'var(--text-secondary)' }}>.AI</span>
          </h2>
          <button
            onClick={onToggleCollapse}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', borderRadius: '6px' }}
            onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            title="Collapse sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <button
          onClick={onNewChat}
          style={{ width: '100%', padding: '12px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 500, boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Plus size={16} /> New Chat
        </button>

        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            style={{ width: '100%', padding: '8px 32px 8px 32px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
            onBlur={e => e.target.style.borderColor = 'var(--card-border)'}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setDebouncedQuery(''); }}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <CloseIcon size={13} />
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        <WorkspaceSelector
          projects={projects}
          currentProjectId={currentProjectId}
          onSelectProject={onSelectProject}
          onCreateProject={onCreateProject}
          onDeleteProject={onDeleteProject}
          onRenameProject={onRenameProject}
        />

        <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', paddingLeft: '8px', letterSpacing: '0.1em', fontWeight: 600 }}>History</h3>

        {debouncedQuery && filteredChats.length === 0 && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>No results</p>
        )}

        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {filteredChats.map(chat => (
            <li
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              onMouseEnter={() => setHoveredChatId(chat.id)}
              onMouseLeave={() => setHoveredChatId(null)}
              style={{
                padding: '12px',
                borderRadius: '10px',
                cursor: 'pointer',
                color: chat.id === currentChatId ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: chat.id === currentChatId ? 'var(--card-glass)' : 'transparent',
                border: chat.id === currentChatId ? '1px solid var(--card-border)' : '1px solid transparent',
                fontWeight: chat.id === currentChatId ? 500 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.2s',
                minHeight: '44px'
              }}
              onMouseOver={e => { if (chat.id !== currentChatId && editingChatId !== chat.id) e.currentTarget.style.background = 'var(--card-glass)'; }}
              onMouseOut={e => { if (chat.id !== currentChatId && editingChatId !== chat.id) e.currentTarget.style.background = 'transparent'; }}
            >
              {editingChatId === chat.id ? (
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '4px', flex: 1 }} onClick={e => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleEditSave(e, chat.id); else if (e.key === 'Escape') handleEditCancel(e); }}
                    style={{ flex: 1, minWidth: '0', background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--accent-color)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.85rem', outline: 'none' }}
                  />
                  <button onClick={(e) => handleEditSave(e, chat.id)} style={{ background: 'transparent', border: 'none', color: '#34d399', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '4px' }}><Check size={14} /></button>
                  <button onClick={handleEditCancel} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '4px' }}><CloseIcon size={14} /></button>
                </div>
              ) : (
                <>
                  <MessageSquare size={16} opacity={chat.id === currentChatId ? 1 : 0.5} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.title}</div>
                    {getSnippet(chat) && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                        {getSnippet(chat)}
                      </div>
                    )}
                  </div>
                  {hoveredChatId === chat.id && (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                      <button
                        onClick={(e) => handleEditClick(e, chat)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', borderRadius: '4px' }}
                        onMouseOver={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--card-glass)'; }}
                        onMouseOut={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                        title="Rename"
                      ><Edit2 size={14} /></button>
                      <button
                        onClick={(e) => handleDelete(e, chat.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', borderRadius: '4px' }}
                        onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                        onMouseOut={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                        title="Delete"
                      ><Trash2 size={14} /></button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ padding: '24px', borderTop: '1px solid var(--sidebar-border)' }}>
        <button
          onClick={onOpenSettings}
          style={{ width: '100%', padding: '12px', background: 'var(--card-glass)', color: 'var(--text-primary)', border: '1px solid var(--sidebar-border)', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500, justifyContent: 'center' }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseOut={e => e.currentTarget.style.background = 'var(--card-glass)'}
        >
          <Settings size={18} /> System Settings
        </button>
      </div>
    </aside>
  );
}
