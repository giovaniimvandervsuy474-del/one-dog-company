import { useStore } from '../store'
import { hhmmss, dur } from '../format'

export default function EvidenceDrawer() {
  const ev = useStore(s => s.selectedEvent), jobId = useStore(s => s.selectedJob), jobs = useStore(s => s.jobs), set = useStore(s => s.set)
  const job = jobId ? jobs[jobId] : undefined
  if (!ev && !job) return null
  const close = () => set({ selectedEvent: null, selectedJob: null })
  return (
    <div className="drawer">
      <div className="panel-h">Evidence <span className="right"><button onClick={close}>✕</button></span></div>
      <div style={{ overflow: 'auto', flex: 1 }}>
        {ev && <div className="section"><h4>Event</h4><div className="kv"><span className="k">id</span><span className="v">{ev.id}</span><span className="k">time</span><span className="v">{new Date(ev.ts).toISOString()}</span><span className="k">type</span><span className="v">{ev.type}</span><span className="k">source</span><span className="v">{ev.source}</span></div><p style={{ margin: '8px 0 0', fontSize: 12 }}>{ev.title}</p></div>}
        {ev?.evidence && <div className="section"><h4>Proof</h4><div className="kv">
          {ev.evidence.jobId && <><span className="k">job</span><span className="v">{ev.evidence.jobId}</span></>}
          {ev.evidence.commit && <><span className="k">commit</span><span className="v">{ev.evidence.commitUrl ? <a href={ev.evidence.commitUrl} target="_blank" rel="noreferrer">{ev.evidence.commit}</a> : ev.evidence.commit}</span></>}
          {ev.evidence.file && <><span className="k">file</span><span className="v">{ev.evidence.file}</span></>}
          {ev.evidence.decisionId && <><span className="k">decision</span><span className="v">{ev.evidence.decisionId}</span></>}
          {ev.evidence.url && <><span className="k">url</span><span className="v"><a href={ev.evidence.url} target="_blank" rel="noreferrer">{ev.evidence.url}</a></span></>}
        </div><p className="dim" style={{ fontSize: 11, margin: '8px 0 0' }}>Events are saved in the project journal. Source links point to the pages observed by the agent.</p></div>}
        {ev?.data && <div className="section"><h4>Data</h4><pre>{JSON.stringify(ev.data, null, 2)}</pre></div>}
        {job && <div className="section"><h4>Job {job.id}</h4><div className="kv"><span className="k">type</span><span className="v">{job.type}</span><span className="k">workspace</span><span className="v">{job.workspace}</span><span className="k">status</span><span className="v">{job.status}</span><span className="k">queued</span><span className="v">{hhmmss(job.queuedAt)}</span>{job.startedAt && <><span className="k">started</span><span className="v">{hhmmss(job.startedAt)}</span></>}{job.durationMs !== undefined && <><span className="k">duration</span><span className="v">{dur(job.durationMs)}</span></>}<span className="k">cost units</span><span className="v">{job.costUnits}</span>{job.metric && <><span className="k">metric</span><span className="v">{job.metric.name} = {job.metric.value}{job.metric.unit}</span></>}</div>
          <h4 style={{ marginTop: 10 }}>Worker output</h4><pre>{job.logs.join('\n') || '(no output yet)'}{job.error ? `\n! ${job.error}` : ''}</pre>
          {job.input && <><h4 style={{ marginTop: 10 }}>Input</h4><pre>{JSON.stringify(job.input, null, 1).slice(0, 2000)}</pre></>}
          {job.output && <><h4 style={{ marginTop: 10 }}>Result</h4><pre>{JSON.stringify(job.output, null, 1).slice(0, 4000)}</pre></>}
        </div>}
      </div>
    </div>
  )
}
