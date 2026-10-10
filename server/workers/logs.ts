import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { input, log, done, progress } from './util.ts'

const { eventsDir, archiveDir } = input<{ eventsDir: string; archiveDir: string }>()
fs.mkdirSync(archiveDir, { recursive: true })
const today = new Date().toISOString().slice(0, 10)
const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.jsonl')).sort()
let archived = 0, savedBytes = 0
const byType: Record<string, number> = {}
let todayEvents = 0, todayBytes = 0
files.forEach((f, i) => {
  const p = path.join(eventsDir, f)
  const raw = fs.readFileSync(p)
  if (f.startsWith(today)) {
    todayBytes = raw.length
    for (const line of raw.toString('utf8').split('\n')) { if (!line) continue; todayEvents++; try { const t = JSON.parse(line).type as string; byType[t] = (byType[t] ?? 0) + 1 } catch {} }
  } else {
    const target = path.join(archiveDir, f + '.gz')
    if (!fs.existsSync(target)) {
      const gz = zlib.gzipSync(raw, { level: 9 })
      fs.writeFileSync(target, gz)
      archived++; savedBytes += raw.length - gz.length
      log(`archived ${f}: ${(raw.length / 1024).toFixed(0)}KB → ${(gz.length / 1024).toFixed(0)}KB`)
    }
  }
  progress((i + 1) / files.length)
})
log(`today: ${todayEvents} events, ${(todayBytes / 1024).toFixed(0)}KB · archived ${archived} day-files, saved ${(savedBytes / 1024).toFixed(0)}KB`)
done({ todayEvents, todayBytes, byType, archived, savedBytes, dayFiles: files.length }, { name: 'events today', value: todayEvents, unit: 'ev' })
