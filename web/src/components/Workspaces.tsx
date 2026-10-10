import { useStore } from '../store'
import Sparkline from './Sparkline'
import { dur, ago } from '../format'
import type { Job } from '../types'

export default function Workspaces() {
  const workspaces = useStore(s => s.workspaces), jobs = useStore(s => s.jobs), order = useStore(s => s.jobOrder), genome = useStore(s => s.genome), metrics = useStore(s => s.metrics), set = useStore(s => s.set)
  const byWs: Record<string, Job[]> = {}
  for (let i = order.length - 1; i >= 0; i--) { const j = jobs[order[i]]; if (!j) continue; (byWs[j.workspace] ??= []).push(j) }
  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panel-h">Workspaces <span className="right muted">{Object.values(jobs).filter(j => j.status === 'running').length} running · {Object.values(jobs).filter(j => j.status === 'queued').length} queued · {genome?.concurrency ?? '-'} lanes</span></div>
      <div className="panel-b"><div className="ws-list">
        {workspaces.map(ws => {
          const list = byWs[ws.id] ?? []
          const current = list.find(j => j.status === 'running') ?? list[0]
          const done = list.filter(j => j.status === 'completed').length, failed = list.filter(j => j.status === 'failed' || j.status === 'timeout').length
          const paused = genome?.pausedWorkspaces.includes(ws.id)
          const metricType = current?.type
          const hist = metricType ? (metrics[metricType] ?? []).map(m => m.v) : []
          const cls = paused ? 'paused' : current?.status === 'running' ? 'running' : current?.status === 'failed' ? 'failed' : ''
          return (
            <div key={ws.id} className={`ws ${cls}`} onClick={() => current && set({ selectedJob: current.id })} style={{ cursor: current ? 'pointer' : 'default' }}>
              <div className="ws-h">{current?.status === 'running' && <span className="live-dot" />}{ws.title}{paused && <span className="badge" style={{ color: '#ffb347', fontSize: 9, padding: '1px 4px' }}>PAUSED</span>}<span className="id">{current?.id.slice(4, 14) ?? 'idle'}</span></div>
              {current ? (<>
                <div className="ws-job"><span className="t">{current.title}</span><span className="dim" style={{ marginLeft: 'auto' }}>{current.status === 'running' ? `${Math.round(current.progress * 100)}%` : current.status}</span></div>
                <div className="bar"><i style={{ width: `${Math.round(current.progress * 100)}%`, background: current.status === 'failed' || current.status === 'timeout' ? '#ff3b5c' : undefined }} /></div>
                <div className="ws-log">{current.logs.slice(-3).map((l, i) => <div className="l" key={i}>{l}</div>)}{current.error && <div className="l" style={{ color: '#ff8aa0' }}>{current.error}</div>}</div>
                <div className="ws-foot"><span>{current.metric ? `${current.metric.name} ${current.metric.value}${current.metric.unit}` : current.durationMs ? dur(current.durationMs) : '…'} · {done}✓ {failed > 0 ? `${failed}✗` : ''} · {ago(current.finishedAt ?? current.startedAt ?? current.queuedAt)}</span><Sparkline data={hist.slice(-30)} /></div>
              </>) : <div className="ws-job dim">waiting for first job…</div>}
            </div>
          )
        })}
      </div></div>
    </div>
  )
}
