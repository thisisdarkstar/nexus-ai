export class ChromeAIProvider {
    constructor() {
        this.session = null;
    }

    async checkAvailability() {
        const lm = (window.ai && window.ai.languageModel) || window.LanguageModel;
        if (!lm && !(window.ai && window.ai.canCreateTextSession)) {
            return { available: false, reason: "API not found. Enable flags." };
        }
        try {
            if (lm) {
                const rawCaps = lm.capabilities ? await lm.capabilities() : await lm.availability();
                const available = rawCaps.available || rawCaps;
                if (available === "readily" || available === "available") {
                    return { available: true };
                }
                return { available: false, reason: `Status: ${available}` };
            } else {
                const caps = await window.ai.canCreateTextSession();
                if (caps === "readily" || caps === "available") {
                    return { available: true };
                }
                return { available: false, reason: `Status: ${caps}` };
            }
        } catch (e) {
            return { available: false, reason: e.message };
        }
    }

    async initialize(temperature) {
        const lm = (window.ai && window.ai.languageModel) || window.LanguageModel;
        if (lm) {
            const opts = {};
            if (temperature !== undefined) opts.temperature = temperature;
            this.session = await lm.create(Object.keys(opts).length ? opts : undefined);
        } else if (window.ai && window.ai.canCreateTextSession) {
            this.session = await window.ai.createTextSession();
        }
    }

    async *streamPrompt(messages, systemPrompt = null, signal = null, options = {}) {
        await this.initialize(options.temperature);

        let promptText = "";
        if (systemPrompt && systemPrompt.trim() !== '') {
            promptText += `System: ${systemPrompt}\n`;
        }
        for (const msg of messages) {
            promptText += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        }
        promptText += "Assistant:";

        const opts = signal ? { signal } : undefined;

        if (this.session.promptStreaming) {
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
        } else {
            const response = await this.session.prompt(promptText, opts);
            yield response;
        }
    }
}
