import fs from 'node:fs'
import path from 'node:path'
import { ROOT, SERVER_DIR, CHRONICLE } from './paths.ts'
import { append } from './ledger.ts'
import { telemetry } from './bus.ts'
import * as sched from './scheduler.ts'
import type { Graph, GraphEdge, GraphNode } from './types.ts'

let graph: Graph = { nodes: [], edges: [], ts: 0 }
const bootTs = Date.now()

function firstSeen(): Record<string, number> {
  try { const m = JSON.parse(fs.readFileSync(path.join(CHRONICLE, 'integrity.json'), 'utf8')) as { files: Record<string, { firstSeen: number }> }; return Object.fromEntries(Object.entries(m.files).map(([k, v]) => [k, v.firstSeen])) } catch { return {} }
}

function scan(dir: string, out: string[]) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) scan(p, out)
    else if (/\.tsx?$/.test(ent.name)) out.push(p)
  }
}

export function rebuild(reason: string): Graph {
  const files: string[] = []
  scan(SERVER_DIR, files)
  const seen = firstSeen()
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const running = new Set(sched.runningJobs().map(j => j.type))
  const defs = sched.jobDefs()
  const ids = new Set<string>()
  for (const f of files) {
    const rel = path.relative(ROOT, f)
    const isWorker = rel.startsWith('server/workers/') && !rel.endsWith('util.ts')
    const def = isWorker ? defs.find(d => d.worker === path.basename(rel)) : undefined
    const kind: GraphNode['kind'] = isWorker ? 'worker' : rel.includes('/brain/') ? 'brain' : rel.includes('economy') || rel.includes('/market/') ? 'economy' : rel.endsWith('scheduler.ts') ? 'scheduler' : 'module'
    const size = fs.statSync(f).size
    nodes.push({ id: rel, label: path.basename(rel, path.extname(rel)), kind, since: seen[rel] ?? bootTs, active: def ? [...running].some(t => defs.find(d => d.type === t)?.worker === path.basename(rel)) : true, meta: { bytes: size, jobType: def?.type, workspace: def?.workspace } })
    ids.add(rel)
    const src = fs.readFileSync(f, 'utf8')
    for (const m of src.matchAll(/from\s+'(\.[^']+)'/g)) {
      const target = path.relative(ROOT, path.resolve(path.dirname(f), m[1]))
      edges.push({ from: rel, to: target, kind: 'import' })
    }
  }
  const ext = (id: string, label: string, kind: GraphNode['kind'], meta?: Record<string, unknown>) => { nodes.push({ id, label, kind, since: bootTs, active: true, meta }); ids.add(id) }
  ext('chronicle', 'chronicle/', 'storage', { desc: 'append-only ledger, memory, digests' })
  ext('config/genome.json', 'genome', 'storage', { desc: 'self-modified configuration' })
  ext('ext:github', 'GitHub', 'external', { desc: 'commits, issues, comments' })
  ext('ext:market', 'Market feed', 'external', { desc: 'price, volume, fees' })
  ext('ext:visitors', 'Visitors', 'external', { desc: 'poke, vote, donate, ask' })
  for (const n of nodes) if (n.kind === 'worker') { edges.push({ from: 'server/scheduler.ts', to: n.id, kind: 'flow' }); edges.push({ from: n.id, to: 'chronicle', kind: 'flow' }) }
  edges.push({ from: 'server/ledger.ts', to: 'chronicle', kind: 'flow' }, { from: 'server/scribe.ts', to: 'ext:github', kind: 'flow' }, { from: 'server/github.ts', to: 'ext:github', kind: 'flow' },
    { from: 'ext:market', to: 'server/economy.ts', kind: 'flow' }, { from: 'server/genome.ts', to: 'config/genome.json', kind: 'flow' }, { from: 'server/brain/index.ts', to: 'server/scheduler.ts', kind: 'control' },
    { from: 'ext:visitors', to: 'server/index.ts', kind: 'flow' }, { from: 'server/brain/memory.ts', to: 'chronicle', kind: 'flow' })
  const clean = edges.filter(e => ids.has(e.from) && ids.has(e.to) && e.from !== e.to)
  const prevIds = new Set(graph.nodes.map(n => n.id))
  graph = { nodes, edges: dedupe(clean), ts: Date.now() }
  if (prevIds.size) {
    for (const n of nodes) if (!prevIds.has(n.id)) append({ type: 'module.added', source: 'modules', severity: 'success', title: `New module ${n.id} joined the graph`, data: { id: n.id, reason }, evidence: { file: n.id } })
    for (const id of prevIds) if (!ids.has(id)) append({ type: 'module.removed', source: 'modules', severity: 'warn', title: `Module ${id} removed from the graph`, data: { id, reason } })
  }
  telemetry('graph', graph)
  return graph
}
function dedupe(edges: GraphEdge[]) { const s = new Set<string>(); return edges.filter(e => { const k = `${e.from}>${e.to}>${e.kind}`; if (s.has(k)) return false; s.add(k); return true }) }

export function get() { return graph }
export function init() {
  rebuild('boot')
  sched.onJobFinish(j => {
    if (j.type === 'integrity' && j.status === 'completed' && j.output) {
      const o = j.output as { changed: string[]; added: string[]; removed: string[] }
      const touched = [...o.changed, ...o.added, ...o.removed].filter(f => f.startsWith('server/') || f.startsWith('web/'))
      for (const f of o.changed) if (f.startsWith('server/') || f.startsWith('web/')) append({ type: 'file.changed', source: 'integrity', title: `File changed: ${f}`, data: { file: f }, evidence: { file: f, jobId: j.id } })
      if (touched.length) rebuild('integrity sweep')
      else telemetry('graph', { ...graph, nodes: graph.nodes.map(n => ({ ...n })) })
    }
    if (j.status === 'running' || !j.type) return
    telemetry('activity', { nodeId: sched.jobDefs().find(d => d.type === j.type)?.worker ? `server/workers/${sched.jobDefs().find(d => d.type === j.type)!.worker}` : null, jobId: j.id, status: j.status })
  })
}
