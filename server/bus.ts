import { EventEmitter } from 'node:events'
import type { LedgerEvent } from './types.ts'

type Events = {
  ledger: (e: LedgerEvent) => void
  telemetry: (t: { channel: string; payload: unknown }) => void
}

class Bus extends EventEmitter {
  override emit<K extends keyof Events>(name: K, ...args: Parameters<Events[K]>): boolean {
    return super.emit(name, ...args)
  }
  override on<K extends keyof Events>(name: K, fn: Events[K]): this {
    return super.on(name, fn)
  }
}

export const bus = new Bus()
bus.setMaxListeners(100)

export function telemetry(channel: string, payload: unknown) {
  bus.emit('telemetry', { channel, payload })
}
