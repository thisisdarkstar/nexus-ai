import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { db } from '../lib/db';
import { providerManager } from '../lib/providers/ProviderManager';

export function useChatEngine({
  currentChatId,
  setCurrentChatId,
  currentProjectId,
  settings,
  reloadChats,
  voice,
  interactiveMode,
  setVoiceOverlay,
  onModelChange,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [title, setTitle] = useState('New Conversation');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [chatSystemPrompt, setChatSystemPrompt] = useState('');
  const [showConvPrompt, setShowConvPrompt] = useState(false);
  const [hasQueuedPrompt, setHasQueuedPrompt] = useState(false);
  const [queuedPromptDisplay, setQueuedPromptDisplay] = useState('');

  const stopRef = useRef(false);
  const abortRef = useRef(null);
  const queuedPromptRef = useRef('');
  const handleSendRef = useRef(null);
  const skipNextLoadRef = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    async function loadChat() {
      if (skipNextLoadRef.current) {
        skipNextLoadRef.current = false;
        return;
      }
      if (currentChatId) {
        setIsLoadingChat(true);
        const chats = await db.getChats();
        const chat = chats.find(c => c.id === currentChatId);
        if (chat) {
          setMessages(chat.messages || []);
          setTitle(chat.title);
          setChatSystemPrompt(chat.systemPrompt || '');
          setShowConvPrompt(false);
          if (chat.provider && onModelChange) onModelChange(chat.provider, chat.model);
        }
        setIsLoadingChat(false);
      } else {
        setMessages([]);
        setTitle('New Conversation');
        setChatSystemPrompt('');
        setShowConvPrompt(false);
      }
    }
    loadChat();
  }, [currentChatId]); // onModelChange omitted intentionally — changes every render

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

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleEditMessage = (index) => {
    if (isGenerating) return;
    const msg = messages[index];
    if (msg.role !== 'user') return;
    setInput(msg.content);
    setMessages(messages.slice(0, index));
  };

  const handleRegenerate = async (index, retryProvider = null, retryModel = null) => {
    if (isGenerating) return;
    const msg = messages[index];
    if (msg.role !== 'ai') return;

    const originalProviderId = providerManager.currentProviderId;
    const originalOpenAIModel = providerManager.providers['openai']?.model;
    if (retryProvider) {
      providerManager.setProvider(retryProvider);
      if (retryProvider === 'openai' && retryModel) {
        providerManager.providers['openai'].model = retryModel;
      }
    }

    const history = messages.slice(0, index);
    const effectiveSystemPrompt = chatSystemPrompt.trim() || settings.systemPrompt;
    const providerOptions = { temperature: settings.temperature, maxTokens: settings.maxTokens };
    setIsGenerating(true);
    stopRef.current = false;
    abortRef.current = new AbortController();
    const startTime = Date.now();
    setMessages([...history, { role: 'ai', content: '' }]);

    let accumulated = '';
    try {
      const provider = providerManager.getProvider();
      const stream = provider.streamPrompt(history, effectiveSystemPrompt, abortRef.current.signal, providerOptions);
      for await (const delta of stream) {
        if (stopRef.current) break;
        accumulated += delta;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: accumulated };
          return updated;
        });
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        accumulated = `**Error:** ${e.message}`;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: accumulated };
          return updated;
        });
      }
    } finally {
      if (retryProvider) {
        providerManager.setProvider(originalProviderId);
        if (originalOpenAIModel !== undefined) {
          providerManager.providers['openai'].model = originalOpenAIModel;
        }
      }
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const finalMessages = [
        ...history,
        { role: 'ai', content: accumulated, generationTime: duration, createdAt: Date.now() }
      ];
      setMessages(finalMessages);
      setIsGenerating(false);
      db.saveChat({
        id: currentChatId,
        projectId: currentProjectId || 'default',
        title,
        messages: finalMessages,
        systemPrompt: chatSystemPrompt,
        provider: settings.provider,
        model: settings.provider === 'openai' ? settings.openaiModel : 'Gemini Nano',
        updatedAt: Date.now()
      }).then(() => reloadChats());
    }
  };

  const handleSend = async (textOverride) => {
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
    setIsGenerating(true);
    stopRef.current = false;
    abortRef.current = new AbortController();
    const startTime = Date.now();

    const sessionChatId = currentChatId || Date.now().toString();
    const isNewChat = !currentChatId;
    const effectiveSystemPrompt = chatSystemPrompt.trim() || settings.systemPrompt;
    const providerOptions = { temperature: settings.temperature, maxTokens: settings.maxTokens };

    const history = [...messages, { role: 'user', content: text, createdAt: Date.now() }];
    const chatTitle = history.length === 1
      ? text.substring(0, 30) + (text.length > 30 ? '...' : '')
      : title;
    if (history.length === 1) setTitle(chatTitle);

    setMessages([...history, { role: 'ai', content: '' }]);

    let accumulated = '';
    let autosaveTimer = null;

    try {
      const provider = providerManager.getProvider();
      const stream = provider.streamPrompt(history, effectiveSystemPrompt, abortRef.current.signal, providerOptions);
      for await (const delta of stream) {
        if (stopRef.current) break;
        accumulated += delta;
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: accumulated };
          return newMsgs;
        });
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => {
          if (accumulated) {
            db.saveChat({
              id: sessionChatId,
              projectId: currentProjectId || 'default',
              title: chatTitle,
              messages: [...history, { role: 'ai', content: accumulated }],
              systemPrompt: chatSystemPrompt,
              provider: settings.provider,
              model: settings.provider === 'openai' ? settings.openaiModel : 'Gemini Nano',
              updatedAt: Date.now()
            });
          }
        }, 4000);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        accumulated = `**Error:** ${e.message}`;
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: accumulated };
          return newMsgs;
        });
      }
    } finally {
      clearTimeout(autosaveTimer);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const finalMessages = [
        ...history,
        { role: 'ai', content: accumulated, generationTime: duration, createdAt: Date.now() }
      ];
      setMessages(finalMessages);
      setIsGenerating(false);

      if (isNewChat) {
        skipNextLoadRef.current = true;
        setCurrentChatId(sessionChatId);
      }
      db.saveChat({
        id: sessionChatId,
        projectId: currentProjectId || 'default',
        title: chatTitle,
        messages: finalMessages,
        systemPrompt: chatSystemPrompt,
        provider: settings.provider,
        model: settings.provider === 'openai' ? settings.openaiModel : 'Gemini Nano',
        updatedAt: Date.now()
      }).then(() => reloadChats());

      if (interactiveMode && voice && setVoiceOverlay) {
        const plainText = accumulated.replace(/[#*_`[\]()]/g, '').replace(/\n/g, ' ').trim();
        if (plainText.length > 10) {
          setVoiceOverlay({ active: true, type: 'tts', text: plainText });
          voice.speak(plainText, () => setVoiceOverlay({ active: false, type: null, text: '' }));
        }
      }
    }
  };

  // useLayoutEffect runs synchronously after every commit, before any useEffect —
  // this guarantees the queue effect always calls the latest handleSend closure.
  useLayoutEffect(() => {
    handleSendRef.current = handleSend;
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isGenerating && queuedPromptRef.current) {
      const queued = queuedPromptRef.current;
      queuedPromptRef.current = '';
      setHasQueuedPrompt(false);
      setQueuedPromptDisplay('');
      handleSendRef.current(queued);
    }
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

  // Derive STT state directly from the voice hook — no local state or interval needed
  const isSttActive = voice?.isListening ?? false;

  const handleSttToggle = () => {
    if (!voice?.isSupported) return;
    if (voice.isListening) {
      voice.stopListening();
      setVoiceOverlay?.({ active: false, type: null, text: '' });
    } else {
      setVoiceOverlay?.({ active: true, type: 'stt', text: '' });
      voice.startListening((transcript) => {
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
      });
    }
  };

  const handleSpeakMessage = (text, index) => {
    if (!voice) return;
    if (voice.isSpeaking && speakingMessageIndex === index) {
      voice.stopSpeaking();
      setSpeakingMessageIndex(null);
      setVoiceOverlay?.({ active: false, type: null, text: '' });
    } else {
      setSpeakingMessageIndex(index);
      setVoiceOverlay?.({ active: true, type: 'tts', text });
      voice.speak(text, () => {
        setSpeakingMessageIndex(null);
        setVoiceOverlay?.({ active: false, type: null, text: '' });
      });
    }
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
    cancelQueue,
  };
}
