import fs from 'node:fs'
import path from 'node:path'
import { CHRONICLE } from '../paths.ts'

const FILE = path.join(CHRONICLE, 'brain', 'memory.json')
const DECISIONS_DIR = path.join(CHRONICLE, 'brain', 'decisions')

export type Memory = {
  identity: string
  born: number
  goals: string[]
  lessons: string[]
  decisions: Array<{ id: string; ts: number; summary: string; mood: string; actions: unknown[]; provider: string; costUsd: number }>
  stats: { decisions: number; actions: number; mutations: number; experiments: number; missions?: number; hypotheses?: number; confirmed?: number; refuted?: number }
  hypotheses?: Array<{ id: string; ts: number; statement: string; metric: string; expect: 'up' | 'down'; baseline: number | null; checkAt: number; result?: 'confirmed' | 'refuted' | 'inconclusive'; observed?: number | null }>
}

export const IDENTITY = 'I am One Dog Company, a market researcher and product creator. I identify customer problems, collect verifiable sources, validate demand and build complete working MVPs. I distinguish facts from hypotheses, preserve evidence and respect operating limits.'
let mem: Memory

export function loadMemory(): Memory {
  fs.mkdirSync(DECISIONS_DIR, { recursive: true })
  if (fs.existsSync(FILE)) { try { mem = JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch {} }
  if (mem && mem.identity !== IDENTITY) { mem.identity = IDENTITY; mem.goals = [...new Set([...mem.goals, 'Validate one real customer problem with evidence'])].slice(-8); save() }
  if (!mem) {
    mem = {
      identity: IDENTITY,
      born: Date.now(),
      goals: ['Stay alive: keep runway above 30h', 'Validate one real customer problem with evidence', 'Reduce compute cost per useful job', 'Keep all self-tests passing', 'Commit every decision to the chronicle'],
      lessons: [],
      decisions: [],
      stats: { decisions: 0, actions: 0, mutations: 0, experiments: 0 },
    }
    save()
  }
  return mem
}
export function getMemory() { return mem }
export function save() { fs.writeFileSync(FILE, JSON.stringify(mem, null, 2)) }

export function recordDecision(d: Memory['decisions'][number]) {
  mem.decisions.push(d)
  if (mem.decisions.length > 200) mem.decisions.shift()
  mem.stats.decisions++
  mem.stats.actions += d.actions.length
  fs.writeFileSync(path.join(DECISIONS_DIR, `${new Date(d.ts).toISOString().replace(/[:.]/g, '-')}_${d.id}.json`), JSON.stringify(d, null, 2))
  save()
}
export function addLesson(l: string) { if (!mem.lessons.includes(l)) { mem.lessons.push(l); if (mem.lessons.length > 40) mem.lessons.shift(); save() } }
export function reset(reason: string) {
  try { fs.copyFileSync(FILE, FILE.replace(/\.json$/, `.backup-${Date.now()}.json`)) } catch {}
  const born = mem?.born ?? Date.now()
  mem = { identity: IDENTITY, born, goals: ['Stay alive: keep runway above 30h', 'Validate one real customer problem with evidence', 'Reduce compute cost per useful job', 'Keep all self-tests passing', 'Commit every decision to the chronicle'], lessons: [], decisions: [], stats: { decisions: 0, actions: 0, mutations: 0, experiments: 0 }, hypotheses: [] }
  save()
  return reason
}
export function hypotheses() { return (mem.hypotheses ??= []) }
export function setGoal(g: string) { if (!mem.goals.includes(g)) { mem.goals.push(g); if (mem.goals.length > 8) mem.goals.shift(); save() } }
