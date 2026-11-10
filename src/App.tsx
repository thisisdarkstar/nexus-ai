import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import WorkbenchHeader from './components/workbench/WorkbenchHeader';
import SecurityCanvas from './components/security/SecurityCanvas';
import CopilotDrawer from './components/copilot/CopilotDrawer';
import VoiceOverlay from './components/VoiceOverlay';
import ConfirmModal from './components/ConfirmModal';
import CommandPalette from './components/CommandPalette';
import ArtifactIngestModal from './components/security/ArtifactIngestModal';
import { ToastProvider, useToast } from './lib/toast';
import { useVoice } from './hooks/useVoice';
import { db } from './lib/db';
import { runStorageMigration } from './core/storage/StorageMigration';
import { DEFAULT_OPENAI_BASE_URL } from './lib/constants';
import { providerManager } from './lib/providers/ProviderManager';
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

const DEFAULT_SETTINGS: Settings = {
  provider: 'openai',
  theme: 'dark',
  systemPrompt: '',
  openaiBaseUrl: DEFAULT_OPENAI_BASE_URL,
  openaiApiKey: 'sk-local',
  openaiModel: '',
  temperature: 0.7,
  maxTokens: 4096,
  ttsVoice: '',
};

function getInitialSettings(): Settings {
  const savedSettings = localStorage.getItem('nexus_settings');
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      return { ...DEFAULT_SETTINGS, ...parsed };
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

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [artifactIngestOpen, setArtifactIngestOpen] = useState(false);
  const [scopeCount, setScopeCount] = useState<number>(1);
  const [activeSecurityTab, setActiveSecurityTab] = useState<SecurityTab>(() => {
    try {
      const saved = localStorage.getItem('nexus_security_active_tab') as SecurityTab;
      if (saved) return saved;
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

  // Load scope count from storage
  const refreshScopeCount = () => {
    try {
      const raw = localStorage.getItem('nexus_security_scope');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const inScope = parsed.filter((item: any) => item.inScope !== false).length;
          setScopeCount(inScope);
          return;
        }
      }
    } catch {
      // fallback
    }
    setScopeCount(1);
  };

  useEffect(() => {
    refreshScopeCount();
    window.addEventListener('storage', refreshScopeCount);
    return () => window.removeEventListener('storage', refreshScopeCount);
  }, [activeSecurityTab]);

  const [securityInitialCode, setSecurityInitialCode] = useState<string | undefined>(undefined);
  const [securityInitialDecoderInput, setSecurityInitialDecoderInput] = useState<string | undefined>(undefined);

  const voice = useVoice();

  useEffect(() => {
    const handleOpenSecurity = (e: Event) => {
      const custom = e as CustomEvent<{ tab?: SecurityTab; code?: string; input?: string }>;
      if (custom.detail?.tab) {
        setActiveSecurityTab(custom.detail.tab);
      }
      if (custom.detail?.code) {
        setSecurityInitialCode(custom.detail.code);
      }
      if (custom.detail?.input) {
        setSecurityInitialDecoderInput(custom.detail.input);
      }
    };
    window.addEventListener('nexus:open-security', handleOpenSecurity);
    const handleOpenIngest = () => setArtifactIngestOpen(true);
    window.addEventListener('nexus:open-ingest', handleOpenIngest);
    return () => {
      window.removeEventListener('nexus:open-security', handleOpenSecurity);
      window.removeEventListener('nexus:open-ingest', handleOpenIngest);
    };
  }, []);

  const handleSendToAIFromSecurity = (prompt: string) => {
    setCopilotOpen(true);
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('nexus:send-ai-prompt', { detail: { prompt } })
      );
    }, 60);
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
          const parsed = JSON.parse(savedSettings);
          setSettings((prev) => ({ ...prev, ...parsed }));
          if (parsed.currentProjectId) {
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
    localStorage.setItem('nexus_settings', JSON.stringify({ ...updated, currentProjectId }));
  };

  useEffect(() => {
    if (currentProjectId) {
      try {
        const savedSettings = localStorage.getItem('nexus_settings');
        const parsed = savedSettings ? JSON.parse(savedSettings) : {};
        parsed.currentProjectId = currentProjectId;
        localStorage.setItem('nexus_settings', JSON.stringify(parsed));
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
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setCopilotOpen((prev) => !prev);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewChat();
      } else if (e.key === 'Escape') {
        if (commandPaletteOpen) setCommandPaletteOpen(false);
        if (artifactIngestOpen) setArtifactIngestOpen(false);
        if (settingsOpen) setSettingsOpen(false);
        if (confirmModal.isOpen) setConfirmModal((c) => ({ ...c, isOpen: false }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen, confirmModal.isOpen, commandPaletteOpen, artifactIngestOpen]);

  const confirmAction = (title: string, message: string, onConfirm: () => Promise<void>) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
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
      }
    );
  };

  const requestDeleteChat = (id: string) => {
    confirmAction(
      'Delete Conversation',
      'Are you sure you want to delete this chat history? This cannot be undone.',
      async () => {
        await db.deleteChat(id);
        if (currentChatId === id) setCurrentChatId(null);
        reloadChats();
        toast('success', 'Conversation deleted');
      }
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

  const reloadChats = async () => {
    const savedChats = await db.getChats();
    setChats(savedChats);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Top Header: Workbench Branding, Engagement Switcher, Scope Badge, ⌘K, Ingest, Copilot & Settings */}
      <WorkbenchHeader
        projects={projects}
        currentProjectId={currentProjectId}
        onSelectProject={(id) => {
          setCurrentProjectId(id);
          setCurrentChatId(null);
        }}
        onCreateProject={handleCreateProject}
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

      {/* Main Area: Security Workbench is 100% Core + Dockable Resizable Copilot Drawer */}
      <main style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <Group
          key={copilotOpen ? 'workbench-split' : 'workbench-full'}
          orientation="horizontal"
          style={{ width: '100%', height: '100%' }}
        >
          <Panel
            defaultSize={copilotOpen ? '70%' : '100%'}
            minSize="40%"
            style={{ height: '100%', overflow: 'hidden' }}
          >
            <SecurityCanvas
              activeTab={activeSecurityTab}
              onTabChange={setActiveSecurityTab}
              onSendToAI={handleSendToAIFromSecurity}
              initialCode={securityInitialCode}
              initialDecoderInput={securityInitialDecoderInput}
            />
          </Panel>

          {copilotOpen && (
            <>
              <Separator
                style={{
                  width: '5px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  cursor: 'col-resize',
                  transition: 'background 0.2s',
                  zIndex: 20,
                }}
              />
              <Panel
                defaultSize="30%"
                minSize="20%"
                maxSize="50%"
                style={{ height: '100%', overflow: 'hidden' }}
              >
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
                />
              </Panel>
            </>
          )}
        </Group>
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
    </div>
  );
}
