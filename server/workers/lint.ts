import fs from 'node:fs'
import path from 'node:path'
import { input, log, done, progress } from './util.ts'

const { root } = input<{ root: string }>()
const dirs = [path.join(root, 'server'), path.join(root, 'web', 'src')]
type Issue = { file: string; line: number; rule: string; text: string }
const issues: Issue[] = []
let files = 0, lines = 0
const rules: Array<[string, RegExp]> = [
  ['no-console', /console\.log\(/],
  ['todo', /\b(TODO|FIXME|HACK)\b/],
  ['no-any', /:\s*any\b/],
  ['trailing-space', /[ \t]+$/],
  ['max-len', /^.{141,}$/],
  ['debugger', /\bdebugger\b/],
]
function walk(d: string) {
  if (!fs.existsSync(d)) return
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name)
    if (ent.isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(ent.name)) {
      files++
      const src = fs.readFileSync(p, 'utf8').split('\n')
      lines += src.length
      src.forEach((l, i) => { for (const [rule, re] of rules) if (re.test(l)) issues.push({ file: path.relative(root, p), line: i + 1, rule, text: l.trim().slice(0, 80) }) })
    }
  }
}
dirs.forEach((d, i) => { walk(d); progress((i + 1) / dirs.length) })
const byRule: Record<string, number> = {}
for (const i of issues) byRule[i.rule] = (byRule[i.rule] ?? 0) + 1
log(`${files} files · ${lines} lines · ${issues.length} findings`)
for (const [r, n] of Object.entries(byRule)) log(`  ${r}: ${n}`)
done({ files, lines, issues: issues.length, byRule, sample: issues.slice(0, 12) }, { name: 'findings', value: issues.length, unit: 'issues' })
