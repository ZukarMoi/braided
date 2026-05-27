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

[MIT + Commons Clause](./LICENSE) — Free to use and modify; commercial resale is not permitted.

See [LICENSE](./LICENSE) for full terms including third-party AI service disclaimers.
