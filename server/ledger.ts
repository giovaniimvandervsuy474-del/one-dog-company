import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { bus } from './bus.ts'
import { CHRONICLE } from './paths.ts'
import type { Evidence, LedgerEvent, Severity } from './types.ts'

const EVENTS_DIR = path.join(CHRONICLE, 'events')
const MAX_MEMORY = 6000

const memory: LedgerEvent[] = []
let seq = 0

function dayFile(ts: number) {
  const d = new Date(ts)
  const name = d.toISOString().slice(0, 10)
  return path.join(EVENTS_DIR, `${name}.jsonl`)
}

export function loadRecent() {
  fs.mkdirSync(EVENTS_DIR, { recursive: true })
  const files = fs.readdirSync(EVENTS_DIR).filter(f => f.endsWith('.jsonl')).sort().slice(-2)
  for (const f of files) {
    const lines = fs.readFileSync(path.join(EVENTS_DIR, f), 'utf8').split('\n').filter(Boolean)
    for (const line of lines) {
      try { memory.push(JSON.parse(line)) } catch { /* corrupted line, skip */ }
    }
  }
  if (memory.length > MAX_MEMORY) memory.splice(0, memory.length - MAX_MEMORY)
  seq = memory.length
}

export type AppendInput = {
  type: string
  title: string
  source: string
  severity?: Severity
  data?: Record<string, unknown>
  evidence?: Evidence
}

/** Anything that looks like a credential is masked before it can reach the ledger, the UI or git. */
const SECRET_PATTERNS = [/rqsty-sk-[A-Za-z0-9+/=_-]{10,}/g, /github_pat_[A-Za-z0-9_]{20,}/g, /gh[pousr]_[A-Za-z0-9]{20,}/g, /api-key=[A-Za-z0-9-]{8,}/gi, /\bsk-[A-Za-z0-9_-]{20,}/g, /Bearer\s+[A-Za-z0-9._-]{20,}/g, /xox[baprs]-[A-Za-z0-9-]{10,}/g, /AKIA[0-9A-Z]{16}/g, /\b[1-9A-HJ-NP-Za-km-z]{87,88}\b/g]
export function redact<T>(v: T): T {
  if (typeof v === 'string') { let s: string = v; for (const re of SECRET_PATTERNS) s = s.replace(re, m => m.slice(0, 6) + '…[redacted]'); return s as unknown as T }
  if (Array.isArray(v)) return v.map(redact) as unknown as T
  if (v && typeof v === 'object') { const o: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = redact(x); return o as T }
  return v
}

export function append(input: AppendInput): LedgerEvent {
  const e: LedgerEvent = {
    id: `${Date.now().toString(36)}-${(seq++).toString(36)}-${randomUUID().slice(0, 4)}`,
    ts: Date.now(),
    type: input.type,
    severity: input.severity ?? 'info',
    source: input.source,
    title: redact(input.title),
    data: input.data ? redact(input.data) : undefined,
    evidence: input.evidence,
  }
  memory.push(e)
  if (memory.length > MAX_MEMORY) memory.shift()
  fs.appendFileSync(dayFile(e.ts), JSON.stringify(e) + '\n')
  bus.emit('ledger', e)
  return e
}

export function recent(limit = 300, filter?: (e: LedgerEvent) => boolean): LedgerEvent[] {
  const src = filter ? memory.filter(filter) : memory
  return src.slice(-limit)
}

export function all(): LedgerEvent[] { return memory }

export function since(ts: number): LedgerEvent[] { return memory.filter(e => e.ts >= ts) }

export function countByType(sinceTs: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of memory) if (e.ts >= sinceTs) out[e.type] = (out[e.type] ?? 0) + 1
  return out
}
