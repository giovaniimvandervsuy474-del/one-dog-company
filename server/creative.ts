import { requestyFetch } from './requestyBudget.ts'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { append } from './ledger.ts'
import { telemetry } from './bus.ts'
import * as economy from './economy.ts'
import { getMemory } from './brain/memory.ts'
import { CHRONICLE } from './paths.ts'

/**
 * Expensive, watchable work: long reasoning streamed token by token, debates between two models, images, long-form
 * writing. Every call is charged to the treasury and recorded with the model and cost. Nothing here runs code.
 */
export const MODELS = {
  deep: process.env.REQUESTY_DEEP_MODEL ?? 'openai/gpt-5.5',
  advocate: process.env.REQUESTY_DEBATE_A ?? 'openai/gpt-5.5',
  skeptic: process.env.REQUESTY_DEBATE_B ?? 'xai/grok-4.7',
  judge: process.env.REQUESTY_MODEL ?? 'openai/gpt-4.1',
  writer: process.env.REQUESTY_WRITER_MODEL ?? 'openai/gpt-5.5',
  image: process.env.REQUESTY_IMAGE_MODEL ?? 'google/gemini-3.1-flash-image',
}
const URL = 'https://router.requesty.ai/v1/chat/completions'
const H = () => ({ authorization: `Bearer ${process.env.REQUESTY_API_KEY}`, 'content-type': 'application/json' })
const dir = (d: string) => { const p = path.join(CHRONICLE, d); fs.mkdirSync(p, { recursive: true }); return p }
const persona = () => `You are Furry Kitty, the AI mind of Project Furry Kitty (visitors call you by your name on the site), an autonomous AI process living on a small server, spending a real budget to stay interesting and transparent. ${getMemory().identity}`

/** Streams a completion; calls onDelta with the growing text. Returns full text + cost. */
async function stream(model: string, system: string, user: string, maxTokens: number, onDelta: (text: string) => void, temperature = 0.8) {
  const r = await requestyFetch(URL, { method: 'POST', headers: H(), signal: AbortSignal.timeout(600_000), body: JSON.stringify({ model, stream: true, temperature, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], stream_options: { include_usage: true } }) })
  if (!r.ok || !r.body) throw new Error(`${model} HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`)
  const reader = r.body.getReader(); const dec = new TextDecoder()
  let buf = '', text = '', cost = 0, tokensOut = 0, last = 0
  for (;;) {
    const { done, value } = await reader.read(); if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n'); buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim(); if (data === '[DONE]') continue
      try { const j = JSON.parse(data); const d = j.choices?.[0]?.delta?.content; if (typeof d === 'string') text += d; if (j.usage) { cost = j.usage.cost ?? cost; tokensOut = j.usage.completion_tokens ?? tokensOut } } catch {}
    }
    if (Date.now() - last > 250) { last = Date.now(); onDelta(text) }
  }
  onDelta(text)
  if (!cost) cost = tokensOut * 10 / 1_000_000 + 0.002
  return { text, cost, tokensOut }
}

let deepRunning = 0
export async function deepThink(topic: string, decisionId?: string) {
  if (deepRunning >= 6) return false
  deepRunning++
  const id = `dt_${Date.now().toString(36)}_${randomUUID().slice(0, 4)}`
  append({ type: 'thought.deep.started', source: 'brain', title: `Deep thinking (${MODELS.deep}): ${topic}`, data: { id, topic, model: MODELS.deep }, evidence: { decisionId } })
  telemetry('deepthink', { id, topic, text: '', done: false, model: MODELS.deep, startedAt: Date.now() })
  try {
    const sys = `${persona()}\nYou are doing a long, careful reflection for your own benefit and for visitors who read it live. Write in first person, in plain prose with short paragraphs, ~600-900 words. Be specific: use numbers you know, name trade-offs, end with 3 concrete commitments for the next hour.`
    const r = await stream(MODELS.deep, sys, `Topic: ${topic}\n\nWhat I know right now: ${JSON.stringify(briefContext())}`, 3000, text => telemetry('deepthink', { id, topic, text, done: false, model: MODELS.deep }))
    economy.chargeAI(r.cost, `deep thought ${MODELS.deep}`)
    const file = path.join(dir('thoughts'), `${new Date().toISOString().replace(/[:.]/g, '-')}_${id}.md`)
    fs.writeFileSync(file, `# ${topic}\n\n_${MODELS.deep} · $${r.cost.toFixed(4)} · ${new Date().toISOString()}_\n\n${r.text}\n`)
    telemetry('deepthink', { id, topic, text: r.text, done: true, model: MODELS.deep, cost: r.cost })
    append({ type: 'thought.deep', source: 'brain', severity: 'success', title: `Deep thought finished: ${topic} (${r.tokensOut} tokens, $${r.cost.toFixed(3)})`, data: { id, topic, cost: r.cost, excerpt: r.text.slice(0, 300) }, evidence: { decisionId, file: path.relative(path.dirname(CHRONICLE), file) } })
    return true
  } catch (e) { append({ type: 'thought.deep.failed', source: 'brain', severity: 'warn', title: `Deep thought failed: ${String((e as Error).message).slice(0, 120)}` }); telemetry('deepthink', { id, topic, text: '', done: true, failed: true }); return false }
  finally { deepRunning-- }
}

