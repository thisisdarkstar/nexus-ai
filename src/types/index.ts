export interface Settings {
  provider: 'chrome' | 'openai';
  theme: 'dark' | 'light';
  systemPrompt: string;
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  temperature: number;
  maxTokens: number;
  ttsVoice: string;
}

export interface ProviderStatus {
  state: 'checking' | 'ready' | 'error';
  reason: string | null;
}

export interface Message {
  role: 'user' | 'ai';
  content: string;
  error?: boolean;
  generationTime?: string;
  tokens?: number;
  createdAt?: number;
  branches?: Message[];
  branchIndex?: number;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  workspaceId: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  provider?: string;
  model?: string;
  systemPrompt?: string;
  tags?: string[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
}

export interface AvailableModel {
  id: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  icon?: string;
}

export interface VoiceOverlayState {
  active: boolean;
  type: 'stt' | 'tts' | null;
  text: string;
}

export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (() => Promise<void>) | null;
}

export interface AIProvider {
  checkAvailability(): Promise<{ available: boolean; reason?: string }>;
  streamPrompt(
    messages: Message[],
    systemPrompt: string | null,
    signal: AbortSignal | null,
    options?: { temperature?: number; maxTokens?: number }
  ): AsyncGenerator<string, void, unknown>;
}

export interface VoiceHook {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  availableVoices: SpeechSynthesisVoice[];
  setPreferredVoice: (name: string) => void;
  startListening: (onTranscript?: ((text: string) => void) | null) => void;
  stopListening: () => void;
  speak: (text: string, onEnd?: (() => void) | null) => void;
  stopSpeaking: () => void;
  toggleListening: (onTranscript?: (text: string) => void) => void;
  isVoiceActive: boolean;
}

export interface ChatEngineReturn {
  messages: Message[];
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isGenerating: boolean;
  title: string;
  copiedIndex: number | null;
  isSttActive: boolean;
  speakingMessageIndex: number | null;
  isLoadingChat: boolean;
  chatSystemPrompt: string;
  setChatSystemPrompt: React.Dispatch<React.SetStateAction<string>>;
  showConvPrompt: boolean;
  setShowConvPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  hasQueuedPrompt: boolean;
  queuedPromptDisplay: string;
  handleSend: (textOverride?: string) => Promise<void>;
  handleStop: () => void;
  handleRegenerate: (
    index: number,
    retryProvider?: string | null,
    retryModel?: string | null
  ) => Promise<void>;
  handleEditMessage: (index: number) => void;
  handleCopy: (text: string, index: number) => void;
  handleExportChat: () => void;
  handleSttToggle: () => void;
  handleSpeakMessage: (text: string, index: number) => void;
  handleRegenerateTitle: (messages: Message[]) => void;
  handleSwitchBranch: (messageIndex: number, direction: 'prev' | 'next') => void;
  handleUndo: () => void;
  handleRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  cancelQueue: () => void;
}

export type SecurityTab =
  | 'auditor'
  | 'sandbox'
  | 'decoders'
  | 'threat_studio'
  | 'reports'
  | 'scope'
  | 'checklists'
  | 'http_studio'
  | 'payloads'
  | 'recon'
  | 'nuclei';

export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface CVSSMetrics {
  version: '3.1' | '4.0';
  av: 'N' | 'A' | 'L' | 'P';
  ac: 'L' | 'H';
  pr: 'N' | 'L' | 'H';
  ui: 'N' | 'R';
  s: 'U' | 'C';
  c: 'H' | 'L' | 'N';
  i: 'H' | 'L' | 'N';
  a: 'H' | 'L' | 'N';
  score: number;
  severity: VulnerabilitySeverity;
  vectorString: string;
}

export interface VulnerabilityFinding {
  id: string;
  title: string;
  severity: VulnerabilitySeverity;
  cweId?: string;
  owaspCategory?: string;
  targetEndpoint?: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  description: string;
  remediation: string;
  pocSteps?: string[];
  references?: string[];
  cvss?: CVSSMetrics;
  status?: 'open' | 'triaged' | 'fixed' | 'retested' | 'accepted';
  patchDiff?: {
    original: string;
    patched: string;
  };
}

export interface SecurityArtifact {
  id: string;
  title: string;
  type: 'code' | 'log' | 'deobfuscate' | 'jwt' | 'hash' | 'yara' | 'sigma' | 'stride';
  content: string;
  language?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface VAPTReport {
  id: string;
  title: string;
  clientName: string;
  targetScope: string;
  assessmentType: 'web' | 'api' | 'mobile' | 'network' | 'cloud' | 'bug_bounty';
  leadTester: string;
  startDate: string;
  endDate: string;
  executiveSummary: string;
  methodology: string;
  findings: VulnerabilityFinding[];
  status: 'draft' | 'in_review' | 'final';
  createdAt: number;
  updatedAt: number;
}

export interface ScopeItem {
  id: string;
  target: string;
  type: 'domain' | 'ip_range' | 'api' | 'mobile_app' | 'cloud_resource';
  inScope: boolean;
  techStack?: string[];
  notes?: string;
  status: 'untested' | 'in_progress' | 'vulnerable' | 'verified_clean';
}

export interface SecurityChecklistItem {
  id: string;
  category: string;
  code: string;
  title: string;
  description: string;
  status: 'untested' | 'pass' | 'fail' | 'na';
  evidence?: string;
}

export interface AuditReport {
  id: string;
  title: string;
  target: string;
  findings: VulnerabilityFinding[];
  overallScore: number;
  createdAt: number;
}

export interface SandboxExecutionResult {
  status: 'idle' | 'running' | 'success' | 'error';
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  result?: string;
}

export interface DecodedJWT {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  isExpired?: boolean;
  expiresAt?: string;
  issuedAt?: string;
  algorithm?: string;
  warnings?: string[];
}

