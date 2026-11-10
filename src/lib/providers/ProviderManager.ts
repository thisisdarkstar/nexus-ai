import { ChromeAIProvider } from './ChromeAIProvider';
import { OpenAIProvider } from './OpenAIProvider';
import type { AIProvider, AvailableModel, OpenAIEndpoint, Settings } from '../../types';

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
      openai.updateFromSettings(settings);
    }
  }

  getOpenAIProvider(): OpenAIProvider | undefined {
    return this.providers['openai'] as OpenAIProvider | undefined;
  }

  async checkEndpointAvailability(endpoint: OpenAIEndpoint): Promise<{ available: boolean; reason?: string }> {
    const openai = this.getOpenAIProvider();
    if (openai) {
      return await openai.checkAvailability(endpoint);
    }
    return { available: false, reason: 'Provider not initialized' };
  }

  async fetchAvailableModels(targetEndpoint?: OpenAIEndpoint): Promise<AvailableModel[]> {
    const openai = this.providers['openai'] as OpenAIProvider | undefined;
    if (openai) {
      return await openai.fetchModels(targetEndpoint);
    }
    return [];
  }
}

export const providerManager = new ProviderManager();
