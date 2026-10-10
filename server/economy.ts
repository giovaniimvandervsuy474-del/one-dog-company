import fs from 'node:fs'
import path from 'node:path'
import { append } from './ledger.ts'
import { telemetry } from './bus.ts'
import { CHRONICLE } from './paths.ts'
import { createMarket, type MarketFeed } from './market/index.ts'
import type { EconomySnapshot, MarketSnapshot, SurvivalState } from './types.ts'

const FILE = path.join(CHRONICLE, 'treasury.json')
const HOSTING_PER_MONTH = Number(process.env.HOSTING_USD_PER_MONTH ?? 10)
const INFRA_PER_HOUR = process.env.MARKET_SOURCE !== 'demo' && process.env.TOKEN_MINT ? HOSTING_PER_MONTH / 730 : 0.06 // live: the real server rent; demo: a round number
const COMPUTE_UNIT_USD = 0.0007   // per cost-unit-second of worker time
const AI_CALL_USD = 0.004          // per heuristic/LLM planning call (LLM adapter reports actual usage)
const TICK_MS = 5000

type Persisted = {
  treasuryUsd: number
  costs: { infra: number; compute: number; ai: number }
  income: { fees: number; donations: number }
  history: Array<{ ts: number; treasury: number; income: number; burn: number; state: SurvivalState }>
  stateHistory: Array<{ ts: number; from: SurvivalState; to: SurvivalState; reason: string }>
  ledger: Array<{ ts: number; kind: string; amountUsd: number; note: string; verified: boolean }>
  obligationsUsd?: number
  settledUsd?: number
  liveSince?: number
}

const START_TREASURY = Number(process.env.START_TREASURY ?? 1000)

let p: Persisted
let state: SurvivalState = 'ALIVE'
let market: MarketFeed
let lastMarket: MarketSnapshot
let lastTick = Date.now()
let stateSince = Date.now()
let computeThisWindow = 0, aiThisWindow = 0, windowStart = Date.now()
let burnPerHour = INFRA_PER_HOUR, incomePerHour = 0
const bootTs = Date.now()
const incomeWindow: Array<{ ts: number; v: number }> = []
const marketHistory: Array<{ ts: number; price: number; volume: number; mcap: number }> = []

export const demo = () => market.source === 'DEMO'

