import type { FounderState } from './components/FounderBrowser'
import { create } from 'zustand'
import type { BrainStatus, ChatMsg, Mission, Links, ImageRec, DeepThink, Debate, Writing, Economy, Genome, Graph, Job, LedgerEvent, Mood, Pulse, ScribeStats, Snapshot, SystemStats } from './types'
import { reaction, type Override } from './mascot/machine'

export type Tab = 'home' | 'overview' | 'desktop' | 'github' | 'evolution' | 'experiments' | 'treasury' | 'about' | 'page' | 'gallery'
export type CameraMode = 'orbit' | 'follow' | 'free'
export type Lang = 'en'
export type Toast = { id: number; ts: number; title: string; color: string; icon: string }

type State = {
  research: FounderState | null
  researchPhase: string
  connected: boolean
  bootTs: number
  events: LedgerEvent[]
  jobs: Record<string, Job>
  jobOrder: string[]
  economy: Economy | null
  genome: Genome | null
  graph: Graph
  brain: BrainStatus | null
  brainPhase: string
  scribe: ScribeStats | null
  scribePhase: string
  metrics: Record<string, Array<{ ts: number; v: number }>>
  stats: Record<string, number>
  stateHistory: Snapshot['stateHistory']
  workspaces: ReadonlyArray<{ id: string; title: string }>
  jobDefs: Snapshot['jobDefs']
  activity: Record<string, number>       // nodeId -> last activity ts
  pulses: Pulse[]
  tab: Tab
  cameraMode: CameraMode
  selectedNode: string | null
  selectedEvent: LedgerEvent | null
  selectedJob: string | null
  feedFilter: string
  scrubTs: number | null                  // null = live
  fps: number
  quality: 'high' | 'medium' | 'low'
  lang: Lang
  toasts: Toast[]
  brainNextAt: number
  scribeNextAt: number
  marketSeries: Array<{ ts: number; price: number; volume: number; mcap: number }>
  progressTick: number
  chat: ChatMsg[]
  mood: Mood | null
  system: SystemStats | null
  day: number
  online: number
  mascotOverride: Override
  mouse: [number, number]
  overload: { active: boolean; reason: string; lagMs: number; load: number; freeMB: number } | null
  mission: Mission | null
  missionHistory: Mission[]
  pageVersion: number
  links: Links | null
  gallery: ImageRec[]
  deepThink: DeepThink | null
  debate: Debate | null
  writing: Writing | null
  applySnapshot: (s: Snapshot) => void
  onLedger: (e: LedgerEvent) => void
  onTelemetry: (t: { channel: string; payload: unknown }) => void
  set: (p: Partial<State>) => void
  pulse: (from: string, to: string, color: string, ambient?: boolean) => void
}

let pulseId = 0
let toastId = 0
const TOAST: Record<string, [string, string]> = { 'image.created': ['#ff8aa0', '🖼'], 'thought.deep': ['#c08cff', '🧠'], 'debate.done': ['#ffd166', '⚖'], 'writing.done': ['#8fe3c4', '✍'], 'budget.changed': ['#5ad7ff', '＄'], 'look.changed': ['#ff8aa0', '🎩'], 'page.updated': ['#5ad7ff', '🖼'], 'identity.changed': ['#ff8aa0', '👤'], 'browse.done': ['#c08cff', '🌐'], 'mission.saved': ['#ffd166', '📚'], 'planner.changed': ['#9fb3c8', '🧠'], 'hypothesis.confirmed': ['#ffd166', '✔'], 'hypothesis.refuted': ['#ffb347', '✘'], 'motto.changed': ['#c08cff', '✎'], 'chat.say': ['#9fb3c8', '💬'], 'mission.started': ['#5ad7ff', '🎯'], 'mission.completed': ['#19f0a0', '🏁'], 'mission.failed': ['#ff3b5c', '✗'], 'system.overload': ['#ffb347', '🔥'], 'system.recovered': ['#19f0a0', '🌿'], 'survival.state': ['#ffb347', '⚠'], 'genome.mutated': ['#ffd166', '🧬'], 'github.commit': ['#ffffff', '⎇'], 'github.push': ['#ffffff', '⇪'], 'github.comment': ['#ffffff', '💬'], 'treasury.income': ['#19f0a0', '＄'], 'module.added': ['#19f0a0', '＋'], 'brain.lesson': ['#c08cff', '✎'], 'experiment.started': ['#c08cff', '⚗'], 'job.failed': ['#ff3b5c', '✗'] }
function initialLang(): Lang { return 'en' }
const EDGE_FOR: Record<string, (e: LedgerEvent) => [string, string, string] | null> = {
  'job.started': e => { const w = workerNode(e); return w ? ['server/scheduler.ts', w, '#19f0a0'] : null },
  'job.completed': e => { const w = workerNode(e); return w ? [w, 'chronicle', '#5ad7ff'] : null },
  'job.failed': e => { const w = workerNode(e); return w ? [w, 'chronicle', '#ff3b5c'] : null },
  'brain.decision': () => ['server/brain/index.ts', 'server/scheduler.ts', '#c08cff'],
  'brain.cycle': () => ['server/economy.ts', 'server/brain/index.ts', '#c08cff'],
  'genome.mutated': () => ['server/genome.ts', 'config/genome.json', '#ffd166'],
  'github.commit': () => ['server/scribe.ts', 'ext:github', '#ffffff'],
  'github.push': () => ['server/github.ts', 'ext:github', '#ffffff'],
  'github.comment': () => ['server/github.ts', 'ext:github', '#ffffff'],
  'treasury.income': () => ['ext:market', 'server/economy.ts', '#19f0a0'],
  'survival.state': () => ['server/economy.ts', 'server/brain/index.ts', '#ffb347'],
  'visitor.poke': () => ['ext:visitors', 'server/index.ts', '#5ad7ff'],
  'visitor.vote': () => ['ext:visitors', 'server/index.ts', '#5ad7ff'],
  'visitor.question': () => ['ext:visitors', 'server/index.ts', '#5ad7ff'],
}
let jobDefsCache: Snapshot['jobDefs'] = []
const WORKER_FILE: Record<string, string> = { 'cpu-bench': 'cpu-bench.ts', compress: 'compress.ts', 'compress-sweep': 'compress.ts', integrity: 'integrity.ts', memory: 'memory.ts', deps: 'deps.ts', lint: 'lint.ts', selftest: 'selftest.ts', 'recovery-check': 'selftest.ts', 'build-validate': 'build-validate.ts', logs: 'logs.ts', forecast: 'forecast.ts', 'nn-train': 'nn-train.ts' }
function workerNode(e: LedgerEvent) { const t = (e.data as { type?: string })?.type; return t && WORKER_FILE[t] ? `server/workers/${WORKER_FILE[t]}` : null }

