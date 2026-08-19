interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  ai?: {
    languageModel?: {
      capabilities?: () => Promise<{ available: string }>;
      availability?: () => Promise<{ available: string }>;
      create?: (opts?: { temperature?: number }) => Promise<ChromeAISession>;
    };
    canCreateTextSession?: () => Promise<string>;
    createTextSession?: () => Promise<ChromeAISession>;
  };
  LanguageModel?: {
    capabilities?: () => Promise<{ available: string }>;
    availability?: () => Promise<{ available: string }>;
    create?: (opts?: { temperature?: number }) => Promise<ChromeAISession>;
  };
}

interface ChromeAISession {
  prompt?: (text: string, opts?: { signal?: AbortSignal }) => Promise<string>;
  promptStreaming?: (text: string, opts?: { signal?: AbortSignal }) => AsyncIterable<string>;
}
