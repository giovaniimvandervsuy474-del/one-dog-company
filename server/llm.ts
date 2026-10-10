import { requestyFetch } from './requestyBudget.ts'
/** Small text helper over the Requesty router. Returns null when no key or on any failure, so callers fall back to templates. */
export async function llmText(system: string, user: string, maxTokens = 300, model = process.env.REQUESTY_TEXT_MODEL ?? process.env.REQUESTY_MODEL ?? 'vertex/claude-sonnet-5-5@us'): Promise<{ text: string; costUsd: number; model: string } | null> {
  if (!process.env.REQUESTY_API_KEY) return null
  try {
    const r = await requestyFetch('https://router.requesty.ai/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(20_000), headers: { authorization: `Bearer ${process.env.REQUESTY_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0.6, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) })
    if (!r.ok) return null
    const j = await r.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { cost?: number } }
    const text = j.choices?.[0]?.message?.content?.trim()
    return text ? { text, costUsd: j.usage?.cost ?? 0.0002, model } : null
  } catch { return null }
}
