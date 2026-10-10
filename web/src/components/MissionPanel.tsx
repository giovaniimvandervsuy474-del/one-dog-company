import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { hhmmss, dur } from '../format'

const ICON: Record<string, string> = { pending: '○', running: '◌', done: '✓', failed: '✗', skipped: '–' }

export default function MissionPanel({ compact = false }: { compact?: boolean }) {
  const m = useStore(s => s.mission), history = useStore(s => s.missionHistory), lang = useStore(s => s.lang)
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(i) }, [])
  const last = history.at(-1)
  const show = m ?? last
  if (!show) return <div className="task"><div className="dim">{'A mission starts shortly…'}</div></div>
  const elapsed = Date.now() - show.startedAt
  return (
    <div className={`task ${compact ? 'compact' : ''}`}>
      <div className="task-t">{m ? '🎯' : show.status === 'done' ? '🏁' : '✗'} {show.title}</div>
      {!compact && <div className="task-why">{show.why}</div>}
      <div className="bar" style={{ margin: '6px 0' }}><i style={{ width: `${Math.round(show.progress * 100)}%`, background: show.status === 'failed' ? '#ff3b5c' : undefined }} /></div>
      <div className="steps">
        {show.steps.map((s, i) => (
          <div key={s.id} className={`step ${s.status}`}>
            <span className={`box ${s.status === 'done' ? 'on' : ''} ${s.status === 'running' ? 'spin' : ''}`}>{ICON[s.status]}</span>
            <span className="step-i">{i + 1}.</span>
            <span className="step-t">{s.title}</span>
            {s.result && !compact && <span className="step-r" title={s.result}>{s.result.length > 70 ? s.result.slice(0, 70) + '…' : s.result}</span>}
            {s.status === 'running' && s.startedAt && <span className="step-r num">{dur(Date.now() - s.startedAt)}</span>}
          </div>
        ))}
      </div>
      <div className="task-f"><span>{m ? ('in progress') : ('finished')} · {dur(show.finishedAt ? show.finishedAt - show.startedAt : elapsed)} · {hhmmss(show.startedAt)}</span><span>{history.filter(h => h.status === 'done').length} {'missions done'}</span></div>
    </div>
  )
}
