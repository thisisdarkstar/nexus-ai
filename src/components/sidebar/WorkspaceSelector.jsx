import { useState } from 'react';
import { Folder, FolderPlus, Edit2, Trash2, Check, X as CloseIcon } from 'lucide-react';

export default function WorkspaceSelector({ projects, currentProjectId, onSelectProject, onCreateProject, onDeleteProject, onRenameProject }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const currentProject = projects?.find(p => p.id === currentProjectId);

  const commitCreate = () => {
    if (newName.trim()) { onCreateProject(newName.trim()); }
    setIsCreating(false);
    setNewName('');
  };

  const commitRename = () => {
    if (editName.trim()) { onRenameProject(currentProjectId, editName.trim()); }
    setIsEditing(false);
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600, paddingLeft: '8px' }}>Workspace</h3>
        <button
          onClick={() => setIsCreating(true)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          title="New Workspace"
        ><FolderPlus size={14} /></button>
      </div>

      {isCreating ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitCreate(); else if (e.key === 'Escape') { setIsCreating(false); setNewName(''); } }}
            placeholder="Workspace name..."
            style={{ flex: 1, background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--accent-color)', borderRadius: '6px', padding: '6px 8px', fontSize: '0.9rem', outline: 'none' }}
          />
          <button onClick={() => { setIsCreating(false); setNewName(''); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><CloseIcon size={16} /></button>
        </div>
      ) : isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            autoFocus
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); else if (e.key === 'Escape') setIsEditing(false); }}
            style={{ flex: 1, background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--accent-color)', borderRadius: '6px', padding: '6px 8px', fontSize: '0.9rem', outline: 'none' }}
          />
          <button onClick={() => setIsEditing(false)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><CloseIcon size={16} /></button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Trigger button */}
          <button
            onClick={() => setIsDropdownOpen(o => !o)}
            style={{ width: '100%', background: 'var(--card-glass)', color: 'var(--text-primary)', border: '1px solid var(--accent-color)', borderRadius: '10px', padding: '10px 12px', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s' }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(139,92,246,0.1)'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--card-glass)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Folder size={14} color="var(--accent-color)" />
              <span style={{ fontWeight: 500 }}>{currentProject?.name || 'Default Workspace'}</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-secondary)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Dropdown */}
          {isDropdownOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsDropdownOpen(false)} />
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: 'rgba(15,23,42,0.97)', border: '1px solid var(--sidebar-border)', borderRadius: '12px', padding: '6px', zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.7)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', maxHeight: '200px', overflowY: 'auto' }}>
                {projects?.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { onSelectProject(p.id); setIsDropdownOpen(false); }}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: p.id === currentProjectId ? 'rgba(139,92,246,0.2)' : 'transparent', border: 'none', borderRadius: '8px', color: p.id === currentProjectId ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', transition: 'all 0.2s' }}
                    onMouseOver={e => { if (p.id !== currentProjectId) { e.currentTarget.style.background = 'var(--card-glass)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                    onMouseOut={e => { if (p.id !== currentProjectId) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                  >
                    <Folder size={14} opacity={p.id === currentProjectId ? 1 : 0.6} color={p.id === currentProjectId ? 'var(--accent-color)' : 'currentColor'} />
                    <span style={{ fontWeight: p.id === currentProjectId ? 500 : 400 }}>{p.name}</span>
                    {p.id === currentProjectId && <Check size={14} style={{ marginLeft: 'auto', color: '#34d399' }} />}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Rename / Delete for non-default workspaces */}
          {currentProjectId !== 'default' && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                onClick={() => { setEditName(currentProject?.name || ''); setIsEditing(true); }}
                style={{ flex: 1, background: 'var(--card-glass)', border: '1px solid var(--sidebar-border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px', borderRadius: '8px', transition: 'all 0.2s' }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'var(--card-glass)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              ><Edit2 size={12} /> Rename</button>
              <button
                onClick={() => onDeleteProject(currentProjectId)}
                style={{ flex: 1, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px', borderRadius: '8px', transition: 'all 0.2s' }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
              ><Trash2 size={12} /> Delete</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
