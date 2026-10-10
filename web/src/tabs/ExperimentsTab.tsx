import { useStore } from '../store'
import Chart from '../components/Chart'

export default function ExperimentsTab() {
  const jobs = useStore(s => s.jobs), order = useStore(s => s.jobOrder), metrics = useStore(s => s.metrics), brain = useStore(s => s.brain)
  const nn = [...order].reverse().map(id => jobs[id]).find(j => j?.type === 'nn-train' && j.status === 'completed')
  const out = nn?.output as { history?: number[]; totalEpochs?: number; mse?: number; arch?: string; task?: string; preds?: Array<{ x: number; y: number; t: number }>; lr?: number } | undefined
  const sweep = brain?.lastExperiment as { rows?: Array<{ algo: string; level: number; ms: number; bytes: number; ratio: number; score: number }>; best?: { level: number; algo: string }; corpusBytes?: number; ts?: number; jobId?: string } | undefined
  const series = (type: string, name: string, color: string) => ({ name, color, points: (metrics[type] ?? []).map(m => ({ x: m.ts, y: m.v })) })
  return (
    <div className="tabpage experiments">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <div className="panel" style={{ flex: 1 }}><div className="panel-h">Separately trained neural network <span className="right"><span className="badge" style={{ color: '#c08cff' }}>TOY TASK · NOT THE SOFTWARE GRAPH</span></span></div><div className="panel-b" style={{ padding: 10 }}>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 12 }}>{out?.task ?? 'approximate sin(x) on [-π, π]'} · architecture {out?.arch ?? '1-16-16-1 tanh'} · lr {out?.lr ?? 0.02} · weights persist in <span className="mono">chronicle/brain/nn-weights.json</span>, so every job continues the same training run. Loss below is real.</p>
          <div className="cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 10 }}><div className="card"><div className="k">total epochs</div><div className="v">{out?.totalEpochs ?? '—'}</div></div><div className="card"><div className="k">mse</div><div className="v" style={{ color: '#c08cff' }}>{out?.mse?.toFixed(5) ?? '—'}</div></div><div className="card"><div className="k">runs</div><div className="v">{(metrics['nn-train'] ?? []).length}</div></div></div>
          {out?.history && <Chart series={[{ name: 'mse per epoch (last 120)', color: '#c08cff', points: out.history.map((v, i) => ({ x: i, y: v })) }]} height={160} xTime={false} />}
          {out?.preds && <table className="table" style={{ marginTop: 8 }}><thead><tr><th>x</th><th>net(x)</th><th>sin(x)</th><th>error</th></tr></thead><tbody>{out.preds.map(p => <tr key={p.x}><td>{p.x}</td><td>{p.y}</td><td>{p.t}</td><td style={{ color: Math.abs(p.y - p.t) < 0.05 ? '#19f0a0' : '#ffb347' }}>{(p.y - p.t).toFixed(4)}</td></tr>)}</tbody></table>}
        </div></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <div className="panel"><div className="panel-h">Compression sweep · evolution experiment <span className="right muted">{sweep?.ts ? new Date(sweep.ts).toLocaleTimeString() : 'not run yet'} {sweep?.jobId ? `· ${sweep.jobId}` : ''}</span></div><div className="panel-b">
          {sweep?.rows ? <table className="table"><thead><tr><th>algo</th><th>level</th><th>time</th><th>bytes</th><th>ratio</th><th>score</th></tr></thead><tbody>{sweep.rows.map(r => <tr key={r.level} style={{ color: sweep.best?.level === r.level ? '#19f0a0' : undefined }}><td>{r.algo}</td><td>L{r.level}</td><td>{r.ms.toFixed(0)}ms</td><td>{(r.bytes / 1024).toFixed(0)}KB</td><td>{r.ratio.toFixed(3)}x</td><td>{r.score.toFixed(3)}{sweep.best?.level === r.level ? ' ◀ adopted' : ''}</td></tr>)}</tbody></table> : <div className="empty">the brain runs a sweep every ~20 min and adopts the best level into the genome</div>}
          {sweep?.corpusBytes && <p className="dim" style={{ fontSize: 11, padding: '6px 10px', margin: 0 }}>corpus: {(sweep.corpusBytes / 1024).toFixed(0)} KB of this project's own sources · score = ratio / log2(ms)</p>}
        </div></div>
        <div className="panel" style={{ flex: 1 }}><div className="panel-h">Measured metrics over time</div><div className="panel-b" style={{ padding: 8, display: 'grid', gridTemplateRows: '1fr 1fr 1fr', gap: 6 }}>
          <Chart series={[series('cpu-bench', 'sha256 hashes/s', '#19f0a0')]} height={120} />
          <Chart series={[series('compress', 'compression ratio', '#5ad7ff')]} height={120} />
          <Chart series={[series('lint', 'static findings', '#ffb347'), series('selftest', 'self-tests passed', '#c08cff')]} height={120} />
        </div></div>
      </div>
    </div>
  )
}
