import { input, log, done, progress } from './util.ts'

const snap = input<{ genome: Record<string, unknown>; economy: Record<string, unknown>; eventIds: string[]; eventCount: number; jobStats: Record<string, number> }>()
const checks: Array<[string, () => boolean]> = [
  ['genome.concurrency in 1..8', () => { const c = snap.genome.concurrency as number; return c >= 1 && c <= 8 }],
  ['genome.compressionLevel in 1..11', () => { const c = snap.genome.compressionLevel as number; return c >= 1 && c <= 11 }],
  ['all job intervals positive', () => Object.values(snap.genome.jobIntervals as Record<string, number>).every(v => v > 1000)],
  ['brain interval ≥ 10s', () => (snap.genome.brainIntervalMs as number) >= 10_000],
  ['treasury is finite', () => Number.isFinite(snap.economy.treasuryUsd as number)],
  ['treasury ≥ 0', () => (snap.economy.treasuryUsd as number) >= 0],
  ['burn rate is finite', () => Number.isFinite(snap.economy.burnPerHourUsd as number)],
  ['vitality in 0..100', () => { const v = snap.economy.vitality as number; return v >= 0 && v <= 100 }],
  ['state is valid', () => ['ALIVE', 'STRAINED', 'CRITICAL', 'HIBERNATING', 'RECOVERING'].includes(snap.economy.state as string)],
  ['event ids unique (sample)', () => new Set(snap.eventIds).size === snap.eventIds.length],
  ['ledger non-empty', () => snap.eventCount > 0],
  ['failed jobs < 30% of finished', () => { const f = snap.jobStats.failed ?? 0, c = snap.jobStats.completed ?? 0; return c + f === 0 || f / (c + f) < 0.3 }],
]
let passed = 0
const failed: string[] = []
checks.forEach(([name, fn], i) => {
  let ok = false
  try { ok = fn() } catch { ok = false }
  if (ok) passed++; else failed.push(name)
  log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  progress((i + 1) / checks.length)
})
done({ total: checks.length, passed, failed }, { name: 'passed', value: passed, unit: `/${checks.length}` })
