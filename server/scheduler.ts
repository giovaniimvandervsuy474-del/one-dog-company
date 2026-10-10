import path from 'node:path'
import os from 'node:os'
import { Worker } from 'node:worker_threads'
import { randomUUID } from 'node:crypto'
import { append } from './ledger.ts'
import { telemetry } from './bus.ts'
import { getGenome } from './genome.ts'
import { ROOT, CHRONICLE } from './paths.ts'
import type { JobRecord, SurvivalState } from './types.ts'
import type { WorkerMsg } from './workers/util.ts'

export type JobDef = {
  type: string
  title: string
  workspace: string
  essential: boolean
  costUnits: number
  timeoutMs: number
  worker: string
  input: () => Record<string, unknown>
}

type Deps = {
  getState: () => SurvivalState
  charge: (units: number, jobType: string) => void
  treasurySeries: () => Array<{ ts: number; v: number }>
  incomeSeries: () => Array<{ ts: number; v: number }>
  selftestSnapshot: () => Record<string, unknown>
}

const defs = new Map<string, JobDef>()
const jobs = new Map<string, JobRecord>()
const order: string[] = []
const queue: string[] = []
const running = new Map<string, Worker>()
const lastRun = new Map<string, number>()
const metricsHistory = new Map<string, Array<{ ts: number; v: number }>>()
export const stats = { completed: 0, failed: 0, timeout: 0, cancelled: 0 }

/**
 * Overload guard. The host is a shared machine; when it starves (swap, load, event-loop lag) worker isolates
 * cannot even start inside their timeouts. Instead of cascading failures we throttle to one essential lane
 * and say so in the ledger. This is survival behaviour, not an error.
 */
export const overload = { active: false, since: 0, lagMs: 0, load: 0, freeMB: 0, recentTimeouts: 0, reason: '' }
let lagProbe = Date.now()
setInterval(() => { const now = Date.now(); overload.lagMs = Math.max(0, now - lagProbe - 1000); lagProbe = now }, 1000)
function evaluateOverload() {
  overload.load = os.loadavg()[0] / Math.max(1, os.cpus().length)
  overload.freeMB = os.freemem() / 1048576
  const reasons: string[] = []
  if (overload.lagMs > 1500) reasons.push(`event loop lag ${overload.lagMs}ms`)
  if (overload.load > 3) reasons.push(`load ${overload.load.toFixed(1)}x cores`)
  if (overload.freeMB < 300) reasons.push(`free memory ${overload.freeMB.toFixed(0)}MB`)
  if (overload.recentTimeouts >= 3) reasons.push(`${overload.recentTimeouts} timeouts in a row`)
  const next = reasons.length > 0
  if (next && !overload.active) { overload.active = true; overload.since = Date.now(); overload.reason = reasons.join(', '); append({ type: 'system.overload', source: 'scheduler', severity: 'warn', title: `Host overloaded (${overload.reason}) → throttling to 1 essential lane`, data: { ...overload } }) }
  else if (!next && overload.active && Date.now() - overload.since > 30_000) { overload.active = false; overload.recentTimeouts = 0; append({ type: 'system.recovered', source: 'scheduler', severity: 'success', title: `Host load back to normal → resuming full schedule`, data: { ...overload } }) }
  else if (next) overload.reason = reasons.join(', ')
  telemetry('overload', { ...overload })
}
let deps: Deps

export const WORKSPACES = [
  { id: 'optimization', title: 'Optimization' },
  { id: 'integrity', title: 'Integrity' },
  { id: 'memory', title: 'Memory' },
  { id: 'tests', title: 'Tests & Build' },
  { id: 'research', title: 'Research (NN)' },
  { id: 'resources', title: 'Resources' },
  { id: 'evolution', title: 'Evolution' },
  { id: 'recovery', title: 'Recovery' },
] as const

