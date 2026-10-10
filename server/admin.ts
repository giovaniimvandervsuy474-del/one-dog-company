import type http from 'node:http'
import { randomBytes } from 'node:crypto'
import { append } from './ledger.ts'
import { getGenome, rollback, listSnapshots, mutate } from './genome.ts'
import * as brain from './brain/index.ts'
import { reset as resetMemory } from './brain/memory.ts'
import * as missions from './missions.ts'
import * as economy from './economy.ts'

/**
 * Operator controls: the human can always pause autonomy, roll the genome back, or reset memory.
 * Protected by ADMIN_TOKEN (env). Every use is written to the ledger so even rollbacks are part of the story.
 */
export const token = process.env.ADMIN_TOKEN || randomBytes(12).toString('hex')
if (!process.env.ADMIN_TOKEN) console.error(`[admin] ADMIN_TOKEN is not configured; public operator controls are unavailable`)

export function authorized(req: http.IncomingMessage, url: URL) {
  const h = req.headers['x-admin-token'] ?? url.searchParams.get('token')
  return Boolean(process.env.ADMIN_TOKEN) && h === token
}

export async function handle(action: string, body: Record<string, unknown>): Promise<{ ok: boolean; [k: string]: unknown }> {
  switch (action) {
    case 'status': return { ok: true, paused: brain.paused, treasury: economy.snapshot().treasuryUsd, demo: economy.demo(), genomeVersion: getGenome().version, snapshots: listSnapshots(), mission: missions.status().active?.title ?? null, provider: getGenome().aiProvider }
    case 'pause': brain.setPaused(true); return { ok: true, paused: true }
    case 'resume': brain.setPaused(false); return { ok: true, paused: false }
    case 'genome-rollback': { const v = body.version === 'defaults' ? 'defaults' : Number(body.version); const ok = rollback(v as number | 'defaults', String(body.reason ?? 'operator rollback')); return { ok, version: getGenome().version } }
    case 'spend-target': { const usd = Number(body.usd); if (!(usd >= 0 && usd <= 500)) return { ok: false, error: 'usd 0-500' }; mutate('spendTargetPerHour', usd, String(body.reason ?? 'operator set spend target')); return { ok: true, spendTargetPerHour: getGenome().spendTargetPerHour } }
    case 'genome-set': { const key = String(body.key); const allowed = ['brainIntervalMs', 'concurrency', 'spendTargetPerHour', 'compressionLevel', 'nnLearningRate', 'cpuBenchDurationMs'] as const; if (!allowed.includes(key as never)) return { ok: false, error: `key must be one of ${allowed.join(', ')}` }; const value = Number(body.value); if (!Number.isFinite(value)) return { ok: false, error: 'value' }; mutate(key as 'concurrency', value as never, String(body.reason ?? 'operator genome-set')); return { ok: true, [key]: (getGenome() as unknown as Record<string, unknown>)[key] } }
    case 'memory-reset': { resetMemory(String(body.reason ?? 'operator reset')); append({ type: 'admin.memory-reset', source: 'admin', severity: 'warn', title: `Memory reset by operator: identity and goals restored, lessons and hypotheses cleared (backup kept)` }); return { ok: true } }
    default: return { ok: false, error: 'unknown action' }
  }
}
