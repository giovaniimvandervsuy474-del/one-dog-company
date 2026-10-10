import fs from 'node:fs'
import path from 'node:path'
import { CONFIG } from './paths.ts'
import { append } from './ledger.ts'
import { telemetry } from './bus.ts'
import type { Genome } from './types.ts'

const FILE = path.join(CONFIG, 'genome.json')

const DEFAULT: Genome = {
  version: 1,
  concurrency: 4,
  brainIntervalMs: 10_000,
  scribeIntervalMs: 2 * 60_000,
  compressionLevel: 6,
  compressionAlgo: 'gzip',
  cpuBenchDurationMs: 2500,
  jobIntervals: {
    'cpu-bench': 14_000,
    'integrity': 18_000,
    'compress': 11_000,
    'memory': 12_000,
    'deps': 300_000,
    'lint': 13_000,
    'logs': 35_000,
    'forecast': 9_000,
    'selftest': 25_000,
    'build-validate': 600_000,
    'nn-train': 16_000,
  },
  pausedWorkspaces: [],
  aiProvider: 'heuristic',
  aiCallsPerHour: 100_000,
  motto: 'AI that refuses to die',
  nnLearningRate: 0.02,
  spendTargetPerHour: Number(process.env.SPEND_TARGET_PER_HOUR ?? 60),
  look: { hoodieColor: '#171a24', antennaColor: '#5ad7ff', neonColor: '#8a5cff', hat: 'none', glasses: 'none', badge: 'LFG', deskItems: ['plant', 'mug'], poster: 'JUST BUILD', sticker: '' },
  history: [],
}

let genome: Genome

export function loadGenome(): Genome {
  fs.mkdirSync(CONFIG, { recursive: true })
  if (fs.existsSync(FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Partial<Genome>
      genome = { ...DEFAULT, ...raw, jobIntervals: { ...DEFAULT.jobIntervals, ...(raw.jobIntervals ?? {}) }, look: { ...DEFAULT.look, ...(raw.look ?? {}) } }
      if ((raw.jobIntervals?.['memory'] ?? 0) > 20_000) { genome.jobIntervals = { ...DEFAULT.jobIntervals }; genome.brainIntervalMs = DEFAULT.brainIntervalMs; genome.scribeIntervalMs = DEFAULT.scribeIntervalMs; genome.concurrency = Math.max(genome.concurrency, 4); genome.cpuBenchDurationMs = DEFAULT.cpuBenchDurationMs }
    } catch {
      genome = structuredClone(DEFAULT)
    }
  } else {
    genome = structuredClone(DEFAULT)
    save()
  }
  const want = process.env.AI_PROVIDER
  if (want === 'anthropic' && process.env.ANTHROPIC_API_KEY) genome.aiProvider = 'anthropic'
  else if (want === 'requesty' && process.env.REQUESTY_API_KEY) genome.aiProvider = 'requesty'
  else if (want === 'heuristic') genome.aiProvider = 'heuristic'
  return genome
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(genome, null, 2))
}

export function getGenome(): Genome { return genome }

export function mutate<K extends keyof Genome>(key: K, value: Genome[K], reason: string, decisionId?: string): boolean {
  if (key === 'history' || key === 'version') return false
  const from = genome[key]
  if (JSON.stringify(from) === JSON.stringify(value)) return false
  genome[key] = value
  genome.version += 1
  genome.history.push({ ts: Date.now(), version: genome.version, key, from, to: value, reason, decisionId })
  if (genome.history.length > 500) genome.history.splice(0, genome.history.length - 500)
  save()
  try { fs.mkdirSync(path.join(CONFIG, 'snapshots'), { recursive: true }); fs.writeFileSync(path.join(CONFIG, 'snapshots', `genome.v${genome.version}.json`), JSON.stringify(genome, null, 2)) } catch {}
  append({
    type: 'genome.mutated',
    source: 'evolution',
    severity: 'success',
    title: `Genome v${genome.version}: ${key} ${JSON.stringify(from)} → ${JSON.stringify(value)}`,
    data: { key, from, to: value, reason, version: genome.version },
    evidence: { file: 'config/genome.json', decisionId },
  })
  telemetry('genome', genome)
  return true
}

/** Roll the genome back to a saved snapshot (or to defaults). Recorded like any other change, so the rollback itself is auditable. */
export function rollback(version: number | 'defaults', reason: string): boolean {
  let next: Genome | null = null
  if (version === 'defaults') next = { ...structuredClone(DEFAULT), history: genome.history }
  else { try { next = JSON.parse(fs.readFileSync(path.join(CONFIG, 'snapshots', `genome.v${version}.json`), 'utf8')) as Genome } catch { return false } }
  if (!next) return false
  const from = genome.version
  const keep = genome.history
  genome = { ...next, history: keep, version: genome.version + 1 }
  genome.history.push({ ts: Date.now(), version: genome.version, key: 'ROLLBACK', from, to: version, reason })
  save()
  append({ type: 'genome.rollback', source: 'admin', severity: 'warn', title: `Genome rolled back to ${version === 'defaults' ? 'defaults' : 'v' + version} (now v${genome.version}) · ${reason}`, data: { from, to: version, reason } })
  telemetry('genome', genome)
  return true
}
export function listSnapshots(): number[] { try { return fs.readdirSync(path.join(CONFIG, 'snapshots')).map(f => Number(f.match(/v(\d+)/)?.[1])).filter(Boolean).sort((a, b) => a - b) } catch { return [] } }

export function mutateJobInterval(type: string, ms: number, reason: string, decisionId?: string) {
  const next = { ...genome.jobIntervals, [type]: ms }
  return mutate('jobIntervals', next, reason, decisionId)
}
