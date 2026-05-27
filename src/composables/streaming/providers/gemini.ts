import type { ChatMessage } from '@/types'
import { parseSSE } from '../parseSSE'

/**
 * Google Gemini — generateContent API（SSE ストリーム）
 * https://ai.google.dev/api/generate-content#method:-models.streamgeneratecontent
 *
 * 注: role が OpenAI 形式（'assistant'）と異なり 'model' を使用する。
 */
export async function streamGemini(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
      signal,
    },
  )
  if (!r.ok) throw new Error(`Gemini ${r.status}`)

  await parseSSE(r, d => {
    try {
      const parsed = JSON.parse(d) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      onChunk(parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '')
    } catch { /* ignore */ }
  }, signal)
}
