# 🛡️ Nexus AI — Advanced Local AI & Security Engineering Workbench

[![React](https://img.shields.io/badge/React-19.2-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646cff.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Pyodide](https://img.shields.io/badge/Pyodide-WebAssembly-ffd43b.svg?logo=python&logoColor=blue)](https://pyodide.org/)
[![License](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

**Nexus AI** is a production-grade, local-first artificial intelligence assistant and cybersecurity engineering workbench. Built with React 19, TypeScript, and Vite, Nexus seamlessly bridges local Large Language Models (via **Ollama**, **LM Studio**, or **Chrome Gemini Nano**) with a comprehensive suite of **11 specialized penetration testing and security analysis modules**.

---

## 🌟 Key Highlights

- **🔒 100% Local-First & Privacy-Preserving**: Complete offline operational capability. Conversations, target assets, scope matrices, and tool data stay stored directly in your browser (`IndexedDB` & `localStorage`).
- **🤖 Context-Aware AI Security Co-Pilot**: Every workbench module features dedicated **"Ask AI"** hooks that automatically inject active tool context (e.g., CVSS vectors, decoded JWT claims, Burp requests, SAST code, or YARA/Sigma rules) into the conversation without manual prompt typing.
- **⚡ Sequential Prompt FIFO Queue**: Rapid-fire queries queued seamlessly in real-time, preventing concurrent thinking conflicts and maintaining multi-turn context integrity.
- **🎛️ Dual-Pane & Fullscreen Responsive Workbench**: Resizable split-screen layout with CSS container queries that adapt effortlessly between narrow sidebars and ultra-wide/4K multi-column views.
- **✨ Custom Glassmorphic Aesthetics**: Modern dark acrylic theme (`backdrop-filter: blur(24px)`), smooth CSS micro-interactions, responsive tables with horizontal scrolling, and custom confirmation modals.

---

## 🛠️ Security Engineering & VAPT Workbench Modules

| Module | Purpose & Core Capabilities |
| :--- | :--- |
| 📑 **VAPT Report Studio** | Professional penetration testing report generator. Includes an interactive **CVSS v3.1 Base Score Calculator & Vector Builder**, executive summary drafting, CWE/OWASP classification, vulnerability diff patches, Bug Bounty markdown exports, and printable HTML/PDF exports. |
| 🎯 **Scope Manager** | Target scope & asset matrix. Track domains, IP/CIDR subnets, and API endpoints with instant `IN-SCOPE` / `OUT-OF-SCOPE` filtering, tech stack tagging, and AI attack-plan generation. |
| 📋 **OWASP Checklist Tracker** | Methodology tracker with built-in industry suites: **Core 4 Essentials**, **OWASP WSTG v4.2 (8 Tests)**, and **OWASP API Security Top 10 (2023)**. Supports custom test items, status tracking (Pass/Fail/Untested), and automated AI remediation plans. |
| 🌐 **HTTP Studio** | Burp Suite request/response parser. Converts HTTP requests into **cURL**, **Python `requests`**, and JavaScript `fetch`. Includes security header posture checks and parameter injection fuzzing. |
| 💣 **Payload Crafter** | Exploit payload matrix with dynamic `LHOST`/`LPORT` binding. Generates Reverse Shells (Bash, Python, Netcat, PowerShell, PHP, Socat), SSRF Cloud Metadata bypasses (AWS, GCP, Azure, DigitalOcean, Kubernetes), and SSTI syntax matrices. |
| 🔄 **Decoders & JWT Hub** | Cyber security Swiss-army knife: Base64, Hex, URL, Rot13, and XOR shift transformations. Live **MD5, SHA-1, SHA-256, SHA-512** hashing with Hashcat crack mode generator, **Shannon Entropy** calculation, and deep **JWT Header/Payload/Claims Security Inspector**. |
| 🔍 **Recon & OSINT Hub** | One-click CLI command generator for **Sublist3r, Amass, Nmap, Nuclei, Gobuster, Ffuf, Masscan, TheHarvester**, alongside an automated Google & GitHub Dork builder. |
| 🧬 **Nuclei Studio** | ProjectDiscovery Nuclei v3 YAML template authoring environment. Configure HTTP requests, paths, matchers (words, regex, status), extractors, and live YAML syntax preview. |
| 🐍 **Python Sandbox** | In-browser WebAssembly Python runtime powered by **Pyodide**. Run security scripts, parse tokens, test regexes, and verify PoCs with zero local Python installation. |
| 🛡️ **SAST Code Auditor** | Static application security analyzer. Scans source code for CWE vulnerabilities (SQLi, XSS, SSRF, Command Injection), providing risk analysis and secure code diff patches. |
| ⚡ **Threat Studio** | Detection engineering suite. Build **Sigma detection rules** mapped to MITRE ATT&CK techniques and evaluate systems against the **STRIDE Threat Model** (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege). |

---

## 🏛️ Project Architecture

```
nexus-ai/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx                      # App orchestrator, theme, and resizable layout
    ├── index.css                    # Design system, glassmorphic tokens, and responsive tables
    ├── types/
    │   └── index.ts                 # Type definitions for chats, models, and security entities
    ├── hooks/
    │   ├── useChatEngine.ts         # Sequential FIFO queue, provider orchestration & context memory
    │   └── useVoice.ts              # Speech-to-Text (STT) and Web Speech API integration
    ├── components/
    │   ├── ChatArea.tsx             # Main chat view, prompt suggestions, and input box
    │   ├── ConfirmModal.tsx         # Custom glassmorphic confirmation modal system
    │   ├── SettingsModal.tsx        # Model configurations, system prompts, and theme switcher
    │   ├── chat/
    │   │   └── MessageItem.tsx      # Markdown bubble renderer with code syntax highlighting
    │   ├── layout/
    │   │   └── Sidebar.tsx          # Chat history, session switching, and import/export
    │   └── security/                # 11 Security Workbench Components & CSS Modules
    │       ├── SecurityCanvas.tsx   # Workbench container, custom dropdown & tab switcher
    │       ├── ReportStudio.tsx     # VAPT & Bug Bounty reports + CVSS v3.1 calculator
    │       ├── ScopeManager.tsx     # Target scope matrix & tech stack tracker
    │       ├── ChecklistTracker.tsx # OWASP WSTG & API Top 10 checklist tracker
    │       ├── HttpStudio.tsx       # Burp HTTP parser, cURL/Python converter & fuzzing
    │       ├── PayloadCrafter.tsx   # Reverse shells, SSRF cloud & SSTI payload crafter
    │       ├── DecoderHub.tsx       # Decoders, Shannon entropy, hashes & JWT inspector
    │       ├── ReconHub.tsx         # Reconnaissance CLI toolchains & OSINT dorks
    │       ├── NucleiStudio.tsx     # Nuclei v3 YAML template builder
    │       ├── SandboxTerminal.tsx  # In-browser Pyodide Python execution terminal
    │       ├── CodeAuditor.tsx      # SAST static vulnerability code auditor
    │       └── DetectionStudio.tsx  # Sigma rules & STRIDE threat modeler
    └── lib/
        ├── db.ts                    # IndexedDB chat session persistence
        ├── markdown.ts              # Marked renderer + Highlight.js syntax highlighting
        ├── providers/               # AI Provider Interfaces
        │   ├── ChromeAIProvider.ts  # Chrome Prompt API (Gemini Nano)
        │   ├── OpenAIProvider.ts    # OpenAI-compatible API (Ollama, LM Studio)
        │   └── ProviderManager.ts   # Unified provider interface
        ├── sandbox/
        │   ├── pyodideWorker.ts     # Dedicated Web Worker for isolated Python execution
        │   └── usePyodide.ts        # React hook interfacing with Pyodide worker
        └── security/
            ├── cvss.ts              # CVSS v3.1 base score computation algorithm
            └── reportGenerator.ts   # Markdown, HTML, and Bug Bounty report compilers
```

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher)
- [npm](https://www.npmjs.com/) (or pnpm / yarn)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/nexus-ai.git
cd nexus-ai
npm install
```

### 3. Development Server
Start the local Vite development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production & Typecheck
```bash
# Type check TypeScript codebase
npm run typecheck

# Build optimized production bundle
npm run build

# Preview production build
npm run preview
```

---

## 🔌 AI Provider Setup

### Option A: Local Ollama / LM Studio (Recommended)
1. Install [Ollama](https://ollama.com/) and download your desired model:
   ```bash
   ollama run qwen2.5-coder:7b
   # or
   ollama run llama3.2
   ```
2. Open **Nexus AI Settings** (⚙️ bottom left).
3. Ensure the **OpenAI Compatible API** endpoint is set to `http://localhost:11434/v1`.
4. Your locally installed models will automatically appear in the model selector dropdown.

### Option B: Chrome Built-in Gemini Nano (`window.ai`)
1. Use Google Chrome version 127+.
2. Navigate to `chrome://flags` and enable:
   - `#enable-experimental-web-platform-features`
   - `#optimization-guide-on-device-model`
   - `#prompt-api-for-gemini-nano`
3. Verify model status at `chrome://on-device-internals/` (Status should show **Ready**).
4. Select **"Gemini Nano (Built-in)"** from the model dropdown.

---

## 🛡️ Security & Responsible Use Notice
Nexus AI is built for authorized security testing, educational research, defensive threat modeling, and bug bounty hunting. Users are strictly responsible for complying with all applicable laws and ensuring they have explicit permission before assessing or testing any target infrastructure.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).