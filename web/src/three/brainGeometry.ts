import * as THREE from 'three'
import type { Graph, GraphNode } from '../types'

export type BrainPoint = [number, number, number]
export function hash(value: string) { let h = 2166136261; for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0) / 4294967295 }
function random(seed: number) { return () => { seed = Math.imul(seed ^ seed >>> 15, 1 | seed); seed ^= seed + Math.imul(seed ^ seed >>> 7, 61 | seed); return ((seed ^ seed >>> 14) >>> 0) / 4294967296 } }

/** Two corrugated cortical hemispheres separated by a visible longitudinal fissure. */
export function cortex(direction: THREE.Vector3, depth = 1): THREE.Vector3 {
  const d = direction.clone().normalize(), side = d.x < 0 ? -1 : 1
  const theta = Math.atan2(d.z, Math.abs(d.x)), phi = Math.acos(d.y)
  const folds = 1 + .075 * Math.sin(theta * 12 + phi * 3) * Math.sin(phi * 11) + .035 * Math.cos(theta * 21 - phi * 9)
  const x = side * (.24 + Math.abs(d.x) * 2.0 * folds)
  const z = d.z * 3.05 * folds
  const y = d.y * 1.93 * folds * (.88 + .12 * Math.abs(d.x)) + .16 * Math.cos(z * .65) + .22
  return new THREE.Vector3(x * depth, y * depth, z * depth)
}

export function brainLayout(graph: Graph): Map<string, BrainPoint> {
  const positions = new Map<string, BrainPoint>()
  const interior: Partial<Record<GraphNode['kind'], number>> = { brain: .22, scheduler: .42, economy: .65, worker: .76, storage: .57 }
  for (const node of graph.nodes) {
    const z = hash(node.id + '/latitude') * 1.76 - .88, theta = hash(node.id + '/longitude') * Math.PI * 2, r = Math.sqrt(1 - z * z)
    const p = cortex(new THREE.Vector3(Math.cos(theta) * r, z, Math.sin(theta) * r), interior[node.kind] ?? .98)
    if (node.id === 'server/brain/index.ts') p.set(-.2, .48, .1)
    positions.set(node.id, p.toArray() as BrainPoint)
  }
  return positions
}

export function axon(a: THREE.Vector3, b: THREE.Vector3, seed = 1, surface = false) {
  const rand = random(seed), distance = a.distanceTo(b), points = [a.clone()]
  const tangent = b.clone().sub(a).normalize(), normal = tangent.clone().cross(new THREE.Vector3(.2, 1, .3)).normalize(), other = tangent.clone().cross(normal).normalize()
  for (let i = 1; i < 6; i++) {
    const t = i / 6, p = a.clone().lerp(b, t), envelope = Math.sin(t * Math.PI)
    if (surface && Math.abs(p.x) > .16) { const bulge = p.clone().normalize().multiplyScalar(distance * .065 * envelope); p.add(bulge) }
    p.addScaledVector(normal, (rand() - .5) * distance * .21 * envelope).addScaledVector(other, (rand() - .5) * distance * .14 * envelope)
    points.push(p)
  }
  points.push(b.clone())
  return new THREE.CatmullRomCurve3(points).getPoints(surface ? 12 : 24)
}

export function fiberGeometry(paths: THREE.Vector3[][], seed = 17) {
  const positions: number[] = [], times: number[] = [], phases: number[] = []
  const rand = random(seed)
  paths.forEach(path => { const phase = rand(); for (let i = 0; i < path.length - 1; i++) { positions.push(...path[i].toArray(), ...path[i + 1].toArray()); times.push(i / (path.length - 1), (i + 1) / (path.length - 1)); phases.push(phase, phase) } })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('aAlong', new THREE.Float32BufferAttribute(times, 1)); geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1))
  return geometry
}

export function makeBrain(mini: boolean) {
  const rand = random(97143), count = mini ? 740 : 1450, points: THREE.Vector3[] = []
  for (let i = 0; i < count; i++) {
    const y = 1 - 2 * (i + .5) / count, angle = i * Math.PI * (3 - Math.sqrt(5)), radius = Math.sqrt(1 - y * y)
    points.push(cortex(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)))
  }
  const cortexCount = points.length
  // The tapered brainstem connects to the posterior underside rather than floating outside the brain.
  for (let i = 0; i < (mini ? 95 : 180); i++) {
    const t = rand(), angle = rand() * Math.PI * 2, radius = (.38 - t * .2) * (.7 + rand() * .3)
    points.push(new THREE.Vector3(Math.cos(angle) * radius, -1.22 - t * 1.6, -1.6 + t * .65 + Math.sin(angle) * radius))
  }
  const paths: THREE.Vector3[][] = []
  for (let i = 0; i < points.length; i++) {
    const near: Array<{ index: number; distance: number }> = []
    for (let j = 0; j < points.length; j++) {
      if (j === i || (i < cortexCount && j < cortexCount && points[i].x * points[j].x < 0)) continue
      const distance = points[i].distanceToSquared(points[j]); if (distance > .9) continue
      let index = near.findIndex(n => distance < n.distance); if (index < 0) index = near.length
      if (index < 4) { near.splice(index, 0, { index: j, distance }); near.length = Math.min(near.length, 4) }
    }
    for (const n of near) if (n.index > i) paths.push(axon(points[i], points[n.index], i * 971 + n.index, true))
  }
  const geometry = new THREE.BufferGeometry(), positions: number[] = [], sizes: number[] = [], strengths: number[] = [], phases: number[] = [], colors: number[] = []
  points.forEach((p, i) => {
    positions.push(...p.toArray()); const hub = i < cortexCount && i % 43 === 0
    sizes.push(hub ? .12 : .035 + rand() * .03); strengths.push(hub ? 1.2 : .3 + rand() * .45); phases.push(rand() * Math.PI * 2)
    colors.push(...new THREE.Color(hub ? '#e3dcff' : p.x < 0 ? '#55dfd1' : '#af8aff').toArray())
  })
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1)); geometry.setAttribute('aPower', new THREE.Float32BufferAttribute(strengths, 1)); geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1)); geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3))
  // Low density interior axons give the cortical shell volume when rotating it.
  for (let i = 0; i < (mini ? 100 : 230); i++) { const a = points[Math.floor(rand() * cortexCount)].clone().multiplyScalar(.93), b = points[Math.floor(rand() * cortexCount)].clone().multiplyScalar(.88); if (a.distanceTo(b) < 4.2) paths.push(axon(a, b, i + 27000)) }
  return { neurons: geometry, fibers: fiberGeometry(paths), fiberCount: paths.length }
}