export function registerDefaults(d: Deps) {
  deps = d
  const g = () => getGenome()
  const add = (j: JobDef) => defs.set(j.type, j)
  add({ type: 'cpu-bench', title: 'CPU benchmark', workspace: 'optimization', essential: false, costUnits: 3, timeoutMs: 15_000, worker: 'cpu-bench.ts', input: () => ({ durationMs: g().cpuBenchDurationMs }) })
  add({ type: 'compress', title: 'Compression benchmark', workspace: 'optimization', essential: false, costUnits: 2, timeoutMs: 20_000, worker: 'compress.ts', input: () => ({ root: ROOT, level: g().compressionLevel, algo: g().compressionAlgo }) })
  add({ type: 'integrity', title: 'File integrity sweep', workspace: 'integrity', essential: true, costUnits: 1, timeoutMs: 40_000, worker: 'integrity.ts', input: () => ({ root: ROOT, manifestPath: path.join(CHRONICLE, 'integrity.json') }) })
  add({ type: 'memory', title: 'Memory analysis', workspace: 'memory', essential: true, costUnits: 1, timeoutMs: 20_000, worker: 'memory.ts', input: () => ({}) })
  add({ type: 'deps', title: 'Dependency analysis', workspace: 'tests', essential: false, costUnits: 2, timeoutMs: 45_000, worker: 'deps.ts', input: () => ({ root: ROOT }) })
  add({ type: 'lint', title: 'Static checks', workspace: 'tests', essential: false, costUnits: 1, timeoutMs: 15_000, worker: 'lint.ts', input: () => ({ root: ROOT }) })
  add({ type: 'selftest', title: 'Self-test suite', workspace: 'tests', essential: true, costUnits: 1, timeoutMs: 20_000, worker: 'selftest.ts', input: () => deps.selftestSnapshot() })
  add({ type: 'build-validate', title: 'Build validation (tsc)', workspace: 'tests', essential: false, costUnits: 6, timeoutMs: 120_000, worker: 'build-validate.ts', input: () => ({ root: ROOT }) })
  add({ type: 'logs', title: 'Log processing & compaction', workspace: 'resources', essential: true, costUnits: 1, timeoutMs: 40_000, worker: 'logs.ts', input: () => ({ eventsDir: path.join(CHRONICLE, 'events'), archiveDir: path.join(CHRONICLE, 'logs-archive') }) })
  add({ type: 'forecast', title: 'Resource forecast', workspace: 'resources', essential: true, costUnits: 1, timeoutMs: 20_000, worker: 'forecast.ts', input: () => ({ series: deps.treasurySeries(), incomeSeries: deps.incomeSeries() }) })
  add({ type: 'nn-train', title: 'Neural net training (toy)', workspace: 'research', essential: false, costUnits: 4, timeoutMs: 30_000, worker: 'nn-train.ts', input: () => ({ weightsPath: path.join(CHRONICLE, 'brain', 'nn-weights.json'), epochs: 300, lr: g().nnLearningRate }) })
  add({ type: 'compress-sweep', title: 'Experiment: compression sweep', workspace: 'evolution', essential: false, costUnits: 5, timeoutMs: 60_000, worker: 'compress.ts', input: () => ({ root: ROOT, algo: g().compressionAlgo, sweep: true }) })
  add({ type: 'research', title: 'Research: read the news', workspace: 'research', essential: false, costUnits: 1, timeoutMs: 60_000, worker: 'research.ts', input: () => ({ topic: 'ai' }) })
  add({ type: 'recovery-check', title: 'Recovery readiness check', workspace: 'recovery', essential: true, costUnits: 1, timeoutMs: 20_000, worker: 'selftest.ts', input: () => deps.selftestSnapshot() })
}

export function jobDefs() { return [...defs.values()] }

export function enqueue(type: string, reason: string, overrides?: Record<string, unknown>, by = 'scheduler'): JobRecord | null {
  const def = defs.get(type)
  if (!def) return null
  const id = `job_${Date.now().toString(36)}_${randomUUID().slice(0, 6)}`
  const job: JobRecord = { id, type, title: def.title, workspace: def.workspace, status: 'queued', essential: def.essential, costUnits: def.costUnits, queuedAt: Date.now(), progress: 0, logs: [], input: { ...def.input(), ...(overrides ?? {}) } }
  jobs.set(id, job); order.push(id); queue.push(id)
  if (order.length > 400) { const old = order.shift()!; if (!running.has(old)) jobs.delete(old) }
  append({ type: 'job.queued', source: by, title: `${def.title} queued · ${reason}`, data: { jobId: id, type, workspace: def.workspace, reason }, evidence: { jobId: id } })
  telemetry('job', job)
  return job
}

export function cancel(id: string, reason: string) {
  const w = running.get(id)
  const job = jobs.get(id)
  if (!job) return false
  if (w) { w.terminate(); finish(job, 'cancelled', reason) }
  else { const i = queue.indexOf(id); if (i >= 0) queue.splice(i, 1); finish(job, 'cancelled', reason) }
  return true
}

function allowed(def: JobDef, state: SurvivalState): boolean {
  const g = getGenome()
  if (g.pausedWorkspaces.includes(def.workspace)) return false
  if (overload.active) return def.essential && def.type !== 'build-validate'
  if (state === 'HIBERNATING') return def.essential
  if (state === 'CRITICAL') return def.essential || ['cpu-bench', 'compress', 'lint'].includes(def.type)
  return true
}

function effectiveConcurrency(state: SurvivalState) {
  const c = getGenome().concurrency
  if (overload.active) return 1
  if (state === 'HIBERNATING') return 1
  if (state === 'CRITICAL') return Math.min(c, 2)
  if (state === 'STRAINED') return Math.min(c, 3)
  return c
}

let tickCount = 0
export function tick() {
  if (++tickCount % 3 === 0) evaluateOverload()
  const state = deps.getState()
  const g = getGenome()
  const now = Date.now()
  // auto-backlog: periodic jobs by genome intervals
  for (const def of defs.values()) {
    const interval = g.jobIntervals[def.type]
    if (!interval) continue
    if (!allowed(def, state)) continue
    const last = lastRun.get(def.type) ?? 0
    const queuedAlready = queue.some(id => jobs.get(id)?.type === def.type) || [...running.keys()].some(id => jobs.get(id)?.type === def.type)
    if (!queuedAlready && now - last >= interval) { lastRun.set(def.type, now); enqueue(def.type, 'periodic', undefined, 'scheduler') }
  }
  // dispatch
  const cap = effectiveConcurrency(state)
  while (running.size < cap && queue.length) {
    // essentials first
    let idx = queue.findIndex(id => jobs.get(id)?.essential)
    if (idx < 0) idx = 0
    const id = queue.splice(idx, 1)[0]
    const job = jobs.get(id)
    if (job) start(job)
  }
}

