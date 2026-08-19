import { useState } from 'react';
import { Folder, FolderPlus, Edit2, Trash2, Check, X as CloseIcon } from 'lucide-react';
import { sanitizePlainText } from '../../lib/sanitize';
import type { Project } from '../../types';
import styles from './WorkspaceSelector.module.css';

interface WorkspaceSelectorProps {
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string) => Promise<void>;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, newName: string) => Promise<void>;
}

export default function WorkspaceSelector({
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
}: WorkspaceSelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const currentProject = projects?.find((p) => p.id === currentProjectId);

  const commitCreate = () => {
    const cleaned = sanitizePlainText(newName);
    if (cleaned) {
      onCreateProject(cleaned);
    }
    setIsCreating(false);
    setNewName('');
  };

  const commitRename = () => {
    const cleaned = sanitizePlainText(editName);
    if (cleaned) {
      onRenameProject(currentProjectId, cleaned);
    }
    setIsEditing(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.headerTitle}>Workspace</h3>
        <button onClick={() => setIsCreating(true)} className={styles.newBtn} title="New Workspace">
          <FolderPlus size={14} />
        </button>
      </div>

      {isCreating ? (
        <div className={styles.inputRow}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitCreate();
              else if (e.key === 'Escape') {
                setIsCreating(false);
                setNewName('');
              }
            }}
            placeholder="Workspace name..."
            className={styles.input}
          />
          <button
            onClick={() => {
              setIsCreating(false);
              setNewName('');
            }}
            className={styles.cancelCreateBtn}
          >
            <CloseIcon size={16} />
          </button>
        </div>
      ) : isEditing ? (
        <div className={styles.inputRow}>
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              else if (e.key === 'Escape') setIsEditing(false);
            }}
            className={styles.input}
          />
          <button onClick={() => setIsEditing(false)} className={styles.cancelCreateBtn}>
            <CloseIcon size={16} />
          </button>
        </div>
      ) : (
        <div className={styles.triggerWrapper}>
          <button onClick={() => setIsDropdownOpen((o) => !o)} className={styles.trigger}>
            <div className={styles.triggerContent}>
              <Folder size={14} color="var(--accent-color)" />
              <span className={styles.triggerName}>
                {currentProject?.name || 'Default Workspace'}
              </span>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`${styles.chevron} ${isDropdownOpen ? styles.chevronOpen : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {isDropdownOpen && (
            <>
              <div className={styles.dropdownOverlay} onClick={() => setIsDropdownOpen(false)} />
              <div className={styles.dropdown}>
                {projects?.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectProject(p.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`${styles.dropdownItem} ${p.id === currentProjectId ? styles.dropdownItemActive : ''}`}
                  >
                    <Folder
                      size={14}
                      opacity={p.id === currentProjectId ? 1 : 0.6}
                      color={p.id === currentProjectId ? 'var(--accent-color)' : 'currentColor'}
                    />
                    <span
                      className={styles.dropdownItemName}
                      style={{ fontWeight: p.id === currentProjectId ? 500 : 400 }}
                    >
                      {p.name}
                    </span>
                    {p.id === currentProjectId && (
                      <Check size={14} className={styles.dropdownCheck} />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {currentProjectId !== 'default' && (
            <div className={styles.actions}>
              <button
                onClick={() => {
                  setEditName(currentProject?.name || '');
                  setIsEditing(true);
                }}
                className={styles.renameBtn}
              >
                <Edit2 size={12} /> Rename
              </button>
              <button
                onClick={() => onDeleteProject(currentProjectId)}
                className={styles.deleteBtn}
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
