import { ChromeAIProvider } from './ChromeAIProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { DEFAULT_OPENAI_BASE_URL } from '../constants';
import type { AIProvider, AvailableModel, Settings } from '../../types';

export class ProviderManager {
  providers: Record<string, AIProvider>;
  currentProviderId: string | null;

  constructor() {
    this.providers = {
      chrome: new ChromeAIProvider(),
      openai: new OpenAIProvider(),
    };
    this.currentProviderId = null;
  }

  setProvider(id: string): void {
    if (this.providers[id]) {
      this.currentProviderId = id;
    }
  }

  getProvider(): AIProvider | undefined {
    return this.currentProviderId ? this.providers[this.currentProviderId] : undefined;
  }

  updateOpenAISettings(settings: Settings): void {
    const openai = this.providers['openai'] as OpenAIProvider | undefined;
    if (openai) {
      openai.baseUrl = settings.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL;
      openai.apiKey = settings.openaiApiKey || 'sk-local';
      openai.model = settings.openaiModel || '';
    }
  }

  async fetchAvailableModels(): Promise<AvailableModel[]> {
    const openai = this.providers['openai'] as OpenAIProvider | undefined;
    if (openai) {
      return await openai.fetchModels();
    }
    return [];
  }
}

export const providerManager = new ProviderManager();
