import { append } from './ledger.ts'
import { getGenome } from './genome.ts'
import * as economy from './economy.ts'
import * as creative from './creative.ts'
import * as sched from './scheduler.ts'
import { getMemory } from './brain/memory.ts'
import { since } from './ledger.ts'

/**
 * Budget pacer. The brain sets topics and priorities; this loop only makes sure the hourly spend target is actually
 * reached by launching more of the agent's own expensive, watchable work when the last 10 minutes fell short.
 * Topics are always taken from the agent's own recent decisions, hypotheses, thoughts and goals: never invented here.
 */
let isPaused = () => false
export function bindPaused(fn: () => boolean) { isPaused = fn }
let rotation = 0
let lastLaunch = 0

function topics(): string[] {
  const m = getMemory(); const recent = since(Date.now() - 3600_000)
  const t: string[] = []
  for (const d of m.decisions.slice(-5)) t.push(d.summary)
  for (const h of (m.hypotheses ?? []).filter(h => !h.result).slice(-3)) t.push(`My open hypothesis: ${h.statement}`)
  for (const g of m.goals.slice(-3)) t.push(`My goal: ${g}`)
  for (const e of recent.filter(e => e.type === 'chat.message').slice(-3)) t.push(`A visitor said: ${e.title}`)
  for (const e of recent.filter(e => e.type === 'thought.deep').slice(-2)) t.push(`Continuing my earlier reflection: ${(e.data as { topic?: string })?.topic ?? e.title}`)
  return t.filter(Boolean)
}
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

async function tick() {
  if (isPaused() || sched.overload.active) return
  const g = getGenome(); if (g.spendTargetPerHour <= 0) return
  const expected10 = g.spendTargetPerHour / 6
  const spent10 = economy.aiSpend(600_000)
  if (spent10 >= expected10 * 0.9) return
  if (Date.now() - lastLaunch < 10_000) return
  const ts = topics(); if (!ts.length) return
  lastLaunch = Date.now()
  // launch several items per tick when far behind (each deep thought on the pro model is ~$0.5, a debate ~$0.15, an image ~$0.07)
  const launches = Math.max(1, Math.min(5, Math.ceil((expected10 - spent10) / 0.6)))
  for (let i = 0; i < launches; i++) launchOne(ts, spent10, expected10)
}
function launchOne(ts: string[], spent10: number, expected10: number) {
  const kind = ['deep', 'debate', 'image', 'deep', 'write', 'deep', 'debate', 'deep'][rotation++ % 8]
  const topic = pick(ts)
  const gap = `$${spent10.toFixed(2)} of $${expected10.toFixed(2)} spent in the last 10 min`
  if (kind === 'deep') { append({ type: 'pacer.launched', source: 'pacer', title: `Behind the budget pace (${gap}) → deep thought: ${topic.slice(0, 90)}`, data: { kind, topic, spent10, expected10 } }); void creative.deepThink(topic) }
  else if (kind === 'debate') { const q = `Is this the right call right now: ${topic.slice(0, 160)}?`; append({ type: 'pacer.launched', source: 'pacer', title: `Behind the budget pace (${gap}) → debate: ${q.slice(0, 90)}`, data: { kind, topic: q, spent10, expected10 } }); void creative.debate(q) }
  else if (kind === 'image') { const eco = economy.snapshot(); const prompt = `Self-portrait of Furry Kitty right now: mood ${getMemory().decisions.at(-1)?.mood ?? 'focused'}, treasury $${eco.treasuryUsd.toFixed(0)}, state ${eco.state.toLowerCase()}; a scene that expresses: ${topic.slice(0, 140)}`; append({ type: 'pacer.launched', source: 'pacer', title: `Behind the budget pace (${gap}) → image: ${prompt.slice(0, 90)}`, data: { kind, topic: prompt, spent10, expected10 } }); void creative.imagine(prompt, 'portrait', 'pacer') }
  else { append({ type: 'pacer.launched', source: 'pacer', title: `Behind the budget pace (${gap}) → writing: ${topic.slice(0, 90)}`, data: { kind, topic, spent10, expected10 } }); void creative.write(pick(['essay', 'letter', 'report', 'story']), topic) }
}
export function start() { setInterval(() => { tick().catch(() => {}) }, 15_000) }
