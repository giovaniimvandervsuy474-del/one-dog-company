import { spawn } from 'node:child_process'
import { input, log, done, progress } from './util.ts'

const { root } = input<{ root: string }>()
log('tsc --noEmit -p server/tsconfig.json')
progress(0.1)
const t = performance.now()
const child = spawn('npx', ['tsc', '--noEmit', '-p', 'server/tsconfig.json'], { cwd: root })
let out = ''
child.stdout.on('data', d => { out += d })
child.stderr.on('data', d => { out += d })
const killer = setTimeout(() => child.kill('SIGKILL'), 100_000)
process.on('exit', () => child.kill('SIGKILL')) // worker terminated (timeout) → take the compiler down with us
child.on('close', code => {
  clearTimeout(killer)
  const ms = performance.now() - t
  const errors = out.split('\n').filter(l => /error TS\d+/.test(l))
  log(`exit ${code} in ${(ms / 1000).toFixed(1)}s · ${errors.length} type errors`)
  for (const e of errors.slice(0, 8)) log('  ' + e.trim().slice(0, 120))
  progress(1)
  done({ exitCode: code, ms, errors: errors.length, sample: errors.slice(0, 20) }, { name: 'type errors', value: errors.length, unit: 'err' })
})
