import { useState, useEffect } from 'react';
import { Sparkles, Download, Terminal, RefreshCw } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { useChatEngine } from '../hooks/useChatEngine';
import MessageItem from './chat/MessageItem';
import InputBar from './chat/InputBar';
import AttachModal from './chat/AttachModal';
import SkeletonBubble from './chat/SkeletonBubble';
import TemplateSelector from './chat/TemplateSelector';
import { PRESET_TEMPLATES, getCustomTemplates } from '../lib/templates';
import type {
  Settings,
  AvailableModel,
  ProviderStatus,
  VoiceHook,
  VoiceOverlayState,
} from '../types';
import styles from './ChatArea.module.css';

interface ChatAreaProps {
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  currentProjectId: string;
  providerStatus: ProviderStatus;
  reloadChats: () => Promise<void>;
  settings: Settings;
  onModelChange: (provider: string, model: string) => void;
  availableModels: AvailableModel[];
  voice: VoiceHook;
  setVoiceOverlay: (overlay: VoiceOverlayState) => void;
}

export default function ChatArea({
  currentChatId,
  setCurrentChatId,
  currentProjectId,
  providerStatus,
  reloadChats,
  settings,
  onModelChange,
  availableModels,
  voice,
  setVoiceOverlay,
}: ChatAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [attachModalOpen, setAttachModalOpen] = useState(false);

  const {
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
    canUndo,
    canRedo,
    cancelQueue,
  } = useChatEngine({
    currentChatId,
    setCurrentChatId,
    currentProjectId,
    settings,
    reloadChats,
    voice,
    setVoiceOverlay,
    onModelChange,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const fileExt = file.name.split('.').pop();
      setInput(
        (prev) => prev + `\n\n\`\`\`${fileExt}\n// ${file.name}\n${event.target?.result}\n\`\`\`\n`
      );
    };
    reader.readAsText(file);
  };

  const statusColor = providerStatus.state === 'ready' ? '#34d399' : '#fbbf24';

  return (
    <div
      className={styles.container}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className={styles.dropOverlay}>
          <div className={styles.dropLabel}>Drop to attach file</div>
        </div>
      )}

      <header className={`${styles.header} ${showConvPrompt ? styles.headerNoBorder : ''}`}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{title}</h2>
          {messages.length >= 2 && (
            <button
              onClick={() => handleRegenerateTitle(messages)}
              className={styles.regenerateTitleBtn}
              disabled={isGenerating}
              title="Regenerate title with AI"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
        <div className={styles.headerActions}>
          <TemplateSelector
            currentPrompt={chatSystemPrompt}
            onSelect={(prompt) => {
              setChatSystemPrompt(prompt);
            }}
            disabled={isGenerating}
          />
          <button
            onClick={() => setShowConvPrompt((s) => !s)}
            className={`${styles.promptBtn} ${showConvPrompt ? styles.promptBtnActive : ''}`}
            title={
              chatSystemPrompt ? 'Custom system prompt active' : 'Set conversation system prompt'
            }
          >
            <Terminal size={16} />
            <span>
              {chatSystemPrompt
                ? (() => {
                    const all = [...PRESET_TEMPLATES, ...getCustomTemplates()];
                    const match = all.find((t) => t.prompt === chatSystemPrompt);
                    return match ? match.name : 'Prompt Active';
                  })()
                : 'Set Prompt'}
            </span>
          </button>
          {messages.length > 0 && (
            <button
              onClick={handleExportChat}
              className={styles.exportBtn}
              title="Export as Markdown"
            >
              <Download size={16} /> Export
            </button>
          )}
          <div className={styles.modelBadge}>
            <Sparkles size={14} color="var(--accent-color)" />
            <span className={styles.modelBadgeName}>
              {settings.provider === 'openai'
                ? settings.openaiModel || 'Default Model'
                : 'Gemini Nano'}
            </span>
          </div>
          <div className={styles.statusBadge} style={{ color: statusColor }}>
            <div
              className={styles.statusDot}
              style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}` }}
            />
            <span className={styles.statusText}>
              {providerStatus.state === 'ready'
                ? 'Ready'
                : providerStatus.state === 'checking'
                  ? 'Checking...'
                  : providerStatus.reason}
            </span>
          </div>
        </div>
      </header>

      {showConvPrompt && (
        <div className={styles.promptPanel}>
          <label className={styles.promptLabel}>
            {(() => {
              const all = [...PRESET_TEMPLATES, ...getCustomTemplates()];
              const match = all.find((t) => t.prompt === chatSystemPrompt);
              return match ? (
                <span className={styles.activeTemplateLabel}>
                  {match.icon} {match.name}
                </span>
              ) : (
                <>
                  Conversation System Prompt{' '}
                  <span className={styles.promptLabelHint}>(overrides global)</span>
                </>
              );
            })()}
          </label>
          <textarea
            value={chatSystemPrompt}
            onChange={(e) => setChatSystemPrompt(e.target.value)}
            placeholder="e.g. You are a helpful assistant specializing in Python..."
            rows={2}
            className={styles.promptTextarea}
          />
        </div>
      )}

      <div className={styles.messageArea}>
        {isLoadingChat ? (
          <div className={styles.loadingContainer}>
            <SkeletonBubble isUser width="36%" />
            <SkeletonBubble isUser={false} width="70%" />
            <SkeletonBubble isUser width="28%" />
            <SkeletonBubble isUser={false} width="78%" />
          </div>
        ) : messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Sparkles size={40} color="white" />
            </div>
            <h1 className={styles.emptyTitle}>How can I help?</h1>
            <p className={styles.emptySubtitle}>Local, private, and exceptionally fast.</p>
          </div>
        ) : (
          <Virtuoso
            style={{ height: '100%' }}
            data={messages}
            followOutput="smooth"
            itemContent={(i, msg) => (
              <div className={styles.messageWrapper}>
                <MessageItem
                  msg={msg}
                  i={i}
                  isGenerating={isGenerating}
                  onEdit={handleEditMessage}
                  onRegenerate={handleRegenerate}
                  onSwitchBranch={handleSwitchBranch}
                  onCopy={handleCopy}
                  copiedIndex={copiedIndex}
                  onSpeak={handleSpeakMessage}
                  isSpeaking={voice && voice.isSpeaking && speakingMessageIndex === i}
                  availableModels={availableModels}
                  settings={settings}
                />
              </div>
            )}
            components={{
              Header: () => <div className={styles.headerSpacer} />,
              Footer: () => <div className={styles.footerSpacer} />,
            }}
          />
        )}
      </div>

      <InputBar
        input={input}
        onInputChange={setInput}
        isGenerating={isGenerating}
        providerStatus={providerStatus}
        isSttActive={isSttActive}
        voice={voice}
        hasQueuedPrompt={hasQueuedPrompt}
        queuedPromptDisplay={queuedPromptDisplay}
        settings={settings}
        availableModels={availableModels}
        onModelChange={onModelChange}
        onSend={handleSend}
        onStop={handleStop}
        onSttToggle={handleSttToggle}
        onAttachOpen={() => setAttachModalOpen(true)}
        onCancelQueue={cancelQueue}
      />

      {attachModalOpen && (
        <AttachModal
          onAttach={(text) => setInput((prev) => prev + text)}
          onClose={() => setAttachModalOpen(false)}
        />
      )}
    </div>
  );
}
