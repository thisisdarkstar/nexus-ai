import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  X,
  History,
  Plus,
  Search,
  Trash2,
  Share2,
  Globe,
  Network,
  Radio,
  Binary,
  Layers,
  FileText,
  Target,
  CheckSquare,
  ShieldAlert,
  Terminal,
  Workflow,
  Wrench,
  BookOpen,
  Activity,
  FileCode,
  Download,
} from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { useChatEngine } from '../../hooks/useChatEngine';
import MessageItem from '../chat/MessageItem';
import InputBar from '../chat/InputBar';
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
import styles from './CopilotDrawer.module.css';

interface CopilotDrawerProps {
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  chats: Chat[];
  currentProjectId: string;
  providerStatus: ProviderStatus;
  reloadChats: () => Promise<void>;
  settings: Settings;
  onModelChange: (provider: string, model: string) => void;
  availableModels: AvailableModel[];
  voice: VoiceHook;
  setVoiceOverlay: (overlay: VoiceOverlayState) => void;
  activeSecurityTab: SecurityTab;
  onClose: () => void;
  onDeleteChat?: (id: string) => void;
}

const TAB_META: Record<
  SecurityTab,
  { name: string; icon: React.ComponentType<{ size?: number; color?: string }>; suggestions: string[] }
> = {
  dashboard: {
    name: 'Executive Dashboard',
    icon: Activity,
    suggestions: [
      'Summarize overall engagement risk posture',
      'Identify highest priority remediation items',
    ],
  },
  graph: {
    name: 'Attack Surface Graph',
    icon: Share2,
    suggestions: [
      'Suggest realistic multi-stage attack paths',
      'Identify choke point nodes with highest degree',
      'Correlate assets with out-of-scope exclusions',
    ],
  },
  http_studio: {
    name: 'HTTP Studio',
    icon: Globe,
    suggestions: [
      'Analyze headers for CSP, HSTS, or CORS flaws',
      'Detect parameter injection vectors (SQLi, SSRF, XSS)',
      'Convert request to Python Requests with auth headers',
    ],
  },
  api_studio: {
    name: 'API Contract Studio',
    icon: Network,
    suggestions: [
      'Find endpoints lacking declared authorization schemes',
      'Flag potential BOLA/IDOR object reference risks',
      'Detect excessive data exposure schemas',
    ],
  },
  payloads: {
    name: 'Payload Crafter',
    icon: Radio,
    suggestions: [
      'Generate cloud metadata SSRF bypass for AWS IMDSv2',
      'Tailor SSTI payload for Jinja2 / Mako template engine',
      'Format reverse shell command with URL encoding',
    ],
  },
  decoders: {
    name: 'Decoders & JWT Hub',
    icon: Binary,
    suggestions: [
      'Analyze JWT claims and check for None-alg vulnerability',
      'Identify unknown hash format and suggest cracking tools',
      'Deobfuscate nested base64 / URL encoded string',
    ],
  },
  recon: {
    name: 'Reconnaissance Hub',
    icon: Search,
    suggestions: [
      'Draft passive OSINT toolchain for this domain',
      'Suggest targeted Google Dorks for exposed configs',
      'Formulate subdomain brute-forcing strategy',
    ],
  },
  workflow: {
    name: 'Assessment Workflows',
    icon: Workflow,
    suggestions: [
      'Review pipeline steps for authorized scope compliance',
      'Optimize automated scan steps to minimize noise',
    ],
  },
  nuclei: {
    name: 'Nuclei Template Studio',
    icon: FileCode,
    suggestions: [
      'Validate YAML matcher syntax and extractor logic',
      'Add DSL helper matchers to avoid false positives',
    ],
  },
  sandbox: {
    name: 'Wasm Python Sandbox',
    icon: Terminal,
    suggestions: [
      'Write a Python script to parse HTTP responses',
      'Debug Pyodide script execution error',
    ],
  },
  auditor: {
    name: 'SAST Code Auditor',
    icon: ShieldAlert,
    suggestions: [
      'Perform taint-analysis review on this code snippet',
      'Identify CWE vulnerability class and severity',
      'Generate secure drop-in code fix diff',
    ],
  },
  remediation: {
    name: 'Remediation Hub',
    icon: Wrench,
    suggestions: [
      'Generate unit regression test for this patch',
      'Draft developer guidance advisory for remediation',
    ],
  },
  knowledge_base: {
    name: 'CWE / OWASP Knowledge Base',
    icon: BookOpen,
    suggestions: [
      'Explain difference between ASVS Level 2 and Level 3',
      'Provide real-world breach examples for this weakness',
    ],
  },
  reports: {
    name: 'Report Studio',
    icon: FileText,
    suggestions: [
      'Draft executive vulnerability summary with business impact',
      'Calculate precise CVSS v3.1 vector string and score',
      'Format reproducible step-by-step PoC steps',
    ],
  },
  scope: {
    name: 'Scope Manager',
    icon: Target,
    suggestions: [
      'Review wildcards and identify scope ambiguity',
      'Prioritize testing order based on asset criticality',
    ],
  },
  checklists: {
    name: 'Testing Checklists',
    icon: CheckSquare,
    suggestions: [
      'Explain verification steps for OWASP WSTG-INPV-01',
      'Generate test cases for API authentication checks',
    ],
  },
  threat_studio: {
    name: 'Threat Modeling Studio',
    icon: Layers,
    suggestions: [
      'Draft Sigma detection rule for web exploit attempts',
      'Model STRIDE threats for payment gateway interaction',
    ],
  },
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
}: CopilotDrawerProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
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

  // Listen to cross-workbench AI dispatch
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

  const activeMeta = TAB_META[activeSecurityTab] || {
    name: 'Security Workbench',
    icon: Sparkles,
    suggestions: ['How can I help with your security assessment?'],
  };
  const ActiveTabIcon = activeMeta.icon;

  const handleQuickChipClick = (suggestion: string) => {
    const prompt = `[Context: ${activeMeta.name}]\n${suggestion}`;
    handleSend(prompt);
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
            <Sparkles size={15} className={styles.copilotBadgeIcon} />
            <span>AI Copilot</span>
          </div>

          <div className={styles.threadSelectWrapper}>
            <CustomSelect
              value={currentChatId || '__new_chat__'}
              onChange={handleThreadSelect}
              options={threadOptions}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
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
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className={styles.welcomeTitle}>Nexus Security Copilot</h3>
              <p className={styles.welcomeDesc}>
                Pair with an AI security specialist for vulnerability validation, scope verification, PoC crafting, and safe remediation.
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
        )}
      </div>

      {/* Input Bar */}
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
        onSend={() => handleSend(input)}
        onStop={handleStop}
        onSttToggle={handleSttToggle}
        onAttachOpen={() => setAttachModalOpen(true)}
        onCancelQueue={cancelQueue}
      />

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
