import { useStore } from './store'
import type { Snapshot, LedgerEvent } from './types'

export function connect() {
  let es: EventSource | null = null
  let retry = 1000
  const open = () => {
    es = new EventSource('/api/stream')
    es.addEventListener('snapshot', ev => { retry = 1000; useStore.getState().applySnapshot(JSON.parse((ev as MessageEvent).data) as Snapshot) })
    es.addEventListener('ledger', ev => useStore.getState().onLedger(JSON.parse((ev as MessageEvent).data) as LedgerEvent))
    es.addEventListener('telemetry', ev => useStore.getState().onTelemetry(JSON.parse((ev as MessageEvent).data)))
    es.onerror = () => { useStore.getState().set({ connected: false }); es?.close(); setTimeout(open, retry); retry = Math.min(15000, retry * 2) }
  }
  open()
}

export async function get<T>(path: string): Promise<T> { const r = await fetch(path); return r.json() as Promise<T> }
export async function post<T>(path: string, body: unknown): Promise<T> { const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return r.json() as Promise<T> }
