import type { ChatMessage } from '@/types'
import { parseSSE } from '../parseSSE'

/**
 * OpenAI — Chat Completions API（SSE ストリーム）
 * https://platform.openai.com/docs/api-reference/streaming
 */
export async function streamOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  })
  if (!r.ok) throw new Error(`OpenAI ${r.status}`)

  await parseSSE(r, d => {
    if (d === '[DONE]') return
    try {
      const parsed = JSON.parse(d) as { choices?: Array<{ delta?: { content?: string } }> }
      onChunk(parsed.choices?.[0]?.delta?.content ?? '')
    } catch { /* ignore */ }
  }, signal)
}
