import { useSettingsStore } from '@/stores/settings'

// プロバイダ別・モデル別の文字数上限キャッシュ
const modelLimitCache = new Map<string, number | null>()

/**
 * モデル名のパラメータ数（B）から文字数上限を推定する。
 * 例: "llama3:7b", "mistral-7b-instruct", "phi3:3.8b"
 */
export function parseSizeFromModelName(name: string): number {
  const m = name.toLowerCase().match(/(\d+(?:\.\d+)?)\s*b\b/)
  const params = m ? parseFloat(m[1]) : 7  // 不明なら 7B 相当とする
  if (params <= 3)  return  6_000   // ~2k tokens 相当
  if (params <= 7)  return 12_000   // ~4k tokens 相当
  if (params <= 14) return 24_000   // ~8k tokens 相当
  if (params <= 30) return 48_000   // ~16k tokens 相当
  return 96_000                     // 30B+
}

/**
 * モデルキー（"ollama:llama3" など）から文字数上限を解決する。
 * - Cloud / AnythingLLM: null（制限なし）
 * - Ollama: /api/show でコンテキスト長を取得 → 推定文字数に変換
 * - LMStudio: モデル名からパラメータ数を推定
 * - 手動上書きが設定されている場合はそれを優先
 */
export async function resolveCharLimit(modelKey: string): Promise<number | null> {
  if (modelLimitCache.has(modelKey)) return modelLimitCache.get(modelKey)!

  const [prov, ...rest] = modelKey.split(':')
  const modelName = rest.join(':')

  // Cloud・AnythingLLM は制限なし
  if (['openai', 'anthropic', 'gemini', 'grok', 'anythingllm'].includes(prov)) {
    modelLimitCache.set(modelKey, null)
    return null
  }

  const cfg = useSettingsStore().cfg

  // 手動上書きが設定されていればそれを使う（0 = 自動）
  const manualLimit = prov === 'ollama'   ? cfg.ollama.contextLimitChars
                    : prov === 'lmstudio' ? cfg.lmstudio.contextLimitChars
                    : undefined
  if (manualLimit && manualLimit > 0) {
    modelLimitCache.set(modelKey, manualLimit)
    return manualLimit
  }

  // Ollama: /api/show でモデルのコンテキスト長を取得
  if (prov === 'ollama') {
    try {
      const r = await fetch(`${cfg.ollama.url}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      })
      if (r.ok) {
        const data = await r.json() as {
          model_info?: Record<string, unknown>
          parameters?: string
          details?: { parameter_size?: string }
        }
        // 新しい Ollama (≥0.3): model_info に context_length
        const ctxFromInfo = data.model_info?.['llama.context_length'] as number | undefined
        // 古い Ollama: parameters 文字列に "num_ctx XXXX"
        const paramMatch = data.parameters?.match(/num_ctx\s+(\d+)/)
        const ctxLen = ctxFromInfo ?? (paramMatch ? parseInt(paramMatch[1]) : null)
        if (ctxLen) {
          // トークン → 文字: 日英混合で 1token ≈ 2.5字、履歴は 60% に抑える
          const limit = Math.floor(ctxLen * 2.5 * 0.6)
          modelLimitCache.set(modelKey, limit)
          return limit
        }
        // context_length が取れなくてもパラメータ数から推定
        const sizeStr = data.details?.parameter_size ?? modelName
        const limit = parseSizeFromModelName(sizeStr)
        modelLimitCache.set(modelKey, limit)
        return limit
      }
    } catch { /* ネットワークエラー等 → フォールバック */ }
  }

  // LMStudio / Ollama フォールバック: モデル名からパラメータ数を推定
  const limit = parseSizeFromModelName(modelName)
  modelLimitCache.set(modelKey, limit)
  return limit
}
