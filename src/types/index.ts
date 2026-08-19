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
