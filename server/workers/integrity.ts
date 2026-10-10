import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { input, log, progress, done } from './util.ts'

const { root, manifestPath } = input<{ root: string; manifestPath: string }>()
const SKIP = new Set(['node_modules', '.git', 'dist', 'events', 'logs-archive', 'jobs'])
const EXT = new Set(['.ts', '.tsx', '.json', '.css', '.html', '.md'])

type Entry = { hash: string; size: number; firstSeen: number; lastChanged: number }
type Manifest = { ts: number; files: Record<string, Entry> }

function walk(dir: string, out: string[]) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (EXT.has(path.extname(ent.name))) out.push(p)
  }
}

let prev: Manifest = { ts: 0, files: {} }
if (fs.existsSync(manifestPath)) { try { prev = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) } catch {} }

const files: string[] = []
walk(root, files)
log(`scanning ${files.length} files`)
const now = Date.now()
const next: Manifest = { ts: now, files: {} }
const changed: string[] = [], added: string[] = []
let totalBytes = 0
files.forEach((f, i) => {
  const rel = path.relative(root, f)
  const data = fs.readFileSync(f)
  totalBytes += data.length
  const hash = createHash('sha256').update(data).digest('hex')
  const old = prev.files[rel]
  if (!old) { added.push(rel); next.files[rel] = { hash, size: data.length, firstSeen: now, lastChanged: now } }
  else if (old.hash !== hash) { changed.push(rel); next.files[rel] = { hash, size: data.length, firstSeen: old.firstSeen, lastChanged: now } }
  else next.files[rel] = { ...old, size: data.length }
  if (i % 20 === 0) { progress(i / files.length); log(`  ${i}/${files.length} ${rel}`) }
})
const removed = Object.keys(prev.files).filter(k => !next.files[k])
fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
fs.writeFileSync(manifestPath, JSON.stringify(next, null, 1))
const rootHash = createHash('sha256').update(Object.entries(next.files).map(([k, v]) => k + v.hash).sort().join('|')).digest('hex')
log(`root hash ${rootHash.slice(0, 12)} · +${added.length} ~${changed.length} -${removed.length}`)
progress(1)
done({ files: files.length, totalBytes, added, changed, removed, rootHash, firstRun: prev.ts === 0 }, { name: 'files', value: files.length, unit: 'files' })
