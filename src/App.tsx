import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { eventBus } from './core/bus/EventBus';
import { deleteEngagement } from './core/storage/ProjectCleanup';
import {
  getActiveProjectId,
  projectLocalStorage,
  setActiveProjectId,
} from './core/storage/projectStorage';
import { storageManager } from './core/storage/StorageManager';
import WorkbenchHeader from './components/workbench/WorkbenchHeader';
import SecurityCanvas from './components/security/SecurityCanvas';
import CopilotDrawer from './components/copilot/CopilotDrawer';
import VoiceOverlay from './components/VoiceOverlay';
import ConfirmModal from './components/ConfirmModal';
import CommandPalette from './components/CommandPalette';
import ArtifactIngestModal from './components/security/ArtifactIngestModal';
import NoteMapStudio from './components/notemap/NoteMapStudio';
import { ToastProvider, useToast } from './lib/toast';
import { useVoice } from './hooks/useVoice';
import { useMediaQuery } from './hooks/useMediaQuery';
import styles from './App.module.css';
import { db } from './lib/db';
import { runStorageMigration } from './core/storage/StorageMigration';
import { DEFAULT_OPENAI_BASE_URL } from './lib/constants';
import { adoptLegacyKeys, hydrateApiKeys, sanitizePersistedSettings, saveApiKeys } from './lib/apiKeyStore';
import { DEFAULT_POLICY_CONFIG, executionPolicyGuard } from './core/policy/ExecutionPolicyGuard';
import { providerManager } from './lib/providers/ProviderManager';
import { isSecurityTab } from './types';
import type {
  Chat,
  Project,
  Settings,
  ProviderStatus,
  VoiceOverlayState,
  ConfirmModalState,
  AvailableModel,
  SecurityTab,
} from './types';

const SettingsModal = lazy(() => import('./components/SettingsModal'));
const QuickAiHud = lazy(() => import('./components/copilot/QuickAiHud'));

const DEFAULT_SETTINGS: Settings = {
  provider: 'openai',
  theme: 'dark',
  systemPrompt: '',
  openaiBaseUrl: DEFAULT_OPENAI_BASE_URL,
  openaiApiKey: 'sk-local',
  openaiModel: '',
  temperature: 0.7,
  maxTokens: 4096,
  contextWindow: 16384,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  ttsVoice: '',
  executionPolicy: DEFAULT_POLICY_CONFIG,
};

function getInitialSettings(): Settings {
  const savedSettings = localStorage.getItem('nexus_settings');
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings) as Record<string, unknown>;
      adoptLegacyKeys(parsed);
      const combined = { ...DEFAULT_SETTINGS, ...parsed } as Settings;
      // Upgrade missing or legacy small contextWindow to 16384 (16K) to prevent 4096 overflows
      if (!combined.contextWindow || combined.contextWindow < 8192) {
        combined.contextWindow = 16384;
      }
      return hydrateApiKeys(combined);
    } catch {
      localStorage.removeItem('nexus_settings');
    }
  }
  return DEFAULT_SETTINGS;
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

