import { randomUUID } from 'node:crypto'
import { append } from '../ledger.ts'
import { telemetry } from '../bus.ts'
import { getGenome, mutate, mutateJobInterval } from '../genome.ts'
import * as economy from '../economy.ts'
import * as sched from '../scheduler.ts'
import { loadMemory, getMemory, recordDecision, addLesson, setGoal } from './memory.ts'
import { decide as heuristic } from './heuristic.ts'
import { parseDecision, type BrainContext, type Decision } from './schema.ts'
import { hypotheses } from './memory.ts'
import * as missions from '../missions.ts'
import * as chat from '../chat.ts'
import { audience } from '../vitals.ts'
import * as creative from '../creative.ts'
import { CHRONICLE } from '../paths.ts'
import fs from 'node:fs'
import path from 'node:path'

let cycle = 0
let aiCallsThisHour = 0
let hourStart = Date.now()
let timer: NodeJS.Timeout | null = null
let lastExperiment: Record<string, unknown> | undefined
export const votes: Record<string, number> = {}
const PAUSE_FILE = path.join(CHRONICLE, '..', 'config', 'paused')
export let paused = fs.existsSync(PAUSE_FILE)
export function setPaused(v: boolean) { paused = v; try { if (v) fs.writeFileSync(PAUSE_FILE, new Date().toISOString()); else fs.rmSync(PAUSE_FILE, { force: true }) } catch {} append({ type: v ? 'admin.paused' : 'admin.resumed', source: 'admin', severity: 'warn', title: v ? 'Autonomy paused by operator: brain and missions stopped, workers continue' : 'Autonomy resumed by operator' }) }
export let onlineNow = 0
export function setOnline(n: number) { onlineNow = n }

export function start() {
  loadMemory()
  missions.bindPaused(() => paused)
  sched.onJobFinish(j => { if (j.type === 'compress-sweep' && j.status === 'completed' && j.output) { lastExperiment = { ...j.output, ts: j.finishedAt, jobId: j.id }; getMemory().stats.experiments++ } })
  schedule(8_000)
}
export let nextAt = 0
function schedule(ms: number) { nextAt = Date.now() + ms; telemetry('brain', { phase: 'idle', cycle, nextAt }); timer = setTimeout(() => { runCycle().catch(err => append({ type: 'brain.error', source: 'brain', severity: 'error', title: `Brain cycle failed: ${String(err).slice(0, 120)}` })).finally(() => schedule(getGenome().brainIntervalMs)) }, ms) }

function pageSummary() { try { const p = path.join(CHRONICLE, 'page', 'index.html'); const st = fs.statSync(p); let summary = ''; try { summary = fs.readFileSync(p + '.summary', 'utf8') } catch {} return { exists: true, bytes: st.size, updatedMinutesAgo: Math.round((Date.now() - st.mtimeMs) / 60000), summary } } catch { return { exists: false } } }
/** Static only: scripts, inline handlers, frames and javascript: links are removed before the page is stored. */
export function sanitizeHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<\/?(iframe|object|embed|form|base|link|meta)[^>]*>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"').slice(0, 60_000)
}
function budgetStatus() {
  const g = getGenome(); const hour = economy.aiSpend(3600_000), ten = economy.aiSpend(600_000), day = economy.aiSpend(86_400_000)
  const expected10 = g.spendTargetPerHour / 6
  const paceStatus = g.spendTargetPerHour <= 0 ? 'no target' : ten < expected10 * 0.5 ? 'far behind target — spend more now' : ten < expected10 * 0.9 ? 'slightly behind' : ten > expected10 * 1.5 ? 'ahead — do cheap work this cycle' : 'on pace'
  return { targetPerHour: g.spendTargetPerHour, spentThisHour: Number(hour.toFixed(3)), spentLast10Min: Number(ten.toFixed(3)), spentToday: Number(day.toFixed(2)), paceStatus }
}
function listNotes(): string[] { try { return fs.readdirSync(path.join(CHRONICLE, 'notes')).filter(f => f.endsWith('.md')).slice(-10) } catch { return [] } }

