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

    async initialize() {
        const lm = (window.ai && window.ai.languageModel) || window.LanguageModel;
        if (lm) {
            this.session = await lm.create();
        } else if (window.ai && window.ai.canCreateTextSession) {
            this.session = await window.ai.createTextSession();
        }
    }

    async *streamPrompt(messages, systemPrompt = null) {
        if (!this.session) await this.initialize();
        
        let promptText = "";
        if (systemPrompt && systemPrompt.trim() !== '') {
            promptText += `System: ${systemPrompt}\n`;
        }
        for (const msg of messages) {
            promptText += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        }
        promptText += "Assistant:";

        if (this.session.promptStreaming) {
            const stream = this.session.promptStreaming(promptText);
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
            const response = await this.session.prompt(promptText);
            yield response;
        }
    }
}
