# 🧵 Braided

**Branch AI perspectives, weave the answer.**

Send a question to multiple AI models at once, branch from any response to dig deeper, and merge insights into a unified answer.

> 複数のAIに同時に問いを投げ、回答を分岐・統合して答えを編み上げるツールです。

---

## Features

- **Multi-model parallel sending** — Ask all your selected models at once and compare responses side by side
- **Model policy comparison** — Send the same question to multiple models simultaneously and observe how their responses diverge. Particularly effective for politically sensitive topics, ethical dilemmas, or contested facts — where differences in training data, safety guidelines, and response policies become plainly visible across models in a single view.
- **Branch from any response** — Dig deeper into any direction without losing context
- **Σ (Sigma) summarization** — Let an AI synthesize all responses into a single summary
- **Consolidation** — Compare, merge, or diff responses across multiple questions
- **Manual context cards** — Inject your own text into the conversation context
- **Client-side context management** — Braided builds and controls the full conversation context on your device. You decide what each model sees: exclude specific responses, include branch threads in summaries, or inject custom text — without relying on any cloud memory service. Automatic history compression keeps local models (Ollama / LM Studio) within their context window limits, and a context log lets you inspect exactly what was sent to each model.
- **Export** — Download sessions as Markdown or sync to an Obsidian vault
- **Bilingual UI** — Japanese / English toggle

---

## Supported Providers

| Provider | Type | Notes |
|---|---|---|
| [Ollama](https://ollama.com) | Local | Auto-detects running models |
| [LM Studio](https://lmstudio.ai) | Local | OpenAI-compatible API |
| [AnythingLLM](https://anythingllm.com) | Local / Cloud | Workspace slug as model |
| [OpenAI](https://platform.openai.com) | Cloud | GPT-4o, GPT-4, etc. |
| [Anthropic](https://anthropic.com) | Cloud | Claude 3.x / 3.5 / 3.7 |
| [Google Gemini](https://ai.google.dev) | Cloud | Gemini 1.5 / 2.0 |
| [xAI Grok](https://x.ai) | Cloud | Grok-2 |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Local development

```bash
git clone https://github.com/ZukarMoi/braided.git
cd braided
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
npm run build
# Output: dist/
```

---

## Local AI Setup

### Ollama

**CLI (terminal launch)**

Add to `~/.zshrc` (or `~/.bashrc`):
```bash
export OLLAMA_HOST=0.0.0.0:11434
export OLLAMA_ORIGINS="*"
```
Then launch with `ollama serve`.

**macOS App (menu bar)**

The app runs as a launchd service and does not read `.zshrc`. Set environment variables with:
```bash
launchctl setenv OLLAMA_ORIGINS "*"
launchctl setenv OLLAMA_HOST "0.0.0.0:11434"
```
Then quit and restart Ollama from the menu bar.

> **Note:** When using Braided from a hosted URL (e.g. GitHub Pages), the above ORIGINS setting is required for the browser to allow cross-origin requests to localhost.

---

### LM Studio

1. Open LM Studio → **Local Server** tab
2. Load a model and start the server (default: `http://localhost:1234`)
3. In Braided's Settings, set the LM Studio URL to `http://localhost:1234`
4. Enable **CORS** in LM Studio's server settings

> LM Studio exposes an OpenAI-compatible API. The same hosted URL restriction applies — local access via `localhost:5173` is recommended when using local models.

---

### AnythingLLM

1. Start AnythingLLM and create a **Workspace**
2. Note the workspace **slug** (shown in the URL, e.g. `my-workspace`)
3. In Braided's Settings, set the AnythingLLM URL (default: `http://localhost:3001`)
4. Enter the API key if authentication is enabled (Settings → API Keys in AnythingLLM)
5. The workspace slug is used as the model name in Braided

---

## Tech Stack

- [Vue 3](https://vuejs.org) + TypeScript + [Vite](https://vitejs.dev)
- [Pinia](https://pinia.vuejs.org) — state management
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) (`idb-keyval`) — local persistence
- [marked](https://marked.js.org) — Markdown rendering
- No backend — runs entirely in the browser

---

## Privacy

- **API keys are stored in your browser only** (IndexedDB). They are never sent to any server other than the respective AI provider.
- **Conversation data stays local.** Nothing is uploaded or tracked.
- Each provider receives only the messages necessary for your current request.

---

## License

Copyright (c) 2026 Zukar Moi

This software is licensed under **MIT License with Commons Clause and Additional Conditions**. See [LICENSE](./LICENSE) for the full text.

**Summary:**

- **PART 1 – MIT License** — Free to use, modify, and distribute.
- **PART 2 – Commons Clause** — Commercial resale of this software as a product or service is not permitted.
- **PART 3 – Third-Party AI Services Disclaimer** — Users are solely responsible for compliance with the terms of service of any AI provider (OpenAI, Anthropic, Google, xAI, Meta, Mistral, etc.) connected through this software. No API keys or model weights are included.
- **PART 4 – Additional Conditions** — Redistributions must retain the original license and copyright notice. Modified versions must be clearly marked as such.