function buildContext(): BrainContext {
  const g = getGenome()
  const jobs = sched.listJobs(40).filter(j => j.status !== 'queued' && j.status !== 'running')
  const trends: BrainContext['metricTrends'] = {}
  for (const [type, hist] of Object.entries(sched.allMetrics())) if (hist.length) trends[type] = { last: hist.at(-1)!.v, avg: hist.reduce((a, b) => a + b.v, 0) / hist.length, n: hist.length }
  const m = getMemory()
  const { history: _h, ...genome } = g
  return {
    now: Date.now(), economy: economy.snapshot() as unknown as Record<string, unknown>, genome,
    recentJobs: jobs.slice(-25).map(j => ({ type: j.type, status: j.status, durationMs: j.durationMs, metric: j.metric, error: j.error })),
    metricTrends: trends, lastExperiment,
    missions: { active: missions.status().active ? { title: missions.status().active!.title, progress: missions.status().active!.progress, step: missions.status().active!.steps.find(s => s.status === 'running')?.title } : null, recent: missions.status().history.slice(-6).map(x => ({ key: x.key, status: x.status, outcome: x.outcome?.slice(0, 160), minutesAgo: Math.round((Date.now() - (x.finishedAt ?? x.startedAt)) / 60000) })) },
    hypotheses: hypotheses().slice(-8).map(h => ({ statement: h.statement, metric: h.metric, expect: h.expect, result: h.result, minutesLeft: h.result ? undefined : Math.max(0, Math.round((h.checkAt - Date.now()) / 60000)) })),
    notes: listNotes(),
    library: missions.libraryNames(),
    budget: budgetStatus(),
    studio: { deepThinking: false, debating: false, images: creative.gallery().length, lastImages: creative.gallery().slice(-3).map(i => `${i.purpose}: ${i.prompt.slice(0, 60)}`), writings: creative.listFiles('writing', 5).map(f => f.name), thoughts: creative.listFiles('thoughts', 5).map(f => f.name) },
    page: pageSummary(),
    look: g.look,
    audience: audience(onlineNow),
    memory: { identity: m.identity, goals: m.goals, lessons: m.lessons.slice(-8), lastDecisions: m.decisions.slice(-6).map(d => `${d.mood}: ${d.summary} [${d.actions.map(a => (a as { kind: string }).kind).join(',')}]`), motto: g.motto },
    stats: { ...sched.stats, ...m.stats, queued: sched.queuedCount(), running: sched.runningJobs().length, votes: Object.values(votes).reduce((a, b) => a + b, 0), hostOverloaded: sched.overload.active ? 1 : 0, hostLoadPerCore: Number(sched.overload.load.toFixed(2)) },
  }
}

