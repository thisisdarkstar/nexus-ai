import type { OpenAIEndpoint } from '../types';

export const DEFAULT_OPENAI_BASE_URL = 'http://localhost:11434/v1';

export const DEFAULT_OPENAI_ENDPOINTS: OpenAIEndpoint[] = [
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: 'sk-local',
    enabled: true,
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (Local)',
    baseUrl: 'http://localhost:1234/v1',
    apiKey: 'sk-local',
    enabled: false,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (Cloud)',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    enabled: false,
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: '',
    enabled: false,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek API',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    enabled: false,
  },
  {
    id: 'openai',
    name: 'OpenAI Official',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    enabled: false,
  },
];
