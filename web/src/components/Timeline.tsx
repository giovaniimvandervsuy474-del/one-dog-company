import { useStore } from '../store'
import { STATE_COLOR, hhmmss } from '../format'

export default function Timeline() {
  const events = useStore(s => s.events), scrubTs = useStore(s => s.scrubTs), set = useStore(s => s.set), stateHistory = useStore(s => s.stateHistory), bootTs = useStore(s => s.bootTs)
  const t0 = Math.min(bootTs, events[0]?.ts ?? bootTs), t1 = Date.now()
  const marks = events.filter(e => ['survival.state', 'genome.mutated', 'github.commit', 'module.added', 'experiment.started'].includes(e.type))
  const col = (t: string) => t === 'survival.state' ? '#ffb347' : t === 'genome.mutated' ? '#ffd166' : t === 'github.commit' ? '#ffffff' : t === 'module.added' ? '#19f0a0' : '#c08cff'
  return (
    <div className="panel">
      <div className="panel-h">Timeline · replay <span className="right">{scrubTs !== null ? <button className="primary" onClick={() => set({ scrubTs: null })}>back to live</button> : <span className="muted">drag to rewind the graph & feed</span>}</span></div>
      <div className="timeline">
        <div className="tl-marks">{marks.map(m => <i key={m.id} title={m.title} style={{ left: `${((m.ts - t0) / (t1 - t0 || 1)) * 100}%`, background: col(m.type) }} />)}{stateHistory.map((s, i) => <i key={'s' + i} style={{ left: `${((s.ts - t0) / (t1 - t0 || 1)) * 100}%`, background: STATE_COLOR[s.to], height: 14, top: 2 }} title={`${s.from} → ${s.to}`} />)}</div>
        <input type="range" min={t0} max={t1} step={1000} value={scrubTs ?? t1} onChange={e => { const v = Number(e.target.value); set({ scrubTs: v >= t1 - 2000 ? null : v }) }} />
        <div className="tl-row"><span>{hhmmss(t0)}</span><span style={{ color: scrubTs !== null ? '#ffb347' : undefined }}>{scrubTs !== null ? `⏪ ${hhmmss(scrubTs)}` : '● LIVE'}</span><span>{hhmmss(t1)}</span></div>
      </div>
    </div>
  )
}