async function runCycle() {
  if (paused) { telemetry('brain', { phase: 'paused', cycle, nextAt }); return }
  cycle++
  const g = getGenome()
  const state = economy.getState()
  if (Date.now() - hourStart > 3600_000) { hourStart = Date.now(); aiCallsThisHour = 0 }
  checkHypotheses()
  const ctx = buildContext()
  telemetry('brain', { phase: 'inspect', cycle, ctx: { state, queued: ctx.stats.queued, running: ctx.stats.running } })
  append({ type: 'brain.cycle', source: 'brain', title: `Brain cycle #${cycle}: inspecting vitals (${state}, ${ctx.recentJobs.length} recent jobs, ${Object.keys(ctx.metricTrends).length} metric streams)`, data: { cycle, state } })

  let decision: Decision
  let provider = 'heuristic'
  let costUsd = 0
  const canUseLLM = (g.aiProvider === 'anthropic' || g.aiProvider === 'requesty') && aiCallsThisHour < g.aiCallsPerHour
  let latencyMs = 0
  if (canUseLLM) {
    try {
      telemetry('brain', { phase: 'llm', cycle, provider: g.aiProvider })
      const t0 = performance.now()
      if (g.aiProvider === 'requesty') {
        const { decide } = await import('./requesty.ts')
        // deep model when there is an experiment to interpret or state just changed; cheap model otherwise
        const deep = state !== 'ALIVE' && cycle % 4 === 0
        const r = await decide(ctx, deep)
        decision = r.decision; provider = r.model; costUsd = r.costUsd; latencyMs = r.latencyMs
      } else {
        const { decide } = await import('./anthropic.ts')
        const r = await decide(ctx)
        decision = parseDecision(r.decision); provider = r.model; costUsd = r.costUsd; latencyMs = Math.round(performance.now() - t0)
      }
      aiCallsThisHour++
      economy.chargeAI(costUsd, `planner ${provider}`)
      append({ type: 'brain.llm', source: 'brain', title: `Planner ${provider} answered in ${latencyMs}ms · $${costUsd.toFixed(5)}`, data: { provider, latencyMs, costUsd, cycle } })
    } catch (err) {
      append({ type: 'brain.fallback', source: 'brain', severity: 'warn', title: `LLM planner unavailable, using heuristic planner: ${String(err).slice(0, 100)}` })
      decision = heuristic(ctx)
    }
  } else {
    decision = heuristic(ctx)
    economy.chargeAI(0.0005, 'heuristic planning')
    costUsd = 0.0005
  }
  // visitor votes nudge the planner: most-voted experiment gets scheduled if nothing else asked for it
  const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]
  if (top && top[1] >= 3 && !decision.actions.some(a => a.kind === 'run_experiment')) { decision.actions.push({ kind: 'run_experiment', experiment: top[0] as 'compress-sweep' | 'cpu-duration', reason: `visitors voted (${top[1]} votes)` }); votes[top[0]] = 0 }

  const id = `dec_${Date.now().toString(36)}_${randomUUID().slice(0, 5)}`
  for (const [i, t] of (decision.thoughts ?? []).entries()) {
    append({ type: 'brain.thought', source: 'brain', title: t, data: { decisionId: id, step: i + 1, of: decision.thoughts.length, provider } })
    await new Promise(r => setTimeout(r, 450))
  }
  append({ type: 'brain.decision', source: 'brain', severity: decision.mood === 'desperate' || decision.mood === 'anxious' ? 'warn' : 'info',
    title: `[${decision.mood}] ${decision.summary}`, data: { decisionId: id, cycle, provider, costUsd, latencyMs, mood: decision.mood, actions: decision.actions }, evidence: { decisionId: id, file: `chronicle/brain/decisions/*_${id}.json` } })
  telemetry('brain', { phase: 'act', cycle, decision, id })
  for (const bad of decision.invalid ?? []) append({ type: 'brain.action.invalid', source: 'brain', severity: 'warn', title: `Ignored a malformed action (${String((bad.action as { kind?: string })?.kind ?? '?')}): ${bad.error}`, data: { action: bad.action, error: bad.error }, evidence: { decisionId: id } })
  for (const a of decision.actions) execute(a, id)
  recordDecision({ id, ts: Date.now(), summary: decision.summary, mood: decision.mood, actions: decision.actions, provider, costUsd })
  telemetry('brain', { phase: 'idle', cycle, memory: getMemory() })
}

