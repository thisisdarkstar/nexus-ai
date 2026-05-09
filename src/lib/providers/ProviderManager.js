import { ChromeAIProvider } from './ChromeAIProvider';
import { OpenAIProvider } from './OpenAIProvider';

export class ProviderManager {
    constructor() {
        this.providers = {
            'chrome': new ChromeAIProvider(),
            'openai': new OpenAIProvider()
        };
        this.currentProviderId = null;
    }

    setProvider(id) {
        if (this.providers[id]) {
            this.currentProviderId = id;
        }
    }

    getProvider() {
        return this.providers[this.currentProviderId];
    }

    updateOpenAISettings(settings) {
        if (this.providers['openai']) {
            this.providers['openai'].baseUrl = settings.openaiBaseUrl || 'http://localhost:11434/v1';
            this.providers['openai'].apiKey = settings.openaiApiKey || 'sk-local';
            this.providers['openai'].model = settings.openaiModel || '';
        }
    }

    async fetchAvailableModels() {
        // Always try to fetch OpenAI models if the provider exists and is configured
        if (this.providers['openai']) {
            return await this.providers['openai'].fetchModels();
        }
        return [];
    }
}
export const providerManager = new ProviderManager();