export function loadEconomy() {
  market = createMarket()
  if (fs.existsSync(FILE)) { try { p = JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch {} }
  if (!p) p = { treasuryUsd: START_TREASURY, costs: { infra: 0, compute: 0, ai: 0 }, income: { fees: 0, donations: 0 }, history: [], stateHistory: [], ledger: [] }
  state = p.stateHistory.at(-1)?.to ?? 'ALIVE'
  lastMarket = { source: market.source, ts: Date.now(), priceUsd: 0, marketCapUsd: 0, volume24hUsd: 0, holders: 0, feesSinceLastUsd: 0, verified: false }
  append({ type: 'economy.boot', source: 'economy', title: `Treasury online: $${p.treasuryUsd.toFixed(2)} (${market.source}) · ${market.describe()}`, data: { treasury: p.treasuryUsd, source: market.source } })
  setInterval(tick, TICK_MS)
  setInterval(save, 30_000)
}

function save() { fs.writeFileSync(FILE, JSON.stringify(p)) }

function spend(usd: number) { if (demo()) p.treasuryUsd = Math.max(0, p.treasuryUsd - usd); else p.obligationsUsd = (p.obligationsUsd ?? 0) + usd }
export function charge(units: number, jobType: string) {
  if (!demo()) return // live: compute is already paid for by the hosting bill; only models and rent are real costs
  const usd = units * COMPUTE_UNIT_USD
  spend(usd)
  p.costs.compute += usd; computeThisWindow += usd
  p.ledger.push({ ts: Date.now(), kind: 'compute', amountUsd: -usd, note: jobType, verified: true })
  trimLedger()
}
export function chargeAI(usd = AI_CALL_USD, note = 'planning call') {
  spend(usd)
  p.costs.ai += usd; aiThisWindow += usd
  p.ledger.push({ ts: Date.now(), kind: 'ai', amountUsd: -usd, note, verified: true })
  trimLedger()
}
function trimLedger() { if (p.ledger.length > 2000) p.ledger.splice(0, p.ledger.length - 2000) }

async function tick() {
  const now = Date.now()
  const dtH = (now - lastTick) / 3600_000
  lastTick = now
  const infra = INFRA_PER_HOUR * dtH
  spend(infra)
  p.costs.infra += infra
  if (!demo()) { p.ledger.push({ ts: now, kind: 'infra', amountUsd: -infra, note: 'hosting', verified: true }); trimLedger() }
  try { lastMarket = await market.poll() } catch { /* keep previous snapshot */ }
  if (!demo()) {
    // live: the treasury is the real wallet value minus what we have spent since connecting (bills are paid outside)
    if (!p.liveSince) { p.liveSince = now; p.obligationsUsd = 0; append({ type: 'treasury.live', source: 'economy', severity: 'success', title: `Treasury is now LIVE: wallet ${lastMarket.walletSol?.toFixed(4) ?? '?'} SOL ≈ $${(lastMarket.walletUsd ?? 0).toFixed(2)} · token ${lastMarket.launched ? 'trading' : 'not trading yet'}`, data: { wallet: lastMarket.walletSol, usd: lastMarket.walletUsd, launched: lastMarket.launched } }) }
    // wallet decreases are the operator paying the bills (models, hosting) out of the wallet: they settle obligations
    if ((lastMarket.paidOutUsd ?? 0) > 0) { p.settledUsd = (p.settledUsd ?? 0) + (lastMarket.paidOutUsd ?? 0); p.ledger.push({ ts: now, kind: 'payout', amountUsd: -(lastMarket.paidOutUsd ?? 0), note: 'wallet → bills', verified: true }); append({ type: 'treasury.payout', source: 'economy', title: `Paid out of the wallet: $${(lastMarket.paidOutUsd ?? 0).toFixed(2)} (settling model/hosting bills)`, data: { usd: lastMarket.paidOutUsd } }) }
    const unsettled = Math.max(0, (p.obligationsUsd ?? 0) - (p.settledUsd ?? 0))
    if ((lastMarket.walletUsd ?? 0) > 0 || this_tick_has_wallet(lastMarket)) p.treasuryUsd = Math.max(0, (lastMarket.walletUsd ?? 0) - unsettled)
  }
  marketHistory.push({ ts: now, price: lastMarket.priceUsd, volume: lastMarket.volume24hUsd, mcap: lastMarket.marketCapUsd }); if (marketHistory.length > 240) marketHistory.shift()
  const fees = lastMarket.feesSinceLastUsd
  if (fees > 0) {
    if (demo()) p.treasuryUsd += fees
    p.income.fees += fees
    incomeWindow.push({ ts: now, v: fees })
    if (fees > 0.05 || lastMarket.verified) {
      p.ledger.push({ ts: now, kind: 'fees', amountUsd: fees, note: `${lastMarket.source} fee accrual`, verified: lastMarket.verified })
      append({ type: 'treasury.income', source: 'economy', severity: 'success', title: `${lastMarket.verified ? 'Verified' : 'DEMO'} fees received: +$${fees.toFixed(3)}`, data: { usd: fees, verified: lastMarket.verified, source: lastMarket.source } })
    }
  }
  while (incomeWindow.length && incomeWindow[0].ts < now - 3600_000) incomeWindow.shift()
  // burn = hosting + everything the ledger says we spent in the last 15 minutes, scaled to an hour (survives restarts)
  const W = 15 * 60_000
  const spent15 = p.ledger.filter(l => (l.kind === 'ai' || l.kind === 'compute') && l.ts >= now - W).reduce((a, l) => a - l.amountUsd, 0)
  const sinceBoot = Math.min(W, now - bootTs)
  burnPerHour = INFRA_PER_HOUR + (sinceBoot > 60_000 ? spent15 / (Math.max(sinceBoot, 3 * 60_000) / 3600_000) : spent15 / 0.25)
  void computeThisWindow; void aiThisWindow; void windowStart
  // income rate = everything that arrived in the last hour (a single deposit is not a rate)
  incomePerHour = p.ledger.filter(l => (l.kind === 'fees' || l.kind === 'donation' || l.kind === 'topup') && l.ts >= now - 3600_000).reduce((a, l) => a + l.amountUsd, 0)
  void dtH; void incomeWindow
  if (now - windowStart > 15 * 60_000) { windowStart = now; computeThisWindow = computeThisWindow * 0.3; aiThisWindow = aiThisWindow * 0.3 }
  p.history.push({ ts: now, treasury: p.treasuryUsd, income: incomePerHour, burn: burnPerHour, state })
  if (p.history.length > 4000) p.history.splice(0, p.history.length - 4000)
  evaluateState('tick')
  telemetry('economy', snapshot())
}

/** Runway = treasury / burn. Income is not subtracted: when money arrives it raises the treasury and the runway with it. */
function runway(): number | null {
  if (burnPerHour <= 0.0001) return null
  return p.treasuryUsd / burnPerHour
}

function ambition(): 0 | 1 | 2 | 3 {
  const mc = lastMarket.marketCapUsd
  if (mc >= 1_000_000) return 3
  if (mc >= 250_000) return 2
  if (mc >= 50_000) return 1
  return 0
}

function this_tick_has_wallet(m: MarketSnapshot) { return m.walletSol !== undefined }
function vitality(): number {
  const rw = runway()
  const runwayScore = rw === null ? 100 : Math.min(100, (rw / 72) * 100)
  const feeScore = Math.min(100, (incomePerHour / Math.max(0.01, burnPerHour)) * 100)
  const volScore = Math.min(100, (lastMarket.volume24hUsd / 50_000) * 100)
  return Math.round(runwayScore * 0.6 + feeScore * 0.25 + volScore * 0.15)
}

function evaluateState(trigger: string) {
  const rw = runway()
  const t = p.treasuryUsd
  let next: SurvivalState = state
  const hours = rw === null ? Infinity : rw
  if (t <= 0.25 || hours < 2) next = 'HIBERNATING'
  else if (hours < 8) next = 'CRITICAL'
  else if (hours < 30) next = 'STRAINED'
  else next = 'ALIVE'
  // recovering: coming up from HIBERNATING/CRITICAL, hold for a while before ALIVE
  if ((state === 'HIBERNATING' || state === 'CRITICAL' || state === 'RECOVERING') && (next === 'ALIVE' || next === 'STRAINED')) {
    if (state !== 'RECOVERING') next = 'RECOVERING'
    else if (Date.now() - stateSince < 3 * 60_000) next = 'RECOVERING'
  }
  if (next !== state) {
    const from = state
    state = next; stateSince = Date.now()
    p.stateHistory.push({ ts: Date.now(), from, to: next, reason: trigger })
    append({ type: 'survival.state', source: 'economy', severity: next === 'ALIVE' || next === 'RECOVERING' ? 'success' : next === 'STRAINED' ? 'warn' : 'error',
      title: `Survival state ${from} → ${next} · treasury $${t.toFixed(2)} · runway ${rw === null ? '∞' : rw.toFixed(1) + 'h'} (estimate)`,
      data: { from, to: next, treasury: t, runwayHours: rw, trigger } })
  }
}

export function getState() { return state }
export function snapshot(): EconomySnapshot {
  return { ts: Date.now(), state, treasuryUsd: p.treasuryUsd, burnPerHourUsd: burnPerHour, incomePerHourUsd: incomePerHour, runwayHours: runway(), vitality: vitality(), ambitionTier: ambition(),
    costs: p.costs, income: p.income, market: lastMarket, demo: demo(), ...(demo() ? {} : { unsettledUsd: Math.max(0, (p.obligationsUsd ?? 0) - (p.settledUsd ?? 0)), settledUsd: p.settledUsd ?? 0 }) }
}
export function history() { return p.history }
export function marketSeries() { return marketHistory }
export function stateHistory() { return p.stateHistory }
export function cashLedger(limit = 200) { return p.ledger.slice(-limit) }
export function aiSpend(windowMs: number) { const t0 = Date.now() - windowMs; return p.ledger.filter(l => l.kind === 'ai' && l.ts >= t0).reduce((a, l) => a - l.amountUsd, 0) }
export function treasurySeries() { return p.history.slice(-240).map(h => ({ ts: h.ts, v: h.treasury })) }
export function incomeSeries() { return p.history.slice(-240).map(h => ({ ts: h.ts, v: h.income })) }