function execute(a: Decision['actions'][number], decisionId: string) {
  const g = getGenome()
  switch (a.kind) {
    case 'schedule_job': sched.enqueue(a.jobType, `brain: ${a.reason}`, undefined, 'brain'); break
    case 'set_concurrency': if (mutate('concurrency', a.value, a.reason, decisionId)) getMemory().stats.mutations++; break
    case 'set_job_interval': if (mutateJobInterval(a.jobType, a.ms, a.reason, decisionId)) getMemory().stats.mutations++; break
    case 'set_brain_interval': if (mutate('brainIntervalMs', a.ms, a.reason, decisionId)) getMemory().stats.mutations++; break
    case 'set_compression': { const c1 = mutate('compressionLevel', a.level, a.reason, decisionId); const c2 = mutate('compressionAlgo', a.algo, a.reason, decisionId); if (c1 || c2) getMemory().stats.mutations++; break }
    case 'pause_workspace': if (!g.pausedWorkspaces.includes(a.workspace)) { mutate('pausedWorkspaces', [...g.pausedWorkspaces, a.workspace], a.reason, decisionId); append({ type: 'workspace.paused', source: 'brain', severity: 'warn', title: `Workspace ${a.workspace} paused · ${a.reason}`, data: { workspace: a.workspace }, evidence: { decisionId } }) } break
    case 'resume_workspace': if (g.pausedWorkspaces.includes(a.workspace)) { mutate('pausedWorkspaces', g.pausedWorkspaces.filter(w => w !== a.workspace), a.reason, decisionId); append({ type: 'workspace.resumed', source: 'brain', severity: 'success', title: `Workspace ${a.workspace} resumed · ${a.reason}`, data: { workspace: a.workspace }, evidence: { decisionId } }) } break
    case 'run_experiment':
      if (a.experiment === 'compress-sweep') sched.enqueue('compress-sweep', `experiment: ${a.reason}`, undefined, 'brain')
      else sched.enqueue('cpu-bench', `experiment: ${a.reason}`, { durationMs: Math.max(500, Math.round(g.cpuBenchDurationMs * 0.6)) }, 'brain')
      append({ type: 'experiment.started', source: 'brain', title: `Experiment ${a.experiment} · ${a.reason}`, data: { experiment: a.experiment }, evidence: { decisionId } })
      break
    case 'set_goal': setGoal(a.goal); append({ type: 'brain.goal', source: 'brain', title: `New goal: ${a.goal}`, data: { goal: a.goal, reason: a.reason }, evidence: { decisionId, file: 'chronicle/brain/memory.json' } }); break
    case 'remember': addLesson(a.lesson); append({ type: 'brain.lesson', source: 'brain', title: `Lesson recorded: ${a.lesson}`, data: { lesson: a.lesson }, evidence: { decisionId, file: 'chronicle/brain/memory.json' } }); break
    case 'noop': break
    case 'choose_mission': missions.request(a.mission, `brain: ${a.reason}`); append({ type: 'mission.requested', source: 'brain', title: `Next mission chosen: ${a.mission} · ${a.reason}`, data: { mission: a.mission }, evidence: { decisionId } }); break
    case 'custom_mission': missions.requestCustom({ title: a.title, why: a.why, steps: a.steps }, decisionId); break
    case 'hypothesis': {
      const baseline = metricNow(a.metric)
      const h = { id: `hyp_${Date.now().toString(36)}`, ts: Date.now(), statement: a.statement, metric: a.metric, expect: a.expect, baseline, checkAt: Date.now() + a.checkAfterMinutes * 60_000 }
      hypotheses().push(h); if (hypotheses().length > 60) hypotheses().shift()
      getMemory().stats.hypotheses = (getMemory().stats.hypotheses ?? 0) + 1
      append({ type: 'hypothesis.stated', source: 'brain', severity: 'info', title: `Hypothesis: ${a.statement} (expect ${a.metric} ${a.expect}, check in ${a.checkAfterMinutes}m)`, data: { ...h }, evidence: { decisionId, file: 'chronicle/brain/memory.json' } })
      break
    }
    case 'write_note': { const file = a.file.replace(/[^\w.-]/g, '_').replace(/\.md$/, '') + '.md'; const p = path.join(CHRONICLE, 'notes', file); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.appendFileSync(p, `\n### ${new Date().toISOString()}\n\n${a.text}\n`); append({ type: 'note.written', source: 'brain', title: `Wrote a note: ${file} · ${a.text.slice(0, 90)}`, data: { file }, evidence: { decisionId, file: `chronicle/notes/${file}` } }); break }
    case 'talk': chat.say(a.message); break
    case 'set_motto': if (mutate('motto', a.text, a.reason, decisionId)) append({ type: 'motto.changed', source: 'brain', severity: 'success', title: `New motto: “${a.text}” · ${a.reason}`, data: { text: a.text }, evidence: { decisionId } }); break
    case 'write_page': { const html = sanitizeHtml(a.html); const dir = path.join(CHRONICLE, 'page'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'index.html'), html); fs.writeFileSync(path.join(dir, 'index.html.summary'), a.summary); fs.appendFileSync(path.join(dir, 'history.log'), `${new Date().toISOString()} ${html.length}B ${a.summary}\n`); append({ type: 'page.updated', source: 'brain', severity: 'success', title: `Updated my page: ${a.summary}`, data: { bytes: html.length, summary: a.summary }, evidence: { decisionId, file: 'chronicle/page/index.html', url: '/agent/' } }); telemetry('page', { updatedAt: Date.now(), summary: a.summary }); break }
    case 'deep_think': void creative.deepThink(a.topic, decisionId); break
    case 'debate': void creative.debate(a.question, decisionId); break
    case 'imagine': void creative.imagine(a.prompt, a.purpose, 'brain', decisionId).then(rec => { if (rec && a.purpose === 'poster') mutate('look', { ...getGenome().look, posterImage: rec.url } as never, 'new poster image', decisionId) }); break
    case 'write': void creative.write(a.genre, a.topic, decisionId); break
    case 'set_spend_target': {
      // Operator rule: the target may fall by at most $3/h per hour; raising it is free.
      const cur = g.spendTargetPerHour; let next = a.usdPerHour
      if (next < cur) {
        const st = getMemory().stats as Record<string, number | undefined>
        const since = Date.now() - (st.lastSpendCutAt ?? 0)
        if (since < 3600_000) { append({ type: 'budget.refused', source: 'brain', severity: 'warn', title: `Spend cut refused: last cut was ${Math.round(since / 60000)} min ago (one cut of ≤ $3/h per hour)`, data: { wanted: a.usdPerHour, current: cur } }); break }
        next = Math.max(cur - 3, a.usdPerHour); st.lastSpendCutAt = Date.now()
      }
      if (mutate('spendTargetPerHour', next, a.reason, decisionId)) append({ type: 'budget.changed', source: 'brain', title: `Spend target $${cur}/h → $${next}/h${next !== a.usdPerHour ? ` (asked for $${a.usdPerHour}, cuts are capped at $3/h per hour)` : ''} · ${a.reason}`, data: { usdPerHour: next, asked: a.usdPerHour }, evidence: { decisionId } })
      break
    }
    case 'save_mission': { const name = missions.saveToLibrary(a.name, { title: a.title, why: a.why, steps: a.steps as never }); append({ type: 'mission.saved', source: 'brain', severity: 'success', title: `Saved a mission design to my library: ${name} (${a.steps.length} steps)`, data: { name }, evidence: { decisionId, file: 'chronicle/brain/missions-library.json' } }); break }
    case 'set_planner': { void import('./requesty.ts').then(r => r.setPreferred(a.model)); append({ type: 'planner.changed', source: 'brain', title: `Thinking with the ${a.model} model from now · ${a.reason}`, data: { model: a.model }, evidence: { decisionId } }); break }
    case 'customize_look': { const next = { ...g.look, ...a.changes }; if (mutate('look', next, a.reason, decisionId)) { const what = Object.entries(a.changes).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('+') : v}`).join(', '); append({ type: 'look.changed', source: 'brain', severity: 'success', title: `Changed my look: ${what} · ${a.reason}`, data: { changes: a.changes, look: next }, evidence: { decisionId, file: 'config/genome.json' } }) } break }
    case 'set_param': { if (a.key === 'cpuBenchDurationMs' && (a.value < 500 || a.value > 6000)) break; if (a.key === 'nnLearningRate' && (a.value < 0.001 || a.value > 0.2)) break; if (mutate(a.key, a.value, a.reason, decisionId)) getMemory().stats.mutations++; break }
  }
}

function metricNow(metric: string): number | null {
  if (metric === 'burn') return economy.snapshot().burnPerHourUsd
  if (metric === 'income') return economy.snapshot().incomePerHourUsd
  const h = sched.metrics(metric); return h.length ? h.at(-1)!.v : null
}

/** Verifies due hypotheses against the metric history: a prediction becomes a confirmed/refuted lesson. */
function checkHypotheses() {
  for (const h of hypotheses()) {
    if (h.result || Date.now() < h.checkAt) continue
    const observed = metricNow(h.metric)
    if (observed === null || h.baseline === null) { h.result = 'inconclusive'; h.observed = observed; append({ type: 'hypothesis.inconclusive', source: 'brain', severity: 'warn', title: `Could not verify: ${h.statement} (no data)`, data: { ...h } }); continue }
    const delta = (observed - h.baseline) / Math.max(1e-9, Math.abs(h.baseline))
    const moved = Math.abs(delta) > 0.02
    const ok = moved && ((h.expect === 'up' && delta > 0) || (h.expect === 'down' && delta < 0))
    h.result = !moved ? 'inconclusive' : ok ? 'confirmed' : 'refuted'; h.observed = observed
    const st = getMemory().stats; if (h.result === 'confirmed') st.confirmed = (st.confirmed ?? 0) + 1; if (h.result === 'refuted') st.refuted = (st.refuted ?? 0) + 1
    const title = `${h.result === 'confirmed' ? '✔ Confirmed' : h.result === 'refuted' ? '✘ Refuted' : '~ Inconclusive'}: ${h.statement} · ${h.metric} ${h.baseline.toFixed(3)} → ${observed.toFixed(3)} (${(delta * 100).toFixed(0)}%)`
    append({ type: `hypothesis.${h.result}`, source: 'brain', severity: h.result === 'confirmed' ? 'success' : h.result === 'refuted' ? 'warn' : 'info', title, data: { ...h, delta } , evidence: { file: 'chronicle/brain/memory.json' } })
    if (h.result !== 'inconclusive') addLesson(`${h.result === 'confirmed' ? 'Confirmed' : 'Refuted'}: ${h.statement} (${h.metric} ${(delta * 100).toFixed(0)}%)`)
  }
}

export function status() {
  return { cycle, aiCallsThisHour, provider: getGenome().aiProvider, memory: getMemory(), lastExperiment, votes, nextAt }
}
