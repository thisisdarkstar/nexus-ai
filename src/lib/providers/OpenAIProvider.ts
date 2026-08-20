import { RateLimiter } from '../rateLimiter';
import { DEFAULT_OPENAI_BASE_URL } from '../constants';
import type { AIProvider, AvailableModel, Message } from '../../types';

export class OpenAIProvider implements AIProvider {
  baseUrl: string;
  apiKey: string;
  model: string;
  private limiter: RateLimiter;

  constructor() {
    this.baseUrl = DEFAULT_OPENAI_BASE_URL;
    this.apiKey = 'sk-local';
    this.model = '';
    this.limiter = new RateLimiter(300);
  }

  async checkAvailability(): Promise<{ available: boolean; reason?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (response.ok) {
        return { available: true };
      }
      return { available: false, reason: `HTTP ${response.status}` };
    } catch {
      return { available: false, reason: 'Cannot connect to server.' };
    }
  }

  async fetchModels(): Promise<AvailableModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
    } catch {
      return [];
    }
    return [];
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

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 90000);
    const combinedSignal =
      signal && AbortSignal.any
        ? AbortSignal.any([signal, timeoutController.signal])
        : signal || timeoutController.signal;

    await this.limiter.throttle();

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: combinedSignal,
      });
    } catch (e) {
      if (e instanceof Error) {
        if (e.name === 'AbortError' && combinedSignal === timeoutController.signal) {
          throw new Error('Request timed out (90s). The model may be overloaded - try again or use a smaller prompt.');
        }
        if (e.name === 'AbortError') {
          throw e;
        }
        if (e.message.includes('fetch') || e.message.includes('network') || e.message.includes('Failed to fetch')) {
          throw new Error(`Cannot connect to ${this.baseUrl}. Make sure your server is running.`);
        }
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || `HTTP ${response.status}`;
      if (response.status === 401) {
        throw new Error('Invalid API key. Check your settings.');
      }
      if (response.status === 404) {
        throw new Error(`Model "${this.model}" not found. Check your model settings.`);
      }
      if (response.status === 429) {
        throw new Error('Rate limited. Wait a moment and try again.');
      }
      if (response.status >= 500) {
        throw new Error(`Server error (${response.status}). Your server may be overloaded.`);
      }
      throw new Error(msg);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data.trim() === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // ignore unparseable chunks
          }
        }
      }
    }
  }
}
