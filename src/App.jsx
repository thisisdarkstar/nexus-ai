import { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import VoiceOverlay from './components/VoiceOverlay';
import ConfirmModal from './components/ConfirmModal';
import { useVoice } from './hooks/useVoice';
import { db } from './lib/db';
import { providerManager } from './lib/providers/ProviderManager';

export default function App() {
  const [chats, setChats] = useState([]);
  const [projects, setProjects] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState('default');
  const [currentChatId, setCurrentChatId] = useState(null);
  const [providerStatus, setProviderStatus] = useState({ state: 'checking', reason: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ provider: 'chrome', theme: 'dark', systemPrompt: '', openaiBaseUrl: 'http://localhost:11434/v1', openaiApiKey: 'sk-local', openaiModel: '', temperature: 0.7, maxTokens: 2048, ttsVoice: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [availableModels, setAvailableModels] = useState([]);

  const [interactiveMode, setInteractiveMode] = useState(false);
  const [voiceOverlay, setVoiceOverlay] = useState({ active: false, type: null, text: '' });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const voice = useVoice();

  useEffect(() => {
    voice.setPreferredVoice(settings.ttsVoice || '');
  }, [settings.ttsVoice]);

  useEffect(() => {
    async function init() {
      await db.init();
      
      let savedProjects = await db.getProjects();
      if (savedProjects.length === 0) {
          const defaultProj = { id: 'default', name: 'Default Workspace', createdAt: Date.now() };
          await db.saveProject(defaultProj);
          savedProjects = [defaultProj];
      }
      setProjects(savedProjects);

      const savedChats = await db.getChats();
      setChats(savedChats);
      
      const savedSettings = localStorage.getItem('nexus_settings');
      if (savedSettings) {
         const parsed = JSON.parse(savedSettings);
         setSettings(prev => ({ ...prev, ...parsed }));
         if (parsed.currentProjectId) {
             setCurrentProjectId(parsed.currentProjectId);
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
        return;
      }
      const status = await provider.checkAvailability();
      if (status.available) {
        setProviderStatus({ state: 'ready', reason: null });
      } else {
        setProviderStatus({ state: 'error', reason: status.reason });
      }

      // Always try to fetch available models if OpenAI is configured, 
      // even if we are currently using Gemini Nano.
      const models = await providerManager.fetchAvailableModels();
      if (models && models.length > 0) {
          setAvailableModels(models);
      }
    }
    checkProvider();
  }, [settings.provider, settings.openaiBaseUrl, settings.openaiApiKey, settings.openaiModel]);

  const saveSettings = (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('nexus_settings', JSON.stringify({ ...updated, currentProjectId }));
  };

  useEffect(() => {
      if (currentProjectId) {
          const savedSettings = localStorage.getItem('nexus_settings');
          const parsed = savedSettings ? JSON.parse(savedSettings) : {};
          parsed.currentProjectId = currentProjectId;
          localStorage.setItem('nexus_settings', JSON.stringify(parsed));
      }
  }, [currentProjectId]);

  const handleNewChat = () => setCurrentChatId(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNewChat();
      }
      if (e.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false);
        if (confirmModal.isOpen) setConfirmModal(c => ({ ...c, isOpen: false }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen, confirmModal.isOpen]);

  const confirmAction = (title, message, onConfirm) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };

  const handleDeleteAll = () => {
    confirmAction(
      "Wipe All Conversations", 
      "Are you sure you want to permanently delete all your chats? This action cannot be undone.",
      async () => {
        await db.clearAll();
        setChats([]);
        setCurrentChatId(null);
      }
    );
  };

  const requestDeleteChat = (id) => {
    confirmAction(
      "Delete Conversation",
      "Are you sure you want to delete this chat history? This cannot be undone.",
      async () => {
        await db.deleteChat(id);
        if (currentChatId === id) setCurrentChatId(null);
        reloadChats();
      }
    );
  };

  const handleRenameChat = async (id, newTitle) => {
    const savedChats = await db.getChats();
    const chat = savedChats.find(c => c.id === id);
    if (chat) {
      await db.saveChat({ ...chat, title: newTitle });
      reloadChats();
    }
  };

  const handleCreateProject = async (name) => {
      const newProj = { id: Date.now().toString(), name, createdAt: Date.now() };
      await db.saveProject(newProj);
      setProjects(await db.getProjects());
      setCurrentProjectId(newProj.id);
      setCurrentChatId(null);
  };

  const handleDeleteProject = async (id) => {
      if (id === 'default') return;
      confirmAction(
        "Delete Workspace",
        "Are you sure you want to delete this workspace and all its chats? This cannot be undone.",
        async () => {
          await db.deleteProject(id);
          const allChats = await db.getChats();
          await Promise.all(
              allChats.filter(c => c.projectId === id).map(c => db.deleteChat(c.id))
          );
          setProjects(await db.getProjects());
          setCurrentProjectId('default');
          setCurrentChatId(null);
          reloadChats();
        }
      );
  };
  
  const handleRenameProject = async (id, newName) => {
      const proj = projects.find(p => p.id === id);
      if (proj) {
          proj.name = newName;
          await db.saveProject(proj);
          setProjects(await db.getProjects());
      }
  };

  const reloadChats = async () => {
    const savedChats = await db.getChats();
    setChats(savedChats);
  };

  const projectChats = useMemo(
    () => chats.filter(c => (c.projectId || 'default') === currentProjectId),
    [chats, currentProjectId]
  );

  return (
    <>
      <Sidebar
        chats={projectChats}
        projects={projects}
        currentProjectId={currentProjectId}
        onSelectProject={(id) => { setCurrentProjectId(id); setCurrentChatId(null); }}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
        currentChatId={currentChatId} 
        onSelectChat={setCurrentChatId} 
        onNewChat={handleNewChat}
        onOpenSettings={() => setSettingsOpen(true)}
        onDeleteChat={requestDeleteChat}
        onRenameChat={handleRenameChat}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
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
                saveSettings({ provider: p, openaiModel: m });
            }
        }}
        voice={voice}
        interactiveMode={interactiveMode}
        setInteractiveMode={setInteractiveMode}
        setVoiceOverlay={setVoiceOverlay}
      />
      <VoiceOverlay 
        isActive={voiceOverlay.active}
        type={voiceOverlay.type}
        text={voiceOverlay.text}
        transcript={voiceOverlay.type === 'stt' ? (voice.interimTranscript || voice.transcript) : ''}
        onClose={() => {
          if (voice.isListening) voice.stopListening();
          if (voice.isSpeaking) voice.stopSpeaking();
          setVoiceOverlay({ active: false, type: null, text: '' });
        }}
      />
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={saveSettings}
          onClose={() => setSettingsOpen(false)}
          onClearChats={handleDeleteAll}
          reloadChats={reloadChats}
          availableVoices={voice.availableVoices}
        />
      )}

      {confirmModal.isOpen && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={() => { confirmModal.onConfirm(); setConfirmModal(c => ({ ...c, isOpen: false })); }}
          onCancel={() => setConfirmModal(c => ({ ...c, isOpen: false }))}
        />
      )}
    </>
  );
}
