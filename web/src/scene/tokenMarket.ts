import { useEffect, useSyncExternalStore } from 'react'

/** The contract address comes from the server config (/api/links), never hardcoded; until the pair trades the chart says so. */
export let TOKEN_ADDRESS = ''
let linksLoaded: Promise<void> | null = null
function loadLinks() {
  if (!linksLoaded) linksLoaded = fetch('/api/links').then(r => r.json()).then((l: { mint?: string | null; pumpfun?: string | null; dexscreener?: string | null }) => { if (l.mint) { TOKEN_ADDRESS = l.mint; publish({ url: l.dexscreener ?? l.pumpfun ?? snapshot.url }) } }).catch(() => {})
  return linksLoaded
}
export type Candle = [number, number, number, number, number, number]
export type TokenMarket = {
  symbol: string; name: string; pair: string; url: string; price: number | null
  marketCap: number | null; change: number | null; volume: number | null; liquidity: number | null
  candles: Candle[]; updatedAt: number; candlesAt: number; error: string | null; chartError: string | null
}
type Pair = { chainId: string; pairAddress: string; url: string; baseToken: { address: string; symbol: string; name: string }; priceUsd?: string; marketCap?: number; liquidity?: { usd: number }; volume?: { h24: number }; priceChange?: { h24: number } }
let snapshot: TokenMarket = { symbol: '1DOG', name: 'One Dog Company', pair: '', url: '', price: null, marketCap: null, change: null, volume: null, liquidity: null, candles: [], updatedAt: 0, candlesAt: 0, error: null, chartError: null }
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
const getSnapshot = () => snapshot
function publish(patch: Partial<TokenMarket>) { snapshot = { ...snapshot, ...patch }; listeners.forEach(fn => fn()) }
let users = 0, timer: ReturnType<typeof setTimeout> | undefined, controller: AbortController | undefined
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
async function refresh(signal: AbortSignal) {
  const timeout = AbortSignal.any([signal, AbortSignal.timeout(15000)])
  try {
    await loadLinks()
    if (!TOKEN_ADDRESS) throw new Error('No contract configured')
    const response = await fetch(`https://api.dexscreener.com/token-pairs/v1/solana/${TOKEN_ADDRESS}`, { signal: timeout })
    if (!response.ok) throw new Error(`Market API ${response.status}`)
    const pairs: Pair[] = await response.json()
    const pair = pairs.filter(p => p.chainId === 'solana' && p.baseToken.address === TOKEN_ADDRESS && Number(p.priceUsd) > 0).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
    if (!pair) throw new Error('Not trading yet')
    if (signal.aborted) return
    const switched = snapshot.pair !== pair.pairAddress
    publish({ symbol: pair.baseToken.symbol, name: pair.baseToken.name, pair: pair.pairAddress, url: pair.url, price: number(Number(pair.priceUsd)), marketCap: number(pair.marketCap), change: typeof pair.priceChange?.h24 === 'number' ? pair.priceChange.h24 : null, volume: number(pair.volume?.h24), liquidity: number(pair.liquidity?.usd), updatedAt: Date.now(), error: null, ...(switched ? { candles: [], candlesAt: 0 } : {}) })
    if (switched || Date.now() - snapshot.candlesAt >= 60000) {
      try {
        const history = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${pair.pairAddress}/ohlcv/minute?aggregate=15&limit=96&currency=usd&token=${TOKEN_ADDRESS}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) })
        if (!history.ok) throw new Error(`Chart API ${history.status}`)
        const json = await history.json()
        const rows: unknown = json.data?.attributes?.ohlcv_list
        if (!Array.isArray(rows)) throw new Error('Chart unavailable')
        const candles = rows.filter((c: unknown): c is Candle => Array.isArray(c) && c.length >= 6 && c.slice(0, 6).every(Number.isFinite) && c.slice(1, 5).every((v: number) => v > 0)).map(c => c.slice(0, 6) as Candle).sort((a, b) => a[0] - b[0])
        if (!signal.aborted) publish({ candles, candlesAt: Date.now(), chartError: candles.length ? null : 'No trades yet' })
      } catch (error) { if (!signal.aborted) publish({ chartError: error instanceof Error ? error.message : 'Chart temporarily unavailable' }) }
    }
  } catch (error) { if (!signal.aborted) publish({ error: error instanceof Error ? error.message : 'Market temporarily unavailable' }) }
}
function start() {
  controller = new AbortController()
  const signal = controller.signal
  const tick = async () => { await refresh(signal); if (!signal.aborted) timer = setTimeout(tick, 30000) }
  void tick()
}
export function useTokenMarket() {
  const value = useSyncExternalStore(subscribe, getSnapshot)
  useEffect(() => { if (++users === 1) start(); return () => { if (--users === 0) { controller?.abort(); clearTimeout(timer) } } }, [])
  return value
}
export const money = (value: number | null) => value === null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 12 : 0 }).format(value)
export const compactMoney = (value: number | null) => value === null ? '—' : '$' + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)

/** Actual 15-minute OHLCV candles; logarithmic price scale keeps large moves readable. */
export function drawCandles(ctx: CanvasRenderingContext2D, market: TokenMarket, x: number, y: number, width: number, height: number) {
  const candles = market.candles
  if (!candles.length) { ctx.fillStyle = '#8ca3b5'; ctx.font = '24px monospace'; ctx.fillText(market.chartError ?? 'Loading trading history…', x + 20, y + height / 2); return }
  const min = Math.log(Math.min(...candles.map(c => c[3]))), max = Math.log(Math.max(...candles.map(c => c[2])))
  const spread = Math.max(max - min, .02), low = min - spread * .07, high = max + spread * .07
  const py = (v: number) => y + height * (1 - (Math.log(v) - low) / (high - low))
  const from = candles[0][0], to = Math.max(candles.at(-1)![0], from + 900), px = (t: number) => x + 10 + (t - from) / (to - from) * (width - 110)
  ctx.font = '18px monospace'
  for (let i = 0; i <= 4; i++) {
    const yy = y + i * height / 4
    ctx.strokeStyle = '#1a2c3d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + width - 90, yy); ctx.stroke()
    ctx.fillStyle = '#7b96aa'; ctx.fillText(Math.exp(high - (high - low) * i / 4).toExponential(2), x + width - 85, yy + 6)
  }
  const step = (width - 110) * 900 / (to - from), body = Math.max(2, Math.min(10, step * .65)), maxVolume = Math.max(...candles.map(c => c[5]), 1)
  for (const c of candles) {
    const xx = px(c[0]), rising = c[4] >= c[1]
    ctx.fillStyle = ctx.strokeStyle = rising ? '#43e5b5' : '#ff7389'
    ctx.globalAlpha = .2; ctx.fillRect(xx - body / 2, y + height - c[5] / maxVolume * height * .18, body, c[5] / maxVolume * height * .18); ctx.globalAlpha = 1
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xx, py(c[2])); ctx.lineTo(xx, py(c[3])); ctx.stroke()
    ctx.fillRect(xx - body / 2, Math.min(py(c[1]), py(c[4])), body, Math.max(2, Math.abs(py(c[1]) - py(c[4]))))
  }
  ctx.fillStyle = '#819aaf'; ctx.font = '18px monospace'
  const label = (t: number) => new Date(t * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  ctx.fillText(label(from), x, y + height + 28); ctx.textAlign = 'right'; ctx.fillText(label(to), x + width - 95, y + height + 28); ctx.textAlign = 'left'
}
