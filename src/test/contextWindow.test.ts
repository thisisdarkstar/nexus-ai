import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from '../lib/providers/OpenAIProvider';
import type { Message, Settings } from '../types';

describe('Context Window & Ollama num_ctx Configuration', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    provider = new OpenAIProvider();
    provider.model = 'qwen3.8-uncensored:9b';
    provider.baseUrl = 'http://localhost:11434/v1';
  });

  it('updates contextWindow from settings', () => {
    const settings: Settings = {
      provider: 'openai',
      theme: 'dark',
      systemPrompt: '',
      openaiBaseUrl: 'http://localhost:11434/v1',
      openaiApiKey: 'sk-local',
      openaiModel: 'qwen3.8-uncensored:9b',
      temperature: 0.7,
      maxTokens: 4096,
      contextWindow: 32768,
      ttsVoice: '',
    };
    provider.updateFromSettings(settings);
    expect(provider.contextWindow).toBe(32768);
  });

  it('passes configured num_ctx in options for Ollama/local endpoints', async () => {
    let capturedBody: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init && init.body) {
        capturedBody = JSON.parse(init.body as string);
      }
      return new Response(
        'data: {"choices":[{"delta":{"content":"Hello world"}}]}\n\ndata: [DONE]\n\n',
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
      );
    });

    provider.contextWindow = 16384;
    const messages: Message[] = [{ role: 'user', content: 'Test prompt' }];

    const generator = provider.streamPrompt(messages, null, null, {
      contextWindow: 16384,
      maxTokens: 4096,
    });

    const chunks: string[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(capturedBody).not.toBeNull();
    expect(capturedBody.options).toBeDefined();
    expect(capturedBody.options.num_ctx).toBe(16384);
    expect(chunks.join('')).toContain('Hello world');
  });

  it('applies sliding window pruning when message history exceeds context budget', async () => {
    let capturedBody: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init && init.body) {
        capturedBody = JSON.parse(init.body as string);
      }
      return new Response(
        'data: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n\n',
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
      );
    });

    // Provide a small contextWindow (4096) with large messages
    provider.contextWindow = 4096;

    // Generate 10 large messages
    const longText = 'A'.repeat(2000); // ~500 tokens each
    const messages: Message[] = [];
    for (let i = 0; i < 10; i++) {
      messages.push({
        role: i % 2 === 0 ? 'user' : 'ai',
        content: `Message ${i}: ${longText}`,
      });
    }

    const generator = provider.streamPrompt(messages, 'System instructions', null, {
      contextWindow: 4096,
      maxTokens: 1024,
    });

    for await (const _ of generator) {}

    expect(capturedBody).not.toBeNull();
    // System prompt must be preserved
    expect(capturedBody.messages[0].role).toBe('system');
    expect(capturedBody.messages[0].content).toBe('System instructions');

    // Total messages must be pruned, not all 10 + 1 messages
    expect(capturedBody.messages.length).toBeLessThan(messages.length + 1);

    // Latest user message must always be retained
    const lastMsg = capturedBody.messages[capturedBody.messages.length - 1];
    expect(lastMsg.content).toContain('Message 9');
  });

  it('provides actionable guidance if provider returns context size error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          error: {
            message: 'request (4488 tokens) exceeds the available context size (4096 tokens), try increasing it',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const messages: Message[] = [{ role: 'user', content: 'Do something big' }];
    const generator = provider.streamPrompt(messages, null, null, { contextWindow: 4096 });

    await expect(async () => {
      for await (const _ of generator) {}
    }).rejects.toThrow(/Increase the Context Window in Settings/i);
  });
});
