import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { input, log, progress, done, fmt } from './util.ts'

const { root, level = 6, algo = 'gzip', sweep = false } = input<{ root: string; level: number; algo: 'gzip' | 'brotli'; sweep: boolean }>()

function corpus(): Buffer {
  const parts: Buffer[] = []
  let size = 0
  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist', 'logs-archive'].includes(ent.name)) continue
      const p = path.join(dir, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (/\.(ts|tsx|json|jsonl|md|css)$/.test(ent.name) && size < 3_000_000) { const b = fs.readFileSync(p); parts.push(b); size += b.length }
    }
  }
  walk(root)
  return Buffer.concat(parts)
}

const data = corpus()
log(`corpus ${(data.length / 1024).toFixed(0)} KB from project sources`)

function run(a: 'gzip' | 'brotli', lvl: number) {
  const t = performance.now()
  const out = a === 'gzip'
    ? zlib.gzipSync(data, { level: lvl })
    : zlib.brotliCompressSync(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: lvl } })
  const ms = performance.now() - t
  return { algo: a, level: lvl, ms, bytes: out.length, ratio: data.length / out.length, score: (data.length / out.length) / Math.log2(ms + 2) }
}

if (sweep) {
  const rows: Array<ReturnType<typeof run>> = []
  const levels = algo === 'gzip' ? [1, 3, 5, 6, 7, 9] : [1, 3, 5, 7, 9, 11]
  levels.forEach((l, i) => { const r = run(algo, l); rows.push(r); log(`${algo} L${l}: ratio ${fmt(r.ratio)} in ${fmt(r.ms, 0)}ms score ${fmt(r.score, 3)}`); progress((i + 1) / levels.length) })
  const best = rows.reduce((a, b) => (b.score > a.score ? b : a))
  done({ sweep: true, algo, rows, best, corpusBytes: data.length }, { name: 'best level', value: best.level, unit: 'lvl' })
} else {
  const r = run(algo, level)
  log(`${algo} L${level}: ${(data.length / 1024).toFixed(0)}KB → ${(r.bytes / 1024).toFixed(0)}KB, ratio ${fmt(r.ratio)} in ${fmt(r.ms, 0)}ms`)
  progress(1)
  done({ ...r, corpusBytes: data.length }, { name: 'ratio', value: Number(r.ratio.toFixed(3)), unit: 'x' })
}