export const useStore = create<State>((set, get) => ({
  research: null, researchPhase: 'idle', connected: false, bootTs: Date.now(), events: [], jobs: {}, jobOrder: [], economy: null, genome: null, graph: { nodes: [], edges: [], ts: 0 }, brain: null, brainPhase: 'idle', scribe: null, scribePhase: 'idle',
  metrics: {}, stats: {}, stateHistory: [], workspaces: [], jobDefs: [], activity: {}, pulses: [], cameraMode: 'orbit', selectedNode: null, selectedEvent: null, selectedJob: null, feedFilter: 'all', scrubTs: null, fps: 60, quality: 'high', lang: initialLang(), toasts: [], brainNextAt: 0, scribeNextAt: 0, marketSeries: [], progressTick: 0, chat: [], mood: null, system: null, day: 1, online: 1, mascotOverride: null, mouse: [0, 0], overload: null, mission: null, missionHistory: [], pageVersion: 0, links: null, gallery: [], deepThink: null, debate: null, writing: null, tab: (location.hash.slice(1) as Tab) || 'home',
  set: p => set(p),
  applySnapshot: s => {
    jobDefsCache = s.jobDefs
    const jobs: Record<string, Job> = {}; for (const j of s.jobs) jobs[j.id] = j
    set({ connected: true, bootTs: s.bootTs, events: s.events, jobs, jobOrder: s.jobs.map(j => j.id), economy: s.economy, genome: s.genome, graph: s.graph, brain: s.brain, scribe: s.scribe, metrics: s.metrics, stats: s.stats, stateHistory: s.stateHistory, workspaces: s.workspaces, jobDefs: s.jobDefs, brainNextAt: s.brain?.nextAt ?? 0, scribeNextAt: s.scribe?.nextAt ?? 0, marketSeries: s.marketSeries ?? [], mission: s.missions?.active ?? null, missionHistory: s.missions?.history ?? [], gallery: s.gallery ?? [], links: s.links ?? null, chat: s.chat ?? [], mood: s.vitals?.mood ?? null, system: s.vitals?.system ?? null, day: s.vitals?.day ?? 1, online: s.online ?? 1 })
  },
  onLedger: e => {
    const st = get()
    const events = st.events.length > 1500 ? [...st.events.slice(-1200), e] : [...st.events, e]
    const patch: Partial<State> = { events }
    const edge = e.type.startsWith('founder.') ? e.type === 'founder.development' ? ['pupper:development', 'pupper:tests', '#edb577'] : /analysis|decision/.test(e.type) ? ['pupper:evidence','pupper:analysis','#b99ad4'] : /plan|started/.test(e.type) ? ['pupper:memory','pupper:plan','#edb577'] : /source|read|navigate|captcha|scroll/.test(e.type) ? ['pupper:browser','pupper:evidence','#86c9bb'] : ['pupper:analysis','pupper:memory','#b99ad4'] : EDGE_FOR[e.type]?.(e)
    if (edge) { get().pulse(edge[0], edge[1], edge[2]); patch.activity = { ...st.activity, [edge[0]]: e.ts, [edge[1]]: e.ts } }
    if (e.type === 'survival.state' && st.economy) patch.economy = { ...st.economy, state: (e.data as { to: Economy['state'] }).to }
    const r = reaction(e, st.economy?.state)
    if (r && Date.now() - e.ts < 10_000 && (!st.mascotOverride || st.mascotOverride.until < Date.now() || r.state === 'celebrating' || r.state === 'talking')) patch.mascotOverride = r
    const t = TOAST[e.type]
    if (t && Date.now() - e.ts < 10_000) patch.toasts = [...st.toasts.filter(x => Date.now() - x.ts < 6000), { id: toastId++, ts: Date.now(), title: e.title, color: t[0], icon: t[1] }].slice(-4)
    if (e.type === 'github.commit' && st.scribe) patch.scribe = { ...st.scribe, commits: st.scribe.commits + 1, lastCommit: { sha: (e.data as { sha: string }).sha, ts: e.ts, url: (e.data as { url: string | null }).url } }
    set(patch)
  },
  onTelemetry: ({ channel, payload }) => {
    const st = get()
    if (channel === 'founder') { set({ researchPhase: (payload as FounderState).status, research: payload as FounderState }); return }
    if (channel === 'job') {
      const j = payload as Job
      const jobs = { ...st.jobs, [j.id]: j }
      const jobOrder = st.jobOrder.includes(j.id) ? st.jobOrder : [...st.jobOrder.slice(-300), j.id]
      const patch: Partial<State> = { jobs, jobOrder }
      if (j.status === 'running') { patch.progressTick = st.progressTick + 1; const w = WORKER_FILE[j.type]; if (w && Math.random() < 0.5) get().pulse(`server/workers/${w}`, 'chronicle', '#5ad7ff', true) }
      if (j.status === 'completed' && j.metric) { const h = [...(st.metrics[j.type] ?? []), { ts: j.finishedAt ?? Date.now(), v: j.metric.value }].slice(-300); patch.metrics = { ...st.metrics, [j.type]: h } }
      set(patch)
    } else if (channel === 'economy') { const e = payload as Economy; set({ economy: e, marketSeries: [...st.marketSeries, { ts: e.ts, price: e.market.priceUsd, volume: e.market.volume24hUsd, mcap: e.market.marketCapUsd }].slice(-240) }) }
    else if (channel === 'genome') set({ genome: payload as Genome })
    else if (channel === 'graph') set({ graph: payload as Graph })
    else if (channel === 'brain') { const p = payload as { phase: string; memory?: BrainStatus['memory']; nextAt?: number; cycle?: number }; set({ brainPhase: p.phase, ...(p.nextAt ? { brainNextAt: p.nextAt } : {}), ...(st.brain && (p.memory || p.cycle) ? { brain: { ...st.brain, ...(p.memory ? { memory: p.memory } : {}), ...(p.cycle ? { cycle: p.cycle } : {}) } } : {}) }) }
    else if (channel === 'chat') { const m = payload as ChatMsg; set({ chat: [...st.chat.filter(x => x.id !== m.id), m].slice(-200) }) }
    else if (channel === 'vitals') { const v = payload as { mood: Mood; system: SystemStats; day: number }; set({ mood: v.mood, system: v.system, day: v.day }) }
    else if (channel === 'presence') set({ online: (payload as { online: number }).online })
    else if (channel === 'mission') { const m = payload as { active: Mission | null; history: Mission[] }; set({ mission: m.active, missionHistory: m.history }) }
    else if (channel === 'page') set({ pageVersion: st.pageVersion + 1 })
    else if (channel === 'gallery') set({ gallery: [payload as ImageRec, ...st.gallery].slice(0, 120) })
    else if (channel === 'deepthink') set({ deepThink: payload as DeepThink })
    else if (channel === 'debate') set({ debate: payload as Debate })
    else if (channel === 'writing') set({ writing: payload as Writing })
    else if (channel === 'overload') set({ overload: payload as State['overload'] })
    else if (channel === 'scribe') { const p = payload as { phase: string; stats?: ScribeStats; nextAt?: number }; set({ scribePhase: p.phase, ...(p.stats ? { scribe: p.stats } : {}), ...(p.nextAt ? { scribeNextAt: p.nextAt } : {}) }) }
  },
  pulse: (from, to, color, ambient = false) => { const st = get(); const pulses = [...st.pulses.filter(p => Date.now() - p.born < 4000), { id: pulseId++, from, to, color, ambient, born: Date.now() }]; set({ pulses: pulses.slice(-120) }) },
}))

export function jobDefs() { return jobDefsCache }
