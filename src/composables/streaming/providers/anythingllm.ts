import type { ChatMessage } from '@/types'
import { parseSSE } from '../parseSSE'

/**
 * AnythingLLM — OpenAI 互換エンドポイント
 * workspace slug をモデル名として使用する。
 * https://docs.anythingllm.com/api-reference/openai-compatible
 */
export async function streamAnythingLLM(
  base: string,
  apiKey: string,
  workspace: string,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const r = await fetch(`${base}/api/openai/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ model: workspace, messages, stream: true }),
    signal,
  })
  if (!r.ok) throw new Error(`AnythingLLM ${r.status}`)

  await parseSSE(r, d => {
    if (d === '[DONE]') return
    try {
      const parsed = JSON.parse(d) as { choices?: Array<{ delta?: { content?: string } }> }
      onChunk(parsed.choices?.[0]?.delta?.content ?? '')
    } catch { /* ignore */ }
  }, signal)
}