function AppContent() {
  const { toast } = useToast();

  const [chats, setChats] = useState<Chat[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState('default');

  // Every workbench module reads storage through this facade. It must be set
  // before children render so a newly selected engagement sees its own data.
  setActiveProjectId(currentProjectId);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>({
    state: 'checking',
    reason: null,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(getInitialSettings);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    variant: 'danger',
  });
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);

  const [voiceOverlay, setVoiceOverlay] = useState<VoiceOverlayState>({
    active: false,
    type: null,
    text: '',
  });

  // Workbench & Copilot Layout State
  const [copilotOpen, setCopilotOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('nexus_copilot_open');
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore
    }
    return window.innerWidth > 1024;
  });

  const [copilotMaximized, setCopilotMaximized] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('nexus_copilot_maximized');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  // Mount Copilot lazily on first open and keep it mounted across close/reopen & split/fullscreen switches.
  const [hasMountedCopilot, setHasMountedCopilot] = useState<boolean>(copilotOpen);
  useEffect(() => {
    if (copilotOpen) setHasMountedCopilot(true);
  }, [copilotOpen]);

  const [copilotWidthPct, setCopilotWidthPct] = useState<number>(() => {
    try {
      const saved = parseFloat(localStorage.getItem('nexus_copilot_width_pct') || '');
      if (Number.isFinite(saved) && saved >= 20 && saved <= 50) return saved;
    } catch {
      // ignore
    }
    return 30;
  });

  useEffect(() => {
    try {
      localStorage.setItem('nexus_copilot_width_pct', String(copilotWidthPct));
    } catch {
      // ignore
    }
  }, [copilotWidthPct]);

  const desktopWorkspaceRef = useRef<HTMLDivElement>(null);
  const startSplitResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = desktopWorkspaceRef.current;
    if (!container) return;

    const handleMove = (moveEvent: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const rightPct = ((rect.right - moveEvent.clientX) / rect.width) * 100;
      setCopilotWidthPct(Math.min(50, Math.max(20, rightPct)));
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, []);

  const [quickHudOpen, setQuickHudOpen] = useState(false);
  const [quickHudInitialQuery, setQuickHudInitialQuery] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('nexus_copilot_maximized', String(copilotMaximized));
    } catch {
      // ignore
    }
  }, [copilotMaximized]);

  useEffect(() => {
    const unsubQuick = eventBus.subscribe('open-quick-hud', (detail) => {
      setQuickHudInitialQuery(detail?.query || '');
      setQuickHudOpen(true);
    });
    return () => unsubQuick();
  }, []);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [artifactIngestOpen, setArtifactIngestOpen] = useState(false);
  const [pendingCopilotPrompt, setPendingCopilotPrompt] = useState<string | null>(null);
  const [scopeCount, setScopeCount] = useState<number>(1);
  const [activeSecurityTab, setActiveSecurityTab] = useState<SecurityTab>(() => {
    try {
      const saved = localStorage.getItem('nexus_security_active_tab');
      if (isSecurityTab(saved)) return saved;
    } catch {
      // fallback
    }
    return 'dashboard';
  });

  useEffect(() => {
    try {
      localStorage.setItem('nexus_security_active_tab', activeSecurityTab);
    } catch (e) {
      console.error(e);
    }
  }, [activeSecurityTab]);

  useEffect(() => {
    try {
      localStorage.setItem('nexus_copilot_open', String(copilotOpen));
    } catch (e) {
      console.error(e);
    }
  }, [copilotOpen]);

  // Scope rules live in both IndexedDB (post-migration/import) and the
  // namespaced localStorage used by ScopeManager. Merge both sources.
  const refreshScopeCount = useCallback(async () => {
    try {
      const [storedScope, legacyScope] = await Promise.all([
        storageManager.getScope(getActiveProjectId()),
        Promise.resolve(projectLocalStorage.getItem('nexus_security_scope')),
      ]);

      const merged = [...storedScope];
      const seen = new Set(merged.map((item) => item.target));
      if (legacyScope) {
        const parsed: unknown = JSON.parse(legacyScope);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (item && typeof item.target === 'string' && !seen.has(item.target)) {
              merged.push(item);
              seen.add(item.target);
            }
          });
        }
      }
      setScopeCount(merged.filter((item) => item.inScope !== false).length);
    } catch {
      setScopeCount(0);
    }
  }, []);

  useEffect(() => {
    refreshScopeCount();
    window.addEventListener('storage', refreshScopeCount);
    const unsubscribe = eventBus.subscribe('scope:added', refreshScopeCount);
    return () => {
      window.removeEventListener('storage', refreshScopeCount);
      unsubscribe();
    };
  }, [refreshScopeCount, activeSecurityTab, currentProjectId]);

  const [securityInitialCode, setSecurityInitialCode] = useState<string | undefined>(undefined);
  const [securityInitialDecoderInput, setSecurityInitialDecoderInput] = useState<string | undefined>(undefined);

  const voice = useVoice();
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    const unsubscribeSecurity = eventBus.subscribe('open-security', (detail) => {
      if (isSecurityTab(detail?.tab)) {
        setActiveSecurityTab(detail.tab);
      }
      if (detail?.code) {
        setSecurityInitialCode(detail.code);
      }
      if (detail?.input) {
        setSecurityInitialDecoderInput(detail.input);
      }
    });
    const unsubscribeIngest = eventBus.subscribe('open-ingest', () => setArtifactIngestOpen(true));
    return () => {
      unsubscribeSecurity();
      unsubscribeIngest();
    };
  }, []);

  // Hand the prompt to the drawer through state instead of a timed window
  // event, so it cannot be dropped while the lazily-mounted drawer starts up.
  const handleSendToAIFromSecurity = (prompt: string) => {
    setPendingCopilotPrompt(prompt);
    setCopilotOpen(true);
  };

  useEffect(() => {
    voice.setPreferredVoice(settings.ttsVoice || '');
  }, [settings.ttsVoice]);

  useEffect(() => {
    async function init() {
      await db.init();
      runStorageMigration('default').catch(console.error);

      let savedProjects = await db.getProjects();
      if (savedProjects.length === 0) {
        const defaultProj: Project = {
          id: 'default',
          name: 'Default Engagement',
          createdAt: Date.now(),
        };
        await db.saveProject(defaultProj);
        savedProjects = [defaultProj];
      }
      setProjects(savedProjects);

      const savedChats = await db.getChats();
      setChats(savedChats);

      const savedSettings = localStorage.getItem('nexus_settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings) as Record<string, unknown>;
          adoptLegacyKeys(parsed);
          setSettings((prev) => hydrateApiKeys({ ...prev, ...parsed } as Settings));
          if (typeof parsed.currentProjectId === 'string') {
            setCurrentProjectId(parsed.currentProjectId);
          }
        } catch {
          localStorage.removeItem('nexus_settings');
        }
      }
    }
    init();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
  }, [settings.theme]);

  useEffect(() => {
    executionPolicyGuard.updateConfig(settings.executionPolicy || DEFAULT_POLICY_CONFIG);
  }, [settings.executionPolicy]);

  useEffect(() => {
    async function checkProvider() {
      setProviderStatus({ state: 'checking', reason: null });
      providerManager.updateOpenAISettings(settings);
      providerManager.setProvider(settings.provider);
      const provider = providerManager.getProvider();

      if (!provider) {
        setProviderStatus({ state: 'error', reason: 'Invalid Provider' });
        toast('error', 'No AI provider configured');
        return;
      }
      const status = await provider.checkAvailability();
      if (status.available) {
        setProviderStatus({ state: 'ready', reason: null });
      } else {
        setProviderStatus({ state: 'error', reason: status.reason || null });
        if (settings.provider === 'chrome') {
          toast('warning', 'Chrome Built-in AI not detected. Switch to OpenAI/Ollama in Settings (⚙️) or enable Chrome flags.');
        } else {
          toast('error', `Provider unavailable: ${status.reason || 'unknown error'}`);
        }
      }

      const models = await providerManager.fetchAvailableModels();
      if (models && models.length > 0) {
        setAvailableModels(models);
      }
    }
    checkProvider();
  }, [settings.provider, settings.openaiBaseUrl, settings.openaiApiKey, settings.openaiModel]);

  const saveSettings = (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveApiKeys(updated);
    localStorage.setItem(
      'nexus_settings',
      JSON.stringify(sanitizePersistedSettings(updated as unknown as Record<string, unknown>, currentProjectId))
    );
  };

  useEffect(() => {
    if (currentProjectId) {
      try {
        const savedSettings = localStorage.getItem('nexus_settings');
        const parsed = savedSettings ? (JSON.parse(savedSettings) as Record<string, unknown>) : {};
        localStorage.setItem(
          'nexus_settings',
          JSON.stringify(sanitizePersistedSettings(parsed, currentProjectId))
        );
      } catch {
        // ignore
      }
    }
  }, [currentProjectId]);

  const handleNewChat = () => {
    setCurrentChatId(null);
    setCopilotOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setArtifactIngestOpen(true);
      } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setQuickHudOpen((prev) => !prev);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setCopilotOpen((prev) => !prev);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewChat();
      } else if (e.key === 'Escape') {
        if (quickHudOpen) {
          setQuickHudOpen(false);
          return;
        }
        if (copilotMaximized) {
          setCopilotMaximized(false);
          return;
        }
        if (commandPaletteOpen) setCommandPaletteOpen(false);
        if (artifactIngestOpen) setArtifactIngestOpen(false);
        if (settingsOpen) setSettingsOpen(false);
        if (confirmModal.isOpen) setConfirmModal((c) => ({ ...c, isOpen: false }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen, confirmModal.isOpen, commandPaletteOpen, artifactIngestOpen, copilotMaximized, quickHudOpen]);

  const confirmAction = (
    title: string,
    message: string,
    onConfirm: () => Promise<void>,
    variant: 'danger' | 'primary' | 'warning' | 'info' = 'danger'
  ) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, variant });
  };

  const handleDeleteAll = () => {
    confirmAction(
      'Wipe All Conversations',
      'Are you sure you want to permanently delete all your chats? This action cannot be undone.',
      async () => {
        await db.clearAll();
        setChats([]);
        setCurrentChatId(null);
        toast('success', 'All conversations deleted');
      },
      'danger'
    );
  };

  const requestDeleteChat = (id: string) => {
    confirmAction(
      'Delete Conversation',
      'Are you sure you want to delete this chat history? This cannot be undone.',
      async () => {
        await db.deleteChat(id);
        if (currentChatId === id) setCurrentChatId(null);
        await reloadChats();
        toast('success', 'Conversation deleted');
      },
      'danger'
    );
  };

  const handleCreateProject = async (name: string) => {
    const newProj: Project = { id: Date.now().toString(), name, createdAt: Date.now() };
    await db.saveProject(newProj);
    setProjects(await db.getProjects());
    setCurrentProjectId(newProj.id);
    setCurrentChatId(null);
    toast('success', `Engagement "${name}" created`);
  };

  const requestDeleteProject = () => {
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project || currentProjectId === 'default') return;
    confirmAction(
      'Delete Engagement',
      `Permanently delete "${project.name}" and all of its chats, findings, scope, assets and evidence? This cannot be undone.`,
      async () => {
        await deleteEngagement(currentProjectId);
        setProjects(await db.getProjects());
        setCurrentProjectId('default');
        setCurrentChatId(null);
        await reloadChats();
        await refreshScopeCount();
        toast('success', `Engagement "${project.name}" deleted`);
      }
    );
  };

  const reloadChats = async () => {
    const savedChats = await db.getChats();
    setChats(savedChats);
  };

  const canvas = (
    <SecurityCanvas
      key={currentProjectId}
      activeTab={activeSecurityTab}
      onTabChange={setActiveSecurityTab}
      onSendToAI={handleSendToAIFromSecurity}
      initialCode={securityInitialCode}
      initialDecoderInput={securityInitialDecoderInput}
    />
  );

  const copilotDrawer = (
    <CopilotDrawer
      currentChatId={currentChatId}
      setCurrentChatId={setCurrentChatId}
      chats={chats}
      currentProjectId={currentProjectId}
      providerStatus={providerStatus}
      reloadChats={reloadChats}
      settings={settings}
      onModelChange={(p, m, endpointId) => {
        const updates: Partial<Settings> = {
          provider: p as Settings['provider'],
          openaiModel: m,
        };
        if (endpointId) {
          updates.activeEndpointId = endpointId;
        }
        saveSettings(updates);
      }}
      availableModels={availableModels}
      voice={voice}
      setVoiceOverlay={setVoiceOverlay}
      activeSecurityTab={activeSecurityTab}
      onClose={() => setCopilotOpen(false)}
      onDeleteChat={requestDeleteChat}
      pendingPrompt={pendingCopilotPrompt}
      onPendingPromptConsumed={() => setPendingCopilotPrompt(null)}
      isMaximized={copilotMaximized}
      onToggleMaximize={() => setCopilotMaximized((prev) => !prev)}
      onSettingsChange={saveSettings}
    />
  );

  return (
    <div className={styles.shell}>
      {/* Top Header: Workbench Branding, Engagement Switcher, Scope Badge, ⌘K, Ingest, Copilot & Settings */}
      <WorkbenchHeader
        projects={projects}
        currentProjectId={currentProjectId}
        onSelectProject={(id) => {
          setCurrentProjectId(id);
          setCurrentChatId(null);
        }}
        onCreateProject={handleCreateProject}
        onDeleteProject={requestDeleteProject}
        canDeleteProject={currentProjectId !== 'default' && projects.length > 1}
        activeTab={activeSecurityTab}
        onTabChange={setActiveSecurityTab}
        scopeCount={scopeCount}
        copilotOpen={copilotOpen}
        onToggleCopilot={() => setCopilotOpen((prev) => !prev)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenIngest={() => setArtifactIngestOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        theme={settings.theme || 'dark'}
        onToggleTheme={() => {
          const next = settings.theme === 'dark' ? 'light' : 'dark';
          saveSettings({ theme: next });
        }}
      />

      {/* Main Area: side-by-side on desktop, bottom-sheet copilot on phones */}
      <main className={styles.main}>
        {isMobile ? (
          <>
            <div className={styles.mobileCanvas}>{canvas}</div>
            {copilotOpen && (
              <>
                <button
                  type="button"
                  className={styles.mobileScrim}
                  onClick={() => setCopilotOpen(false)}
                  aria-label="Close AI copilot"
                />
                <div className={styles.mobileDrawer}>{copilotDrawer}</div>
              </>
            )}
          </>
        ) : (
          <div ref={desktopWorkspaceRef} className={styles.desktopWorkspace}>
            <div
              className={styles.workbenchPane}
              style={{
                display: copilotOpen && copilotMaximized ? 'none' : 'flex',
              }}
            >
              {canvas}
            </div>

            {copilotOpen && !copilotMaximized && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize Copilot drawer"
                aria-valuenow={Math.round(copilotWidthPct)}
                aria-valuemin={20}
                aria-valuemax={50}
                tabIndex={0}
                className={styles.splitDivider}
                onMouseDown={startSplitResize}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') setCopilotWidthPct((w) => Math.min(50, w + 2));
                  if (e.key === 'ArrowRight') setCopilotWidthPct((w) => Math.max(20, w - 2));
                }}
              />
            )}

            {hasMountedCopilot && (
              <div
                className={copilotMaximized ? styles.focusStudioWrapper : styles.splitCopilotPane}
                style={{
                  display: copilotOpen ? 'flex' : 'none',
                  width: copilotMaximized ? '100%' : `${copilotWidthPct}%`,
                }}
                aria-hidden={!copilotOpen}
              >
                {copilotDrawer}
              </div>
            )}
          </div>
        )}
      </main>

      <VoiceOverlay
        isActive={voiceOverlay.active}
        type={voiceOverlay.type}
        text={voiceOverlay.text}
        transcript={voiceOverlay.type === 'stt' ? voice.interimTranscript || voice.transcript : ''}
        onClose={() => {
          if (voice.isListening) voice.stopListening();
          if (voice.isSpeaking) voice.stopSpeaking();
          setVoiceOverlay({ active: false, type: null, text: '' });
        }}
      />

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            settings={settings}
            onSave={saveSettings}
            onClose={() => setSettingsOpen(false)}
            onClearChats={handleDeleteAll}
            reloadChats={reloadChats}
            availableVoices={voice.availableVoices}
          />
        </Suspense>
      )}

      {confirmModal.isOpen && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          variant={confirmModal.variant || 'danger'}
          onConfirm={async () => {
            try {
              await confirmModal.onConfirm?.();
            } catch (err) {
              console.error('Confirm action failed:', err);
              toast('error', 'Action failed');
            }
            setConfirmModal((c) => ({ ...c, isOpen: false }));
          }}
          onCancel={() => setConfirmModal((c) => ({ ...c, isOpen: false }))}
        />
      )}

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNewChat={handleNewChat}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenIngest={() => setArtifactIngestOpen(true)}
        onToggleTheme={() => {
          const next = settings.theme === 'dark' ? 'light' : 'dark';
          saveSettings({ theme: next });
        }}
      />

      <ArtifactIngestModal
        isOpen={artifactIngestOpen}
        onClose={() => setArtifactIngestOpen(false)}
        onSuccess={(summary) => {
          toast('success', `Artifact Ingested: ${summary}`);
        }}
      />

      {quickHudOpen && (
        <Suspense fallback={null}>
          <QuickAiHud
            isOpen={quickHudOpen}
            onClose={() => setQuickHudOpen(false)}
            settings={settings}
            initialQuery={quickHudInitialQuery}
            onOpenFullCopilotWithPrompt={(prompt) => {
              setQuickHudOpen(false);
              setPendingCopilotPrompt(prompt);
              setCopilotOpen(true);
            }}
          />
        </Suspense>
      )}

      <NoteMapStudio
        projectId={currentProjectId}
        onSendToAI={handleSendToAIFromSecurity}
      />
    </div>
  );
}
