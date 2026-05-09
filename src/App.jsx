import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import VoiceOverlay from './components/VoiceOverlay';
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
  const [settings, setSettings] = useState({ provider: 'chrome', theme: 'dark', systemPrompt: '', openaiBaseUrl: 'http://localhost:11434/v1', openaiApiKey: 'sk-local', openaiModel: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [availableModels, setAvailableModels] = useState([]);

  const [interactiveMode, setInteractiveMode] = useState(false);
  const [voiceOverlay, setVoiceOverlay] = useState({ active: false, type: null, text: '' });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const voice = useVoice();

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
  }, [settings.provider, settings.openaiBaseUrl, settings.openaiApiKey]);

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
      chat.title = newTitle;
      await db.saveChat(chat);
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
          for (const c of allChats) {
              if (c.projectId === id) {
                  await db.deleteChat(c.id);
              }
          }
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

  return (
    <>
      <Sidebar 
        chats={chats.filter(c => (c.projectId || 'default') === currentProjectId)} 
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
        />
      )}

      {confirmModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--sidebar-glass)', backdropFilter: 'blur(24px)', width: '400px', borderRadius: '24px', border: '1px solid var(--sidebar-border)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>{confirmModal.title}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button 
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                style={{ padding: '10px 20px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--card-border)', borderRadius: '12px', cursor: 'pointer', fontWeight: 500 }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                Cancel
              </button>
              <button 
                onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, isOpen: false }); }}
                style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 500, boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
