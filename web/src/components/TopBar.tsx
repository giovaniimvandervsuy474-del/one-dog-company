import { useEffect, useState } from 'react'
import { useStore, type Tab } from '../store'
import { usd, big, hours, STATE_COLOR } from '../format'
import Sparkline from './Sparkline'
import { TokenInline } from './TokenCard'
import LifeTimer from './LifeTimer'

const TABS: Array<[Tab, string]> = [['home', 'HOME'], ['overview', 'LIVE'], ['desktop', 'DESKTOP'], ['evolution', 'EVOLUTION'], ['experiments', 'EXPERIMENTS'], ['github', 'GITHUB'], ['treasury', 'ECONOMY'], ['gallery', 'STUDIO'], ['page', 'MY PAGE'], ['about', 'ABOUT']]

export default function TopBar() {
  const tab = useStore(s => s.tab), set = useStore(s => s.set)
  const lang = useStore(s => s.lang), market = useStore(s => s.marketSeries), overload = useStore(s => s.overload)
  const genome = useStore(s => s.genome), brainPhase = useStore(s => s.brainPhase)
  const eco = useStore(s => s.economy), connected = useStore(s => s.connected), fps = useStore(s => s.fps), scribe = useStore(s => s.scribe), bootTs = useStore(s => s.bootTs), day = useStore(s => s.day)
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick(t => t + 1), 1000); return () => clearInterval(i) }, [])
  const state = eco?.state ?? 'ALIVE'
  const beat = state === 'CRITICAL' ? '0.5s' : state === 'STRAINED' ? '1.2s' : state === 'HIBERNATING' ? '4s' : '2.4s'
  const up = Math.floor((Date.now() - bootTs) / 1000)
  const uptime = `${Math.floor(up / 3600)}h ${String(Math.floor((up % 3600) / 60)).padStart(2, '0')}m ${String(up % 60).padStart(2, '0')}s`
  return (
    <header className="topbar-shell">
    <LifeTimer />
    <div className="topbar" style={{ ['--state' as string]: STATE_COLOR[state], ['--beat' as string]: beat }}>
      <div className="brand"><span className="dot" /><div><div>PROJECT FURRY KITTY</div><div className="brand-sub" title="the server writes its own tagline">{genome?.motto ?? 'AI that refuses to die'}</div></div></div>
      <span className="badge state">{state}</span>
      {brainPhase === 'paused' && <span className="badge" style={{ color: '#ffb347', background: 'rgba(255,179,71,0.12)' }} title="operator paused autonomy: workers and chat run, no decisions, no spending">⏸ {'PAUSED · waiting for the token launch'}</span>}
      {overload?.active && <span className="badge" style={{ color: '#ffb347', background: 'rgba(255,179,71,0.12)' }} title={overload.reason}>{'⚠ HOST OVERLOADED · 1 lane'}</span>}
      <div className="tabs">{TABS.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => { set({ tab: id }); location.hash = id }}>{label}</button>)}</div>
      <TokenInline />
      <div className="topstats">
        <div className="stat" style={{ minWidth: 56 }}><span className="k">Day</span><span className="v">{day}</span></div>
        <div className="stat" title={eco && !eco.demo ? `wallet ${eco.market.walletSol?.toFixed(4)} SOL ≈ $${eco.market.walletUsd?.toFixed(2)} · unpaid bills $${(eco.unsettledUsd ?? 0).toFixed(3)} (models + hosting since live)` : undefined}><span className="k">Treasury {eco?.demo ? <span className="badge demo">DEMO</span> : <span className="badge demo" style={{ color: '#19f0a0' }}>LIVE</span>}</span><span className="v" style={{ color: STATE_COLOR[state] }}>{eco ? usd(eco.treasuryUsd, 2) : '—'}{eco && !eco.demo && eco.market.walletSol !== undefined && <span className="dim" style={{ fontSize: 10 }}> {eco.market.walletSol.toFixed(3)} SOL</span>}</span></div>
        <div className="stat"><span className="k">Runway · est.</span><span className="v">{eco ? hours(eco.runwayHours) : '—'}</span></div>
        <div className="stat"><span className="k">Burn / Income</span><span className="v"><span style={{ color: '#ff8aa0' }}>{eco ? usd(eco.burnPerHourUsd, 3) : '—'}</span><span className="dim">/</span><span style={{ color: '#19f0a0' }}>{eco ? usd(eco.incomePerHourUsd, 3) : '—'}</span><span className="dim">/h</span></span></div>
        <div className="stat" style={{ minWidth: 150 }}><span className="k">Mcap · Vol 24h · price</span><span className="v" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{eco ? (eco.market.source === 'SOLANA' && !eco.market.launched ? ('token not trading yet') : `$${big(eco.market.marketCapUsd)} · $${big(eco.market.volume24hUsd)}`) : '—'}<Sparkline data={market.slice(-60).map(m => m.price)} w={56} h={16} color={market.length > 1 && market.at(-1)!.price >= market[0].price ? '#19f0a0' : '#ff3b5c'} /></span></div>
        <div className="stat"><span className="k">Vitality</span><span className="v">{eco?.vitality ?? '—'}<span className="dim">/100</span></span></div>
        <div className="stat"><span className="k">Commits</span><span className="v">{scribe?.commits ?? 0}<span className="dim"> · {scribe?.lastCommit ? scribe.lastCommit.sha.slice(0, 7) : 'none'}</span></span></div>
        <div className="stat"><span className="k">Uptime</span><span className="v">{uptime}</span></div>
        <div className="stat" style={{ minWidth: 50 }}><span className="k">FPS</span><span className="v">{fps}</span></div>
        <button className="wallet" title={'Wallet arrives with the Solana treasury'} onClick={() => alert('Wallet connect arrives when the treasury moves to Solana. DEMO mode for now.')}>Connect Wallet</button>
        <span className={`conn ${connected ? 'on' : ''}`} title={connected ? 'stream connected' : 'reconnecting'} />
      </div>
    </div>
    </header>
  )
}
