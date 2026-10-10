import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { hhmmss, SEV_COLOR } from '../format'
import { explainText } from '../i18n'

const FILTERS: Array<[string, string]> = [['all', 'all'], ['mission', 'missions'], ['job', 'jobs'], ['brain', 'brain'], ['genome', 'genome'], ['github', 'github'], ['survival', 'survival'], ['treasury', 'treasury'], ['experiment', 'experiments'], ['visitor', 'visitors'], ['file', 'files'], ['module', 'modules']]
const NOISE = new Set(['job.queued', 'brain.cycle', 'scribe.idle', 'brain.thought'])

export default function Feed() {
  const lang = useStore(s => s.lang)
  const events = useStore(s => s.events), filter = useStore(s => s.feedFilter), selected = useStore(s => s.selectedEvent), set = useStore(s => s.set), scrubTs = useStore(s => s.scrubTs)
  const ref = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const list = events.filter(e => (filter === 'all' ? !NOISE.has(e.type) : e.type.startsWith(filter)) && (scrubTs === null || e.ts <= scrubTs)).slice(-250)
  const [stuck, setStuck] = useState(true)
  useEffect(() => { if (stick.current && ref.current) requestAnimationFrame(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }) }, [list.length, filter])
  const jump = () => { stick.current = true; setStuck(true); if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }
  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panel-h"><span className="live-dot" />Live feed <span className="right muted">{events.length} events</span></div>
      <div className="feed-filters">{FILTERS.map(([id, label]) => <button key={id} className={`chip ${filter === id ? 'on' : ''}`} onClick={() => set({ feedFilter: id })}>{label}</button>)}</div>
      {!stuck && <button className="primary" style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 3 }} onClick={jump}>↓ jump to live</button>}
      <div className="panel-b" ref={ref} onWheel={e => { const el = ref.current!; if (e.deltaY < 0) { stick.current = false; setStuck(false) } else if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) { stick.current = true; setStuck(true) } }}>
        <div className="feed">
          {list.map(e => (
            <div key={e.id} className={`ev ${selected?.id === e.id ? 'sel' : ''}`} onClick={() => set({ selectedEvent: selected?.id === e.id ? null : e, selectedJob: e.evidence?.jobId ?? null })}>
              <span className="t">{hhmmss(e.ts)}</span>
              <span className="s" style={{ background: SEV_COLOR[e.severity], boxShadow: `0 0 6px ${SEV_COLOR[e.severity]}` }} />
              <div className="m"><div className="ty">{e.type} · {e.source}{e.evidence && (e.evidence.commit || e.evidence.jobId || e.evidence.decisionId || e.evidence.url) && <span className="ev-tag">evidence</span>}</div><div className={`ti ${e.severity}`}>{e.title}</div>{explainText(e.type, lang) && <div className="ex">{explainText(e.type, lang)}</div>}</div>
            </div>
          ))}
          {!list.length && <div className="empty">no events in this filter yet</div>}
        </div>
      </div>
    </div>
  )
}
