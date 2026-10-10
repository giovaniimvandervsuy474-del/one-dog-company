import { useEffect, useState } from 'react'
import { useStore } from '../store'
import Stage from '../scene/Stage'
import LiveCam from '../components/LiveCam'
import Chat from '../components/Chat'
import Core from '../three/Core'
import Sparkline from '../components/Sparkline'
import Toasts from '../components/Toasts'
import MissionPanel from '../components/MissionPanel'
import { TokenCompact } from '../components/TokenCard'
import { usd, hhmmss, STATE_COLOR, dur } from '../format'
import { stateText, deathClock, moodText, jobText, countdown } from '../i18n'
import { useMascotState } from '../mascot/useMascotState'

const TAG: Record<string, string> = { pacer: 'BUDGET', thought: 'DEEP', debate: 'DEBATE', image: 'ART', writing: 'WRITING', budget: 'BUDGET', page: 'PAGE', identity: 'AI', planner: 'AI', browse: 'WEB', hypothesis: 'SCIENCE', note: 'NOTE', research: 'RESEARCH', motto: 'AI', mission: 'MISSION', job: 'JOB', brain: 'AI', genome: 'GENOME', github: 'GITHUB', survival: 'SURVIVAL', treasury: 'ECONOMY', experiment: 'EXPERIMENT', visitor: 'VISITOR', chat: 'CHAT', file: 'FILE', module: 'MODULE', system: 'SYSTEM', economy: 'ECONOMY', workspace: 'AI', scribe: 'GITHUB' }
const TAGCOL: Record<string, string> = { DEEP: '#c08cff', DEBATE: '#ffd166', ART: '#ff8aa0', WRITING: '#8fe3c4', BUDGET: '#5ad7ff', PAGE: '#5ad7ff', WEB: '#c08cff', SCIENCE: '#ffd166', NOTE: '#8fe3c4', RESEARCH: '#c08cff', MISSION: '#5ad7ff', JOB: '#19f0a0', AI: '#c08cff', GENOME: '#ffd166', GITHUB: '#ff8aa0', SURVIVAL: '#ffb347', ECONOMY: '#5ad7ff', EXPERIMENT: '#c08cff', VISITOR: '#9fb3c8', CHAT: '#9fb3c8', FILE: '#8fe3c4', MODULE: '#19f0a0', SYSTEM: '#9fb3c8' }

function Tick() { const [, t] = useState(0); useEffect(() => { const i = setInterval(() => t(x => x + 1), 1000); return () => clearInterval(i) }, []); return null }

