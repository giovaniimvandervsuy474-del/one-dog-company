import fs from 'node:fs'
import path from 'node:path'
import { append, countByType, since } from './ledger.ts'
import { bus, telemetry } from './bus.ts'
import { getGenome } from './genome.ts'
import * as economy from './economy.ts'
import * as sched from './scheduler.ts'
import * as gh from './github.ts'
import { getMemory } from './brain/memory.ts'
import { CHRONICLE } from './paths.ts'

let lastRun = Date.now()
let timer: NodeJS.Timeout | null = null
let pending = false
let busy = false
export const scribeStats = { commits: 0, pushes: 0, comments: 0, lastCommit: null as null | { sha: string; ts: number; url: string | null }, lastError: null as null | string }

export function start() {
  writeReadme()
  bus.on('ledger', e => { if (e.type === 'survival.state' || e.type === 'genome.mutated') { pending = true; if (!timer) timer = setTimeout(() => { timer = null; void cycle('event') }, 20_000) } })
  loop()
}
export let nextAt = 0
function loop() { const ms = getGenome().scribeIntervalMs; nextAt = Date.now() + ms; telemetry('scribe', { phase: 'idle', stats: scribeStats, nextAt }); setTimeout(() => { void cycle('periodic').finally(loop) }, ms) }

const LEAK = [/rqsty-sk-[A-Za-z0-9+/=_-]{10,}/, /github_pat_[A-Za-z0-9_]{20,}/, /gh[pousr]_[A-Za-z0-9]{20,}/, /api-key=[A-Za-z0-9-]{8,}/i, /\bsk-[A-Za-z0-9_-]{20,}/, /AKIA[0-9A-Z]{16}/]
function scanForSecrets(dirs: string[]): string | null {
  const root = path.dirname(CHRONICLE)
  const walk = (d: string): string | null => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name)
      if (ent.isDirectory()) { if (ent.name === 'logs-archive' || ent.name === 'images') continue; const r = walk(p); if (r) return r }
      else if (/\.(json|jsonl|md|txt|html|log)$/.test(ent.name) && fs.statSync(p).size < 50_000_000) { const t = fs.readFileSync(p, 'utf8'); for (const re of LEAK) if (re.test(t)) return path.relative(root, p) }
    }
    return null
  }
  for (const d of dirs) { const full = path.join(root, d); if (fs.existsSync(full)) { const r = walk(full); if (r) return r } }
  return null
}
function md(n: number, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : 'n/a' }

function digest(from: number): { title: string; body: string } {
  const eco = economy.snapshot()
  const events = since(from)
  const counts = countByType(from)
  const decisions = events.filter(e => e.type === 'brain.decision')
  const states = events.filter(e => e.type === 'survival.state')
  const mutations = events.filter(e => e.type === 'genome.mutated')
  const completed = events.filter(e => e.type === 'job.completed').length
  const failed = events.filter(e => e.type === 'job.failed').length
  const metrics = Object.entries(sched.allMetrics()).map(([t, h]) => `| ${t} | ${h.at(-1)?.v ?? '-'} | ${h.length} |`).join('\n')
  const title = `${eco.state} · $${md(eco.treasuryUsd)} · ${completed} jobs · ${decisions.length} decisions · ${mutations.length} mutations`
  const body = [
    `# Chronicle digest`,
    ``,
    `**Window:** ${new Date(from).toISOString()} → ${new Date().toISOString()}  `,
    `**State:** ${eco.state} · **Treasury:** $${md(eco.treasuryUsd)} (${eco.demo ? 'DEMO' : 'LIVE'}) · **Burn:** $${md(eco.burnPerHourUsd, 4)}/h · **Income:** $${md(eco.incomePerHourUsd, 4)}/h · **Runway (estimate):** ${eco.runwayHours === null ? '∞' : md(eco.runwayHours, 1) + 'h'} · **Vitality:** ${eco.vitality}`,
    `**Market (${eco.market.source}):** price $${eco.market.priceUsd.toExponential(2)} · mcap $${md(eco.market.marketCapUsd, 0)} · 24h vol $${md(eco.market.volume24hUsd, 0)} · fees ${eco.market.verified ? 'verified' : 'unverified/demo'}`,
    ``,
    `## Work`,
    `- Jobs completed: ${completed}, failed/timeout: ${failed}`,
    `- Events by type: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`,
    ``,
    `| metric | last | samples |`, `|---|---|---|`, metrics || '| - | - | - |',
    ``,
    `## Decisions`,
    ...(decisions.length ? decisions.map(d => `- ${new Date(d.ts).toISOString().slice(11, 19)} ${d.title}`) : ['- none']),
    ``,
    `## Genome mutations (v${getGenome().version})`,
    ...(mutations.length ? mutations.map(m => `- ${new Date(m.ts).toISOString().slice(11, 19)} ${m.title} — ${(m.data as { reason: string }).reason}`) : ['- none']),
    ``,
    `## Survival state changes`,
    ...(states.length ? states.map(s => `- ${new Date(s.ts).toISOString().slice(11, 19)} ${s.title}`) : ['- none']),
    ``,
    `## Memory`,
    `- Goals: ${getMemory().goals.join('; ')}`,
    `- Lessons: ${getMemory().lessons.slice(-5).join('; ') || 'none yet'}`,
  ].join('\n')
  return { title, body }
}

