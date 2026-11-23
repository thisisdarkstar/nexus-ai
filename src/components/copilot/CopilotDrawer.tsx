import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  X,
  History,
  Plus,
  Search,
  Trash2,
  Download,
  Paperclip,
  Mic,
  MicOff,
  Send,
  Square,
} from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { useChatEngine } from '../../hooks/useChatEngine';
import MessageItem from '../chat/MessageItem';
import ModelMenu from '../chat/ModelMenu';
import AttachModal from '../chat/AttachModal';
import SkeletonBubble from '../chat/SkeletonBubble';
import CustomSelect from '../common/CustomSelect';
import type {
  Chat,
  Settings,
  AvailableModel,
  ProviderStatus,
  VoiceHook,
  VoiceOverlayState,
  SecurityTab,
} from '../../types';
import { SECURITY_TAB_META } from '../../lib/security/tabRegistry';
import { getQuickPromptContext } from '../../lib/security/aiContextRegistry';
import styles from './CopilotDrawer.module.css';

interface CopilotDrawerProps {
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  chats: Chat[];
  currentProjectId: string;
  providerStatus: ProviderStatus;
  reloadChats: () => Promise<void>;
  settings: Settings;
  onModelChange: (provider: string, model: string, endpointId?: string) => void;
  availableModels: AvailableModel[];
  voice: VoiceHook;
  setVoiceOverlay: (overlay: VoiceOverlayState) => void;
  activeSecurityTab: SecurityTab;
  onClose: () => void;
  onDeleteChat?: (id: string) => void;
  pendingPrompt?: string | null;
  onPendingPromptConsumed?: () => void;
}

const TAB_SUGGESTIONS: Record<SecurityTab, string[]> = {
  dashboard: ['Summarize overall engagement risk posture', 'Identify highest priority remediation items'],
  reports: ['Draft an executive summary for this engagement', 'Review CVSS scoring for the top finding'],
  scope: ['Suggest a test plan for in-scope assets', 'Find scope gaps and blind spots'],
  checklists: ['Explain verification steps for OWASP WSTG-INPV-01', 'Generate test cases for API authentication checks'],
  http_studio: ['Review this request for BOLA and injection risks', 'Propose security header improvements'],
  api_studio: ['Find broken authorization in this API contract', 'Map endpoints to OWASP API Top 10 risks'],
  payloads: ['Suggest safe payload variations for this target', 'Explain when each reverse shell technique works'],
  decoders: ['Identify the encoding on this artifact', 'Analyze JWT claims and signature weaknesses'],
  graph: ['Suggest realistic multi-stage attack paths', 'Prioritize nodes by blast radius'],
  recon: ['Generate advanced dork queries for this domain', 'Recommend an enumeration pipeline'],
  workflow: ['Review this pipeline for missing verification steps', 'Suggest a safer execution order'],
  nuclei: ['Improve matchers in this Nuclei template', 'Suggest extractors for this response pattern'],
  sandbox: ['Debug this Python security script', 'Add error handling to this PoC'],
  auditor: ['Find CWE vulnerabilities in this code', 'Propose a secure diff patch'],
  remediation: ['Check this patch for completeness', 'Suggest regression tests for this fix'],
  knowledge_base: ['Explain attack vectors for this weakness', 'List defensive controls for my stack'],
  threat_studio: ['Draft a Sigma detection rule for web exploit attempts', 'Model STRIDE threats for a payment gateway'],
};


