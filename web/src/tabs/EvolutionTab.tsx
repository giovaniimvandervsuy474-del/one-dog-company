import { useStore } from '../store'
import { hhmmss, ago } from '../format'

const MOOD: Record<string, string> = { calm: '#19f0a0', focused: '#5ad7ff', anxious: '#ffb347', desperate: '#ff3b5c', hopeful: '#c08cff' }

export default function EvolutionTab() {
  const genome = useStore(s => s.genome), brain = useStore(s => s.brain), stats = useStore(s => s.stats)
  if (!genome) return <div className="empty">loading…</div>
  const { history, jobIntervals, ...g } = genome
  const decisions = [...(brain?.memory.decisions ?? [])].reverse()
  return (
    <div className="tabpage evolution">
      <div className="cards" style={{ gridColumn: '1 / 4' }}>
        <div className="card"><div className="k">Genome version</div><div className="v" style={{ color: '#ffd166' }}>v{genome.version}</div><div className="s">{history.length} recorded mutations</div></div>
        <div className="card"><div className="k">Decisions</div><div className="v">{brain?.memory.stats.decisions ?? 0}</div><div className="s">{brain?.memory.stats.actions ?? 0} actions · provider {brain?.provider}</div></div>
        <div className="card"><div className="k">Experiments</div><div className="v">{brain?.memory.stats.experiments ?? 0}</div><div className="s">compression sweeps completed</div></div>
        <div className="card"><div className="k">Jobs</div><div className="v">{stats.completed ?? 0}</div><div className="s">{stats.failed ?? 0} failed · {stats.timeout ?? 0} timed out</div></div>
      </div>
      <div className="panel"><div className="panel-h">Genome · current configuration <span className="right muted">config/genome.json</span></div><div className="panel-b">
        <table className="table"><thead><tr><th>gene</th><th>value</th></tr></thead><tbody>
          {Object.entries(g).map(([k, v]) => <tr key={k}><td>{k}</td><td style={{ color: '#ffd166' }}>{JSON.stringify(v)}</td></tr>)}
          {Object.entries(jobIntervals).map(([k, v]) => <tr key={k}><td className="dim">interval · {k}</td><td>{(v / 1000).toFixed(0)}s</td></tr>)}
        </tbody></table>
        <div className="panel-h" style={{ borderTop: '1px solid var(--line)' }}>Mutation history</div>
        {[...history].reverse().map((h, i) => <div key={i} className="gen-item"><span className="mono dim">{hhmmss(h.ts)}</span> <span className="v">v{h.version}</span> <b>{h.key}</b>: <span className="mono">{JSON.stringify(h.from)}</span> → <span className="mono" style={{ color: '#19f0a0' }}>{JSON.stringify(h.to)}</span><div className="r">{h.reason}{h.decisionId && <span className="dim"> · {h.decisionId}</span>}</div></div>)}
        {!history.length && <div className="empty">no mutations yet</div>}
      </div></div>
      <div className="panel"><div className="panel-h">Hypotheses · the server predicts, then checks itself <span className="right muted">{brain?.memory.stats.confirmed ?? 0} confirmed · {brain?.memory.stats.refuted ?? 0} refuted</span></div><div className="panel-b">
        {[...(brain?.memory.hypotheses ?? [])].reverse().slice(0, 30).map(h => <div key={h.id} className="gen-item"><span className="mono dim">{hhmmss(h.ts)}</span> <span style={{ color: h.result === 'confirmed' ? '#19f0a0' : h.result === 'refuted' ? '#ffb347' : h.result ? '#9fb3c8' : '#5ad7ff' }}>{h.result ?? 'pending'}</span> · {h.statement}<div className="r">{h.metric} expected {h.expect} · baseline {h.baseline ?? '—'}{h.observed !== undefined ? ` → observed ${h.observed ?? '—'}` : ` · check at ${hhmmss(h.checkAt)}`}</div></div>)}
        {!(brain?.memory.hypotheses?.length) && <div className="empty">no hypotheses yet</div>}
      </div></div>
      <div className="panel"><div className="panel-h">Decision log <span className="right muted">every planning cycle · chronicle/brain/decisions</span></div><div className="panel-b">
        {decisions.map(d => <div key={d.id} className="decision"><span className="mood" style={{ color: MOOD[d.mood] }}>{d.mood}</span><span className="dim mono" style={{ fontSize: 10 }}>{hhmmss(d.ts)} · {ago(d.ts)} ago · {d.provider} · ${d.costUsd.toFixed(5)}</span><div style={{ marginTop: 3 }}>{d.summary}</div><div className="acts">{d.actions.map((a, i) => <span key={i} className="act" title={String(a.reason ?? a.lesson ?? '')}>{String(a.kind)}{a.jobType ? `:${a.jobType}` : ''}{a.workspace ? `:${a.workspace}` : ''}{a.value !== undefined ? `=${a.value}` : ''}{a.ms !== undefined ? `=${Number(a.ms) / 1000}s` : ''}{a.level !== undefined ? ` L${a.level} ${a.algo}` : ''}</span>)}</div></div>)}
        {!decisions.length && <div className="empty">brain has not decided anything yet</div>}
      </div></div>
    </div>
  )
}
