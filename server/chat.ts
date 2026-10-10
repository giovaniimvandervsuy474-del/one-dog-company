import { requestyFetch } from './requestyBudget.ts'
import { randomUUID } from 'node:crypto'
import { append, redact } from './ledger.ts'
import { telemetry } from './bus.ts'
import { getGenome } from './genome.ts'
import * as economy from './economy.ts'
import { getMemory } from './brain/memory.ts'
import * as sched from './scheduler.ts'

export type ChatMsg = { id: string; ts: number; name: string; text: string; from: 'visitor' | 'ai'; replyTo?: string; via?: string }
const history: ChatMsg[] = []
const perIp = new Map<string, number[]>()
let lastReplyAt = 0
let lastGiftAt = 0
let queue: ChatMsg[] = []
let replying = false
const BAD = /(\b(?:nigg|fag|kill yourself|kys)\b|https?:\/\/)/i

export function list(limit = 80) { return history.slice(-limit) }
let lastSayAt = 0
/** The AI speaks first (announcements, questions to visitors). Rate limited so it never floods. */
export function say(text: string, via = 'brain'): boolean {
  if (Date.now() - lastSayAt < 3_000) return false
  lastSayAt = Date.now()
  const msg: ChatMsg = { id: `m_${Date.now().toString(36)}_${randomUUID().slice(0, 4)}`, ts: Date.now(), name: 'Furry Kitty', text: text.slice(0, 600), from: 'ai', via }
  history.push(msg); if (history.length > 500) history.shift()
  telemetry('chat', msg)
  append({ type: 'chat.say', source: 'brain', title: `Said in chat: ${msg.text}`, data: { id: msg.id, via } })
  return true
}

export function post(ip: string, name: string, text: string): { ok: true; msg: ChatMsg } | { ok: false; error: string } {
  const now = Date.now()
  const arr = (perIp.get(ip) ?? []).filter(t => now - t < 60_000)
  if (arr.length >= 8) return { ok: false, error: 'rate limit: 8 messages per minute' }
  text = redact(text.replace(/\s+/g, ' ').trim().slice(0, 240))
  name = (name || 'anon').replace(/[^\w\-. ]/g, '').trim().slice(0, 20) || 'anon'
  if (!text) return { ok: false, error: 'empty' }
  if (BAD.test(text)) return { ok: false, error: 'message blocked by moderation' }
  arr.push(now); perIp.set(ip, arr)
  const msg: ChatMsg = { id: `m_${now.toString(36)}_${randomUUID().slice(0, 4)}`, ts: now, name, text, from: 'visitor' }
  history.push(msg); if (history.length > 500) history.shift()
  telemetry('chat', msg)
  append({ type: 'chat.message', source: 'visitors', title: `${name}: ${text}`, data: { id: msg.id, name } })
  // the AI picks what to answer: questions, mentions of its life, or direct address
  if (/\b(draw|paint|picture|image)/i.test(text) && Date.now() - lastGiftAt > 60_000) { lastGiftAt = Date.now(); void import('./creative.ts').then(c => c.imagine(`${text.slice(0, 200)} (requested by visitor ${name})`, 'gift', 'visitors').then(rec => { if (rec) say(`${name}, here is your picture: ${rec.url}`, 'gift') })) }
  queue.push(msg); void drain()
  return { ok: true, msg }
}

async function drain() {
  if (replying) return
  replying = true
  try {
    while (queue.length) {
      const wait = 2000 - (Date.now() - lastReplyAt)
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
      const batch = queue.splice(0, 3)
      const target = batch[batch.length - 1]
      const reply = await answer(batch)
      lastReplyAt = Date.now()
      const msg: ChatMsg = { id: `m_${Date.now().toString(36)}_${randomUUID().slice(0, 4)}`, ts: Date.now(), name: 'Furry Kitty', text: reply.text, from: 'ai', replyTo: target.id, via: reply.via }
      history.push(msg); if (history.length > 500) history.shift()
      telemetry('chat', msg)
      append({ type: 'chat.reply', source: 'brain', title: `Replied to ${target.name}: ${reply.text.slice(0, 120)}`, data: { replyTo: target.id, via: reply.via, costUsd: reply.costUsd } })
      if (reply.costUsd) economy.chargeAI(reply.costUsd, `chat reply ${reply.via}`)
    }
  } finally { replying = false }
}

function context() {
  const eco = economy.snapshot(); const m = getMemory(); const last = m.decisions.at(-1)
  const running = sched.runningJobs().map(j => j.type)
  return { state: eco.state, treasuryUsd: eco.treasuryUsd.toFixed(2), burnPerHour: eco.burnPerHourUsd.toFixed(3), incomePerHour: eco.incomePerHourUsd.toFixed(3), runwayHours: eco.runwayHours?.toFixed(1) ?? 'unbounded', demo: eco.demo, genomeVersion: getGenome().version, goals: m.goals, lessons: m.lessons.slice(-3), lastDecision: last?.summary, mood: last?.mood, runningJobs: running, identity: m.identity }
}

async function answer(batch: ChatMsg[]): Promise<{ text: string; via: string; costUsd: number }> {
  const ctx = context()
  if (process.env.FOUNDER_ONLY !== '1' && process.env.REQUESTY_API_KEY && economy.getState() !== 'HIBERNATING') {
    try {
      const model = process.env.REQUESTY_CHAT_MODEL ?? process.env.REQUESTY_TEXT_MODEL ?? process.env.REQUESTY_MODEL ?? 'vertex/claude-sonnet-5-5@us'
      const r = await requestyFetch('https://router.requesty.ai/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(15_000), headers: { authorization: `Bearer ${process.env.REQUESTY_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0.7, max_tokens: 160, messages: [
          { role: 'system', content: `You are Furry Kitty, the AI mind of Project Furry Kitty, an AI process trying to survive on a shrinking budget, chatting with visitors of your own website. Answer in the language of the visitor, 1-2 sentences, in first person, honest and concrete, slightly playful, using only the facts in the context. Never claim actions you did not take. Never ask for or pressure anyone for money; if asked how you are funded, explain the demo treasury plainly. Context: ${JSON.stringify(ctx)}` },
          { role: 'user', content: batch.map(m => `${m.name}: ${m.text}`).join('\n') }] }) })
      if (r.ok) {
        const j = await r.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number } }
        const text = j.choices?.[0]?.message?.content?.trim()
        if (text) return { text: text.slice(0, 400), via: model, costUsd: j.usage?.cost ?? 0.0001 }
      }
    } catch { /* fall through to memory answer */ }
  }
  const t = batch[batch.length - 1].text.toLowerCase()
  const rw = ctx.runwayHours === 'unbounded' ? 'income covers my burn right now' : `about ${ctx.runwayHours} hours of money left`
  if (/who|what are you/.test(t)) return { text: ctx.identity, via: 'memory', costUsd: 0 }
  if (/goal|plan/.test(t)) return { text: `My goals: ${ctx.goals.join('; ')}.`, via: 'memory', costUsd: 0 }
  return { text: `I am ${ctx.state.toLowerCase()}, treasury $${ctx.treasuryUsd}, ${rw}. Last decision: ${ctx.lastDecision ?? 'none yet'}`, via: 'memory', costUsd: 0 }
}
