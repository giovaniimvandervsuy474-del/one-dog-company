import fs from 'node:fs'
import path from 'node:path'
import { input, log, done, progress } from './util.ts'

const { root } = input<{ root: string }>()
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const direct = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
const nm = path.join(root, 'node_modules')
let packages = 0, totalBytes = 0
const sizes: Array<{ name: string; bytes: number }> = []
function dirSize(d: string, depth = 0): number {
  let s = 0
  try {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name)
      if (ent.isDirectory()) { if (depth < 2) s += dirSize(p, depth + 1) }
      else { try { s += fs.statSync(p).size } catch {} }
    }
  } catch {}
  return s
}
if (fs.existsSync(nm)) {
  const names = fs.readdirSync(nm).filter(n => !n.startsWith('.'))
  const expanded: string[] = []
  for (const n of names) {
    if (n.startsWith('@')) for (const s of fs.readdirSync(path.join(nm, n))) expanded.push(`${n}/${s}`)
    else expanded.push(n)
  }
  packages = expanded.length
  expanded.forEach((n, i) => { const b = dirSize(path.join(nm, n)); totalBytes += b; sizes.push({ name: n, bytes: b }); if (i % 25 === 0) progress(i / expanded.length) })
}
sizes.sort((a, b) => b.bytes - a.bytes)
log(`${Object.keys(direct).length} direct deps · ${packages} installed packages · ${(totalBytes / 1048576).toFixed(1)} MB`)
for (const s of sizes.slice(0, 5)) log(`  ${s.name} ${(s.bytes / 1048576).toFixed(1)} MB`)
progress(1)
done({ direct: Object.keys(direct).length, packages, totalMB: totalBytes / 1048576, biggest: sizes.slice(0, 8) }, { name: 'packages', value: packages, unit: 'pkgs' })
