import { useState } from 'react';
import { Plus, Settings, MessageSquare, Trash2, Edit2, Check, X as CloseIcon, FolderPlus, Folder, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Sidebar({ 
  chats, projects, currentProjectId, 
  onSelectProject, onCreateProject, onDeleteProject, onRenameProject,
  currentChatId, onSelectChat, onNewChat, onOpenSettings, onDeleteChat, onRenameChat,
  collapsed, onToggleCollapse
}) {
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [hoveredChatId, setHoveredChatId] = useState(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleEditClick = (e, chat) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const handleEditSave = async (e, id) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      await onRenameChat(id, editTitle.trim());
    }
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
          style={{ width: '40px', height: '40px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)' }}
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>Nexus<span style={{fontWeight: 300, color: 'var(--text-secondary)'}}>.AI</span></h2>
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
          style={{ width: '100%', padding: '12px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 500, boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)' }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Plus size={16} /> New Chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        {/* Workspace Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600, paddingLeft: '8px' }}>Workspace</h3>
            <button 
              onClick={() => setIsCreatingProject(true)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              title="New Workspace"
            >
              <FolderPlus size={14} />
            </button>
          </div>

          {isCreatingProject ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input 
                autoFocus
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newProjectName.trim()) {
                    onCreateProject(newProjectName.trim());
                    setIsCreatingProject(false);
                    setNewProjectName('');
                  } else if (e.key === 'Escape') {
                    setIsCreatingProject(false);
                    setNewProjectName('');
                  }
                }}
                placeholder="Workspace name..."
                style={{ flex: 1, background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--accent-color)', borderRadius: '6px', padding: '6px 8px', fontSize: '0.9rem', outline: 'none' }}
              />
              <button onClick={() => { setIsCreatingProject(false); setNewProjectName(''); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><CloseIcon size={16}/></button>
            </div>
          ) : isEditingProject ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input 
                autoFocus
                value={editProjectName}
                onChange={e => setEditProjectName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && editProjectName.trim()) {
                    onRenameProject(currentProjectId, editProjectName.trim());
                    setIsEditingProject(false);
                  } else if (e.key === 'Escape') {
                    setIsEditingProject(false);
                  }
                }}
                style={{ flex: 1, background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--accent-color)', borderRadius: '6px', padding: '6px 8px', fontSize: '0.9rem', outline: 'none' }}
              />
              <button onClick={() => { setIsEditingProject(false); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><CloseIcon size={16}/></button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{ width: '100%', background: 'var(--card-glass)', color: 'var(--text-primary)', border: '1px solid var(--accent-color)', borderRadius: '10px', padding: '10px 12px', fontSize: '0.9rem', outline: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--card-glass)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Folder size={14} color="var(--accent-color)" />
                  <span style={{ fontWeight: 500 }}>{projects?.find(p => p.id === currentProjectId)?.name || 'Default Workspace'}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>

              {isDropdownOpen && (
                <>
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} onClick={() => setIsDropdownOpen(false)} />
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: 'var(--sidebar-glass)', border: '1px solid var(--sidebar-border)', borderRadius: '12px', padding: '6px', zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', maxHeight: '200px', overflowY: 'auto' }}>
                    {projects?.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => { onSelectProject(p.id); setIsDropdownOpen(false); }}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: p.id === currentProjectId ? 'rgba(139, 92, 246, 0.2)' : 'transparent', border: 'none', borderRadius: '8px', color: p.id === currentProjectId ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', transition: 'all 0.2s' }}
                        onMouseOver={e => { if(p.id !== currentProjectId) { e.currentTarget.style.background = 'var(--card-glass)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                        onMouseOut={e => { if(p.id !== currentProjectId) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                      >
                        <Folder size={14} opacity={p.id === currentProjectId ? 1 : 0.6} color={p.id === currentProjectId ? "var(--accent-color)" : "currentColor"} />
                        <span style={{ fontWeight: p.id === currentProjectId ? 500 : 400 }}>{p.name}</span>
                        {p.id === currentProjectId && <Check size={14} style={{ marginLeft: 'auto', color: '#34d399' }} />}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {currentProjectId !== 'default' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button 
                    onClick={() => { setEditProjectName(projects.find(p => p.id === currentProjectId)?.name || ''); setIsEditingProject(true); }}
                    style={{ flex: 1, background: 'var(--card-glass)', border: '1px solid var(--sidebar-border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px', borderRadius: '8px', transition: 'all 0.2s' }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'var(--card-glass)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    <Edit2 size={12} /> Rename
                  </button>
                  <button 
                    onClick={() => onDeleteProject(currentProjectId)}
                    style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px', borderRadius: '8px', transition: 'all 0.2s' }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#f87171'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', paddingLeft: '8px', letterSpacing: '0.1em', fontWeight: 600 }}>History</h3>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {chats.map(chat => (
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
              onMouseOver={e => { if (chat.id !== currentChatId && editingChatId !== chat.id) e.currentTarget.style.background = 'var(--card-glass)' }}
              onMouseOut={e => { if (chat.id !== currentChatId && editingChatId !== chat.id) e.currentTarget.style.background = 'transparent' }}
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
                  <button onClick={(e) => handleEditSave(e, chat.id)} style={{ background: 'transparent', border: 'none', color: '#34d399', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '4px' }}><Check size={14}/></button>
                  <button onClick={handleEditCancel} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '4px' }}><CloseIcon size={14}/></button>
                </div>
              ) : (
                <>
                  <MessageSquare size={16} opacity={chat.id === currentChatId ? 1 : 0.5} style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{chat.title}</span>
                  
                  {hoveredChatId === chat.id && (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                      <button 
                        onClick={(e) => handleEditClick(e, chat)} 
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', borderRadius: '4px' }}
                        onMouseOver={e => { e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.background='var(--card-glass)'; }}
                        onMouseOut={e => { e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.background='transparent'; }}
                        title="Rename"
                      ><Edit2 size={14}/></button>
                      <button 
                        onClick={(e) => handleDelete(e, chat.id)} 
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', borderRadius: '4px' }}
                        onMouseOver={e => { e.currentTarget.style.color='#ef4444'; e.currentTarget.style.background='rgba(239,68,68,0.1)'; }}
                        onMouseOut={e => { e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.background='transparent'; }}
                        title="Delete"
                      ><Trash2 size={14}/></button>
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