function start(job: JobRecord) {
  const def = defs.get(job.type)!
  job.status = 'running'; job.startedAt = Date.now()
  append({ type: 'job.started', source: 'scheduler', title: `▶ ${def.title}`, data: { jobId: job.id, type: job.type, workspace: job.workspace }, evidence: { jobId: job.id } })
  telemetry('job', job)
  const w = new Worker(new URL(`./workers/${def.worker}`, import.meta.url), { workerData: job.input, resourceLimits: { maxOldGenerationSizeMb: 256 } })
  running.set(job.id, w)
  const timer = setTimeout(() => { w.terminate(); finish(job, 'timeout', `exceeded ${def.timeoutMs}ms`) }, def.timeoutMs)
  w.on('message', (m: WorkerMsg) => {
    if (m.type === 'log') { job.logs.push(m.line); if (job.logs.length > 60) job.logs.shift(); telemetry('job', job) }
    else if (m.type === 'progress') { job.progress = m.value; telemetry('job', job) }
    else if (m.type === 'result') { clearTimeout(timer); job.output = m.output; job.metric = m.metric; finish(job, 'completed') }
  })
  w.on('error', err => { clearTimeout(timer); finish(job, 'failed', String(err?.message ?? err)) })
  w.on('exit', code => { clearTimeout(timer); if (job.status === 'running') finish(job, 'failed', `worker exited with code ${code}`) })
}

function finish(job: JobRecord, status: JobRecord['status'], error?: string) {
  if (job.status !== 'running' && job.status !== 'queued') return
  running.get(job.id)?.terminate().catch(() => {})
  running.delete(job.id)
  job.status = status; job.finishedAt = Date.now(); job.durationMs = job.finishedAt - (job.startedAt ?? job.finishedAt); job.error = error
  if (status === 'completed') job.progress = 1
  if (status === 'completed') stats.completed++
  else if (status === 'failed') stats.failed++
  else if (status === 'timeout') { stats.timeout++; overload.recentTimeouts++ }
  if (status === 'completed') overload.recentTimeouts = 0
  else if (status === 'cancelled') stats.cancelled++
  if (status === 'completed' || status === 'failed') deps.charge(job.costUnits * Math.max(0.2, (job.durationMs ?? 1000) / 1000), job.type)
  else if (status === 'timeout') deps.charge(job.costUnits * 0.5, job.type) // a stalled isolate still cost something, but not the full stalled duration
  if (job.metric && status === 'completed') {
    const h = metricsHistory.get(job.type) ?? []
    h.push({ ts: job.finishedAt, v: job.metric.value }); if (h.length > 300) h.shift()
    metricsHistory.set(job.type, h)
  }
  const def = defs.get(job.type)!
  const metricStr = job.metric ? ` · ${job.metric.name} ${job.metric.value}${job.metric.unit}` : ''
  append({
    type: status === 'completed' ? 'job.completed' : 'job.failed',
    source: 'scheduler',
    severity: status === 'completed' ? 'success' : status === 'cancelled' ? 'warn' : 'error',
    title: status === 'completed' ? `✓ ${def.title} in ${job.durationMs}ms${metricStr}` : `✗ ${def.title} ${status}${error ? ': ' + error.slice(0, 80) : ''}`,
    data: { jobId: job.id, type: job.type, workspace: job.workspace, status, durationMs: job.durationMs, metric: job.metric, output: summarize(job.output), error },
    evidence: { jobId: job.id },
  })
  telemetry('job', job)
  onFinish.forEach(fn => fn(job))
}

function summarize(o?: Record<string, unknown>) {
  if (!o) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) { if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') out[k] = v; else if (Array.isArray(v)) out[k] = `[${v.length}]` }
  return out
}

const onFinish: Array<(j: JobRecord) => void> = []
export function onJobFinish(fn: (j: JobRecord) => void) { onFinish.push(fn) }

export function getJob(id: string) { return jobs.get(id) }
export function listJobs(limit = 120): JobRecord[] { return order.slice(-limit).map(id => jobs.get(id)!).filter(Boolean) }
export function runningJobs(): JobRecord[] { return [...running.keys()].map(id => jobs.get(id)!) }
export function queuedCount() { return queue.length }
export function metrics(type: string) { return metricsHistory.get(type) ?? [] }
export function allMetrics() { return Object.fromEntries(metricsHistory) }
export function lastCompleted(type: string): JobRecord | undefined {
  for (let i = order.length - 1; i >= 0; i--) { const j = jobs.get(order[i]); if (j && j.type === type && j.status === 'completed') return j }
  return undefined
}
