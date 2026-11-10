import { RateLimiter } from '../rateLimiter';
import { DEFAULT_OPENAI_BASE_URL, DEFAULT_OPENAI_ENDPOINTS } from '../constants';
import type { AIProvider, AvailableModel, Message, OpenAIEndpoint, Settings } from '../../types';

export class OpenAIProvider implements AIProvider {
  baseUrl: string;
  apiKey: string;
  model: string;
  endpoints: OpenAIEndpoint[];
  activeEndpointId: string;
  private modelEndpointMap: Map<string, string>; // modelId -> endpointId
  private limiter: RateLimiter;

  constructor() {
    this.baseUrl = DEFAULT_OPENAI_BASE_URL;
    this.apiKey = 'sk-local';
    this.model = '';
    this.endpoints = [...DEFAULT_OPENAI_ENDPOINTS];
    this.activeEndpointId = 'ollama';
    this.modelEndpointMap = new Map();
    this.limiter = new RateLimiter(300);
  }

  updateFromSettings(settings: Settings): void {
    if (settings.endpoints && settings.endpoints.length > 0) {
      this.endpoints = settings.endpoints;
    } else if (settings.openaiBaseUrl) {
      // Backwards compatibility: wrap single config as an endpoint
      this.endpoints = [
        {
          id: 'primary',
          name: 'Primary Endpoint',
          baseUrl: settings.openaiBaseUrl,
          apiKey: settings.openaiApiKey || 'sk-local',
          enabled: true,
        },
      ];
    } else {
      this.endpoints = [...DEFAULT_OPENAI_ENDPOINTS];
    }

    this.activeEndpointId = settings.activeEndpointId || this.endpoints[0]?.id || 'ollama';
    const active = this.getActiveEndpoint();
    this.baseUrl = active?.baseUrl || settings.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL;
    this.apiKey = active?.apiKey || settings.openaiApiKey || 'sk-local';
    this.model = settings.openaiModel || '';
  }

  getActiveEndpoint(): OpenAIEndpoint | undefined {
    return (
      this.endpoints.find((e) => e.id === this.activeEndpointId) ||
      this.endpoints.find((e) => e.enabled !== false) ||
      this.endpoints[0]
    );
  }

