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
  Maximize2,
  Minimize2,
  MessageSquare,
  FolderArchive,
  Zap,
  Activity,
  ShieldAlert,
  Terminal,
  FileCheck,
  FileText,
  SlidersHorizontal,
  CheckCircle2,
  UploadCloud,
  Cpu,
  Info,
  Eye,
  BookOpen,
  Swords,
} from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { useChatEngine } from '../../hooks/useChatEngine';
import MessageItem from '../chat/MessageItem';
import ModelMenu from '../chat/ModelMenu';
import AttachModal from '../chat/AttachModal';
import SkeletonBubble from '../chat/SkeletonBubble';
import CustomSelect, { SelectOption } from '../common/CustomSelect';
import { vaultStore, type VaultDocument } from '../../lib/rag/vaultStore';
import ModelArena from './ModelArena';
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

export type CopilotTab = 'chat' | 'arena' | 'vault' | 'presets' | 'telemetry';

export interface SecurityPersonaPreset {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  color: string;
  description: string;
  systemPrompt: string;
  samplePrompt: string;
}

export const SECURITY_PERSONA_PRESETS: SecurityPersonaPreset[] = [
  {
    id: 'web_appsec',
    name: 'Web AppSec Specialist',
    icon: ShieldAlert,
    color: '#38bdf8',
    description: 'Expert in OWASP Top 10, IDOR, SSRF, injection vectors, and broken access controls.',
    systemPrompt: 'You are an elite application security engineer. Analyze HTTP requests, API schemas, and vulnerabilities with deep rigor. Provide realistic attack vectors, curl PoCs, and actionable remediation guidance adhering to OWASP WSTG.',
    samplePrompt: 'Review my target scope and suggest a methodical testing checklist for broken object level authorization (BOLA) and injection vectors.',
  },
  {
    id: 'exploit_dev',
    name: 'Exploit & PoC Crafter',
    icon: Terminal,
    color: '#f59e0b',
    description: 'Specializes in crafting weaponized Nuclei templates, Python exploit scripts, and filter bypasses.',
    systemPrompt: 'You are a senior red-team exploit developer and vulnerability researcher. Help debug and craft robust, accurate exploit PoCs, Nuclei v3 YAML templates, and custom payloads with safe verification safeguards.',
    samplePrompt: 'I need a custom Nuclei v3 template with precise DSL matchers and extractors for detecting an unauthenticated administrative endpoint.',
  },
  {
    id: 'soc_detection',
    name: 'SOC & Detection Engineer',
    icon: Activity,
    color: '#10b981',
    description: 'Generates high-fidelity Sigma, YARA, Snort, and SIEM correlation rules for threat telemetry.',
    systemPrompt: 'You are a principal threat detection engineer. Translate threat intelligence, CVEs, and adversary attack paths into robust Sigma, YARA, and SIEM detection rules with zero false positives.',
    samplePrompt: 'Draft a production-grade Sigma detection rule for detecting web exploit command injection attempts in web access logs.',
  },
  {
    id: 'compliance_audit',
    name: 'Compliance & Audit Reviewer',
    icon: FileCheck,
    color: '#818cf8',
    description: 'Evaluates CVSS v3.1 vector scores, risk ratings, and maps findings to NIST SP 800-53 & ISO 27001.',
    systemPrompt: 'You are an accredited cybersecurity auditor and compliance assessor. Guide CVSS v3.1 base scoring, calculate temporal metrics, and map findings to security control frameworks (NIST SP 800-53, ISO 27001, SOC 2).',
    samplePrompt: 'Help me calculate an accurate CVSS v3.1 vector string and score for an unauthenticated server-side request forgery (SSRF).',
  },
  {
    id: 'executive_report',
    name: 'Executive Report Writer',
    icon: FileText,
    color: '#ec4899',
    description: 'Translates technical vulnerabilities into polished executive risk summaries for leadership.',
    systemPrompt: 'You are an executive security advisor and technical writer. Translate complex technical vulnerabilities, exploit chains, and findings into clear, impactful executive summaries and remediation roadmaps for CISOs and board members.',
    samplePrompt: 'Draft an executive briefing summarizing critical engagement risks, potential business impact, and a 30-day prioritized remediation roadmap.',
  },
];

