import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { db } from '../lib/db';
import { providerManager } from '../lib/providers/ProviderManager';
import { estimateTokens } from '../lib/tokens';
import { useUndoRedo } from '../lib/useUndoRedo';
import type {
  Message,
  Chat,
  Settings,
  VoiceHook,
  VoiceOverlayState,
  ChatEngineReturn,
} from '../types';

interface UseChatEngineParams {
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  currentProjectId: string;
  settings: Settings;
  reloadChats: () => Promise<void>;
  voice: VoiceHook;
  setVoiceOverlay: (overlay: VoiceOverlayState) => void;
  onModelChange: (provider: string, model: string) => void;
}

export function useChatEngine({
  currentChatId,
  setCurrentChatId,
  currentProjectId,
  settings,
  reloadChats,
  voice,
  setVoiceOverlay,
  onModelChange,
}: UseChatEngineParams): ChatEngineReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [title, setTitle] = useState('New Conversation');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [chatSystemPrompt, setChatSystemPrompt] = useState('');
  const [showConvPrompt, setShowConvPrompt] = useState(false);
  const [hasQueuedPrompt, setHasQueuedPrompt] = useState(false);
  const [queuedPromptDisplay, setQueuedPromptDisplay] = useState('');

  const undoRedo = useUndoRedo();

  const handleUndo = useCallback(() => {
    const prev = undoRedo.undo(messages);
    if (prev) setMessages(prev);
  }, [undoRedo, messages]);

  const handleRedo = useCallback(() => {
    const next = undoRedo.redo(messages);
    if (next) setMessages(next);
  }, [undoRedo, messages]);

  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const queuedPromptRef = useRef('');
  const handleSendRef = useRef<((textOverride?: string) => Promise<void>) | null>(null);
  const skipNextLoadRef = useRef(false);

  useEffect(() => {
    async function loadChat() {
      if (skipNextLoadRef.current) {
        skipNextLoadRef.current = false;
        return;
      }
      if (currentChatId) {
        setIsLoadingChat(true);
        const chats = await db.getChats();
        const chat = chats.find((c) => c.id === currentChatId);
        if (chat) {
          setMessages(chat.messages || []);
          setTitle(chat.title);
          setChatSystemPrompt(chat.systemPrompt || '');
          if (chat.provider && onModelChange) onModelChange(chat.provider, chat.model || '');
        }
        setIsLoadingChat(false);
      } else {
        setMessages([]);
        setTitle('New Conversation');
        setChatSystemPrompt('');
      }
    }
    loadChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChatId]);

  const handleExportChat = () => {
    if (!messages.length) return;
    let markdown = `# ${title}\n\n`;
    for (const msg of messages) {
      markdown += `### ${msg.role === 'user' ? 'User' : 'Assistant'}\n${msg.content}\n\n`;
    }
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleEditMessage = (index: number) => {
    if (isGenerating) return;
    const msg = messages[index];
    if (msg.role !== 'user') return;
    undoRedo.pushSnapshot(messages);
    setInput(msg.content);
    setMessages(messages.slice(0, index));
  };

  const handleRegenerate = async (
    index: number,
    retryProvider: string | null = null,
    retryModel: string | null = null
  ) => {
    if (isGenerating) return;
    const msg = messages[index];
    if (msg.role !== 'ai') return;

    const originalProviderId = providerManager.currentProviderId;
    const openai = providerManager.providers['openai'] as unknown as { model: string } | undefined;
    const originalOpenAIModel = openai?.model;

    if (retryProvider) {
      providerManager.setProvider(retryProvider);
      if (retryProvider === 'openai' && retryModel && openai) {
        openai.model = retryModel;
      }
    }

    const history = messages.slice(0, index);
    undoRedo.pushSnapshot(messages);
    const oldMsg = messages[index];
    const effectiveSystemPrompt = chatSystemPrompt.trim() || settings.systemPrompt;
    const providerOptions = { temperature: settings.temperature, maxTokens: settings.maxTokens };
    setIsGenerating(true);
    stopRef.current = false;
    abortRef.current = new AbortController();
    const startTime = Date.now();

    const existingBranches = oldMsg.branches || [];
    const branchIndex = existingBranches.length;
    const newBranch = { ...oldMsg, branches: undefined, branchIndex: undefined };
    const newMsg: Message = {
      role: 'ai',
      content: '',
      branches: [...existingBranches, newBranch],
      branchIndex: branchIndex + 1,
    };
    setMessages([...history, newMsg]);

    let accumulated = '';
    try {
      const provider = providerManager.getProvider();
      if (!provider) throw new Error('No provider available');
      const stream = provider.streamPrompt(
        history,
        effectiveSystemPrompt,
        abortRef.current.signal,
        providerOptions
      );
      for await (const delta of stream) {
        if (stopRef.current) break;
        accumulated += delta;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: accumulated };
          return updated;
        });
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        accumulated = e.message;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: accumulated, error: true };
          return updated;
        });
      }
    } finally {
      if (retryProvider) {
        providerManager.setProvider(originalProviderId || '');
        if (originalOpenAIModel !== undefined && openai) {
          openai.model = originalOpenAIModel;
        }
      }
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const finalMessages: Message[] = [
        ...history,
        {
          role: 'ai',
          content: accumulated,
          generationTime: duration,
          tokens: estimateTokens(accumulated),
          createdAt: Date.now(),
        },
      ];
      setMessages(finalMessages);
      setIsGenerating(false);
      db.saveChat({
        id: currentChatId || '',
        workspaceId: currentProjectId || 'default',
        title,
        messages: finalMessages,
        systemPrompt: chatSystemPrompt,
        provider: settings.provider,
        model: settings.provider === 'openai' ? settings.openaiModel : 'Gemini Nano',
        updatedAt: Date.now(),
      } as Chat).then(() => reloadChats()).catch((err) => console.error('Failed to save chat:', err));
    }
  };

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride !== undefined ? textOverride : input).trim();
    if (!text) return;

    if (isGenerating && textOverride === undefined) {
      queuedPromptRef.current = text;
      setHasQueuedPrompt(true);
      setQueuedPromptDisplay(text);
      setInput('');
      return;
    }

    if (textOverride === undefined) setInput('');
    undoRedo.pushSnapshot(messages);
    setIsGenerating(true);
    stopRef.current = false;
    abortRef.current = new AbortController();
    const startTime = Date.now();

    const sessionChatId = currentChatId || Date.now().toString();
    const isNewChat = !currentChatId;
    const effectiveSystemPrompt = chatSystemPrompt.trim() || settings.systemPrompt;
    const providerOptions = { temperature: settings.temperature, maxTokens: settings.maxTokens };

    const history: Message[] = [
      ...messages,
      { role: 'user', content: text, createdAt: Date.now() },
    ];
    const chatTitle =
      history.length === 1 ? text.substring(0, 30) + (text.length > 30 ? '...' : '') : title;
    if (history.length === 1) setTitle(chatTitle);

    setMessages([...history, { role: 'ai', content: '' }]);

    let accumulated = '';
    let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      const provider = providerManager.getProvider();
      if (!provider) throw new Error('No provider available');
      const stream = provider.streamPrompt(
        history,
        effectiveSystemPrompt,
        abortRef.current.signal,
        providerOptions
      );
      for await (const delta of stream) {
        if (stopRef.current) break;
        accumulated += delta;
        setMessages((prev) => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: accumulated };
          return newMsgs;
        });
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => {
          if (accumulated) {
            db.saveChat({
              id: sessionChatId,
              workspaceId: currentProjectId || 'default',
              title: chatTitle,
              messages: [...history, { role: 'ai', content: accumulated }],
              systemPrompt: chatSystemPrompt,
              provider: settings.provider,
              model: settings.provider === 'openai' ? settings.openaiModel : 'Gemini Nano',
              updatedAt: Date.now(),
            } as Chat).catch((err) => console.error('Autosave failed:', err));
          }
        }, 4000);
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        accumulated = e.message;
        setMessages((prev) => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: accumulated, error: true };
          return newMsgs;
        });
      }
    } finally {
      clearTimeout(autosaveTimer);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const finalMessages: Message[] = [
        ...history,
        {
          role: 'ai',
          content: accumulated,
          generationTime: duration,
          tokens: estimateTokens(accumulated),
          createdAt: Date.now(),
        },
      ];
      setMessages(finalMessages);
      setIsGenerating(false);

      if (isNewChat) {
        skipNextLoadRef.current = true;
        setCurrentChatId(sessionChatId);
      }
      db.saveChat({
        id: sessionChatId,
        workspaceId: currentProjectId || 'default',
        title: chatTitle,
        messages: finalMessages,
        systemPrompt: chatSystemPrompt,
        provider: settings.provider,
        model: settings.provider === 'openai' ? settings.openaiModel : 'Gemini Nano',
        updatedAt: Date.now(),
      } as Chat).then(() => reloadChats()).catch((err) => console.error('Failed to save chat:', err));

      if (finalMessages.length === 2) {
        handleRegenerateTitle(finalMessages);
      }
    }
  };

  useLayoutEffect(() => {
    handleSendRef.current = handleSend;
  });

  useEffect(() => {
    if (!isGenerating && queuedPromptRef.current) {
      const queued = queuedPromptRef.current;
      queuedPromptRef.current = '';
      setHasQueuedPrompt(false);
      setQueuedPromptDisplay('');
      handleSendRef.current?.(queued);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating]);

  const handleStop = () => {
    stopRef.current = true;
    abortRef.current?.abort();
    setIsGenerating(false);
  };

  const cancelQueue = () => {
    queuedPromptRef.current = '';
    setHasQueuedPrompt(false);
    setQueuedPromptDisplay('');
  };

  const handleRegenerateTitle = async (currentMessages: Message[]) => {
    if (currentMessages.length < 2 || isGenerating) return;
    const snippet = currentMessages
      .slice(0, 4)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 200)}`)
      .join('\n');
    const titleMessages: Message[] = [
      {
        role: 'user',
        content: `Generate a short, concise title (4-8 words) for this conversation. Reply with ONLY the title, no quotes, no extra text:\n\n${snippet}`,
      },
    ];
    try {
      const provider = providerManager.getProvider();
      if (!provider) return;
      let generated = '';
      const stream = provider.streamPrompt(titleMessages, 'You generate concise chat titles.', null, {
        temperature: 0.3,
        maxTokens: 30,
      });
      for await (const delta of stream) {
        generated += delta;
      }
      const newTitle = generated.replace(/["'\n]/g, '').trim();
      if (newTitle && newTitle.length > 2 && newTitle.length < 60) {
        setTitle(newTitle);
        if (currentChatId) {
          const savedChats = await db.getChats();
          const chat = savedChats.find((c) => c.id === currentChatId);
          if (chat) {
            await db.saveChat({ ...chat, title: newTitle }).catch(() => {});
            reloadChats();
          }
        }
      }
    } catch {
      // silently fail - title stays as-is
    }
  };

  const isSttActive = voice?.isListening ?? false;

  const handleSttToggle = () => {
    if (!voice?.isSupported) return;
    if (voice.isListening) {
      voice.stopListening();
      setVoiceOverlay({ active: false, type: null, text: '' });
    } else {
      setVoiceOverlay({ active: true, type: 'stt', text: '' });
      voice.startListening((transcript: string) => {
        setInput((prev) => prev + (prev ? ' ' : '') + transcript);
      });
    }
  };

  const handleSpeakMessage = (text: string, index: number) => {
    if (!voice) return;
    if (voice.isSpeaking && speakingMessageIndex === index) {
      voice.stopSpeaking();
      setSpeakingMessageIndex(null);
      setVoiceOverlay({ active: false, type: null, text: '' });
    } else {
      setSpeakingMessageIndex(index);
      setVoiceOverlay({ active: true, type: 'tts', text });
      voice.speak(text, () => {
        setSpeakingMessageIndex(null);
        setVoiceOverlay({ active: false, type: null, text: '' });
      });
    }
  };

  const handleSwitchBranch = (messageIndex: number, direction: 'prev' | 'next') => {
    setMessages((prev) => {
      const msg = prev[messageIndex];
      if (!msg || !msg.branches || msg.branches.length === 0) return prev;

      const currentIdx = msg.branchIndex ?? msg.branches.length;
      const newIdx = direction === 'prev' ? currentIdx - 1 : currentIdx + 1;

      if (newIdx < 0 || newIdx > msg.branches.length) return prev;

      const updated = [...prev];
      if (newIdx === msg.branches.length) {
        updated[messageIndex] = { ...msg, branchIndex: newIdx };
      } else {
        const branch = msg.branches[newIdx];
        updated[messageIndex] = {
          ...branch,
          branches: msg.branches,
          branchIndex: newIdx,
        };
      }
      return updated;
    });
  };

  return {
    messages,
    input,
    setInput,
    isGenerating,
    title,
    copiedIndex,
    isSttActive,
    speakingMessageIndex,
    isLoadingChat,
    chatSystemPrompt,
    setChatSystemPrompt,
    showConvPrompt,
    setShowConvPrompt,
    hasQueuedPrompt,
    queuedPromptDisplay,
    handleSend,
    handleStop,
    handleRegenerate,
    handleEditMessage,
    handleCopy,
    handleExportChat,
    handleSttToggle,
    handleSpeakMessage,
    handleRegenerateTitle,
    handleSwitchBranch,
    handleUndo,
    handleRedo,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
    cancelQueue,
  };
}
