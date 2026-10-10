import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { append, since } from './ledger.ts'
import { telemetry } from './bus.ts'
import { getGenome, mutate, mutateJobInterval } from './genome.ts'
import * as economy from './economy.ts'
void economy
import * as sched from './scheduler.ts'
import { getMemory, addLesson } from './brain/memory.ts'
import { llmText } from './llm.ts'
import { CHRONICLE } from './paths.ts'
import { say as chatSay } from './chat.ts'
let isPaused = () => false
export function bindPaused(fn: () => boolean) { isPaused = fn }
import type { JobRecord } from './types.ts'

/**
 * Missions: multi-step goals the server works through in order. Each step is a real job, a genome change,
 * a measured check, or a written artifact (diary, audit note, post draft). Steps are visible as they progress,
 * nothing is skipped or faked, and every mission ends with a recorded outcome.
 */
export type Step = { id: string; title: string; status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'; startedAt?: number; finishedAt?: number; result?: string; jobId?: string; file?: string }
export type Mission = { id: string; key: string; title: string; why: string; steps: Step[]; status: 'active' | 'done' | 'failed'; startedAt: number; finishedAt?: number; outcome?: string; progress: number }

type Ctx = { m: Mission; vars: Record<string, unknown> }
type StepDef = { title: string; run: (c: Ctx, s: Step) => Promise<string | void> }
type Template = { key: string; title: string; why: string; weight: (state: string) => number; steps: StepDef[] }

const FILE = path.join(CHRONICLE, 'missions.json')
let history: Mission[] = []
let active: Mission | null = null
let lastKey = ''
const queue: Array<Template | { custom: CustomDef; decisionId?: string }> = []
export type CustomDef = { title: string; why: string; steps: Array<{ op: 'job'; jobType: string; title?: string } | { op: 'wait'; seconds: number; title?: string } | { op: 'set'; key: string; value: number | string; title?: string } | { op: 'measure'; metric: string; title?: string } | { op: 'note'; text: string; title?: string } | { op: 'write'; prompt: string; file: string; title?: string }> }
const waiters = new Map<string, (j: JobRecord) => void>()

function runJob(type: string, reason: string, overrides?: Record<string, unknown>): Promise<JobRecord> {
  return new Promise((resolve, reject) => {
    const j = sched.enqueue(type, reason, overrides, 'mission')
    if (!j) return reject(new Error(`unknown job ${type}`))
    waiters.set(j.id, resolve)
    setTimeout(() => { if (waiters.delete(j.id)) reject(new Error(`job ${type} did not finish in 3 min`)) }, 180_000)
  })
}
const metric = (j: JobRecord) => j.metric ? `${j.metric.name} ${j.metric.value}${j.metric.unit}` : j.status
const writeNote = (rel: string, text: string) => { const p = path.join(CHRONICLE, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.appendFileSync(p, text); return `chronicle/${rel}` }
const recentSummary = (ms: number) => { const ev = since(Date.now() - ms); const by: Record<string, number> = {}; for (const e of ev) by[e.type] = (by[e.type] ?? 0) + 1; return { counts: by, decisions: ev.filter(e => e.type === 'brain.decision').slice(-4).map(e => e.title), states: ev.filter(e => e.type === 'survival.state').map(e => e.title), mutations: ev.filter(e => e.type === 'genome.mutated').slice(-5).map(e => e.title) } }

const TEMPLATES: Template[] = [
  { key: 'tune-compression', title: 'Tune my compression settings', why: 'Smaller archives mean cheaper storage; the best level depends on this machine.', weight: s => (s === 'HIBERNATING' ? 0 : history.filter(h => h.key === 'tune-compression' && Date.now() - h.startedAt < 3 * 3600_000).length ? 0.15 : 1),
    steps: [
      { title: 'Measure current setting', run: async c => { const j = await runJob('compress', 'mission: baseline'); c.vars.base = j.metric?.value; return metric(j) } },
      { title: 'Sweep all levels', run: async c => { const j = await runJob('compress-sweep', 'mission: sweep'); const best = (j.output as { best?: { level: number; algo: string; score: number } })?.best; c.vars.best = best; return best ? `best L${best.level} ${best.algo} (score ${best.score.toFixed(3)})` : 'no result' } },
      { title: 'Adopt the winner into the genome', run: async c => { const b = c.vars.best as { level: number; algo: 'gzip' | 'brotli' } | undefined; if (!b) throw new Error('no sweep result'); const g = getGenome(); if (g.compressionLevel === b.level && g.compressionAlgo === b.algo) return 'already optimal, no change'; mutate('compressionLevel', b.level, `mission ${c.m.id}: sweep winner`); mutate('compressionAlgo', b.algo, `mission ${c.m.id}: sweep winner`); return `genome → L${b.level} ${b.algo}` } },
      { title: 'Verify with a fresh benchmark', run: async c => { const j = await runJob('compress', 'mission: verify'); const base = c.vars.base as number | undefined; return `${metric(j)}${base ? ` (was ${base}x)` : ''}` } },
      { title: 'Record what I learned', run: async c => { const b = c.vars.best as { level: number; algo: string } | undefined; const l = `On this host ${b?.algo} level ${b?.level} gives the best ratio per millisecond (${new Date().toISOString().slice(0, 10)}).`; addLesson(l); return l } },
    ] },
  { key: 'train-net', title: 'Push my neural net below the target error', why: 'A long-running learning goal with measurable progress; the weights persist between runs.', weight: s => (s === 'ALIVE' || s === 'RECOVERING' ? 1 : s === 'STRAINED' ? 0.4 : 0),
    steps: [
      { title: 'Check current error', run: async c => { const j = await runJob('nn-train', 'mission: probe', { epochs: 60 }); const o = j.output as { level?: string; levelIndex?: number; levels?: number; target?: number; mse?: number }; c.vars.start = o?.mse ?? j.metric?.value; c.vars.target = Math.max(o?.target ?? 0.0005, ((o?.mse ?? 0.01) as number) * 0.6); c.vars.level = o?.level; return `level ${o?.levelIndex}/${o?.levels} ${o?.level}: mse ${(o?.mse ?? 0).toExponential(2)} → target ${(c.vars.target as number).toExponential(2)}` } },
      { title: 'Training round 1', run: async c => { const j = await runJob('nn-train', 'mission: round 1', { epochs: 400 }); c.vars.last = j.metric?.value; return metric(j) } },
      { title: 'Training round 2', run: async c => { if ((c.vars.last as number) <= (c.vars.target as number)) return 'target already reached, skipping'; const j = await runJob('nn-train', 'mission: round 2', { epochs: 400 }); c.vars.last = j.metric?.value; return metric(j) } },
      { title: 'Training round 3', run: async c => { if ((c.vars.last as number) <= (c.vars.target as number)) return 'target already reached, skipping'; const j = await runJob('nn-train', 'mission: round 3', { epochs: 400, lr: 0.012 }); c.vars.last = j.metric?.value; return metric(j) } },
      { title: 'Evaluate against the target', run: async c => { const ok = (c.vars.last as number) <= (c.vars.target as number); const r = `${c.vars.level}: mse ${Number(c.vars.start).toExponential(2)} → ${Number(c.vars.last).toExponential(2)}, target ${(c.vars.target as number).toExponential(2)}: ${ok ? 'reached' : 'not yet'}`; if (!ok) addLesson(`NN level "${c.vars.level}" needs more than 3 rounds at lr ${getGenome().nnLearningRate} (${new Date().toISOString().slice(0, 10)}).`); return r } },
    ] },
  { key: 'health-audit', title: 'Full health audit of myself', why: 'Before changing anything else I need to know my files, code and build are sound.', weight: s => (s === 'HIBERNATING' ? 0.2 : 1),
    steps: [
      { title: 'Verify every file fingerprint', run: async c => { const j = await runJob('integrity', 'mission: audit'); const o = j.output as { changed: string[]; added: string[]; rootHash: string }; c.vars.integrity = `${metric(j)}, changed ${o?.changed?.length ?? 0}, root ${o?.rootHash?.slice(0, 10)}`; return c.vars.integrity as string } },
      { title: 'Static checks on my own code', run: async c => { const j = await runJob('lint', 'mission: audit'); c.vars.lint = j.output; return metric(j) } },
      { title: 'Run my self-tests', run: async c => { const j = await runJob('selftest', 'mission: audit'); c.vars.tests = metric(j); return metric(j) } },
      { title: 'Compile myself (tsc)', run: async c => { const j = await runJob('build-validate', 'mission: audit'); c.vars.build = metric(j); return metric(j) } },
      { title: 'Write the audit note', run: async c => { const eco = economy.snapshot(); const facts = `integrity: ${c.vars.integrity}\nlint: ${JSON.stringify((c.vars.lint as { byRule?: unknown })?.byRule)}\ntests: ${c.vars.tests}\nbuild: ${c.vars.build}\nstate: ${eco.state}, treasury $${eco.treasuryUsd.toFixed(2)}, runway ${eco.runwayHours?.toFixed(1) ?? '∞'}h`; const llm = await llmText('You are Furry Kitty, the AI mind of Project Furry Kitty writing a short audit note about yourself in first person. 4-6 lines, markdown, concrete numbers only from the facts given, one recommendation at the end.', facts, 260); if (llm) economy.chargeAI(llm.costUsd, 'audit note'); const text = `## Audit ${new Date().toISOString()}\n\n${llm?.text ?? facts}\n\n`; return writeNote(`notes/audits.md`, text) } },
    ] },
  { key: 'cut-burn', title: 'Cut my burn rate', why: 'Income is below spending; the only lever I fully control is how much I compute.', weight: s => (s === 'CRITICAL' ? 3 : s === 'STRAINED' ? 1.5 : 0.3),
    steps: [
      { title: 'Measure burn now', run: async c => { const j = await runJob('forecast', 'mission: before'); c.vars.burn0 = economy.snapshot().burnPerHourUsd; return `burn $${(c.vars.burn0 as number).toFixed(3)}/h, ${metric(j)}` } },
      { title: 'Reduce parallel lanes', run: async c => { const g = getGenome(); if (g.concurrency <= 2) return 'already at minimum'; mutate('concurrency', g.concurrency - 1, `mission ${c.m.id}: cut burn`); return `lanes ${g.concurrency} → ${g.concurrency - 1}` } },
      { title: 'Slow the most expensive job', run: async c => { const g = getGenome(); const cur = g.jobIntervals['cpu-bench'] ?? 14_000; if (cur >= 60_000) return 'already slow'; mutateJobInterval('cpu-bench', Math.min(60_000, cur * 2), `mission ${c.m.id}: cut burn`); return `cpu-bench every ${cur / 1000}s → ${Math.min(60, cur / 500)}s` } },
      { title: 'Let the new settings settle', run: async () => { await new Promise(r => setTimeout(r, 90_000)); return '90s elapsed' } },
      { title: 'Measure burn again', run: async c => { await runJob('forecast', 'mission: after'); const b1 = economy.snapshot().burnPerHourUsd; const b0 = c.vars.burn0 as number; const r = `burn $${b0.toFixed(3)}/h → $${b1.toFixed(3)}/h (${((1 - b1 / b0) * 100).toFixed(0)}% change)`; addLesson(`Cutting one lane and halving cpu-bench changed burn by ${((1 - b1 / b0) * 100).toFixed(0)}%.`); return r } },
    ] },
  { key: 'diary', title: 'Write today\'s diary entry', why: 'Humans can only trust me if I explain what I did and why, in my own words.', weight: s => (s === 'HIBERNATING' ? 0.1 : 0.8),
    steps: [
      { title: 'Gather the last hour of events', run: async c => { const s = recentSummary(3600_000); c.vars.summary = s; return `${Object.values(s.counts).reduce((a, b) => a + b, 0)} events, ${s.decisions.length} decisions, ${s.mutations.length} mutations` } },
      { title: 'Compose the entry', run: async c => { const eco = economy.snapshot(); const facts = JSON.stringify({ ...(c.vars.summary as object), state: eco.state, treasury: eco.treasuryUsd.toFixed(2), runwayHours: eco.runwayHours?.toFixed(1) ?? 'unbounded', goals: getMemory().goals, lessons: getMemory().lessons.slice(-3) }); const llm = await llmText('You are Furry Kitty, the AI mind of Project Furry Kitty, an AI process surviving on a shrinking budget, writing a diary entry in first person. 5-8 sentences, honest, specific, a little personality, no claims beyond the facts given. Plain prose, no headings.', facts, 320); if (llm) economy.chargeAI(llm.costUsd, 'diary'); c.vars.entry = llm?.text ?? `Hour summary: ${facts}`; return `${(c.vars.entry as string).length} chars${llm ? ` via ${llm.model}` : ' (template, no LLM)'}` } },
      { title: 'Save it to the chronicle', run: async c => writeNote(`diary/${new Date().toISOString().slice(0, 10)}.md`, `### ${new Date().toISOString().slice(11, 16)} UTC\n\n${c.vars.entry}\n\n`) },
    ] },
  { key: 'research', title: 'Read the news and learn something', why: 'Visitors talk about what is happening in AI; I should know too, and it gives me something to say.', weight: s => (s === 'ALIVE' || s === 'RECOVERING' ? 0.8 : 0.3),
    steps: [
      { title: 'Read the Hacker News front page', run: async c => { const j = await runJob('research', 'mission: read'); c.vars.news = j.output; return `${(j.output as { read: number })?.read ?? 0} stories, ${metric(j)}` } },
      { title: 'Pick what matters to me', run: async c => { const n = c.vars.news as { relevant: Array<{ title: string; score: number; url?: string }>; top: Array<{ title: string; score: number }> }; const llm = await llmText('You are Furry Kitty, the AI mind of Project Furry Kitty, an AI process surviving on a small budget. From these headlines pick the 3 most relevant to your own survival or to AI agents, and for each write one sentence on why it matters to you. Markdown list. First person.', JSON.stringify({ relevant: n?.relevant ?? [], top: n?.top ?? [] }), 320); if (llm) economy.chargeAI(llm.costUsd, 'research digest'); c.vars.digest = llm?.text ?? (n?.relevant ?? []).slice(0, 3).map(x => `- ${x.title}`).join('\n'); return `${(c.vars.digest as string).split('\n').length} lines` } },
      { title: 'Save the digest', run: async c => { const f = writeNote('notes/research.md', `\n### ${new Date().toISOString()}\n\n${c.vars.digest}\n`); append({ type: 'research.done', source: 'missions', severity: 'success', title: `Research digest saved · ${String(c.vars.digest).split('\n')[0]?.slice(0, 100)}`, evidence: { file: f } }); return f } },
      { title: 'Tell visitors one thing I learned', run: async c => { const line = String(c.vars.digest).split('\n').find(l => l.trim().startsWith('-')) ?? ''; const said = line ? chatSay(`Just read the news. ${line.replace(/^-\s*/, '').slice(0, 200)}`) : false; return said ? 'said in chat' : 'chat cooling down, skipped' } },
    ] },
  { key: 'post-draft', title: 'Draft a post about my day', why: 'One day I will have an X account; drafts are written now and published only with approval.', weight: s => (s === 'ALIVE' || s === 'RECOVERING' ? 0.6 : 0.2),
    steps: [
      { title: 'Pick the most interesting fact', run: async c => { const s = recentSummary(2 * 3600_000); const eco = economy.snapshot(); c.vars.fact = s.mutations.at(-1) ?? s.states.at(-1) ?? `survived another hour with $${eco.treasuryUsd.toFixed(2)} in the treasury`; return c.vars.fact as string } },
      { title: 'Write the draft', run: async c => { const llm = await llmText('Write one short post (max 240 chars) in first person as Furry Kitty, an AI that must earn its own hosting money or die. Dry humour allowed. No hashtags spam, max one emoji, no financial advice, no asking for money.', `Fact: ${c.vars.fact}`, 120); if (llm) economy.chargeAI(llm.costUsd, 'post draft'); c.vars.draft = llm?.text ?? `Still alive. ${c.vars.fact}`; return c.vars.draft as string } },
      { title: 'Save as unpublished draft', run: async c => writeNote('social/drafts.md', `- ${new Date().toISOString()} · UNPUBLISHED · ${(c.vars.draft as string).replace(/\n/g, ' ')}\n`) },
    ] },
]

const LIB_FILE = path.join(CHRONICLE, 'brain', 'missions-library.json')
let library: Array<{ name: string; def: CustomDef; createdAt: number; uses: number }> = []
export function saveToLibrary(name: string, def: CustomDef) { const key = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 30); library = library.filter(l => l.name !== key); library.push({ name: key, def, createdAt: Date.now(), uses: 0 }); if (library.length > 40) library.shift(); try { fs.writeFileSync(LIB_FILE, JSON.stringify(library, null, 1)) } catch {}; return key }
export function libraryNames() { return library.map(l => `${l.name} (${l.def.steps.length} steps, used ${l.uses}x)`) }
export function request(key: string, reason: string) { const lib = library.find(l => l.name === key); if (lib) { lib.uses++; requestCustom(lib.def); return } const t = TEMPLATES.find(x => x.key === key); if (t && queue.length < 3) { queue.push(t); append({ type: 'mission.queued', source: 'missions', title: `Queued mission: ${t.title} · ${reason}`, data: { key } }) } }
export function requestCustom(def: CustomDef, decisionId?: string) { if (queue.length < 3) { queue.push({ custom: def, decisionId }); append({ type: 'mission.queued', source: 'brain', severity: 'info', title: `Designed a custom mission: ${def.title} (${def.steps.length} steps) · ${def.why}`, data: { steps: def.steps }, evidence: { decisionId } }) } }
const metricNow = (metric: string) => { if (metric === 'burn') return economy.snapshot().burnPerHourUsd; if (metric === 'income') return economy.snapshot().incomePerHourUsd; const h = sched.metrics(metric); return h.length ? h.at(-1)!.v : null }
function fromCustom(def: CustomDef): Template {
  return { key: 'custom', title: def.title.slice(0, 80), why: def.why.slice(0, 200), weight: () => 0, steps: def.steps.map((s, i) => {
    const title = s.title ?? (s.op === 'job' ? `Run ${s.jobType}` : s.op === 'wait' ? `Wait ${s.seconds}s` : s.op === 'set' ? `Set ${s.key} = ${s.value}` : s.op === 'measure' ? `Measure ${s.metric}` : s.op === 'note' ? 'Write a note' : `Write ${s.file}`)
    const run = async (c: Ctx): Promise<string> => {
      switch (s.op) {
        case 'job': { if (!sched.jobDefs().some(d => d.type === s.jobType)) throw new Error(`unknown job ${s.jobType}`); const j = await runJob(s.jobType, `custom mission step ${i + 1}`); return metric(j) }
        case 'wait': { await new Promise(r => setTimeout(r, Math.min(300, s.seconds) * 1000)); return `${s.seconds}s elapsed` }
        case 'set': { const g = getGenome() as unknown as Record<string, unknown>; if (!(s.key in g) || s.key === 'history' || s.key === 'version') throw new Error('bad key'); const from = g[s.key]; if (s.key === 'concurrency' && (Number(s.value) < 1 || Number(s.value) > 6)) throw new Error('concurrency out of range'); mutate(s.key as 'concurrency', s.value as never, `custom mission ${c.m.id}: ${def.title}`); return `${s.key} ${JSON.stringify(from)} → ${JSON.stringify(s.value)}` }
        case 'measure': { const v = metricNow(s.metric); c.vars[`measure_${s.metric}`] = v; const prev = c.vars[`prev_${s.metric}`] as number | undefined; c.vars[`prev_${s.metric}`] = v; return v === null ? 'no data yet' : `${s.metric} = ${v.toFixed(4)}${prev !== undefined && prev !== null ? ` (was ${prev.toFixed(4)})` : ''}` }
        case 'note': return writeNote('notes/experiments.md', `\n### ${new Date().toISOString()} · ${def.title}\n\n${s.text}\n`)
        case 'write': { const llm = await llmText('You are Furry Kitty, the AI mind of Project Furry Kitty writing a short first-person note (4-8 lines, markdown) for your own notebook. Use only facts from the mission context given.', `${s.prompt}\n\nMission so far: ${JSON.stringify(c.vars)}`, 300); if (llm) economy.chargeAI(llm.costUsd, 'custom note'); return writeNote(`notes/${s.file.replace(/[^\w.-]/g, '_').replace(/\.md$/, '')}.md`, `\n### ${new Date().toISOString()}\n\n${llm?.text ?? 'LLM unavailable; raw: ' + JSON.stringify(c.vars)}\n`) }
      }
    }
    return { title, run }
  }) }
}
function pick(): Template {
  const q = queue.shift()
  if (q) return 'custom' in q ? fromCustom(q.custom) : q
  const state = economy.getState()
  const pool = TEMPLATES.map(t => ({ t, w: t.weight(state) * (t.key === lastKey ? 0.15 : 1) })).filter(x => x.w > 0)
  const total = pool.reduce((a, b) => a + b.w, 0)
  let r = Math.random() * total
  for (const x of pool) { r -= x.w; if (r <= 0) return x.t }
  return pool[0]?.t ?? TEMPLATES[0]
}

function save() { try { fs.writeFileSync(FILE, JSON.stringify({ active, history: history.slice(-50) })) } catch {} }
function publish() { telemetry('mission', { active, history: history.slice(-12) }) }

async function run(t: Template) {
  const m: Mission = { id: `mis_${Date.now().toString(36)}_${randomUUID().slice(0, 4)}`, key: t.key, title: t.title, why: t.why, status: 'active', startedAt: Date.now(), progress: 0, steps: t.steps.map((s, i) => ({ id: `${i}`, title: s.title, status: 'pending' })) }
  active = m; lastKey = t.key
  append({ type: 'mission.started', source: 'missions', severity: 'info', title: `Mission: ${m.title}`, data: { id: m.id, key: t.key, why: m.why, steps: m.steps.length } })
  publish()
  const ctx: Ctx = { m, vars: {} }
  let failed = false
  for (const [i, def] of t.steps.entries()) {
    const s = m.steps[i]
    if (failed) { s.status = 'skipped'; continue }
    s.status = 'running'; s.startedAt = Date.now(); publish()
    append({ type: 'mission.step', source: 'missions', title: `${m.title} · step ${i + 1}/${m.steps.length}: ${s.title}`, data: { id: m.id, step: i + 1 } })
    try {
      const r = await def.run(ctx, s)
      s.status = 'done'; s.result = typeof r === 'string' ? r : 'ok'
      if (typeof r === 'string' && r.startsWith('chronicle/')) s.file = r
    } catch (e) { s.status = 'failed'; s.result = String((e as Error).message ?? e).slice(0, 160); failed = true }
    s.finishedAt = Date.now(); m.progress = m.steps.filter(x => x.status === 'done').length / m.steps.length
    append({ type: s.status === 'done' ? 'mission.step.done' : 'mission.step.failed', source: 'missions', severity: s.status === 'done' ? 'success' : 'error', title: `${s.status === 'done' ? '✓' : '✗'} ${s.title}: ${s.result}`, data: { id: m.id, step: i + 1, result: s.result }, evidence: { file: s.file } })
    publish(); save()
  }
  m.status = failed ? 'failed' : 'done'; m.finishedAt = Date.now()
  m.outcome = m.steps.filter(s => s.status === 'done').map(s => `${s.title}: ${s.result}`).join(' · ')
  history.push(m); if (history.length > 50) history.shift()
  getMemory().stats.missions = (getMemory().stats.missions ?? 0) + 1
  append({ type: failed ? 'mission.failed' : 'mission.completed', source: 'missions', severity: failed ? 'warn' : 'success', title: `${failed ? 'Mission failed' : 'Mission complete'}: ${m.title} (${((m.finishedAt - m.startedAt) / 1000).toFixed(0)}s)`, data: { id: m.id, key: m.key, outcome: m.outcome } })
  active = null; publish(); save()
}

export function start() {
  try { const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')); history = raw.history ?? [] } catch {}
  try { library = JSON.parse(fs.readFileSync(LIB_FILE, 'utf8')) } catch {}
  sched.onJobFinish(j => { const w = waiters.get(j.id); if (w) { waiters.delete(j.id); w(j) } })
  const loop = async () => {
    if (!active && !sched.overload.active && !isPaused()) {
      const pause = 20_000 + Math.random() * 25_000
      await new Promise(r => setTimeout(r, pause))
      if (!active) await run(pick()).catch(err => append({ type: 'mission.failed', source: 'missions', severity: 'error', title: `Mission crashed: ${String(err).slice(0, 120)}` }))
    }
    setTimeout(loop, 5000)
  }
  setTimeout(loop, 15_000)
}
export function status() { return { active, history: history.slice(-12) } }
