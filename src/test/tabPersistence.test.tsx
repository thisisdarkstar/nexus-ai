import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SecurityCanvas from '../components/security/SecurityCanvas';
import CopilotDrawer from '../components/copilot/CopilotDrawer';
import type { Settings, AvailableModel, VoiceHook, ProviderStatus, ChatEngineReturn } from '../types';

vi.mock('../hooks/useChatEngine', () => ({
  useChatEngine: (): ChatEngineReturn => {
    const [input, setInput] = useState('');
    const [chatSystemPrompt, setChatSystemPrompt] = useState('');
    const [showConvPrompt, setShowConvPrompt] = useState(false);

    return {
      messages: [],
      setMessages: vi.fn(),
      input,
      setInput,
      isGenerating: false,
      title: 'Test Persistence Thread',
      copiedIndex: null,
      isSttActive: false,
      speakingMessageIndex: null,
      isLoadingChat: false,
      chatSystemPrompt,
      setChatSystemPrompt,
      showConvPrompt,
      setShowConvPrompt,
      hasQueuedPrompt: false,
      queuedPromptDisplay: '',
      handleSend: vi.fn(async () => {}),
      handleStop: vi.fn(),
      handleRegenerate: vi.fn(async () => {}),
      handleEditMessage: vi.fn(),
      handleCopy: vi.fn(),
      handleExportChat: vi.fn(),
      handleSttToggle: vi.fn(),
      handleSpeakMessage: vi.fn(),
      handleRegenerateTitle: vi.fn(),
      handleSwitchBranch: vi.fn(),
      handleUndo: vi.fn(),
      handleRedo: vi.fn(),
      canUndo: false,
      canRedo: false,
      cancelQueue: vi.fn(),
    };
  },
}));

const mockSettings: Settings = {
  provider: 'openai',
  theme: 'dark',
  systemPrompt: '',
  openaiBaseUrl: 'http://127.0.0.1:11434/v1',
  openaiApiKey: 'sk-local',
  openaiModel: 'qwen2.5:0.5b',
  temperature: 0.7,
  maxTokens: 4096,
  contextWindow: 16384,
  ttsVoice: '',
};

const mockModels: AvailableModel[] = [
  { id: 'qwen2.5:0.5b' },
  { id: 'chimera-cyber:7b' },
];

const mockVoice: VoiceHook = {
  isListening: false,
  isSpeaking: false,
  transcript: '',
  interimTranscript: '',
  isSupported: false,
  availableVoices: [],
  setPreferredVoice: vi.fn(),
  startListening: vi.fn(),
  stopListening: vi.fn(),
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
  toggleListening: vi.fn(),
  isVoiceActive: false,
};

const mockProviderStatus: ProviderStatus = {
  state: 'ready',
  reason: null,
};

describe('Workbench & Copilot persistent tabs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps visited SecurityCanvas modules mounted and preserves edits across tab switches', async () => {
    const onTabChange = vi.fn();
    const { rerender } = render(
      <SecurityCanvas activeTab="auditor" onTabChange={onTabChange} />
    );

    const auditorTextarea = (await screen.findByPlaceholderText(
      /Paste source code to inspect/i,
      {},
      { timeout: 10000 }
    )) as HTMLTextAreaElement;

    fireEvent.change(auditorTextarea, {
      target: { value: '# PERSISTENT_AUDIT_DRAFT\nprint("ok")' },
    });
    expect(auditorTextarea.value).toBe('# PERSISTENT_AUDIT_DRAFT\nprint("ok")');

    // Switch to HTTP Studio
    rerender(<SecurityCanvas activeTab="http_studio" onTabChange={onTabChange} />);

    const httpTextarea = (await screen.findByPlaceholderText(
      /Paste raw HTTP request/i,
      {},
      { timeout: 10000 }
    )) as HTMLTextAreaElement;
    fireEvent.change(httpTextarea, {
      target: { value: 'GET /persistent HTTP/1.1\nHost: example.com' },
    });

    // Previous auditor module must stay mounted (hidden via display: none) with its state intact
    expect(auditorTextarea.isConnected).toBe(true);
    expect(auditorTextarea.value).toBe('# PERSISTENT_AUDIT_DRAFT\nprint("ok")');
    expect(auditorTextarea.closest('[aria-hidden="true"]')).not.toBeNull();

    // Switch back to SAST Audit
    rerender(<SecurityCanvas activeTab="auditor" onTabChange={onTabChange} />);

    await waitFor(() => {
      expect(auditorTextarea.closest('[aria-hidden="false"]')).not.toBeNull();
    });
    expect(auditorTextarea.value).toBe('# PERSISTENT_AUDIT_DRAFT\nprint("ok")');
    expect(httpTextarea.isConnected).toBe(true);
    expect(httpTextarea.value).toBe('GET /persistent HTTP/1.1\nHost: example.com');
  });

  it('keeps Copilot Chat and Arena panes mounted across internal tab switches and maximize toggles', () => {
    const props = {
      currentChatId: 'chat-1',
      setCurrentChatId: vi.fn(),
      chats: [],
      currentProjectId: 'default',
      providerStatus: mockProviderStatus,
      reloadChats: vi.fn(async () => {}),
      settings: mockSettings,
      onModelChange: vi.fn(),
      onSettingsChange: vi.fn(),
      availableModels: mockModels,
      voice: mockVoice,
      setVoiceOverlay: vi.fn(),
      activeSecurityTab: 'auditor' as const,
      onClose: vi.fn(),
      isMaximized: false,
      onToggleMaximize: vi.fn(),
    };

    const { rerender } = render(<CopilotDrawer {...props} />);

    const chatInput = screen.getByPlaceholderText(/Ask Copilot about SAST Audit/i) as HTMLTextAreaElement;
    fireEvent.change(chatInput, { target: { value: 'Persistent Chat Draft' } });
    expect(chatInput.value).toBe('Persistent Chat Draft');

    // Switch to Arena tab
    fireEvent.click(screen.getByRole('button', { name: /Arena/i }));

    const arenaPrompt = screen.getByPlaceholderText(/Broadcast a security prompt/i) as HTMLTextAreaElement;
    fireEvent.change(arenaPrompt, { target: { value: 'Persistent Arena Prompt' } });
    expect(arenaPrompt.value).toBe('Persistent Arena Prompt');
    expect(chatInput.isConnected).toBe(true);
    expect(chatInput.closest('[aria-hidden="true"]')).not.toBeNull();

    // Toggle maximize (Focus Studio) while on Arena
    rerender(<CopilotDrawer {...props} isMaximized={true} />);
    expect(arenaPrompt.isConnected).toBe(true);
    expect(arenaPrompt.value).toBe('Persistent Arena Prompt');
    expect(chatInput.value).toBe('Persistent Chat Draft');

    // Switch back to Chat tab
    fireEvent.click(screen.getByRole('button', { name: /^Chat$/i }));
    expect(chatInput.closest('[aria-hidden="false"]')).not.toBeNull();
    expect(chatInput.value).toBe('Persistent Chat Draft');
    expect(arenaPrompt.isConnected).toBe(true);
    expect(arenaPrompt.value).toBe('Persistent Arena Prompt');
  });
});