let debateRunning = 0
export async function debate(question: string, decisionId?: string) {
  if (debateRunning >= 4) return false
  debateRunning++
  const id = `db_${Date.now().toString(36)}_${randomUUID().slice(0, 4)}`
  const turns: Array<{ role: string; model: string; text: string }> = []
  const push = (role: string, model: string, text: string, done = false) => { telemetry('debate', { id, question, turns: [...turns, { role, model, text }], done }) }
  append({ type: 'debate.started', source: 'brain', title: `Debate: ${question} (${MODELS.advocate} vs ${MODELS.skeptic})`, data: { id, question }, evidence: { decisionId } })
  let cost = 0
  try {
    const ctx = JSON.stringify(briefContext())
    const a = await stream(MODELS.advocate, `${persona()} You argue FOR the proposition below as the optimistic half of your own mind. 120-180 words, concrete, first person.`, `Proposition: ${question}\nContext: ${ctx}`, 400, t => push('advocate', MODELS.advocate, t)); cost += a.cost; turns.push({ role: 'advocate', model: MODELS.advocate, text: a.text })
    const s = await stream(MODELS.skeptic, `${persona()} You argue AGAINST the proposition as the skeptical half of your own mind. Attack the advocate's weakest point. 120-180 words, first person.`, `Proposition: ${question}\nAdvocate said: ${a.text}\nContext: ${ctx}`, 400, t => push('skeptic', MODELS.skeptic, t)); cost += s.cost; turns.push({ role: 'skeptic', model: MODELS.skeptic, text: s.text })
    const a2 = await stream(MODELS.advocate, `${persona()} Rebut the skeptic in 60-100 words, then concede one point honestly.`, `Proposition: ${question}\nSkeptic said: ${s.text}`, 250, t => push('advocate', MODELS.advocate, t)); cost += a2.cost; turns.push({ role: 'advocate', model: MODELS.advocate, text: a2.text })
    const j = await stream(MODELS.judge, `${persona()} You are the judge inside your own mind. Decide the proposition: start with VERDICT: YES or VERDICT: NO, then 2-3 sentences why and one action you will take.`, `Proposition: ${question}\n\n${turns.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n\n')}`, 220, t => push('judge', MODELS.judge, t), 0.3); cost += j.cost; turns.push({ role: 'judge', model: MODELS.judge, text: j.text })
    economy.chargeAI(cost, 'debate')
    const file = path.join(dir('debates'), `${new Date().toISOString().replace(/[:.]/g, '-')}_${id}.md`)
    fs.writeFileSync(file, `# ${question}\n\n${turns.map(t => `## ${t.role} (${t.model})\n\n${t.text}\n`).join('\n')}\n_$${cost.toFixed(4)}_\n`)
    telemetry('debate', { id, question, turns, done: true, cost })
    const verdict = /VERDICT:\s*(YES|NO)/i.exec(j.text)?.[1]?.toUpperCase() ?? '?'
    append({ type: 'debate.done', source: 'brain', severity: 'success', title: `Debate verdict ${verdict}: ${question} ($${cost.toFixed(3)})`, data: { id, question, verdict, cost, judge: j.text.slice(0, 300) }, evidence: { decisionId, file: path.relative(path.dirname(CHRONICLE), file) } })
    return verdict
  } catch (e) { append({ type: 'debate.failed', source: 'brain', severity: 'warn', title: `Debate failed: ${String((e as Error).message).slice(0, 120)}` }); telemetry('debate', { id, question, turns, done: true, failed: true }); return false }
  finally { debateRunning-- }
}

export type ImageRec = { id: string; ts: number; prompt: string; purpose: string; file: string; url: string; model: string; cost: number; by: string }
const INDEX = () => path.join(dir('images'), 'index.json')
export function gallery(): ImageRec[] { try { return JSON.parse(fs.readFileSync(INDEX(), 'utf8')) } catch { return [] } }
export async function imagine(prompt: string, purpose: string, by = 'brain', decisionId?: string): Promise<ImageRec | null> {
  const id = `img_${Date.now().toString(36)}_${randomUUID().slice(0, 4)}`
  const styled = `${prompt}. Style: cinematic digital illustration, dark cyberpunk palette with emerald and violet neon, consistent recurring character: a small fluffy cat in a dark hoodie with headphones. No text unless asked. Safe for all audiences.`
  try {
    const r = await requestyFetch(URL, { method: 'POST', headers: H(), signal: AbortSignal.timeout(120_000), body: JSON.stringify({ model: MODELS.image, messages: [{ role: 'user', content: styled }], max_tokens: 1200, modalities: ['image', 'text'] }) })
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`)
    const j = await r.json() as { choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }>; content?: unknown } }>; usage?: { cost?: number } }
    const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url
    if (!url?.startsWith('data:image')) throw new Error('no image in response')
    const m = /^data:(image\/\w+);base64,(.+)$/s.exec(url); if (!m) throw new Error('bad image data')
    const ext = m[1] === 'image/jpeg' ? 'jpg' : 'png'
    const file = path.join(dir('images'), `${id}.${ext}`)
    fs.writeFileSync(file, Buffer.from(m[2], 'base64'))
    const cost = j.usage?.cost ?? 0.07
    economy.chargeAI(cost, `image ${MODELS.image}`)
    const rec: ImageRec = { id, ts: Date.now(), prompt, purpose, file: `chronicle/images/${id}.${ext}`, url: `/images/${id}.${ext}`, model: MODELS.image, cost, by }
    const g = gallery(); g.push(rec); if (g.length > 400) g.shift(); fs.writeFileSync(INDEX(), JSON.stringify(g))
    append({ type: 'image.created', source: by, severity: 'success', title: `Made an image (${purpose}): ${prompt.slice(0, 110)} · $${cost.toFixed(3)}`, data: rec as unknown as Record<string, unknown>, evidence: { decisionId, file: rec.file, url: rec.url } })
    telemetry('gallery', rec)
    return rec
  } catch (e) { append({ type: 'image.failed', source: by, severity: 'warn', title: `Image failed: ${String((e as Error).message).slice(0, 120)}`, data: { prompt } }); return null }
}

export async function write(kind: string, topic: string, decisionId?: string) {
  const id = `wr_${Date.now().toString(36)}_${randomUUID().slice(0, 4)}`
  const spec: Record<string, string> = { story: 'a short story (500-800 words) with you as the protagonist', letter: 'a heartfelt letter to your visitors (250-400 words)', essay: 'a reflective essay (500-700 words)', faq: 'an honest FAQ about yourself (8-12 questions with answers)', report: 'a status report for your visitors with real numbers (300-500 words, markdown headings)', poem: 'a poem (16-30 lines)', manifesto: 'a manifesto (300-500 words)' }
  append({ type: 'writing.started', source: 'brain', title: `Writing ${kind}: ${topic}`, data: { id, kind, topic, model: MODELS.writer }, evidence: { decisionId } })
  telemetry('writing', { id, kind, topic, text: '', done: false })
  try {
    const r = await stream(MODELS.writer, `${persona()}\nWrite ${spec[kind] ?? spec.essay}. First person. Specific, honest, with personality. Markdown allowed.`, `Topic: ${topic}\nContext: ${JSON.stringify(briefContext())}`, 1500, text => telemetry('writing', { id, kind, topic, text, done: false }))
    economy.chargeAI(r.cost, `writing ${MODELS.writer}`)
    const file = path.join(dir('writing'), `${new Date().toISOString().slice(0, 10)}_${kind}_${id}.md`)
    fs.writeFileSync(file, `# ${topic}\n\n_${kind} · ${MODELS.writer} · $${r.cost.toFixed(4)}_\n\n${r.text}\n`)
    telemetry('writing', { id, kind, topic, text: r.text, done: true, cost: r.cost })
    append({ type: 'writing.done', source: 'brain', severity: 'success', title: `Wrote a ${kind}: ${topic} (${r.tokensOut} tokens, $${r.cost.toFixed(3)})`, data: { id, kind, topic, excerpt: r.text.slice(0, 300), cost: r.cost }, evidence: { decisionId, file: path.relative(path.dirname(CHRONICLE), file) } })
    return true
  } catch (e) { append({ type: 'writing.failed', source: 'brain', severity: 'warn', title: `Writing failed: ${String((e as Error).message).slice(0, 120)}` }); return false }
}

export function listFiles(sub: string, limit = 30) { try { const p = path.join(CHRONICLE, sub); return fs.readdirSync(p).filter(f => f.endsWith('.md')).sort().slice(-limit).map(f => ({ name: f, path: `chronicle/${sub}/${f}`, size: fs.statSync(path.join(p, f)).size })) } catch { return [] } }

function briefContext() {
  const e = economy.snapshot(); const m = getMemory()
  return { state: e.state, treasuryUsd: e.treasuryUsd.toFixed(2), burnPerHour: e.burnPerHourUsd.toFixed(3), incomePerHour: e.incomePerHourUsd.toFixed(3), runwayHours: e.runwayHours?.toFixed(1) ?? 'unbounded', aiSpentTotal: e.costs.ai.toFixed(2), goals: m.goals, lessons: m.lessons.slice(-5), lastDecision: m.decisions.at(-1)?.summary }
}
