import type { ChatMessage } from '@/types'
import { parseSSE } from '../parseSSE'

/**
 * Anthropic (Claude) — Messages API（SSE ストリーム）
 * https://docs.anthropic.com/en/api/messages-streaming
 */
export async function streamAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, messages, max_tokens: 4096, stream: true }),
    signal,
  })
  if (!r.ok) throw new Error(`Anthropic ${r.status}`)

  await parseSSE(r, d => {
    try {
      const p = JSON.parse(d) as { type?: string; delta?: { text?: string } }
      if (p.type === 'content_block_delta') onChunk(p.delta?.text ?? '')
    } catch { /* ignore */ }
  }, signal)
}
