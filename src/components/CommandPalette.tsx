import { useState, useEffect, useRef } from 'react';
import {
  Search,
  UploadCloud,
  Plus,
  Settings as SettingsIcon,
  SunMoon,
  Sparkles,
  Download,
  FolderArchive,
  Swords,
  Brain,
  FileText,
} from 'lucide-react';
import { eventBus } from '../core/bus/EventBus';
import { workbenchBridge } from '../lib/security/workbenchBridge';
import { exportEngagementBundle, importEngagementBundle } from '../lib/security/engagementBundle';
import { SECURITY_TABS } from '../lib/security/tabRegistry';
import type { SecurityTab } from '../types';
import styles from './CommandPalette.module.css';

interface CommandItem {
  id: string;
  title: string;
  category: 'Workbench' | 'Engagements' | 'Actions' | 'System';
  icon: React.ComponentType<{ size?: number; color?: string }>;
  action: () => void;
  shortcut?: string;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenIngest: () => void;
  onToggleTheme: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onNewChat,
  onOpenSettings,
  onOpenIngest,
  onToggleTheme,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const switchTab = (tab: SecurityTab) => {
    workbenchBridge.switchTab(tab);
    onClose();
  };

  const commands: CommandItem[] = [
    // All workbench tabs, derived from the shared registry.
    ...SECURITY_TABS.map((tab) => ({
      id: `tab-${tab.id}`,
      title: `Open ${tab.name}`,
      category: 'Workbench' as const,
      icon: tab.icon,
      keywords: [tab.id, tab.tooltip, ...tab.keywords],
      action: () => switchTab(tab.id),
    })),

    // Actions
    {
      id: 'action-export-nexus',
      title: 'Export Engagement (.nexus portable bundle)',
      category: 'Engagements',
      icon: Download,
      action: async () => {
        onClose();
        const savedSettings = localStorage.getItem('nexus_settings');
        const projId = savedSettings ? JSON.parse(savedSettings).currentProjectId || 'default' : 'default';
        await exportEngagementBundle(projId);
      },
    },
    {
      id: 'action-import-nexus',
      title: 'Import Engagement (.nexus bundle file)',
      category: 'Engagements',
      icon: FolderArchive,
      action: () => {
        onClose();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.nexus,.json';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            try {
              await importEngagementBundle(file);
              window.location.reload();
            } catch (err) {
              console.error('Failed to import bundle:', err);
            }
          }
        };
        input.click();
      },
    },
    {
      id: 'action-ingest',
      title: 'Ingest Scan Artifact (Burp, Nmap, Nuclei, SARIF)',
      category: 'Actions',
      icon: UploadCloud,
      action: () => {
        onClose();
        onOpenIngest();
      },
      shortcut: 'Ctrl+I',
    },
    {
      id: 'action-new-chat',
      title: 'Start New Conversation',
      category: 'Actions',
      icon: Plus,
      action: () => {
        onClose();
        onNewChat();
      },
      shortcut: 'Ctrl+N',
    },
    {
      id: 'action-quick-ai',
      title: 'Quick AI Spotlight HUD',
      category: 'Actions',
      icon: Sparkles,
      action: () => {
        onClose();
        eventBus.publish('open-quick-hud', {});
      },
      shortcut: 'Ctrl+Shift+J',
      keywords: ['spotlight', 'quick', 'ai', 'ask', 'prompt', 'mini'],
    },
    {
      id: 'action-model-arena',
      title: 'Dual-Model Comparison Arena',
      category: 'Actions',
      icon: Swords,
      action: () => {
        onClose();
        eventBus.publish('open-quick-hud', { query: 'Compare models in Arena' });
      },
      keywords: ['arena', 'compare', 'dual', 'lmsys', 'benchmark', 'models'],
    },
    {
      id: 'action-notemap-open',
      title: 'Open Notes & Attack Mindmap Studio',
      category: 'Actions',
      icon: Brain,
      action: () => {
        onClose();
        workbenchBridge.openNoteMap();
      },
      shortcut: 'Ctrl+Shift+M',
      keywords: ['mindmap', 'notes', 'notepad', 'scratchpad', 'graph', 'tree'],
    },
    {
      id: 'action-notemap-new-map',
      title: 'Create New Attack Mindmap',
      category: 'Actions',
      icon: Brain,
      action: () => {
        onClose();
        workbenchBridge.openNoteMap({ createMode: 'mindmap' });
      },
      keywords: ['new mindmap', 'create map', 'attack tree'],
    },
    {
      id: 'action-notemap-new-note',
      title: 'Create New Security Note',
      category: 'Actions',
      icon: FileText,
      action: () => {
        onClose();
        workbenchBridge.openNoteMap({ createMode: 'note' });
      },
      keywords: ['new note', 'notepad', 'markdown', 'scratchpad'],
    },

    // System
    {
      id: 'sys-settings',
      title: 'Open Settings (Models, API Keys)',
      category: 'System',
      icon: SettingsIcon,
      action: () => {
        onClose();
        onOpenSettings();
      },
    },
    {
      id: 'sys-theme',
      title: 'Toggle Theme (Dark / Light)',
      category: 'System',
      icon: SunMoon,
      action: () => {
        onToggleTheme();
        onClose();
      },
    },
  ];

  const filtered = commands.filter((cmd) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      cmd.keywords?.some((keyword) => keyword.toLowerCase().includes(q)) ||
      false
    );
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchBox}>
          <Search size={18} color="#64748b" />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Type a command or jump to tool... (e.g. 'audit', 'scope', 'ingest')"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <span className={styles.badge}>ESC to close</span>
        </div>

        <div className={styles.list}>
          {filtered.map((cmd, idx) => {
            const Icon = cmd.icon;
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={cmd.id}
                className={`${styles.item} ${isSelected ? styles.selected : ''}`}
                onClick={() => cmd.action()}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className={styles.itemLeft}>
                  <Icon size={16} />
                  <span>{cmd.title}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {cmd.shortcut && <span className={styles.badge}>{cmd.shortcut}</span>}
                  <span className={styles.categoryTag}>{cmd.category}</span>
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              No commands matching "{query}"
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <span>Navigation</span>
          <div className={styles.footerHints}>
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Dismiss</span>
          </div>
        </div>
      </div>
    </div>
  );
}

