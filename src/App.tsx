import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import {
  Group,
  Panel,
  Separator,
  type PanelImperativeHandle,
} from 'react-resizable-panels';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SecurityCanvas from './components/security/SecurityCanvas';
import VoiceOverlay from './components/VoiceOverlay';
import ConfirmModal from './components/ConfirmModal';
import MindmapFloatingButton from './components/mindmap/MindmapFloatingButton';
import MindmapStudio from './components/mindmap/MindmapStudio';
import { ToastProvider, useToast } from './lib/toast';
import { useVoice } from './hooks/useVoice';
import { db } from './lib/db';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [securityWorkbenchOpen, setSecurityWorkbenchOpen] = useState(false);
  const [activeSecurityTab, setActiveSecurityTab] = useState<SecurityTab>(() => {
    try {
      const saved = localStorage.getItem('nexus_security_active_tab') as SecurityTab;
      if (saved) return saved;
    } catch {
      // fallback
    }
    return 'reports';
  });

  useEffect(() => {
    try {
      localStorage.setItem('nexus_security_active_tab', activeSecurityTab);
    } catch (e) {
      console.error(e);
    }
  }, [activeSecurityTab]);

  const [securityInitialCode, setSecurityInitialCode] = useState<string | undefined>(undefined);
  const [securityInitialDecoderInput, setSecurityInitialDecoderInput] = useState<string | undefined>(undefined);
  // Increments on every nexus:open-security dispatch so re-opening the identical
  // code block still propagates (React skips effects when values are equal).
  const [securityPayloadNonce, setSecurityPayloadNonce] = useState(0);
  const [mindmapOpen, setMindmapOpen] = useState(false);

  // The workbench panel stays mounted at all times; closing it collapses the
  // panel instead of unmounting SecurityCanvas so tool state is preserved.
  const chatPanelRef = useRef<PanelImperativeHandle>(null);
  const workbenchPanelRef = useRef<PanelImperativeHandle>(null);

  useEffect(() => {
    const chat = chatPanelRef.current;
    const workbench = workbenchPanelRef.current;
    if (!chat || !workbench) return;
    if (securityWorkbenchOpen) {
      workbench.expand();
      chat.resize('45%');
    } else {
      workbench.collapse();
      chat.resize('100%');
    }
  }, [securityWorkbenchOpen]);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setMindmapOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

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
      setSecurityPayloadNonce((n) => n + 1);
      setSecurityWorkbenchOpen(true);
    };
    window.addEventListener('nexus:open-security', handleOpenSecurity);
    return () => window.removeEventListener('nexus:open-security', handleOpenSecurity);
  }, []);

  const handleSendToAIFromSecurity = (prompt: string) => {
    window.dispatchEvent(
      new CustomEvent('nexus:send-ai-prompt', { detail: { prompt } })
    );
  };

  useEffect(() => {
    voice.setPreferredVoice(settings.ttsVoice || '');
  }, [settings.ttsVoice]);

  useEffect(() => {
    async function init() {
      await db.init();

      let savedProjects = await db.getProjects();
      if (savedProjects.length === 0) {
        const defaultProj: Project = {
          id: 'default',
          name: 'Default Workspace',
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

  const handleNewChat = () => setCurrentChatId(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNewChat();
      }
      if (e.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false);
        if (confirmModal.isOpen) setConfirmModal((c) => ({ ...c, isOpen: false }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen, confirmModal.isOpen]);

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

  const handleRenameChat = async (id: string, newTitle: string) => {
    const savedChats = await db.getChats();
    const chat = savedChats.find((c) => c.id === id);
    if (chat) {
      await db.saveChat({ ...chat, title: newTitle });
      reloadChats();
    }
  };

  const handlePinChat = async (id: string) => {
    const savedChats = await db.getChats();
    const chat = savedChats.find((c) => c.id === id);
    if (chat) {
      await db.saveChat({ ...chat, pinned: !chat.pinned });
      reloadChats();
    }
  };

  const handleUpdateChatTags = async (id: string, tags: string[]) => {
    const savedChats = await db.getChats();
    const chat = savedChats.find((c) => c.id === id);
    if (chat) {
      await db.saveChat({ ...chat, tags });
      reloadChats();
    }
  };

  const handleCreateProject = async (name: string) => {
    const newProj: Project = { id: Date.now().toString(), name, createdAt: Date.now() };
    await db.saveProject(newProj);
    setProjects(await db.getProjects());
    setCurrentProjectId(newProj.id);
    setCurrentChatId(null);
    toast('success', `Workspace "${name}" created`);
  };

  const handleDeleteProject = async (id: string) => {
    if (id === 'default') return;
    confirmAction(
      'Delete Workspace',
      'Are you sure you want to delete this workspace and all its chats? This cannot be undone.',
      async () => {
        await db.deleteProject(id);
        const allChats = await db.getChats();
        await Promise.all(
          allChats.filter((c) => c.workspaceId === id).map((c) => db.deleteChat(c.id))
        );
        setProjects(await db.getProjects());
        setCurrentProjectId('default');
        setCurrentChatId(null);
        reloadChats();
        toast('success', 'Workspace deleted');
      }
    );
  };

  const handleRenameProject = async (id: string, newName: string) => {
    const proj = projects.find((p) => p.id === id);
    if (proj) {
      const updated = { ...proj, name: newName };
      await db.saveProject(updated);
      setProjects(await db.getProjects());
    }
  };

  const reloadChats = async () => {
    const savedChats = await db.getChats();
    setChats(savedChats);
  };

  const projectChats = useMemo(
    () => chats.filter((c) => (c.workspaceId || 'default') === currentProjectId),
    [chats, currentProjectId]
  );

  return (
    <>
      <Sidebar
        chats={projectChats}
        projects={projects}
        currentProjectId={currentProjectId}
        onSelectProject={(id) => {
          setCurrentProjectId(id);
          setCurrentChatId(null);
        }}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
        currentChatId={currentChatId}
        onSelectChat={setCurrentChatId}
        onNewChat={handleNewChat}
        onOpenSettings={() => setSettingsOpen(true)}
        onDeleteChat={requestDeleteChat}
        onRenameChat={handleRenameChat}
        onPinChat={handlePinChat}
        onUpdateChatTags={handleUpdateChatTags}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div style={{ flex: 1, display: 'flex', height: '100vh', overflow: 'hidden', minWidth: 0 }}>
        <Group orientation="horizontal" style={{ width: '100%', height: '100%' }}>
          <Panel
            panelRef={chatPanelRef}
            defaultSize={securityWorkbenchOpen ? '45%' : '100%'}
            minSize="30%"
            style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <ChatArea
              currentChatId={currentChatId}
              setCurrentChatId={setCurrentChatId}
              currentProjectId={currentProjectId}
              providerStatus={providerStatus}
              reloadChats={reloadChats}
              settings={settings}
              availableModels={availableModels}
              onModelChange={(p, m) => {
                if (settings.provider !== p || (p === 'openai' && settings.openaiModel !== m)) {
                  saveSettings({ provider: p as Settings['provider'], openaiModel: m });
                }
              }}
              voice={voice}
              setVoiceOverlay={setVoiceOverlay}
              onToggleSecurityWorkbench={() => setSecurityWorkbenchOpen(!securityWorkbenchOpen)}
              securityWorkbenchOpen={securityWorkbenchOpen}
            />
          </Panel>

          <Separator
            style={{
              width: '5px',
              background: 'rgba(255, 255, 255, 0.05)',
              cursor: 'col-resize',
              transition: 'background 0.2s',
              zIndex: 20,
              display: securityWorkbenchOpen ? undefined : 'none',
            }}
          />
          <Panel
            panelRef={workbenchPanelRef}
            defaultSize="55%"
            minSize="32%"
            collapsible
            collapsedSize={0}
            style={{ height: '100%', overflow: 'hidden' }}
          >
            <div
              className="nexus-workbench-content"
              style={{
                height: '100%',
                overflow: 'hidden',
                display: securityWorkbenchOpen ? undefined : 'none',
              }}
            >
              <SecurityCanvas
                activeTab={activeSecurityTab}
                onTabChange={setActiveSecurityTab}
                onClose={() => setSecurityWorkbenchOpen(false)}
                onSendToAI={handleSendToAIFromSecurity}
                initialCode={securityInitialCode}
                initialDecoderInput={securityInitialDecoderInput}
                payloadNonce={securityPayloadNonce}
              />
            </div>
          </Panel>
        </Group>
      </div>
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
            onImportResult={(success, message) => {
              toast(success ? 'success' : 'error', message);
            }}
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

      {/* Floating Mindmap Trigger & Studio Canvas */}
      <MindmapFloatingButton
        onClick={() => setMindmapOpen(true)}
        isOpen={mindmapOpen}
      />
      <MindmapStudio
        isOpen={mindmapOpen}
        onClose={() => setMindmapOpen(false)}
      />
    </>
  );
}