interface CopilotDrawerProps {
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  chats: Chat[];
  currentProjectId: string;
  providerStatus: ProviderStatus;
  reloadChats: () => Promise<void>;
  settings: Settings;
  onModelChange: (provider: string, model: string, endpointId?: string) => void;
  onSettingsChange?: (newSettings: Partial<Settings>) => void;
  availableModels: AvailableModel[];
  voice: VoiceHook;
  setVoiceOverlay: (overlay: VoiceOverlayState) => void;
  activeSecurityTab: SecurityTab;
  onClose: () => void;
  onDeleteChat?: (id: string) => void;
  pendingPrompt?: string | null;
  onPendingPromptConsumed?: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
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
  onSettingsChange,
  availableModels,
  voice,
  setVoiceOverlay,
  activeSecurityTab,
  onClose,
  onDeleteChat,
  pendingPrompt,
  onPendingPromptConsumed,
  isMaximized = false,
  onToggleMaximize,
}: CopilotDrawerProps) {
  const [activeCopilotTab, setActiveCopilotTab] = useState<CopilotTab>('chat');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const vaultFileInputRef = useRef<HTMLInputElement>(null);

  const [vaultDocs, setVaultDocs] = useState<VaultDocument[]>(() => vaultStore.getDocuments());
  const [previewDoc, setPreviewDoc] = useState<VaultDocument | null>(null);
  const [vaultSearchQuery, setVaultSearchQuery] = useState('');

  useEffect(() => {
    return vaultStore.subscribe(setVaultDocs);
  }, []);

  const handleVaultFilesUpload = async (fileList: FileList | File[]) => {
    for (const file of Array.from(fileList)) {
      try {
        const text = await file.text();
        await vaultStore.addDocument(file.name, text);
      } catch (err) {
        console.error('Failed to read vault file:', err);
      }
    }
  };

  const testSearchResults = useMemo(() => {
    if (!vaultSearchQuery.trim()) return [];
    return vaultStore.search(vaultSearchQuery, 3);
  }, [vaultSearchQuery, vaultDocs]);

  const [modelDetails, setModelDetails] = useState<{
    format?: string;
    family?: string;
    parameterSize?: string;
    quantization?: string;
    sizeBytes?: number;
    capabilities?: string[];
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadModelDetails() {
      if (settings.provider !== 'openai' || !settings.openaiModel) {
        setModelDetails(null);
        return;
      }
      try {
        const baseUrl = settings.openaiBaseUrl || 'http://127.0.0.1:11434/v1';
        const rootUrl = baseUrl.replace(/\/v1\/?$/, '');
        const res = await fetch(`${rootUrl}/api/tags`).catch(() => null);
        if (res && res.ok) {
          const json = await res.json();
          const found = (json.models || []).find(
            (m: any) => m.name === settings.openaiModel || m.model === settings.openaiModel
          );
          if (found && isMounted) {
            setModelDetails({
              format: found.details?.format,
              family: found.details?.family,
              parameterSize: found.details?.parameter_size,
              quantization: found.details?.quantization_level,
              sizeBytes: found.size,
              capabilities: found.capabilities || [],
            });
            return;
          }
        }
      } catch {
        // ignore
      }
      if (isMounted) setModelDetails(null);
    }
    loadModelDetails();
    return () => {
      isMounted = false;
    };
  }, [settings.provider, settings.openaiModel, settings.openaiBaseUrl]);

  const {
    messages,
    setMessages,
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
    const opts: SelectOption<string>[] = projectChats.map((c) => ({
      value: c.id,
      label: c.title || 'Untitled Thread',
      onAction: onDeleteChat ? (id: string) => onDeleteChat(id) : undefined,
      actionTitle: 'Delete Thread',
    }));
    opts.unshift({
      value: '__new_chat__',
      label: '+ New Research Thread',
    });
    return opts;
  }, [projectChats, onDeleteChat]);

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

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : input).trim();
    if (!text || isGenerating) return;
    setInput('');
    handleSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (!e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        if (input.trim() && !isGenerating) {
          handleSendMessage(input);
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

  const estimatedTokens = useMemo(() => {
    let chars = (chatSystemPrompt || settings.systemPrompt || '').length;
    for (const m of messages) {
      chars += (m.content || '').length;
    }
    chars += input.length;
    return Math.max(1, Math.round(chars / 3.8));
  }, [messages, chatSystemPrompt, settings.systemPrompt, input]);

  const contextLimit = settings.contextWindow || 16384;
  const contextPercent = Math.min(100, Math.round((estimatedTokens / contextLimit) * 100));

  const handleActivatePreset = (preset: SecurityPersonaPreset) => {
    setChatSystemPrompt(preset.systemPrompt);
    setInput(preset.samplePrompt);
    setActiveCopilotTab('chat');
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  return (
    <div
      className={`${styles.copilotContainer} ${isMaximized ? styles.maximized : ''}`}
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

          {currentChatId && onDeleteChat && (
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.deleteHeaderBtn}`}
              onClick={() => onDeleteChat(currentChatId)}
              title="Delete Conversation Thread"
              aria-label="Delete Conversation Thread"
            >
              <Trash2 size={14} />
            </button>
          )}

          {onToggleMaximize && (
            <button
              type="button"
              className={`${styles.iconBtn} ${isMaximized ? styles.iconBtnActive : ''}`}
              onClick={onToggleMaximize}
              title={isMaximized ? 'Restore Split View (Esc)' : 'Expand to Focus Studio (Full Screen)'}
              aria-label={isMaximized ? 'Restore Split View' : 'Expand to Focus Studio'}
            >
              {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
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

      {/* Sub-Tab Navigation Bar */}
      <div className={styles.subTabBar}>
        <button
          type="button"
          className={`${styles.subTabBtn} ${activeCopilotTab === 'chat' ? styles.subTabActive : ''}`}
          onClick={() => setActiveCopilotTab('chat')}
        >
          <MessageSquare size={13} />
          <span>Chat</span>
        </button>
        <button
          type="button"
          className={`${styles.subTabBtn} ${activeCopilotTab === 'arena' ? styles.subTabActive : ''}`}
          onClick={() => setActiveCopilotTab('arena')}
          title="Dual-Model Comparison Arena"
        >
          <Swords size={13} />
          <span>Arena</span>
        </button>
        <button
          type="button"
          className={`${styles.subTabBtn} ${activeCopilotTab === 'vault' ? styles.subTabActive : ''}`}
          onClick={() => setActiveCopilotTab('vault')}
        >
          <FolderArchive size={13} />
          <span>Vault</span>
        </button>
        <button
          type="button"
          className={`${styles.subTabBtn} ${activeCopilotTab === 'presets' ? styles.subTabActive : ''}`}
          onClick={() => setActiveCopilotTab('presets')}
        >
          <Zap size={13} />
          <span>Presets</span>
        </button>
        <button
          type="button"
          className={`${styles.subTabBtn} ${activeCopilotTab === 'telemetry' ? styles.subTabActive : ''}`}
          onClick={() => setActiveCopilotTab('telemetry')}
        >
          <Activity size={13} />
          <span>Telemetry</span>
        </button>
      </div>

      {activeCopilotTab === 'chat' && (
        <>
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

              <div
                className={styles.contextMeterBadge}
                title={`Estimated conversation context: ~${estimatedTokens.toLocaleString()} / ${contextLimit.toLocaleString()} tokens (${contextPercent}%)`}
              >
                <span className={styles.contextMeterText}>
                  {estimatedTokens > 999 ? `${(estimatedTokens / 1000).toFixed(1)}k` : estimatedTokens} / {contextLimit > 999 ? `${Math.round(contextLimit / 1000)}k` : contextLimit}
                </span>
                <div className={styles.contextMeterTrack}>
                  <div
                    className={styles.contextMeterFill}
                    style={{
                      width: `${contextPercent}%`,
                      backgroundColor: contextPercent > 85 ? '#ef4444' : contextPercent > 65 ? '#f59e0b' : '#10b981',
                    }}
                  />
                </div>
              </div>
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
                  onClick={() => handleSendMessage(input)}
                  title="Send to Copilot (Enter)"
                >
                  <Send size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Dual-Model Comparison Arena */}
      {activeCopilotTab === 'arena' && (
        <div className={styles.subTabContent}>
          <ModelArena
            availableModels={availableModels}
            currentModel={settings.openaiModel || ''}
            settings={settings}
            onAdoptResponse={(content, modelName) => {
              setActiveCopilotTab('chat');
              setMessages((prev) => [
                ...prev,
                {
                  role: 'ai',
                  content: `*(Adopted from ${modelName} in Model Arena)*\n\n${content}`,
                  createdAt: Date.now(),
                },
              ]);
            }}
          />
        </div>
      )}

      {/* Engagement Document & Evidence Vault */}
      {activeCopilotTab === 'vault' && (
        <div className={styles.subTabContent}>
          <input
            type="file"
            ref={vaultFileInputRef}
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) void handleVaultFilesUpload(e.target.files);
              e.target.value = '';
            }}
          />

          <div className={styles.vaultCard}>
            <div className={styles.telemetryCardTitle}>
              <FolderArchive size={15} color="#38bdf8" />
              <span>Engagement Evidence & Document Vault</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Ingest scan logs, target source code, or vulnerability evidence. Copilot chunks and indexes files into an offline semantic store for grounded answers with verified citations.
            </p>

            {/* Ingestion Dropzone */}
            <div
              className={styles.vaultDropzone}
              onClick={() => vaultFileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) void handleVaultFilesUpload(e.dataTransfer.files);
              }}
            >
              <UploadCloud size={24} color="#38bdf8" />
              <div>
                <strong>Click or drop security documents to index</strong>
                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                  Burp XML, Nuclei YAML, Nmap XML/txt, SARIF, JSON logs, or source code
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className={styles.vaultStatsRow}>
              <div className={styles.vaultStatBadge}>
                <span>Documents:</span>
                <strong>{vaultDocs.length}</strong>
              </div>
              <div className={styles.vaultStatBadge}>
                <span>Active Chunks:</span>
                <strong style={{ color: '#10b981' }}>{vaultStore.getActiveChunks().length}</strong>
              </div>
              <div className={styles.vaultStatBadge}>
                <span>Indexed Tokens:</span>
                <strong style={{ color: '#38bdf8' }}>~{vaultStore.getActiveTokenCount().toLocaleString()}</strong>
              </div>
            </div>
          </div>

          {/* Indexed Documents Manager */}
          {vaultDocs.length > 0 && (
            <div className={styles.vaultCard}>
              <div className={styles.vaultDocHeader}>
                <div className={styles.telemetryCardTitle}>
                  <BookOpen size={15} color="#10b981" />
                  <span>Indexed Documents ({vaultDocs.length})</span>
                </div>
                <button
                  type="button"
                  className={`${styles.vaultActionBtn} ${styles.vaultActionBtnDanger}`}
                  onClick={() => vaultStore.clearAll()}
                  title="Remove all documents from knowledge vault"
                >
                  <Trash2 size={12} /> Clear All
                </button>
              </div>

              {/* Retrieval Sandbox / Search Bar */}
              <div className={styles.vaultSearchTestGroup}>
                <Search size={13} color="#94a3b8" />
                <input
                  type="text"
                  className={styles.vaultSearchTestInput}
                  placeholder="Test semantic retrieval against vault (e.g. port 8080, cwe-79, admin endpoint)..."
                  value={vaultSearchQuery}
                  onChange={(e) => setVaultSearchQuery(e.target.value)}
                />
                {vaultSearchQuery && (
                  <button
                    type="button"
                    className={styles.vaultActionBtn}
                    onClick={() => setVaultSearchQuery('')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Live Match Preview */}
              {testSearchResults.length > 0 && (
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '6px', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 600 }}>
                    Top Retrieval Match (Score: {testSearchResults[0].score.toFixed(2)} · {testSearchResults[0].docName})
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto' }}>
                    {testSearchResults[0].text.slice(0, 240)}...
                  </div>
                </div>
              )}

              {/* Document Cards List */}
              <div className={styles.vaultDocsList}>
                {vaultDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className={`${styles.vaultDocCard} ${!doc.enabled ? styles.vaultDocCardDisabled : ''}`}
                  >
                    <div className={styles.vaultDocHeader}>
                      <div className={styles.vaultDocTitleGroup}>
                        <FileText size={15} color={doc.enabled ? '#38bdf8' : '#64748b'} />
                        <span className={styles.vaultDocName} title={doc.name}>
                          {doc.name}
                        </span>
                      </div>
                      <div className={styles.vaultDocActions}>
                        <button
                          type="button"
                          className={`${styles.vaultToggleBtn} ${!doc.enabled ? styles.vaultToggleBtnDisabled : ''}`}
                          onClick={() => vaultStore.toggleDocument(doc.id)}
                          title={doc.enabled ? 'Click to mute document for RAG' : 'Click to enable for RAG'}
                        >
                          {doc.enabled ? '✓ RAG Active' : 'Muted'}
                        </button>
                        <button
                          type="button"
                          className={styles.vaultActionBtn}
                          onClick={() => setPreviewDoc(doc)}
                          title="Inspect Chunks"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.vaultActionBtn} ${styles.vaultActionBtnDanger}`}
                          onClick={() => vaultStore.removeDocument(doc.id)}
                          title="Delete from Vault"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className={styles.vaultDocBadges}>
                      <span className={styles.vaultDocBadge}>{(doc.size / 1024).toFixed(1)} KB</span>
                      <span className={styles.vaultDocBadge}>{doc.chunks.length} chunk{doc.chunks.length > 1 ? 's' : ''}</span>
                      <span className={styles.vaultDocBadge}>~{doc.tokenCount.toLocaleString()} tokens</span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                        {new Date(doc.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.vaultCard}>
            <div className={styles.telemetryCardTitle}>
              <CheckCircle2 size={15} color="#10b981" />
              <span>Active Engagement Telemetry</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className={styles.telemetryStatsRow}>
                <span>Active Workbench Module:</span>
                <strong style={{ color: '#38bdf8' }}>{activeMeta.name}</strong>
              </div>
              <div className={styles.telemetryStatsRow}>
                <span>Current Chat System Prompt:</span>
                <span>{chatSystemPrompt ? 'Customized' : 'Default Global'}</span>
              </div>
              <div className={styles.telemetryStatsRow}>
                <span>Messages in Thread:</span>
                <strong>{messages.length}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Chunks Inspector Modal */}
      {previewDoc && (
        <div className={styles.citationModalOverlay} onClick={() => setPreviewDoc(null)}>
          <div
            className={styles.citationModal}
            role="dialog"
            aria-modal="true"
            aria-label="Document Chunks"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.citationModalHeader}>
              <div className={styles.citationModalTitleGroup}>
                <FileText size={16} color="#38bdf8" />
                <span className={styles.citationModalTitle}>{previewDoc.name}</span>
                <span className={styles.citationChunkBadge}>
                  {previewDoc.chunks.length} Chunks (~{previewDoc.tokenCount.toLocaleString()} tokens)
                </span>
              </div>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setPreviewDoc(null)}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>
            <div className={styles.citationModalBody}>
              {previewDoc.chunks.map((chk, ci) => (
                <div
                  key={chk.id}
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#38bdf8' }}>
                    <strong>Chunk #{ci + 1} of {chk.totalChunks}</strong>
                    <span>~{chk.tokenEstimate} tokens</span>
                  </div>
                  <pre className={styles.citationExcerptText} style={{ maxHeight: '180px' }}>
                    {chk.text}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Security Personas & Presets */}
      {activeCopilotTab === 'presets' && (
        <div className={styles.subTabContent}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Security Personas & Prompts</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Switch specialist instructions and starter workflows in 1 click.
              </div>
            </div>
          </div>

          <div className={styles.presetsGrid}>
            {SECURITY_PERSONA_PRESETS.map((preset) => {
              const PresetIcon = preset.icon;
              const isCurrent = chatSystemPrompt === preset.systemPrompt;
              return (
                <div
                  key={preset.id}
                  className={styles.presetCard}
                  onClick={() => handleActivatePreset(preset)}
                >
                  <div className={styles.presetHeader}>
                    <div className={styles.presetTitleGroup}>
                      <PresetIcon size={16} color={preset.color} />
                      <span style={{ color: preset.color }}>{preset.name}</span>
                    </div>
                    {isCurrent && (
                      <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                        Active
                      </span>
                    )}
                  </div>
                  <p className={styles.presetDesc}>{preset.description}</p>
                  <div className={styles.presetSample}>
                    "{preset.samplePrompt}"
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Model & Hardware Telemetry */}
      {activeCopilotTab === 'telemetry' && (
        <div className={styles.subTabContent}>
          <div className={styles.telemetryCard}>
            <div className={styles.telemetryCardTitle}>
              <Activity size={15} color="#38bdf8" />
              <span>Active Inference Engine</span>
            </div>
            <div className={styles.telemetryStatsRow}>
              <span>Provider:</span>
              <strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{settings.provider}</strong>
            </div>
            <div className={styles.telemetryStatsRow}>
              <span>Model:</span>
              <strong style={{ color: '#38bdf8' }}>{settings.provider === 'openai' ? settings.openaiModel || 'Default Model' : 'Gemini Nano'}</strong>
            </div>
            <div className={styles.telemetryStatsRow}>
              <span>Base URL:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{settings.openaiBaseUrl}</span>
            </div>
            {modelDetails && (
              <>
                <div className={styles.telemetryStatsRow}>
                  <span>Architecture / Family:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {modelDetails.family || 'GGUF'} ({modelDetails.format || 'gguf'})
                  </strong>
                </div>
                {modelDetails.parameterSize && (
                  <div className={styles.telemetryStatsRow}>
                    <span>Parameter Size:</span>
                    <strong style={{ color: '#10b981' }}>{modelDetails.parameterSize}</strong>
                  </div>
                )}
                {modelDetails.quantization && (
                  <div className={styles.telemetryStatsRow}>
                    <span>Quantization Tier:</span>
                    <strong style={{ color: '#f59e0b' }}>{modelDetails.quantization}</strong>
                  </div>
                )}
                {modelDetails.sizeBytes && (
                  <div className={styles.telemetryStatsRow}>
                    <span>Memory Footprint:</span>
                    <span>{(modelDetails.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB</span>
                  </div>
                )}
                {modelDetails.capabilities && modelDetails.capabilities.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {modelDetails.capabilities.map((cap, ci) => (
                      <span
                        key={ci}
                        style={{
                          fontSize: '0.65rem',
                          background: 'rgba(56, 189, 248, 0.1)',
                          color: '#38bdf8',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                        }}
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className={styles.telemetryCard}>
            <div className={styles.telemetryCardTitle}>
              <Cpu size={15} color="#10b981" />
              <span>Context Window Gauge</span>
            </div>
            <div className={styles.telemetryMeterTrack}>
              <div
                className={styles.telemetryMeterFill}
                style={{
                  width: `${contextPercent}%`,
                  backgroundColor: contextPercent > 85 ? '#ef4444' : contextPercent > 65 ? '#f59e0b' : '#10b981',
                }}
              />
            </div>
            <div className={styles.telemetryStatsRow}>
              <span>Estimated Tokens Used:</span>
              <strong>~{estimatedTokens.toLocaleString()} / {contextLimit.toLocaleString()} ({contextPercent}%)</strong>
            </div>
          </div>

          <div className={styles.telemetryCard}>
            <div className={styles.telemetryCardTitle}>
              <SlidersHorizontal size={15} color="#f59e0b" />
              <span>Interactive Hyperparameters</span>
            </div>
            <div className={styles.telemetryControlRow}>
              <div className={styles.telemetryControlLabel}>
                <span>Temperature</span>
                <strong>{settings.temperature}</strong>
              </div>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={settings.temperature}
                onChange={(e) => onSettingsChange?.({ temperature: parseFloat(e.target.value) })}
                className={styles.telemetrySlider}
              />
            </div>

            <div className={styles.telemetryControlRow} style={{ marginTop: '0.5rem' }}>
              <div className={styles.telemetryControlLabel}>
                <span>Top P (Nucleus Sampling)</span>
                <strong>{settings.topP ?? 0.9}</strong>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={settings.topP ?? 0.9}
                onChange={(e) => onSettingsChange?.({ topP: parseFloat(e.target.value) })}
                className={styles.telemetrySlider}
              />
            </div>

            <div className={styles.telemetryControlRow} style={{ marginTop: '0.5rem' }}>
              <div className={styles.telemetryControlLabel}>
                <span>Repeat Penalty</span>
                <strong>{settings.repeatPenalty ?? 1.1}</strong>
              </div>
              <input
                type="range"
                min="1.0"
                max="1.5"
                step="0.05"
                value={settings.repeatPenalty ?? 1.1}
                onChange={(e) => onSettingsChange?.({ repeatPenalty: parseFloat(e.target.value) })}
                className={styles.telemetrySlider}
              />
            </div>

            <div className={styles.telemetryControlRow} style={{ marginTop: '0.5rem' }}>
              <div className={styles.telemetryControlLabel}>
                <span>Context Size (num_ctx)</span>
                <strong>{((settings.contextWindow || 16384) / 1024).toFixed(0)}K tokens</strong>
              </div>
              <select
                value={settings.contextWindow || 16384}
                onChange={(e) => onSettingsChange?.({ contextWindow: parseInt(e.target.value, 10) })}
                style={{
                  background: 'var(--sd-90)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--wa-12)',
                  padding: '0.35rem 0.5rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                }}
              >
                <option value="2048">2,048 tokens (2K)</option>
                <option value="4096">4,096 tokens (4K)</option>
                <option value="8192">8,192 tokens (8K)</option>
                <option value="16384">16,384 tokens (16K - Recommended)</option>
                <option value="32768">32,768 tokens (32K)</option>
                <option value="65536">65,536 tokens (64K)</option>
                <option value="131072">131,072 tokens (128K)</option>
              </select>
            </div>
          </div>

          <div className={styles.telemetryNote}>
            <div style={{ fontWeight: 600, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Info size={12} /> Local VRAM & GPU Offload Tip
            </div>
            To offload 100% of layers into GPU VRAM (reducing CPU and RAM usage), ensure your Ollama model fits in VRAM. For 8GB VRAM GPUs, 7B/8B Q4_K_M or Q5_K_M models fit completely into VRAM for lightning-fast inference.
          </div>
        </div>
      )}

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
