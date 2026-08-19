import type { AIProvider, Message } from '../../types';

export class ChromeAIProvider implements AIProvider {
  session: ChromeAISession | null = null;

  async checkAvailability(): Promise<{ available: boolean; reason?: string }> {
    const lm = window.ai?.languageModel || window.LanguageModel;
    if (!lm && !window.ai?.canCreateTextSession) {
      return { available: false, reason: 'API not found. Enable flags.' };
    }
    try {
      if (lm) {
        const rawCaps = lm.availability ? await lm.availability() : await lm.capabilities!();
        const available = rawCaps.available || rawCaps;
        if (available === 'readily' || available === 'available') {
          return { available: true };
        }
        return { available: false, reason: `Status: ${available}` };
      } else {
        const caps = await window.ai!.canCreateTextSession!();
        if (caps === 'readily' || caps === 'available') {
          return { available: true };
        }
        return { available: false, reason: `Status: ${caps}` };
      }
    } catch (e) {
      return { available: false, reason: e instanceof Error ? e.message : String(e) };
    }
  }

  async initialize(temperature?: number): Promise<void> {
    const lm = window.ai?.languageModel || window.LanguageModel;
    if (lm) {
      const opts: { temperature?: number } = {};
      if (temperature !== undefined) opts.temperature = temperature;
      this.session = await (lm.create as Function)(Object.keys(opts).length ? opts : undefined);
    } else if (window.ai?.canCreateTextSession) {
      this.session = await window.ai.createTextSession!();
    }
  }

  async *streamPrompt(
    messages: Message[],
    systemPrompt: string | null = null,
    signal: AbortSignal | null = null,
    options: { temperature?: number } = {}
  ): AsyncGenerator<string> {
    await this.initialize(options.temperature);

    let promptText = '';
    if (systemPrompt && systemPrompt.trim() !== '') {
      promptText += `System: ${systemPrompt}\n`;
    }
    for (const msg of messages) {
      promptText += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    }
    promptText += 'Assistant:';

    const opts = signal ? { signal } : undefined;

    if (this.session?.promptStreaming) {
      const stream = this.session.promptStreaming(promptText, opts);
      let currentText = '';

      for await (const chunk of stream) {
        if (currentText.length > 0 && chunk.startsWith(currentText)) {
          yield chunk.substring(currentText.length);
          currentText = chunk;
        } else {
          yield chunk;
          currentText += chunk;
        }
      }
    } else if (this.session?.prompt) {
      const response = await this.session.prompt(promptText, opts);
      yield response;
    }
  }
}
