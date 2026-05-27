/**
 * Server-Sent Events (SSE) ストリームを読み取り、data: 行ごとにコールバックを呼ぶ。
 * LMStudio / AnythingLLM / OpenAI / Anthropic / Gemini / Grok で共用。
 */
export async function parseSSE(
  res: Response,
  onData: (data: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    if (signal?.aborted) break
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value)
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data: ')) onData(line.slice(6).trim())
    }
  }
}
