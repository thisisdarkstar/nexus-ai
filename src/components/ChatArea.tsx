import { useState, useEffect } from 'react';
import { Sparkles, Download, Terminal, RefreshCw, Shield } from 'lucide-react';
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
  onToggleSecurityWorkbench?: () => void;
  securityWorkbenchOpen?: boolean;
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
  onToggleSecurityWorkbench,
  securityWorkbenchOpen,
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
    const handleAIRequest = (e: Event) => {
      const customEvent = e as CustomEvent<{ prompt: string }>;
      if (customEvent.detail?.prompt) {
        handleSend(customEvent.detail.prompt);
      }
    };
    window.addEventListener('nexus:send-ai-prompt', handleAIRequest);
    return () => window.removeEventListener('nexus:send-ai-prompt', handleAIRequest);
  }, [handleSend]);

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
          {onToggleSecurityWorkbench && (
            <button
              onClick={onToggleSecurityWorkbench}
              className={`${styles.promptBtn} ${securityWorkbenchOpen ? styles.promptBtnActive : ''}`}
              title={
                securityWorkbenchOpen
                  ? 'Close Security Workbench'
                  : 'Open Security Workbench (SAST Auditor, Sandbox, Decoders)'
              }
              style={
                securityWorkbenchOpen
                  ? {
                      background: 'rgba(16, 185, 129, 0.2)',
                      borderColor: 'rgba(16, 185, 129, 0.4)',
                      color: '#10b981',
                    }
                  : undefined
              }
            >
              <Shield size={14} color={securityWorkbenchOpen ? '#10b981' : 'var(--accent-color)'} />
              <span className={styles.btnLabel}>Workbench</span>
            </button>
          )}
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
              chatSystemPrompt ? `Active Prompt: ${chatSystemPrompt.slice(0, 100)}` : 'Set conversation system prompt'
            }
          >
            <Terminal size={14} />
            <span className={styles.btnLabel}>
              {chatSystemPrompt
                ? (() => {
                    const all = [...PRESET_TEMPLATES, ...getCustomTemplates()];
                    const match = all.find((t) => t.prompt === chatSystemPrompt);
                    return match ? match.name : 'Active';
                  })()
                : 'Prompt'}
            </span>
          </button>
          {messages.length > 0 && (
            <button
              onClick={handleExportChat}
              className={styles.exportBtn}
              title="Export as Markdown"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
          )}
          <div
            className={styles.modelBadge}
            title={
              settings.provider === 'openai'
                ? settings.openaiModel || 'Default Model'
                : 'Gemini Nano'
            }
          >
            <Sparkles size={13} color="var(--accent-color)" />
            <span className={styles.modelBadgeName}>
              {settings.provider === 'openai'
                ? settings.openaiModel || 'Default'
                : 'Nano'}
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
                  ? '...'
                  : 'Error'}
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
            <div className={styles.suggestions}>
              {[
                { label: '🔍 Explain SQL Injection', prompt: 'Explain SQL injection vulnerabilities with examples and how to prevent them.' },
                { label: '🐍 Write a port scanner', prompt: 'Write a Python port scanner script that scans the top 1000 ports on a target host.' },
                { label: '🔑 Analyze a JWT token', prompt: 'Explain how JWT tokens work and how to test them for common vulnerabilities like the alg:none bypass and weak HMAC secrets.' },
                { label: '📑 CVSS score for RCE', prompt: 'Calculate and explain the CVSS v3.1 base score for an unauthenticated remote code execution vulnerability.' },
                { label: '🛡️ XSS WAF bypass payloads', prompt: 'Show me common XSS bypass techniques for WAFs with example payloads and explanations.' },
                { label: '⚡ Write a Sigma rule', prompt: 'Write a Sigma detection rule for detecting suspicious PowerShell execution with base64-encoded commands, mapped to MITRE ATT&CK.' },
              ].map((s) => (
                <button
                  key={s.label}
                  className={styles.suggestionChip}
                  onClick={() => handleSend(s.prompt)}
                  disabled={providerStatus.state !== 'ready'}
                >
                  {s.label}
                </button>
              ))}
            </div>
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