export default function Home() {
  const pageVersion = useStore(s => s.pageVersion)
  const eco = useStore(s => s.economy), lang = useStore(s => s.lang), mood = useStore(s => s.mood), sys = useStore(s => s.system), events = useStore(s => s.events), jobs = useStore(s => s.jobs), online = useStore(s => s.online), genome = useStore(s => s.genome), scribe = useStore(s => s.scribe), brainNextAt = useStore(s => s.brainNextAt), bootTs = useStore(s => s.bootTs), market = useStore(s => s.marketSeries), set = useStore(s => s.set)
  const mstate = useMascotState()
  const state = eco?.state ?? 'ALIVE'
  const col = STATE_COLOR[state]
  const dec = [...events].reverse().find(e => e.type === 'brain.decision')
  const decMood = (dec?.data as { mood?: string })?.mood ?? 'calm'
  const actions = ((dec?.data as { actions?: Array<Record<string, unknown>> })?.actions ?? [])
  const running = Object.values(jobs).filter(j => j.status === 'running')
  const recentJobs = Object.values(jobs).sort((a, b) => (b.startedAt ?? b.queuedAt) - (a.startedAt ?? a.queuedAt)).slice(0, 6)
  const feed = events.filter(e => !['job.queued', 'brain.cycle', 'scribe.idle', 'brain.thought', 'job.started', 'mission.step'].includes(e.type)).slice(-40).reverse()
  const up = Math.floor((Date.now() - bootTs) / 1000)
  const uptime = `${Math.floor(up / 86400)}d ${Math.floor((up % 86400) / 3600)}h ${String(Math.floor((up % 3600) / 60)).padStart(2, '0')}m`
  const lastCommit = [...events].reverse().find(e => e.type === 'github.commit')
  const spent24 = eco ? eco.costs.infra + eco.costs.compute + eco.costs.ai : 0
  const bar = (label: string, v: number, c = '#19f0a0') => <div className="mbar"><span>{label}</span><div className="bar"><i style={{ width: `${v}%`, background: c, boxShadow: 'none' }} /></div><span className="num">{v}%</span></div>
  return (
    <div className="home">
      <Tick />
      <aside className="home-l">
        <div className="card"><div className="k">AI status</div><div className="v" style={{ color: col, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><span className="dot" style={{ background: col, boxShadow: `0 0 10px ${col}` }} />{state}<Sparkline data={market.slice(-40).map(m => m.price)} w={70} h={22} color={col} /></div><div className="s">{stateText(state, lang)}</div></div>
        <div className="card"><div className="k">{'Survival time'}</div><div className="v" style={{ fontSize: 18 }}>◷ {uptime}</div><TokenCompact /><div className="s">{'money runs out in'} <b style={{ color: col }}>{deathClock(eco?.runwayHours ?? null, lang)}</b></div>
          <div className="k" style={{ marginTop: 10 }}>Treasury {eco?.demo && <span className="badge demo">DEMO</span>}</div><div className="v" style={{ fontSize: 20 }}>{eco ? usd(eco.treasuryUsd) : '—'} <span className="s" style={{ color: '#ff8aa0', fontSize: 11 }}>{eco ? `−${usd(eco.burnPerHourUsd, 2)}/h` : ''}</span></div>
          {eco && eco.incomePerHourUsd > 0 && <div className="row"><span className="k">Income (last hour)</span><span className="num" style={{ color: '#19f0a0' }}>+{usd(eco.incomePerHourUsd, 2)}</span></div>}
          <div className="row"><span className="k">{'Total spent'}</span><span className="num">{usd(spent24)}</span></div>
          <div className="row"><span className="k">{'Active workers'}</span><span className="num">{running.length} / {genome?.concurrency ?? '-'}</span></div>
          <div className="row"><span className="k">{'Compute load'}</span><span className="num">{sys?.cpu ?? 0}%</span></div>
          <div className="bar" style={{ marginTop: 4 }}><i style={{ width: `${sys?.cpu ?? 0}%` }} /></div>
        </div>
        <div className="card"><div className="k">AI mood <span className="dim">· {'derived from real metrics'}</span></div>
          <div className="moodrow"><div className="moodface" style={{ borderColor: col }}><img src="/models/furry-kitty-portrait.png" alt="Furry Kitty" data-state={mstate} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div><div><div style={{ color: col, fontWeight: 600 }}>{moodText(decMood, lang)}</div><div className="quote">“{(dec?.title ?? '').replace(/^\[\w+\]\s*/, '').slice(0, 110)}”</div></div></div>
          {mood && <>{bar('Motivation', mood.motivation)}{bar('Curiosity', mood.curiosity, '#5ad7ff')}{bar('Stress', mood.stress, '#ffb347')}{bar('Hunger', mood.hunger, '#ff3b5c')}{bar('Creativity', mood.creativity, '#c08cff')}</>}
        </div>
      </aside>
      <main className="home-c"><Stage /><Toasts /></main>
      <aside className="home-r">
        <div className="panel" style={{ flex: 1 }}>
          <div className="panel-h">Live activity <span className="right"><span className="live-dot" /> {online} online</span></div>
          <div className="panel-b activity">{feed.map(e => { const tag = TAG[e.type.split('.')[0]] ?? 'SYS'; return <div key={e.id} className="act" onClick={() => set({ selectedEvent: e, selectedJob: e.evidence?.jobId ?? null })}><span className="t">{hhmmss(e.ts).slice(0, 5)}</span><span className="tag" style={{ color: TAGCOL[tag] }}>[{tag}]</span><span className="x">{e.title}</span></div> })}</div>
          <Chat />
        </div>
        <div className="panel" style={{ maxHeight: '46%' }}><div className="panel-h">Current mission <span className="right muted">🧠 {'next decision'} {countdown(brainNextAt)}</span></div>
          <div className="panel-b"><MissionPanel /></div>
        </div>
      </aside>
      <section className="home-b">
        <LiveCam />
        <div className="panel mini"><div className="panel-h">Neural core</div><div className="panel-b" style={{ position: 'relative' }}><Core mini /></div></div>
        <div className="panel mini"><div className="panel-h">Terminal</div><div className="panel-b term small">{recentJobs.map(j => <div key={j.id}><span className="j">&gt; {j.type}</span> {j.status === 'completed' ? <span className="ok">✓ {j.metric ? `${j.metric.name} ${j.metric.value}${j.metric.unit}` : ''} ({dur(j.durationMs ?? 0)})</span> : j.status === 'running' ? `${Math.round(j.progress * 100)}%…` : j.status}</div>)}</div></div>
        <div className="panel mini" style={{ cursor: 'pointer' }} onClick={() => set({ tab: 'page' })}><div className="panel-h">My page <span className="right muted">{'written by the server itself'}</span></div><div className="panel-b browser"><div className="url">/agent/</div><iframe key={pageVersion} src="/agent/" sandbox="" title="agent page preview" style={{ width: '200%', height: '200%', transform: 'scale(0.5)', transformOrigin: '0 0', border: 0, background: '#05080d', pointerEvents: 'none' }} /></div></div>
        <div className="panel mini"><div className="panel-h">GitHub</div><div className="panel-b" style={{ padding: 8, fontSize: 11 }}>{lastCommit ? <><div style={{ color: '#ffd166' }} className="mono">{(lastCommit.data as { sha: string }).sha.slice(0, 7)}</div><div>{lastCommit.title.replace(/^Committed \w+: /, '')}</div><div className="dim">{hhmmss(lastCommit.ts)} · {scribe?.commits ?? 0} commits · next {countdown(useStore.getState().scribeNextAt)}</div></> : <div className="dim">no commits yet</div>}</div></div>
        <div className="panel mini"><div className="panel-h">System</div><div className="panel-b sysgrid">
          <span>CPU</span><b>{sys?.cpu ?? 0}%</b><Sparkline data={useStore.getState().metrics['cpu-bench']?.slice(-20).map(m => m.v) ?? []} w={70} h={14} />
          <span>MEM</span><b>{sys?.memUsedGB ?? 0} GB</b><Sparkline data={useStore.getState().metrics['memory']?.slice(-20).map(m => m.v) ?? []} w={70} h={14} color="#ffb347" />
          <span>DISK</span><b>{sys?.diskPct ?? 0}%</b><Sparkline data={useStore.getState().metrics['logs']?.slice(-20).map(m => m.v) ?? []} w={70} h={14} color="#5ad7ff" />
          <span>NET</span><b>{sys?.netKBps ?? 0} KB/s</b><Sparkline data={useStore.getState().metrics['forecast']?.slice(-20).map(m => m.v) ?? []} w={70} h={14} color="#c08cff" />
        </div></div>
      </section>
    </div>
  )
}
