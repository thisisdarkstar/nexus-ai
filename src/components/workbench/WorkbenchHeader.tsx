import React, { useMemo } from 'react';
import {
  Shield,
  Target,
  Search,
  UploadCloud,
  Sparkles,
  Settings as SettingsIcon,
  Sun,
  Moon,
  FolderKanban,
} from 'lucide-react';
import CustomSelect from '../common/CustomSelect';
import type { Project, SecurityTab } from '../../types';
import styles from './WorkbenchHeader.module.css';

interface WorkbenchHeaderProps {
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string) => Promise<void>;
  activeTab: SecurityTab;
  onTabChange: (tab: SecurityTab) => void;
  scopeCount: number;
  copilotOpen: boolean;
  onToggleCopilot: () => void;
  onOpenCommandPalette: () => void;
  onOpenIngest: () => void;
  onOpenSettings: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export default function WorkbenchHeader({
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
  activeTab,
  onTabChange,
  scopeCount,
  copilotOpen,
  onToggleCopilot,
  onOpenCommandPalette,
  onOpenIngest,
  onOpenSettings,
  theme,
  onToggleTheme,
}: WorkbenchHeaderProps) {
  const projectOptions = useMemo(() => {
    const opts = projects.map((p) => ({
      value: p.id,
      label: p.name || 'Default Engagement',
    }));
    opts.push({
      value: '__new_project__',
      label: '+ New Engagement...',
    });
    return opts;
  }, [projects]);

  const handleProjectChange = async (val: string) => {
    if (val === '__new_project__') {
      const name = window.prompt('Enter new engagement or target project name:');
      if (name && name.trim()) {
        await onCreateProject(name.trim());
      }
    } else {
      onSelectProject(val);
    }
  };

  return (
    <header className={styles.header}>
      {/* Left: Brand, Engagement Selector, Scope Pill */}
      <div className={styles.leftGroup}>
        <div className={styles.brand} onClick={() => onTabChange('dashboard')} title="Nexus AI Security Dashboard">
          <div className={styles.brandIcon}>
            <Shield size={17} />
          </div>
          <div className={styles.brandTextGroup}>
            <span className={styles.brandTitle}>NEXUS AI</span>
            <span className={styles.brandBadge}>SECURITY WORKBENCH</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <FolderKanban size={14} color="#94a3b8" />
          <CustomSelect
            value={currentProjectId}
            onChange={handleProjectChange}
            options={projectOptions}
            style={{ minWidth: '170px' }}
            ariaLabel="Active Engagement Target"
          />
        </div>

        <button
          type="button"
          className={styles.scopePill}
          onClick={() => onTabChange('scope')}
          title="Click to view and configure Target Scope Rules"
        >
          <span className={styles.scopeDot} />
          <Target size={12} />
          <span>{scopeCount > 0 ? `${scopeCount} In-Scope` : 'Define Scope'}</span>
        </button>
      </div>

      {/* Center: Quick Search Command Palette Trigger */}
      <div className={styles.centerGroup}>
        <button
          type="button"
          className={styles.commandSearchBtn}
          onClick={onOpenCommandPalette}
          title="Open Command Palette (Ctrl+K / ⌘K)"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={13} />
            <span>Search attack surface, tools, or advisories...</span>
          </div>
          <span className={styles.kbd}>⌘K</span>
        </button>
      </div>

      {/* Right: Ingest, Copilot Toggle, Settings, Theme */}
      <div className={styles.rightGroup}>
        <button
          type="button"
          className={styles.btn}
          onClick={onOpenIngest}
          title="Ingest Scan Artifacts (Burp, HTTPX, Nuclei, Semgrep, SARIF)"
        >
          <UploadCloud size={13} color="#38bdf8" />
          <span>Import Scan</span>
        </button>

        <button
          type="button"
          className={`${styles.btn} ${styles.copilotToggle} ${copilotOpen ? styles.copilotToggleActive : ''}`}
          onClick={onToggleCopilot}
          title="Toggle AI Security Copilot Drawer (Ctrl+J / ⌘J)"
        >
          <Sparkles size={13} />
          <span>AI Copilot</span>
          <span className={styles.kbd} style={{ background: 'rgba(0,0,0,0.2)', color: 'currentColor' }}>
            Ctrl+J
          </span>
        </button>

        <button
          type="button"
          className={styles.iconBtn}
          onClick={onOpenSettings}
          title="System & AI Model Configuration"
        >
          <SettingsIcon size={15} />
        </button>

        <button
          type="button"
          className={styles.iconBtn}
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
}
