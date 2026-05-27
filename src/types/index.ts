export type NodeType = 'q' | 'r' | 'sigma' | 'merge' | 'consolidation' | 'manual'
export type Provider = 'ollama' | 'lmstudio' | 'anythingllm' | 'openai' | 'anthropic' | 'gemini' | 'grok'
export type MergeStrategy = 'summary' | 'contrast' | 'judge' | 'handoff'
export type ConsolidationStrategy = 'best' | 'merge' | 'diff' | 'custom'
export type SidebarView = 'list' | 'tree'
export type VaultSyncState = 'idle' | 'syncing' | 'ok' | 'err'

export interface BraidedNode {
  id: string
  type: NodeType
  parentId?: string
  parentIds?: string[]        // merge nodes only
  content: string
  model?: string              // 'ollama:llama3', 'anthropic:claude-...' etc.
  timestamp: number
  excluded?: boolean
  _cancelled?: boolean
  _branch?: boolean            // AddCard等の明示的ブランチ操作で生成されたQノード
  _sigmaInclude?: boolean      // ブランチQノード: 親CompositeCardの統合に含めるか
  strategy?: MergeStrategy    // merge nodes only
  consolidationStrategy?: ConsolidationStrategy  // consolidation nodes only
  customInstruction?: string  // consolidation custom strategy
  continueModel?: string      // 単一モデル継続Qノードの場合にmodelKeyを保持
  _ctx?: {
    messages:      Array<{ role: string; content: string }>
    method:        'full-cloud' | 'full-local' | 'compressed' | 'truncated'
    charLimit:     number | null
    originalChars: number
  }
  _stats?: StreamStats  // Ollama のみ: 応答速度統計
}

export interface Session {
  id: string
  title: string
  created: number
  nodes: BraidedNode[]
  injectedContext?: string
}

export interface OllamaConfig     { url: string; unloadAfter?: boolean; contextLimitChars?: number }
export interface LMStudioConfig   { url: string; contextLimitChars?: number }
export interface AnythingLLMConfig{ url: string; apiKey: string }
export interface ProviderConfig   { apiKey: string }
export interface VaultConfig      { path: string; autoSync: boolean }

export interface AppConfig {
  ollama:      OllamaConfig
  lmstudio:    LMStudioConfig
  anythingllm: AnythingLLMConfig
  openai:      ProviderConfig
  anthropic:   ProviderConfig
  gemini:      ProviderConfig
  grok:        ProviderConfig
  vault:       VaultConfig
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Ollama から取得できるストリーミング統計 */
export interface StreamStats {
  totalMs: number       // 合計応答時間（ミリ秒）
  tokensPerSec: number  // 生成速度（tokens/sec）
  evalCount: number     // 生成トークン数
}

export interface DisplayTurn {
  q: BraidedNode
  responses: BraidedNode[]
  sigma: BraidedNode | null
}
