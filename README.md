# Nexus Local AI Framework

A production-grade, local-first AI chatbot framework built with React and Vite. Nexus Chat is designed to be a high-performance, modular UI that interfaces seamlessly with both built-in browser AI (Chrome Prompt API / Gemini Nano) and external local LLM servers (like Ollama and LM Studio).

## Features

- **Premium Glassmorphic UI**: A stunning, custom-designed interface featuring radial mesh gradients, glass panels, and smooth CSS animations.
- **Local-First Architecture**: Connects directly to `window.ai` (Chrome Gemini Nano) for zero-latency, offline inferences.
- **External Provider Support**: Built-in support for OpenAI-compatible local endpoints (Ollama, LM Studio) with dynamic model fetching.
- **Robust Conversation Management**: Persists chats using IndexedDB. Supports global importing/exporting, as well as renaming, deleting, and Markdown exports of individual sessions.
- **Advanced Controls**: Edit your previous prompts or seamlessly regenerate AI responses.
- **File Attachments**: Instantly inject context by attaching `.js`, `.py`, `.txt`, and `.md` files directly into your prompt.

## Project Structure

```text
nexus-chat/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css                 # Global styles and glassmorphic theme variables
    ├── components/
    │   ├── Sidebar.jsx           # Chat history and session management UI
    │   ├── ChatArea.jsx          # Main chat interface, message bubbles, and input
    │   └── SettingsModal.jsx     # Configuration for providers, themes, and global prompts
    └── lib/
        ├── db.js                 # IndexedDB wrapper for local chat persistence
        └── providers/
            ├── ProviderManager.js   # Orchestrates active AI providers
            ├── ChromeAIProvider.js  # Interfaces with Chrome's experimental window.ai
            └── OpenAIProvider.js    # Connects to local servers like Ollama/LM Studio
```

## Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Run the development server:**

   ```bash
   npm run dev
   ```

3. **Chrome window.ai Setup:**
   Ensure you are using Chrome 127+ and have the following flags enabled via `chrome://flags`:
   - `#enable-experimental-web-platform-features`
   - `#optimization-guide-on-device-model`
   - `#prompt-api-for-gemini-nano`

4. **Ollama Setup (Optional):**
   - Install Ollama and pull a model (e.g., `ollama run llama3`).
   - Open Nexus Chat Settings, switch the provider to "OpenAI Compatible API".
   - Your local models will automatically populate in the dropdown.
