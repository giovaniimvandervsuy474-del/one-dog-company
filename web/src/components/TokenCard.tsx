import { useState } from 'react'
import { useStore } from '../store'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return <button className="chip" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500) }) }} title="copy">{ok ? '✓ copied' : 'copy'}</button>
}

/** Contract address, treasury wallet and the public links. Compact in the header, full card on the home page. */
export function TokenInline() {
  const l = useStore(s => s.links), lang = useStore(s => s.lang)
  if (!l?.mint) return null
  return <span className="token-inline" title={l.mint}><span className="k">CA</span><span className="mono">{short(l.mint)}</span><Copy text={l.mint} />{l.pumpfun && <a href={l.pumpfun} target="_blank" rel="noreferrer">pump.fun</a>}{l.dexscreener && <a href={l.dexscreener} target="_blank" rel="noreferrer">{'chart'}</a>}</span>
}

/** Two compact lines for the survival card: contract + links, treasury wallet. */
export function TokenCompact() {
  const l = useStore(s => s.links), eco = useStore(s => s.economy), lang = useStore(s => s.lang)
  if (!l?.mint && !l?.wallet) return null
  const notTrading = eco && eco.market.source === 'SOLANA' && !eco.market.launched
  return (
    <div className="token-compact">
      {l.mint && <div className="row"><span className="k">CA</span><span className="mono" title={l.mint}>{short(l.mint)}</span><Copy text={l.mint} />{l.pumpfun && <a href={l.pumpfun} target="_blank" rel="noreferrer">pump.fun</a>}{l.dexscreener && <a href={l.dexscreener} target="_blank" rel="noreferrer">{'chart'}</a>}{notTrading && <span className="dim">{'· not trading yet'}</span>}</div>}
      {l.wallet && <div className="row"><span className="k">{'wallet'}</span><span className="mono" title={l.wallet}>{short(l.wallet)}</span><Copy text={l.wallet} />{l.solscanWallet && <a href={l.solscanWallet} target="_blank" rel="noreferrer">solscan</a>}{eco?.market.walletSol !== undefined && <span className="dim mono">{eco.market.walletSol.toFixed(3)} SOL</span>}</div>}
    </div>
  )
}

export default function TokenCard() {
  const l = useStore(s => s.links), eco = useStore(s => s.economy), lang = useStore(s => s.lang)
  if (!l) return null
  return (
    <div className="card token-card">
      <div className="k">{'Token & treasury'} {l.live ? <span className="badge demo" style={{ color: '#19f0a0' }}>LIVE</span> : <span className="badge demo">DEMO</span>}</div>
      {l.mint ? <>
        <div className="row"><span className="k">CA</span><span className="mono" title={l.mint}>{short(l.mint)}</span><Copy text={l.mint} /></div>
        <div className="links">{l.pumpfun && <a href={l.pumpfun} target="_blank" rel="noreferrer">pump.fun</a>}{l.dexscreener && <a href={l.dexscreener} target="_blank" rel="noreferrer">DexScreener</a>}{l.solscanMint && <a href={l.solscanMint} target="_blank" rel="noreferrer">Solscan</a>}</div>
        {eco && eco.market.source === 'SOLANA' && !eco.market.launched && <div className="s" style={{ color: '#ffb347' }}>{'not trading yet'}</div>}
      </> : <div className="s">{'contract address appears at launch'}</div>}
      {l.wallet && <>
        <div className="row" style={{ marginTop: 8 }}><span className="k">{'Treasury'}</span><span className="mono" title={l.wallet}>{short(l.wallet)}</span><Copy text={l.wallet} /></div>
        <div className="links">{l.solscanWallet && <a href={l.solscanWallet} target="_blank" rel="noreferrer">Solscan</a>}{eco?.market.walletSol !== undefined && <span className="dim mono">{eco.market.walletSol.toFixed(3)} SOL</span>}</div>
        <div className="s">{'fees arrive here; this balance is what it lives on'}</div>
      </>}
      <div className="row" style={{ marginTop: 8 }}><span className="k">GitHub</span><a href={l.github} target="_blank" rel="noreferrer" className="mono">{l.github.replace('https://github.com/', '')}</a></div>
    </div>
  )
}