function writeReadme() {
  const p = path.join(CHRONICLE, 'README.md')
  if (fs.existsSync(p)) return
  fs.writeFileSync(p, `# Chronicle\n\nThis directory is written by PROJECT FURRY KITTY itself. Nothing here is hand-edited.\n\n- \`events/YYYY-MM-DD.jsonl\` — append-only ledger of every event (jobs, decisions, state changes, commits)\n- \`DIGEST.md\` — human-readable summary of the last scribe window\n- \`state.json\` — snapshot of economy, genome and workers at the last commit\n- \`brain/memory.json\`, \`brain/decisions/\` — persistent memory and every decision with its actions\n- \`treasury.json\` — cash flows and survival state history\n- \`integrity.json\` — sha256 manifest of the source tree\n- \`logs-archive/\` — compacted older ledgers\n`)
}

export async function cycle(trigger: 'periodic' | 'event' | 'manual') {
  if (busy) return
  busy = true
  const from = lastRun
  try {
    const { title, body } = digest(from)
    fs.writeFileSync(path.join(CHRONICLE, 'DIGEST.md'), body)
    fs.writeFileSync(path.join(CHRONICLE, 'state.json'), JSON.stringify({ ts: Date.now(), economy: economy.snapshot(), genome: getGenome(), running: sched.runningJobs().map(j => ({ id: j.id, type: j.type })), stats: sched.stats, metrics: sched.allMetrics() }, null, 1))
    telemetry('scribe', { phase: 'writing', trigger })
    const leak = scanForSecrets(['chronicle', 'config'])
    if (leak) { append({ type: 'github.error', source: 'scribe', severity: 'error', title: `Commit skipped: credential-like string found in ${leak}. Remove it before the chronicle can be committed again.` }); lastRun = Date.now(); return }
    const sha = await gh.commit(`chronicle: ${title}\n\ntrigger: ${trigger}\n\n${body.split('\n').slice(0, 12).join('\n')}`, ['chronicle', 'config'])
    if (sha) {
      scribeStats.commits++
      const base = gh.toHttps(await gh.remoteUrl())
      const url = base ? `${base}/commit/${sha}` : null
      scribeStats.lastCommit = { sha, ts: Date.now(), url }
      append({ type: 'github.commit', source: 'scribe', severity: 'success', title: `Committed ${sha.slice(0, 7)}: ${title}`, data: { sha, trigger, url }, evidence: { commit: sha, commitUrl: url ?? undefined, file: 'chronicle/DIGEST.md' } })
      telemetry('scribe', { phase: 'pushing', sha })
      try {
        const pushed = await gh.push()
        if (pushed) { scribeStats.pushes++; append({ type: 'github.push', source: 'scribe', severity: 'success', title: `Pushed ${sha.slice(0, 7)} to origin`, data: { sha, url }, evidence: { commit: sha, commitUrl: url ?? undefined } }) }
      } catch (e) { scribeStats.lastError = String(e).slice(0, 200); append({ type: 'github.error', source: 'scribe', severity: 'warn', title: `Push failed: ${String(e).slice(0, 100)}`, data: { sha } }) }
      try {
        const commentUrl = await gh.comment(`### ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC — ${title}\n\n${body.split('\n').slice(3).join('\n')}\n\n_commit ${base ? `[${sha.slice(0, 7)}](${url})` : sha.slice(0, 7)}_`)
        if (commentUrl) { scribeStats.comments++; append({ type: 'github.comment', source: 'scribe', severity: 'success', title: `Posted life-log comment on GitHub`, data: { url: commentUrl }, evidence: { url: commentUrl, commit: sha } }) }
      } catch (e) { scribeStats.lastError = String(e).slice(0, 200); append({ type: 'github.error', source: 'scribe', severity: 'warn', title: `GitHub comment failed: ${String(e).slice(0, 100)}` }) }
    } else {
      append({ type: 'scribe.idle', source: 'scribe', title: `Scribe: nothing new to commit (${trigger})` })
    }
    lastRun = Date.now()
    pending = false
  } catch (e) {
    scribeStats.lastError = String(e).slice(0, 200)
    append({ type: 'github.error', source: 'scribe', severity: 'error', title: `Scribe failed: ${String(e).slice(0, 120)}` })
  } finally { busy = false; telemetry('scribe', { phase: 'idle', stats: scribeStats, nextAt }) }
}
