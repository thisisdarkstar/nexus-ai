import type { OpenAIEndpoint, Settings } from '../types';

const SESSION_KEY = 'nexus_api_keys';

export interface ApiKeys {
  openaiApiKey: string;
  endpointKeys: Record<string, string>;
}

// Fallback for browsers that block sessionStorage (private mode / embedded webviews).
let memoryKeys: ApiKeys | null = null;

function readKeys(): ApiKeys | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return memoryKeys;
    const parsed = JSON.parse(raw) as Partial<ApiKeys>;
    return {
      openaiApiKey: typeof parsed.openaiApiKey === 'string' ? parsed.openaiApiKey : '',
      endpointKeys:
        parsed.endpointKeys && typeof parsed.endpointKeys === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.endpointKeys).filter(([, key]) => typeof key === 'string')
            )
          : {},
    };
  } catch {
    return memoryKeys;
  }
}

function writeKeys(keys: ApiKeys): void {
  memoryKeys = keys;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(keys));
  } catch {
    // Memory fallback still keeps keys available for this page session.
  }
}

/** Move keys out of a legacy localStorage settings blob, then sanitize that blob. */
export function adoptLegacyKeys(parsed: Record<string, unknown>): void {
  const existing = readKeys() || { openaiApiKey: '', endpointKeys: {} };
  const endpointKeys = { ...existing.endpointKeys };
  let openaiApiKey = existing.openaiApiKey;

  if (typeof parsed.openaiApiKey === 'string' && parsed.openaiApiKey) {
    openaiApiKey = parsed.openaiApiKey;
  }
  if (Array.isArray(parsed.endpoints)) {
    for (const endpoint of parsed.endpoints as Partial<OpenAIEndpoint>[]) {
      if (endpoint?.id && typeof endpoint.apiKey === 'string' && endpoint.apiKey) {
        endpointKeys[endpoint.id] = endpoint.apiKey;
      }
    }
  }
  if (openaiApiKey || Object.keys(endpointKeys).length > 0) {
    writeKeys({ openaiApiKey, endpointKeys });
  }
  try {
    localStorage.setItem('nexus_settings', JSON.stringify(sanitizePersistedSettings(parsed)));
  } catch {
    // ignore
  }
}

export function saveApiKeys(settings: Pick<Settings, 'openaiApiKey' | 'endpoints'>): void {
  const endpointKeys: Record<string, string> = {};
  for (const endpoint of settings.endpoints || []) {
    if (endpoint.apiKey) endpointKeys[endpoint.id] = endpoint.apiKey;
  }
  writeKeys({ openaiApiKey: settings.openaiApiKey || '', endpointKeys });
}

export function hydrateApiKeys(settings: Settings): Settings {
  const keys = readKeys();
  if (!keys) return settings;
  return {
    ...settings,
    openaiApiKey: keys.openaiApiKey || settings.openaiApiKey,
    endpoints: settings.endpoints?.map((endpoint) => ({
      ...endpoint,
      apiKey: keys.endpointKeys[endpoint.id] ?? endpoint.apiKey,
    })),
  };
}

export function clearApiKeys(): void {
  memoryKeys = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/** Remove secrets from settings before writing them to localStorage. */
export function sanitizePersistedSettings(
  settings: Record<string, unknown>,
  currentProjectId?: string
): Record<string, unknown> {
  const sanitized = { ...settings };
  delete sanitized.openaiApiKey;
  if (Array.isArray(sanitized.endpoints)) {
    sanitized.endpoints = (sanitized.endpoints as Record<string, unknown>[]).map((endpoint) => {
      const copy = { ...endpoint };
      delete copy.apiKey;
      return copy;
    });
  }
  if (currentProjectId) sanitized.currentProjectId = currentProjectId;
  return sanitized;
}
