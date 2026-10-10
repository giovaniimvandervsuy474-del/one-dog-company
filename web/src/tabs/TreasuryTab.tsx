import { useEffect, useState } from 'react'
import { get } from '../api'
import { useStore } from '../store'
import Chart from '../components/Chart'
import { usd, big, hours, hhmmss, STATE_COLOR } from '../format'

type Hist = { history: Array<{ ts: number; treasury: number; income: number; burn: number; state: string }>; states: Array<{ ts: number; from: string; to: string; reason: string }>; ledger: Array<{ ts: number; kind: string; amountUsd: number; note: string; verified: boolean }> }

export default function TreasuryTab() {
  const eco = useStore(s => s.economy)
  const [h, setH] = useState<Hist | null>(null)
  useEffect(() => { const load = () => get<Hist>('/api/economy/history').then(setH); load(); const i = setInterval(load, 10000); return () => clearInterval(i) }, [])
  if (!eco) return <div className="empty">loading…</div>
  const bands = (h?.states ?? []).map((s, i, arr) => ({ from: s.ts, to: arr[i + 1]?.ts ?? Date.now(), color: STATE_COLOR[s.to] }))
  return (
    <div className="tabpage treasury">
      <div className="cards" style={{ gridColumn: '1 / 3', gridTemplateColumns: eco.demo ? 'repeat(6, 1fr)' : 'repeat(7, 1fr)' }}>
        <div className="card"><div className="k">{eco.demo ? <>Treasury <span className="badge demo">DEMO</span></> : 'Treasury (wallet − unpaid bills)'}</div><div className="v" style={{ color: STATE_COLOR[eco.state] }}>{usd(eco.treasuryUsd, 2)}</div><div className="s">{eco.demo ? `state ${eco.state}` : `unpaid bills $${(eco.unsettledUsd ?? 0).toFixed(2)} · paid $${(eco.settledUsd ?? 0).toFixed(2)} · ${eco.state}`}</div></div>
        <div className="card"><div className="k">Burn</div><div className="v" style={{ color: '#ff8aa0' }}>{usd(eco.burnPerHourUsd, 4)}<span className="dim" style={{ fontSize: 12 }}>/h</span></div><div className="s">infra {usd(eco.costs.infra, 3)} · compute {usd(eco.costs.compute, 3)} · ai {usd(eco.costs.ai, 4)}</div></div>
        <div className="card"><div className="k">Income</div><div className="v" style={{ color: '#19f0a0' }}>{usd(eco.incomePerHourUsd, 4)}<span className="dim" style={{ fontSize: 12 }}>/h</span></div><div className="s">fees {usd(eco.income.fees, 3)} · donations {usd(eco.income.donations, 2)}</div></div>
        <div className="card"><div className="k">Runway · estimate</div><div className="v">{hours(eco.runwayHours)}</div><div className="s">linear, at current burn minus income</div></div>
        <div className="card"><div className="k">Market cap</div><div className="v">{eco.market.source === 'SOLANA' && !eco.market.launched ? '—' : `$${big(eco.market.marketCapUsd)}`}</div><div className="s">ambition tier {eco.ambitionTier} · price ${eco.market.priceUsd.toExponential(2)}</div></div>
        {!eco.demo && <div className="card"><div className="k">Wallet</div><div className="v">{eco.market.walletSol?.toFixed(3) ?? '—'} SOL</div><div className="s">≈ ${eco.market.walletUsd?.toFixed(2) ?? '—'} · fees arrive here; transfers out settle the bills</div></div>}
        <div className="card"><div className="k">Volume 24h</div><div className="v">${big(eco.market.volume24hUsd)}</div><div className="s">{eco.market.source === 'SOLANA' ? (eco.market.launched ? 'on-chain via DexScreener' : 'token not trading yet · wallet live via RPC') : `${eco.market.holders} holders · DEMO`}</div></div>
      </div>
      <div className="panel"><div className="panel-h">Treasury over time <span className="right muted">bands = survival state</span></div><div className="panel-b" style={{ padding: 8, display: 'grid', gridTemplateRows: '2fr 1fr', gap: 6 }}>
        <Chart series={[{ name: 'treasury $', color: '#19f0a0', points: (h?.history ?? []).map(p => ({ x: p.ts, y: p.treasury })) }]} height={220} bands={bands} />
        <Chart series={[{ name: 'burn $/h', color: '#ff8aa0', points: (h?.history ?? []).map(p => ({ x: p.ts, y: p.burn })) }, { name: 'income $/h', color: '#5ad7ff', points: (h?.history ?? []).map(p => ({ x: p.ts, y: p.income })) }]} height={140} />
      </div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <div className="panel" style={{ flex: 1 }}><div className="panel-h">How survival is tied to the token</div><div className="panel-b" style={{ padding: 12, fontSize: 12, lineHeight: 1.5 }}>
          <p style={{ margin: 0 }}><b style={{ color: '#19f0a0' }}>Wallet is the treasury.</b> Verified SOL arriving in the wallet is income. Every model call (at the exact price the router reports) and every hour of hosting become a bill; the treasury is the wallet value minus unpaid bills. When SOL leaves the wallet to pay those bills, they are marked paid.</p>
          <p><b style={{ color: '#5ad7ff' }}>Market cap → ambition.</b> Tier {eco.ambitionTier}: higher cap lets the brain run more lanes and more research.</p>
          <p><b style={{ color: '#ffb347' }}>Volume → forecast.</b> Falling volume lowers vitality before fees dry up, so the brain cuts costs early.</p>
          <p style={{ margin: 0 }}><b style={{ color: '#ff3b5c' }}>Runway → state.</b> ALIVE &gt; 30h · STRAINED 8–30h · CRITICAL 2–8h · HIBERNATING &lt; 2h · RECOVERING when funds return. Mcap, volume, buys and sells never count as revenue.</p>
        </div></div>
        <div className="panel" style={{ flex: 2 }}><div className="panel-h">Cash flow ledger</div><div className="panel-b"><table className="table"><thead><tr><th>time</th><th>kind</th><th>amount</th><th>note</th></tr></thead><tbody>{[...(h?.ledger ?? [])].reverse().slice(0, 120).map((l, i) => <tr key={i}><td>{hhmmss(l.ts)}</td><td>{l.kind}{!l.verified && l.amountUsd > 0 ? ' (demo)' : ''}</td><td style={{ color: l.amountUsd >= 0 ? '#19f0a0' : '#ff8aa0' }}>{l.amountUsd >= 0 ? '+' : ''}{l.amountUsd.toFixed(5)}</td><td className="dim">{l.note}</td></tr>)}</tbody></table></div></div>
        <div className="panel" style={{ flex: 1 }}><div className="panel-h">State history</div><div className="panel-b">{[...(h?.states ?? [])].reverse().map((s, i) => <div key={i} className="gen-item"><span className="mono dim">{hhmmss(s.ts)}</span> <span style={{ color: STATE_COLOR[s.from] }}>{s.from}</span> → <span style={{ color: STATE_COLOR[s.to] }}>{s.to}</span> <span className="dim">· {s.reason}</span></div>)}{!h?.states.length && <div className="empty">no transitions yet</div>}</div></div>
      </div>
    </div>
  )
}
