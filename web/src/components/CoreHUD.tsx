import { useStore } from '../store'
import { KIND_COLOR, STATE_COLOR, ago } from '../format'
import Core from '../three/Core'
import '../three/neural.css'
import NowBar from './NowBar'
import Toasts from './Toasts'

export default function CoreHUD() {
  const eco = useStore(s => s.economy), graph = useStore(s => s.graph), mode = useStore(s => s.cameraMode), set = useStore(s => s.set), sel = useStore(s => s.selectedNode), brain = useStore(s => s.brain), brainPhase = useStore(s => s.brainPhase), quality = useStore(s => s.quality), scrubTs = useStore(s => s.scrubTs), jobs = useStore(s => s.jobs), events = useStore(s => s.events)
  const state = eco?.state ?? 'ALIVE'
  const node = graph.nodes.find(n => n.id === sel)
  const lastDecision = [...events].reverse().find(e => e.type === 'brain.decision')
  const deg = node ? graph.edges.filter(e => e.from === node.id || e.to === node.id).length : 0
  const nodeJobs = node?.meta?.jobType ? Object.values(jobs).filter(j => j.type === node.meta!.jobType).slice(-5).reverse() : []
  const phaseText = brainPhase === 'llm' ? 'thinking (LLM)…' : brainPhase === 'inspect' ? 'inspecting vitals…' : brainPhase === 'act' ? 'acting…' : 'idle'
  return (
    <div className="core-wrap" style={{ ['--state' as string]: STATE_COLOR[state] }}>
      <Core />
      <Toasts />
      <NowBar />
      <div className="hud tl"><span className="title">NEURAL CORTEX · LIVE</span><span className="big">{eco?.vitality ?? '—'}</span><span className="sub">vitality · {graph.nodes.length} modules · {graph.edges.length} links · genome v{useStore.getState().genome?.version ?? '-'}</span><span className="sub" style={{ color: '#c9b3ff' }}>brain: {phaseText} · cycle {brain?.cycle ?? 0}</span></div>
      {lastDecision && <div className="brain-line" title={lastDecision.title}>{lastDecision.title}</div>}
      {scrubTs !== null && <div className="scrub-banner">REPLAY · {new Date(scrubTs).toLocaleTimeString('en-GB', { hour12: false })} · {ago(scrubTs)} ago</div>}
      <div className="hud tr">{(['orbit', 'follow', 'free'] as const).map(m => <button key={m} className={mode === m ? 'primary' : ''} onClick={() => set({ cameraMode: m })}>{m}</button>)}<button onClick={() => set({ quality: quality === 'high' ? 'medium' : quality === 'medium' ? 'low' : 'high' })} title="render quality">{quality}</button></div>
      <div className="hud bl" style={{ bottom: 40 }}><div className="legend">{Object.entries(KIND_COLOR).map(([k, c]) => <span key={k}><i style={{ background: c, boxShadow: `0 0 6px ${c}` }} />{k}</span>)}</div><span className="dim neural-hint">Blue fibers = ambient anatomy · bright travelling signals = real events</span></div>
      {node && <div className="node-card"><button className="close" onClick={() => set({ selectedNode: null })}>✕</button><h3 style={{ color: KIND_COLOR[node.kind] }}>{node.label}</h3><div className="kv"><span className="k">id</span><span className="v">{node.id}</span><span className="k">kind</span><span className="v">{node.kind}</span><span className="k">links</span><span className="v">{deg}</span><span className="k">since</span><span className="v">{new Date(node.since).toLocaleString()}</span>{node.meta?.bytes !== undefined && <><span className="k">size</span><span className="v">{String(node.meta.bytes)} B</span></>}{node.meta?.desc !== undefined && <><span className="k">role</span><span className="v">{String(node.meta.desc)}</span></>}{node.meta?.workspace !== undefined && <><span className="k">workspace</span><span className="v">{String(node.meta.workspace)}</span></>}</div>
        {nodeJobs.length > 0 && <div style={{ marginTop: 8 }}><div className="dim" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em' }}>recent jobs</div>{nodeJobs.map(j => <div key={j.id} className="mono" style={{ fontSize: 10, cursor: 'pointer' }} onClick={() => set({ selectedJob: j.id })}>{j.status === 'completed' ? '✓' : j.status === 'running' ? '▶' : '✗'} {j.id.slice(4, 14)} {j.metric ? `${j.metric.name} ${j.metric.value}${j.metric.unit}` : j.status}</div>)}</div>}
        {node.id.startsWith('server/') && <div style={{ marginTop: 8 }}><button onClick={() => set({ tab: 'desktop', selectedNode: node.id })}>open in Live Desktop</button></div>}
      </div>}
    </div>
  )
}
