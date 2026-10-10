import { useState } from 'react'
import { post } from '../api'
import { useStore } from '../store'

export default function VisitorPanel() {
  const brain = useStore(s => s.brain), links = useStore(s => s.links), lang = useStore(s => s.lang)
  const [msg, setMsg] = useState<string>(''), [q, setQ] = useState(''), [answer, setAnswer] = useState<string>('')
  const run = async (fn: () => Promise<{ ok?: boolean; error?: string; answer?: string }>) => { try { const r = await fn(); setMsg(r.error ? `✗ ${r.error}` : '✓ recorded in the ledger'); if (r.answer) setAnswer(r.answer) } catch (e) { setMsg(String(e)) } }
  const votes = brain?.votes ?? {}
  return (
    <div className="panel">
      <div className="panel-h">Visitor actions <span className="right muted">safe · rate-limited · all logged</span></div>
      <div className="visitor">
        <button onClick={() => run(() => post('/api/visitor/poke', { jobType: 'cpu-bench' }))}>⚡ benchmark</button>
        <button onClick={() => run(() => post('/api/visitor/poke', { jobType: 'selftest' }))}>🧪 self-test</button>
        <button onClick={() => run(() => post('/api/visitor/poke', { jobType: 'integrity' }))}>🔍 integrity</button>
        <button onClick={() => run(() => post('/api/visitor/vote', { experiment: 'compress-sweep' }))}>🗳 vote: compress ({votes['compress-sweep'] ?? 0})</button>
        <button className="primary" onClick={() => { const w = links?.wallet; if (w) { navigator.clipboard?.writeText(w); setMsg(`✓ treasury address copied: ${w.slice(0, 8)}…`) } else setMsg('treasury address not configured') }}>💚 {'support with SOL'}</button>
        <button onClick={() => links?.solscanWallet && window.open(links.solscanWallet, '_blank')}>🔎 {'treasury on Solscan'}</button>
        <div className="full"><input placeholder="ask the server (answered from memory, no LLM)" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && q.trim()) { run(() => post('/api/visitor/ask', { question: q })); setQ('') } }} /><button onClick={() => { if (q.trim()) { run(() => post('/api/visitor/ask', { question: q })); setQ('') } }}>ask</button></div>
        {answer && <div className="answer">{answer}</div>}
        {msg && <div className="answer" style={{ borderColor: msg.startsWith('✓') ? '#19f0a0' : '#ff3b5c' }}>{msg}</div>}
      </div>
    </div>
  )
}
