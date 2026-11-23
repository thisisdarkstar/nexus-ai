import { beforeEach, describe, expect, it } from 'vitest';
import { clearApiKeys, hydrateApiKeys, sanitizePersistedSettings, saveApiKeys } from '../lib/apiKeyStore';
import type { Settings } from '../types';

const baseSettings: Settings = {
  provider: 'openai',
  theme: 'dark',
  systemPrompt: '',
  openaiBaseUrl: 'http://localhost:11434/v1',
  openaiApiKey: '',
  openaiModel: '',
  endpoints: [{ id: 'ep-1', name: 'Local', baseUrl: 'http://localhost:11434/v1', apiKey: '' }],
  temperature: 0.7,
  maxTokens: 4096,
  contextWindow: 16384,
  ttsVoice: '',
};

describe('API key storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearApiKeys();
  });

  it('removes keys from settings before they are persisted', () => {
    const sanitized = sanitizePersistedSettings(
      {
        ...baseSettings,
        openaiApiKey: 'sk-secret',
        endpoints: [{ id: 'ep-1', name: 'Local', baseUrl: 'x', apiKey: 'sk-endpoint' }],
      },
      'engagement-a'
    );

    expect(sanitized.openaiApiKey).toBeUndefined();
    expect((sanitized.endpoints as Array<Record<string, unknown>>)[0].apiKey).toBeUndefined();
    expect(sanitized.currentProjectId).toBe('engagement-a');
    expect(sanitized.systemPrompt).toBe('');
  });

  it('round-trips keys through session storage without persisting them', () => {
    saveApiKeys({
      openaiApiKey: 'sk-session',
      endpoints: [{ id: 'ep-1', name: 'Local', baseUrl: 'x', apiKey: 'sk-endpoint' }],
    });

    const hydrated = hydrateApiKeys(baseSettings);
    expect(hydrated.openaiApiKey).toBe('sk-session');
    expect(hydrated.endpoints?.[0].apiKey).toBe('sk-endpoint');
    expect(localStorage.getItem('nexus_settings')).toBeNull();
  });

  it('forgets keys when cleared', () => {
    saveApiKeys({ openaiApiKey: 'sk-session', endpoints: [] });
    clearApiKeys();
    expect(hydrateApiKeys(baseSettings).openaiApiKey).toBe('');
  });
});
