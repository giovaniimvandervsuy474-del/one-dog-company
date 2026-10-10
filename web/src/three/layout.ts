import type { Graph, GraphNode } from '../types'

export type Pos = [number, number, number]
const SHELL: Record<GraphNode['kind'], number> = { brain: 0.9, scheduler: 2.2, economy: 2.6, module: 3.8, worker: 5.4, storage: 6.4, external: 7.2 }

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0) / 4294967295 }

/** Deterministic shell placement by node kind followed by a short force relaxation. Same graph → same layout. */
export function layout(graph: Graph, prev?: Map<string, Pos>): Map<string, Pos> {
  const pos = new Map<string, Pos>()
  const byKind: Record<string, GraphNode[]> = {}
  for (const n of graph.nodes) (byKind[n.kind] ??= []).push(n)
  for (const [kind, list] of Object.entries(byKind)) {
    list.sort((a, b) => a.id.localeCompare(b.id))
    list.forEach((n, i) => {
      if (prev?.has(n.id)) { pos.set(n.id, [...prev.get(n.id)!] as Pos); return }
      const r = SHELL[kind as GraphNode['kind']]
      const golden = Math.PI * (3 - Math.sqrt(5))
      const y = kind === 'worker' ? (hash(n.id) - 0.5) * 1.2 : 1 - (2 * (i + 0.5)) / Math.max(1, list.length)
      const rad = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = golden * i + hash(n.id) * 6.283
      pos.set(n.id, [Math.cos(theta) * rad * r, y * r * (kind === 'worker' ? 1 : 0.7), Math.sin(theta) * rad * r])
    })
  }
  const ids = graph.nodes.map(n => n.id)
  const idx = new Map(ids.map((id, i) => [id, i]))
  const P = ids.map(id => pos.get(id)!)
  const kindOf = new Map(graph.nodes.map(n => [n.id, n.kind]))
  const edges = graph.edges.map(e => [idx.get(e.from)!, idx.get(e.to)!]).filter(([a, b]) => a !== undefined && b !== undefined)
  for (let it = 0; it < 90; it++) {
    const F = P.map(() => [0, 0, 0] as Pos)
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], dz = P[i][2] - P[j][2]
      const d2 = dx * dx + dy * dy + dz * dz + 0.01
      const f = 1.6 / d2
      F[i][0] += dx * f; F[i][1] += dy * f; F[i][2] += dz * f
      F[j][0] -= dx * f; F[j][1] -= dy * f; F[j][2] -= dz * f
    }
    for (const [a, b] of edges) {
      const dx = P[b][0] - P[a][0], dy = P[b][1] - P[a][1], dz = P[b][2] - P[a][2]
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6
      const f = (d - 2.4) * 0.02
      F[a][0] += dx / d * f; F[a][1] += dy / d * f; F[a][2] += dz / d * f
      F[b][0] -= dx / d * f; F[b][1] -= dy / d * f; F[b][2] -= dz / d * f
    }
    for (let i = 0; i < P.length; i++) {
      const kind = kindOf.get(ids[i])!
      if (kind === 'brain' && ids[i] === 'server/brain/index.ts') continue
      const r = SHELL[kind]
      const len = Math.hypot(...P[i]) + 1e-6
      const radial = (r - len) * 0.08
      const nx = P[i][0] / len, ny = P[i][1] / len, nz = P[i][2] / len
      P[i] = [P[i][0] + (F[i][0] * 0.04 + nx * radial), P[i][1] + (F[i][1] * 0.04 + ny * radial) * 0.8, P[i][2] + (F[i][2] * 0.04 + nz * radial)]
    }
  }
  const brain = idx.get('server/brain/index.ts')
  if (brain !== undefined) P[brain] = [0, 0, 0]
  ids.forEach((id, i) => pos.set(id, P[i]))
  return pos
}
