import { useEffect, useRef } from 'react'
import { TOKEN_ADDRESS, drawCandles, money, compactMoney, useTokenMarket, type TokenMarket } from './tokenMarket'
import './monitors.css'

function PriceChart({ market }: { market: TokenMarket }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.fillStyle = '#07121d'; ctx.fillRect(0, 0, 1200, 480)
    drawCandles(ctx, market, 25, 20, 1150, 400)
  }, [market])
  return <canvas ref={ref} width={1200} height={480} role="img" aria-label={`Real ${market.symbol} price history, ${market.candles.length} 15-minute candles, USD logarithmic scale`} />
}
export function TokenChartDialog({ onClose }: { onClose: () => void }) {
  const market = useTokenMarket(), dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close() }, [])
  const delayed = !!market.error || (market.updatedAt > 0 && Date.now() - market.updatedAt > 90000)
  return <dialog ref={dialog} className="token-dialog" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <header><div><span className="token-eyebrow">SOLANA · {market.name}</span><h2>{market.symbol} / USD <small className={delayed ? 'delayed' : ''}>{market.updatedAt ? delayed ? 'DELAYED' : 'LIVE' : 'CONNECTING'}</small></h2></div><button autoFocus onClick={onClose} aria-label="Close token chart">✕</button></header>
    <div className="token-stats"><div><span>MARKET CAP</span><strong>{money(market.marketCap)}</strong></div><div><span>PRICE</span><strong>{money(market.price)}</strong></div><div><span>24H CHANGE</span><strong style={{ color: (market.change ?? 0) >= 0 ? '#51e4be' : '#ff7389' }}>{market.change === null ? '—' : `${market.change >= 0 ? '+' : ''}${market.change.toFixed(2)}%`}</strong></div><div><span>24H VOLUME</span><strong>{compactMoney(market.volume)}</strong></div></div>
    <PriceChart market={market}/>
    <div className="token-chart-meta"><span>15-minute candles · USD · logarithmic scale</span><span>Liquidity {compactMoney(market.liquidity)}</span></div>
    {(market.error || market.chartError) && <p className="token-error">{market.error ?? market.chartError}. Last available data is retained; retrying automatically.</p>}
    <footer><p>Quotes refresh every 30 seconds; history every 60 seconds.<br/>Updated {market.updatedAt ? new Date(market.updatedAt).toLocaleTimeString() : '—'} · Latest trade candle {market.candles.length ? new Date(market.candles.at(-1)![0] * 1000).toLocaleString() : '—'}</p><a href={market.url} target="_blank" rel="noreferrer">Open on DEX Screener ↗</a></footer>
    <p className="token-contract">{TOKEN_ADDRESS}</p><p className="token-source">Market cap / quote: DEX Screener · OHLCV: GeckoTerminal. Candles advance when trades occur.</p>
  </dialog>
}
export function TokenChartButton({ onClick }: { onClick: () => void }) {
  const market = useTokenMarket()
  return <button className="stage-market" onClick={onClick} aria-label="Expand live token chart"><span>{market.symbol} · MCAP</span><strong>{compactMoney(market.marketCap)}</strong><span>↗</span></button>
}