  async checkAvailability(targetEndpoint?: OpenAIEndpoint): Promise<{ available: boolean; reason?: string }> {
    const ep = targetEndpoint || this.getActiveEndpoint();
    const url = ep?.baseUrl || this.baseUrl;
    const key = ep?.apiKey || this.apiKey;

    try {
      const response = await fetch(`${url}/models`, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
      });
      if (response.ok) {
        return { available: true };
      }
      return { available: false, reason: `HTTP ${response.status} from ${ep?.name || url}` };
    } catch {
      return { available: false, reason: `Cannot connect to ${ep?.name || url}` };
    }
  }

  async fetchModels(targetEndpoint?: OpenAIEndpoint): Promise<AvailableModel[]> {
    // If a specific endpoint is targeted (e.g. from test connection in settings)
    if (targetEndpoint) {
      try {
        const response = await fetch(`${targetEndpoint.baseUrl}/models`, {
          headers: targetEndpoint.apiKey ? { Authorization: `Bearer ${targetEndpoint.apiKey}` } : {},
        });
        if (response.ok) {
          const data = await response.json();
          const list = data.data || [];
          return list.map((m: any) => ({
            id: m.id,
            endpointId: targetEndpoint.id,
            endpointName: targetEndpoint.name,
          }));
        }
      } catch {
        return [];
      }
      return [];
    }

    // Otherwise, aggregate models across all enabled endpoints in parallel
    const enabledEndpoints = this.endpoints.filter((e) => e.enabled !== false);
    if (enabledEndpoints.length === 0) {
      enabledEndpoints.push(this.endpoints[0] || {
        id: 'default',
        name: 'Default',
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        enabled: true,
      });
    }

    const results = await Promise.allSettled(
      enabledEndpoints.map(async (ep) => {
        const res = await fetch(`${ep.baseUrl}/models`, {
          headers: ep.apiKey ? { Authorization: `Bearer ${ep.apiKey}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = data.data || [];
        return list.map((m: any) => ({
          id: m.id,
          endpointId: ep.id,
          endpointName: ep.name,
        }));
      })
    );

    const aggregated: AvailableModel[] = [];
    results.forEach((res, index) => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        res.value.forEach((m) => {
          aggregated.push(m);
          this.modelEndpointMap.set(m.id, m.endpointId || enabledEndpoints[index].id);
        });
      }
    });

    return aggregated;
  }

  async *streamPrompt(
    messages: Message[],
    systemPrompt: string | null = null,
    signal: AbortSignal | null = null,
    options: { temperature?: number; maxTokens?: number } = {}
  ): AsyncGenerator<string> {
    if (!this.model) {
      throw new Error('No model selected. Pick a model from the model menu or Settings.');
    }

    // Resolve which endpoint hosts this model
    let targetBaseUrl = this.baseUrl;
    let targetApiKey = this.apiKey;

    const matchedEndpointId = this.modelEndpointMap.get(this.model);
    if (matchedEndpointId) {
      const ep = this.endpoints.find((e) => e.id === matchedEndpointId);
      if (ep) {
        targetBaseUrl = ep.baseUrl;
        targetApiKey = ep.apiKey;
      }
    } else {
      const activeEp = this.getActiveEndpoint();
      if (activeEp) {
        targetBaseUrl = activeEp.baseUrl;
        targetApiKey = activeEp.apiKey;
      }
    }

    let formattedMessages: Array<{ role: string; content: string }> = [];
    if (systemPrompt && systemPrompt.trim() !== '') {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }

    formattedMessages = formattedMessages.concat(
      messages.map((m) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content,
      }))
    );

    const body: Record<string, unknown> = {
      model: this.model,
      messages: formattedMessages,
      stream: true,
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    // For local Ollama endpoints, default num_ctx to 4096 to prevent 65k VRAM/CPU bloat
    if (targetBaseUrl.includes('11434') || targetBaseUrl.includes('localhost')) {
      body.options = { num_ctx: 4096 };
    }

    const timeoutController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(
      () => timeoutController.abort(),
      180000
    ); // 3 minutes initial window for cold model load into VRAM

    const resetInactivityTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => timeoutController.abort(), 60000); // 60s inactivity window
    };

    const combinedSignal =
      signal && AbortSignal.any
        ? AbortSignal.any([signal, timeoutController.signal])
        : signal || timeoutController.signal;

    await this.limiter.throttle();

    let response: Response;
    try {
      response = await fetch(`${targetBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(targetApiKey ? { Authorization: `Bearer ${targetApiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: combinedSignal,
      });
    } catch (e) {
      if (e instanceof Error) {
        if (e.name === 'AbortError' && combinedSignal === timeoutController.signal) {
          throw new Error('Request timed out. The local model is taking too long to respond - consider using a smaller context or a lighter model.');
        }
        if (e.name === 'AbortError') {
          throw e;
        }
        if (e.message.includes('fetch') || e.message.includes('network') || e.message.includes('Failed to fetch')) {
          throw new Error(`Cannot connect to ${targetBaseUrl}. Make sure your endpoint server is running.`);
        }
      }
      throw e;
    }

    if (!response.ok) {
      if (timeoutId) clearTimeout(timeoutId);
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || `HTTP ${response.status}`;
      if (response.status === 401) {
        throw new Error(`Invalid API key for ${targetBaseUrl}. Check your endpoint settings.`);
      }
      if (response.status === 404) {
        throw new Error(`Model "${this.model}" not found at ${targetBaseUrl}.`);
      }
      if (response.status === 429) {
        throw new Error('Rate limited by provider. Wait a moment and try again.');
      }
      if (response.status >= 500) {
        throw new Error(`Server error (${response.status}) at ${targetBaseUrl}.`);
      }
      throw new Error(msg);
    }

    if (!response.body) {
      if (timeoutId) clearTimeout(timeoutId);
      throw new Error('Response body is null');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let inThinkingMode = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        resetInactivityTimer();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.trim() === '[DONE]') {
              if (inThinkingMode) {
                yield '\n\n';
                inThinkingMode = false;
              }
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta;
              if (!delta) continue;

              const reasoning = delta.reasoning_content ?? delta.reasoning;
              const content = delta.content;

              if (reasoning) {
                if (!inThinkingMode) {
                  inThinkingMode = true;
                  yield '> *Thinking:*\n> ';
                }
                yield reasoning.replace(/\n/g, '\n> ');
              } else if (content) {
                if (inThinkingMode) {
                  yield '\n\n';
                  inThinkingMode = false;
                }
                yield content;
              }
            } catch {
              // ignore unparseable chunks
            }
          }
        }
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
}
