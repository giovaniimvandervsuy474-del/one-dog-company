import { createHash } from 'node:crypto'
import { input, log, progress, done, fmt } from './util.ts'

const { durationMs = 1500 } = input<{ durationMs: number }>()
log(`cpu benchmark: sha256 chain for ${durationMs}ms`)
const start = performance.now()
let hashes = 0
let buf: Buffer = Buffer.alloc(64, 1)
let nextLog = 500
while (performance.now() - start < durationMs) {
  for (let i = 0; i < 2000; i++) { buf = Buffer.from(createHash('sha256').update(buf).digest()); hashes++ }
  const el = performance.now() - start
  progress(el / durationMs * 0.7)
  if (el >= nextLog) { log(`  ${(el / 1000).toFixed(1)}s: ${(hashes / 1000).toFixed(0)}k hashes · ${fmt(hashes / (el / 1000) / 1000, 0)}k/s`); nextLog += 500 }
}
const hashMs = performance.now() - start
const hashesPerSec = hashes / (hashMs / 1000)
log(`sha256: ${hashes} hashes in ${fmt(hashMs, 0)}ms → ${fmt(hashesPerSec / 1000, 1)}k/s`)

const N = 300_000
const t2 = performance.now()
const sieve = new Uint8Array(N + 1)
let primes = 0
for (let i = 2; i <= N; i++) {
  if (!sieve[i]) { primes++; for (let j = i * 2; j <= N; j += i) sieve[j] = 1 }
}
const primeMs = performance.now() - t2
log(`sieve: ${primes} primes ≤ ${N} in ${fmt(primeMs, 1)}ms`)
progress(1)
done({ hashes, hashMs, hashesPerSec, primes, primeMs, digest: buf.toString('hex').slice(0, 16) }, { name: 'sha256/s', value: Math.round(hashesPerSec), unit: 'h/s' })
