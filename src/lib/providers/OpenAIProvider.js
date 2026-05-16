export class OpenAIProvider {
    constructor() {
        this.baseUrl = 'http://localhost:11434/v1';
        this.apiKey = 'sk-local';
        this.model = '';
    }

    async checkAvailability() {
        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            if (response.ok) {
                return { available: true };
            }
            return { available: false, reason: `HTTP ${response.status}` };
        } catch (e) {
            return { available: false, reason: "Cannot connect to server." };
        }
    }

    async fetchModels() {
        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            if (response.ok) {
                const data = await response.json();
                return data.data || [];
            }
        } catch (e) {
            return [];
        }
        return [];
    }

    async *streamPrompt(messages, systemPrompt = null, signal = null, options = {}) {
        if (!this.model) {
            throw new Error('No model selected. Pick a model from the model menu or Settings.');
        }
        let formattedMessages = [];
        if (systemPrompt && systemPrompt.trim() !== '') {
            formattedMessages.push({ role: 'system', content: systemPrompt });
        }

        formattedMessages = formattedMessages.concat(messages.map(m => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.content
        })));

        const body = {
            model: this.model,
            messages: formattedMessages,
            stream: true,
        };
        if (options.temperature !== undefined) body.temperature = options.temperature;
        if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

        // Merge user abort with a 90-second timeout
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), 90000);
        const combinedSignal = signal
            ? AbortSignal.any ? AbortSignal.any([signal, timeoutController.signal]) : signal
            : timeoutController.signal;

        let response;
        try {
            response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(body),
                signal: combinedSignal
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP error! status: ${response.status}`);
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
                    } catch (e) {
                        // ignore unparseable chunks
                    }
                }
            }
        }
    }
}