export default function CopilotDrawer({
  currentChatId,
  setCurrentChatId,
  chats,
  currentProjectId,
  providerStatus,
  reloadChats,
  settings,
  onModelChange,
  availableModels,
  voice,
  setVoiceOverlay,
  activeSecurityTab,
  onClose,
  onDeleteChat,
  pendingPrompt,
  onPendingPromptConsumed,
}: CopilotDrawerProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    handleSwitchBranch,
    handleUndo,
    handleRedo,
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

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  // Consume a prompt handed over by the workbench. State-based handoff avoids
  // the old timed CustomEvent, which could be lost while this drawer mounted.
  // Instead of directly sending the message, load it into the input textarea and focus it
  // so the researcher can inspect, add details, or customize the prompt before sending.
  const consumedPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingPrompt) {
      consumedPromptRef.current = null;
      return;
    }
    if (consumedPromptRef.current === pendingPrompt) return;
    consumedPromptRef.current = pendingPrompt;
    onPendingPromptConsumed?.();
    setInput((prev) => (prev.trim() ? `${prev.trim()}\n\n${pendingPrompt}` : pendingPrompt));
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.value.length;
        textareaRef.current.selectionEnd = textareaRef.current.value.length;
      }
    });
  }, [pendingPrompt, onPendingPromptConsumed, setInput]);

  // Project chats
  const projectChats = useMemo(
    () => chats.filter((c) => (c.workspaceId || 'default') === currentProjectId),
    [chats, currentProjectId]
  );

  const threadOptions = useMemo(() => {
    const opts = projectChats.map((c) => ({
      value: c.id,
      label: c.title || 'Untitled Thread',
    }));
    opts.unshift({
      value: '__new_chat__',
      label: '+ New Research Thread',
    });
    return opts;
  }, [projectChats]);

  const handleThreadSelect = (val: string) => {
    if (val === '__new_chat__') {
      setCurrentChatId(null);
    } else {
      setCurrentChatId(val);
    }
    setHistoryOpen(false);
  };

  const filteredHistoryChats = useMemo(() => {
    if (!historySearch.trim()) return projectChats;
    const q = historySearch.toLowerCase();
    return projectChats.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages?.some((m) => m.content?.toLowerCase().includes(q))
    );
  }, [projectChats, historySearch]);

  const meta = SECURITY_TAB_META[activeSecurityTab];
  const activeMeta = {
    name: meta.name,
    icon: meta.icon,
    suggestions: TAB_SUGGESTIONS[activeSecurityTab],
  };
  const ActiveTabIcon = activeMeta.icon;

  const handleQuickChipClick = (suggestion: string) => {
    const prompt = getQuickPromptContext(activeSecurityTab, suggestion);
    setInput((prev) => (prev.trim() ? `${prev.trim()}\n\n${prompt}` : prompt));
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.value.length;
        textareaRef.current.selectionEnd = textareaRef.current.value.length;
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (!e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        if (input.trim() && !isGenerating) {
          handleSend(input);
        }
      }
    }
  };

  // Drag and drop support
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

  return (
    <div
      className={styles.copilotContainer}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className={styles.dropOverlay}>
          <div>Drop file to analyze in Copilot</div>
        </div>
      )}

      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.brandGroup}>
          <div className={styles.copilotBadge}>
            <Sparkles size={14} className={styles.copilotBadgeIcon} />
            <span>Copilot</span>
          </div>

          <div className={styles.threadSelectWrapper}>
            <CustomSelect
              value={currentChatId || '__new_chat__'}
              onChange={handleThreadSelect}
              options={threadOptions}
              style={{ fontSize: '0.74rem', padding: '0.2rem 0.45rem', minWidth: 0, width: '100%' }}
              ariaLabel="Select Thread"
            />
          </div>
        </div>

        <div className={styles.actionsGroup}>
          <button
            type="button"
            className={`${styles.iconBtn} ${historyOpen ? styles.iconBtnActive : ''}`}
            onClick={() => setHistoryOpen(!historyOpen)}
            title="Thread History & Past Inquiries"
          >
            <History size={14} />
          </button>

          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setCurrentChatId(null)}
            title="Start New Research Thread"
          >
            <Plus size={14} />
          </button>

          {messages.length > 0 && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleExportChat}
              title="Export Conversation as Markdown"
            >
              <Download size={14} />
            </button>
          )}

          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            title="Collapse AI Copilot Drawer (Ctrl+J / ⌘J)"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* History Drawer Flyout */}
      {historyOpen && (
        <div className={styles.historyOverlay}>
          <div className={styles.historyHeader}>
            <span className={styles.historyTitle}>Research Threads ({projectChats.length})</span>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setHistoryOpen(false)}
            >
              <X size={13} />
            </button>
          </div>

          <div className={styles.historySearch}>
            <Search size={12} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className={styles.historyList}>
            {filteredHistoryChats.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                No threads found
              </div>
            ) : (
              filteredHistoryChats.map((c) => (
                <div
                  key={c.id}
                  className={`${styles.historyItem} ${c.id === currentChatId ? styles.historyItemActive : ''}`}
                  onClick={() => {
                    setCurrentChatId(c.id);
                    setHistoryOpen(false);
                  }}
                >
                  <span className={styles.historyItemTitle}>{c.title || 'Untitled Thread'}</span>
                  {onDeleteChat && (
                    <button
                      type="button"
                      className={styles.iconBtn}
                      style={{ width: '20px', height: '20px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(c.id);
                      }}
                      title="Delete Thread"
                    >
                      <Trash2 size={11} color="#f87171" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Security Context Bar */}
      <div className={styles.contextBar}>
        <div className={styles.contextHeader}>
          <span className={styles.contextPill}>
            <ActiveTabIcon size={12} />
            <span>Active: {activeMeta.name}</span>
          </span>
          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
            {settings.provider === 'openai' ? settings.openaiModel || 'OpenAI' : 'Gemini Nano'}
          </span>
        </div>

        <div className={styles.quickChips}>
          {activeMeta.suggestions.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              className={styles.chip}
              onClick={() => handleQuickChipClick(sug)}
              title={sug}
            >
              <Sparkles size={10} color="#38bdf8" />
              <span>{sug}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages Stream */}
      <div className={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div className={styles.welcomeState}>
            <div className={styles.welcomeIconWrapper}>
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className={styles.welcomeTitle}>Nexus Security Copilot</h3>
              <p className={styles.welcomeDesc}>
                Pair with an AI security specialist for vulnerability triage, scope verification, PoC crafting, and safe remediation.
              </p>
            </div>

            <div className={styles.welcomeSuggestions}>
              {activeMeta.suggestions.slice(0, 3).map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  className={styles.suggestionCard}
                  onClick={() => handleQuickChipClick(sug)}
                >
                  <Sparkles size={12} color="#10b981" />
                  <span>{sug}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.srOnly} role="status" aria-live="polite">
              {isGenerating ? 'AI is generating a response' : ''}
            </div>
            <Virtuoso
            style={{ height: '100%' }}
            data={messages}
            initialTopMostItemIndex={messages.length - 1}
            followOutput="smooth"
            itemContent={(index, msg) => (
              <MessageItem
                key={index}
                msg={msg}
                i={index}
                isLatest={index === messages.length - 1}
                copiedIndex={copiedIndex}
                isSpeaking={speakingMessageIndex === index}
                isGenerating={isGenerating}
                onCopy={handleCopy}
                onSpeak={handleSpeakMessage}
                onRegenerate={handleRegenerate}
                onEdit={handleEditMessage}
                onSwitchBranch={handleSwitchBranch}
                availableModels={availableModels}
                settings={settings}
              />
            )}
            components={{
              Footer: () => (isGenerating ? <SkeletonBubble /> : null),
            }}
            />
          </>
        )}
      </div>

      {/* Dedicated Integrated Bottom Input Dock */}
      <div className={styles.inputDock}>
        {hasQueuedPrompt && (
          <div className={styles.queuedPill}>
            <span className={styles.queuedDot} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Queued: {queuedPromptDisplay}
            </span>
            <button
              type="button"
              onClick={cancelQueue}
              style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.7rem' }}
            >
              Cancel
            </button>
          </div>
        )}

        <div className={styles.inputCard}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask Copilot about ${activeMeta.name}...`}
            rows={1}
          />

          <div className={styles.inputToolbar}>
            <div className={styles.toolbarLeft}>
              <button
                type="button"
                className={styles.toolBtn}
                onClick={() => setAttachModalOpen(true)}
                title="Attach files or logs"
              >
                <Paperclip size={14} />
              </button>

              <button
                type="button"
                className={`${styles.toolBtn} ${isSttActive ? styles.micActive : ''}`}
                onClick={handleSttToggle}
                title={isSttActive ? 'Stop listening' : 'Voice dictation'}
              >
                {isSttActive ? <MicOff size={14} /> : <Mic size={14} />}
              </button>

              <ModelMenu
                settings={settings}
                availableModels={availableModels}
                isGenerating={isGenerating}
                onModelChange={onModelChange}
              />
            </div>

            <div className={styles.toolbarRight}>
              {isGenerating ? (
                <button
                  type="button"
                  className={styles.stopBtn}
                  onClick={handleStop}
                  title="Stop generating response"
                >
                  <Square size={12} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.sendBtn}
                  disabled={!input.trim() || providerStatus.state !== 'ready'}
                  onClick={() => handleSend(input)}
                  title="Send to Copilot (Enter)"
                >
                  <Send size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attach Modal */}
      {attachModalOpen && (
        <AttachModal
          onClose={() => setAttachModalOpen(false)}
          onAttach={(content) => {
            setInput((prev) => (prev ? `${prev}\n\n${content}` : content));
          }}
        />
      )}
    </div>
  );
}
