import fs from 'node:fs'
import os from 'node:os'
import { ROOT } from './paths.ts'
import * as economy from './economy.ts'
import * as sched from './scheduler.ts'
import { getGenome } from './genome.ts'
import { getMemory } from './brain/memory.ts'
import { telemetry } from './bus.ts'

/** Derived "mood" metrics. Each one is a function of real numbers and is labelled as derived in the UI. */
export function mood() {
  const eco = economy.snapshot()
  const m = getMemory()
  const total = sched.stats.completed + sched.stats.failed + sched.stats.timeout
  const failRate = total ? (sched.stats.failed + sched.stats.timeout) / total : 0
  const runway = eco.runwayHours ?? 999
  const hunger = Math.round(Math.max(0, Math.min(100, 100 - (runway / 48) * 100)))
  const stress = Math.round(Math.max(0, Math.min(100, failRate * 300 + (eco.state === 'CRITICAL' ? 55 : eco.state === 'STRAINED' ? 30 : eco.state === 'HIBERNATING' ? 80 : 0) + Math.max(0, 40 - runway) * 0.8)))
  const recentDecisions = m.decisions.slice(-10)
  const experiments = recentDecisions.flatMap(d => d.actions).filter(a => (a as { kind: string }).kind === 'run_experiment').length
  const mutations = getGenome().history.filter(h => Date.now() - h.ts < 3600_000).length
  const research = sched.metrics('nn-train').filter(x => Date.now() - x.ts < 600_000).length
  const curiosity = Math.round(Math.min(100, 35 + experiments * 12 + research * 6))
  const creativity = Math.round(Math.min(100, 30 + mutations * 9 + (m.lessons.length > 0 ? 10 : 0)))
  const motivation = Math.round(Math.max(5, Math.min(100, eco.vitality * 0.7 + (eco.state === 'ALIVE' ? 25 : eco.state === 'RECOVERING' ? 20 : 0) - failRate * 50)))
  return { motivation, curiosity, stress, hunger, creativity, derived: true }
}

let lastCpu = os.cpus().map(c => c.times)
let bytesOut = 0
let lastNet = { ts: Date.now(), bytes: 0, rate: 0 }
export function countBytes(n: number) { bytesOut += n }

export function system() {
  const cpus = os.cpus()
  let idle = 0, total = 0
  cpus.forEach((c, i) => { const p = lastCpu[i] ?? c.times; const d = { user: c.times.user - p.user, nice: c.times.nice - p.nice, sys: c.times.sys - p.sys, idle: c.times.idle - p.idle, irq: c.times.irq - p.irq }; idle += d.idle; total += d.user + d.nice + d.sys + d.idle + d.irq })
  lastCpu = cpus.map(c => c.times)
  const cpu = total ? Math.round((1 - idle / total) * 100) : 0
  const memUsedGB = (os.totalmem() - os.freemem()) / 1073741824
  let diskPct = 0
  try { const s = fs.statfsSync(ROOT); diskPct = Math.round((1 - s.bavail / s.blocks) * 100) } catch {}
  const now = Date.now()
  const dt = (now - lastNet.ts) / 1000
  if (dt >= 1) { lastNet = { ts: now, bytes: bytesOut, rate: (bytesOut - lastNet.bytes) / dt } }
  return { cpu, memUsedGB: Number(memUsedGB.toFixed(2)), memTotalGB: Number((os.totalmem() / 1073741824).toFixed(1)), diskPct, netKBps: Number((lastNet.rate / 1024).toFixed(1)), load1: Number(os.loadavg()[0].toFixed(2)), procRssMB: Number((process.memoryUsage().rss / 1048576).toFixed(0)), workers: sched.runningJobs().length, lanes: getGenome().concurrency }
}

import { since } from './ledger.ts'
export function audience(online: number) {
  const h = since(Date.now() - 3600_000)
  const c = (t: string) => h.filter(e => e.type === t).length
  return { online, lastHour: { chatMessages: c('chat.message'), votes: c('visitor.vote'), pokes: c('visitor.poke'), questions: c('visitor.question'), donations: c('treasury.income') && h.filter(e => e.type === 'treasury.income' && /donation/i.test(e.title)).length, aiReplies: c('chat.reply') + c('chat.say') } }
}
export function start() {
  setInterval(() => telemetry('vitals', { ts: Date.now(), mood: mood(), system: system(), day: Math.floor((Date.now() - getMemory().born) / 86400_000) + 1 }), 2000)
}
