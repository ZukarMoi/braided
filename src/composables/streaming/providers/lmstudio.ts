import type { ChatMessage } from '@/types'
import { parseSSE } from '../parseSSE'

/**
 * LM Studio — OpenAI 互換 API（ベース URL のみ異なる）
 * https://lmstudio.ai/docs/api/openai-api
 */
export async function streamLMStudio(
  base: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const r = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  })
  if (!r.ok) throw new Error(`LM Studio ${r.status}`)

  await parseSSE(r, d => {
    if (d === '[DONE]') return
    try {
      const parsed = JSON.parse(d) as { choices?: Array<{ delta?: { content?: string } }> }
      onChunk(parsed.choices?.[0]?.delta?.content ?? '')
    } catch { /* ignore */ }
  }, signal)
}
