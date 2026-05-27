import type { ChatMessage, StreamStats } from '@/types'

/**
 * Ollama — NDJSON ストリーム形式
 * https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion
 *
 * ストリーム終端の done:true 行に応答統計が含まれる:
 *   total_duration  — 合計時間（ナノ秒）
 *   eval_count      — 生成トークン数
 *   eval_duration   — 生成時間（ナノ秒）
 */
export async function streamOllama(
  base: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  unloadAfter = false,
  onStats?: (stats: StreamStats) => void,
): Promise<void> {
  const body: Record<string, unknown> = { model, messages, stream: true }
  if (unloadAfter) body.keep_alive = 0

  const r = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!r.ok) throw new Error(`Ollama ${r.status}`)

  const reader = r.body!.getReader()
  const dec = new TextDecoder()
  while (true) {
    if (signal?.aborted) break
    const { done, value } = await reader.read()
    if (done) break
    for (const line of dec.decode(value).split('\n').filter(Boolean)) {
      try {
        const d = JSON.parse(line) as {
          message?: { content?: string }
          done?: boolean
          total_duration?: number
          eval_count?: number
          eval_duration?: number
        }
        if (d.message?.content) onChunk(d.message.content)
        if (d.done && onStats && d.eval_count && d.eval_duration && d.total_duration) {
          onStats({
            totalMs:     Math.round(d.total_duration / 1e6),
            tokensPerSec: Math.round((d.eval_count / (d.eval_duration / 1e9)) * 10) / 10,
            evalCount:   d.eval_count,
          })
        }
      } catch { /* ignore parse errors */ }
    }
  }
}
