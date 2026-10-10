import { parentPort, workerData } from 'node:worker_threads'

export type WorkerMsg =
  | { type: 'log'; line: string }
  | { type: 'progress'; value: number }
  | { type: 'result'; output: Record<string, unknown>; metric?: { name: string; value: number; unit: string } }

export function input<T = Record<string, unknown>>(): T { return (workerData ?? {}) as T }
export function log(line: string) { parentPort?.postMessage({ type: 'log', line } satisfies WorkerMsg) }
export function progress(value: number) { parentPort?.postMessage({ type: 'progress', value: Math.max(0, Math.min(1, value)) } satisfies WorkerMsg) }
export function done(output: Record<string, unknown>, metric?: { name: string; value: number; unit: string }) {
  parentPort?.postMessage({ type: 'result', output, metric } satisfies WorkerMsg)
}
export function fmt(n: number, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : 'n/a' }
