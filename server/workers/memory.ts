import os from 'node:os'
import v8 from 'node:v8'
import { log, done, progress, fmt } from './util.ts'

const mu = process.memoryUsage()
const heap = v8.getHeapStatistics()
const total = os.totalmem(), free = os.freemem()
const load = os.loadavg()
log(`heap ${fmt(mu.heapUsed / 1048576, 1)}MB / ${fmt(heap.heap_size_limit / 1048576, 0)}MB limit · rss ${fmt(mu.rss / 1048576, 1)}MB`)
log(`system ${fmt((total - free) / 1073741824, 2)}GB used of ${fmt(total / 1073741824, 1)}GB · load ${load.map(l => l.toFixed(2)).join(' ')}`)
// small allocation probe: measure allocation throughput for 50ms
const t = performance.now(); let allocs = 0; const keep: number[][] = []
while (performance.now() - t < 250) { keep.push(new Array(128).fill(allocs)); allocs++; if (keep.length > 2000) keep.length = 0; if (allocs % 20000 === 0) progress(Math.min(0.9, (performance.now() - t) / 250)) }
log(`alloc probe: ${allocs} arrays/250ms`)
progress(1)
done({ heapUsedMB: mu.heapUsed / 1048576, rssMB: mu.rss / 1048576, heapLimitMB: heap.heap_size_limit / 1048576, sysUsedGB: (total - free) / 1073741824, sysTotalGB: total / 1073741824, load1: load[0], allocsPer50ms: allocs, cpus: os.cpus().length },
  { name: 'rss', value: Number((mu.rss / 1048576).toFixed(1)), unit: 'MB' })
