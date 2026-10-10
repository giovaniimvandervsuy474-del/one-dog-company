import { useStore } from '../store'
import { t, jobText } from '../i18n'
import { hhmmss } from '../format'

/** Contents of the floating monitors. Every line comes from the store, i.e. from real backend events. */
export function TaskMonitor() {
  const mission = useStore(s => s.mission), lang = useStore(s => s.lang)
  if (mission) return <div className="mon"><div className="mon-t">🎯 {mission.title}</div>{mission.steps.map((s, i) => <div key={s.id} className="mon-l" style={{ opacity: s.status === 'pending' ? 0.5 : 1 }}><span className={s.status === 'done' ? 'ok' : s.status === 'running' ? 'spin' : ''}>{s.status === 'done' ? '✓' : s.status === 'running' ? '◌' : s.status === 'failed' ? '✗' : '○'}</span> {i + 1}. {s.title}</div>)}</div>
  return <TaskMonitorFallback lang={lang} />
}

function TaskMonitorFallback({ lang }: { lang: 'en' }) {
  const events = useStore(s => s.events), jobs = useStore(s => s.jobs), brainPhase = useStore(s => s.brainPhase)
  const dec = [...events].reverse().find(e => e.type === 'brain.decision')
  const actions = ((dec?.data as { actions?: Array<Record<string, unknown>> })?.actions ?? []).slice(0, 4)
  const running = Object.values(jobs).filter(j => j.status === 'running').slice(0, 3)
  return (
    <div className="mon">
      <div className="mon-t">{brainPhase === 'llm' ? t('thinking', lang) : 'Current plan'}</div>
      {actions.map((a, i) => <div key={i} className="mon-l"><span className="ok">✓</span> {String(a.kind).replace(/_/g, ' ')}{a.jobType ? `: ${a.jobType}` : ''}{a.workspace ? `: ${a.workspace}` : ''}{a.value !== undefined ? ` = ${a.value}` : ''}{a.ms !== undefined ? ` = ${Number(a.ms) / 1000}s` : ''}</div>)}
      {!actions.length && <div className="mon-l dim">…</div>}
      {running.map(j => <div key={j.id} className="mon-l"><span className="spin">◌</span> {jobText(j.type, lang)} <span className="dim">{Math.round(j.progress * 100)}%</span></div>)}
    </div>
  )
}

export function ThoughtMonitor() {
  const events = useStore(s => s.events), lang = useStore(s => s.lang), dt = useStore(s => s.deepThink), db = useStore(s => s.debate)
  if (dt && !dt.done && dt.text) return <div className="mon"><div className="mon-t">🧠 {dt.topic.slice(0, 50)}</div><div className="mon-stream">{dt.text.slice(-700)}</div></div>
  if (db && !db.done && db.turns.length) { const t = db.turns.at(-1)!; return <div className="mon"><div className="mon-t">⚖ {t.role} ({t.model.split('/').pop()})</div><div className="mon-stream">{t.text.slice(-600)}</div></div> }
  const thoughts = events.filter(e => e.type === 'brain.thought').slice(-4)
  return (
    <div className="mon">
      <div className="mon-t">{'Reasoning'}</div>
      {thoughts.map(e => <div key={e.id} className="mon-l"><span className="dim">{hhmmss(e.ts).slice(3)}</span> {e.title}</div>)}
      {!thoughts.length && <div className="mon-l dim">…</div>}
    </div>
  )
}

export function ExperimentMonitor() {
  const brain = useStore(s => s.brain), lang = useStore(s => s.lang), metrics = useStore(s => s.metrics)
  const exp = brain?.lastExperiment as { best?: { level: number; algo: string; score: number }; ts?: number } | undefined
  const nn = metrics['nn-train']?.at(-1)
  const votes = brain?.votes ?? {}
  return (
    <div className="mon">
      <div className="mon-t">{'Experiments'}</div>
      <div className="mon-l">⚗ compression sweep: {exp?.best ? <span className="ok">L{exp.best.level} {exp.best.algo} · {exp.best.score.toFixed(2)}</span> : <span className="dim">pending</span>}</div>
      <div className="mon-l">🧠 nn mse: {nn ? <span className="ok">{nn.v}</span> : <span className="dim">…</span>}</div>
      <div className="mon-l">🗳 votes: compress {votes['compress-sweep'] ?? 0} · cpu {votes['cpu-duration'] ?? 0}</div>
    </div>
  )
}

export function OptimizationMonitor() {
  const jobs = useStore(s => s.jobs), metrics = useStore(s => s.metrics), lang = useStore(s => s.lang), genome = useStore(s => s.genome)
  const last = (type: string) => Object.values(jobs).filter(j => j.type === type && j.status === 'completed').sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))[0]
  const mem = last('memory')?.output as { rssMB?: number; sysUsedGB?: number } | undefined
  const cpu = metrics['cpu-bench'] ?? [], ratio = metrics['compress'] ?? [], lint = metrics['lint'] ?? [], build = metrics['build-validate'] ?? []
  const arrow = (h: Array<{ v: number }>, d = 0) => h.length > 1 ? `${h[0].v.toFixed(d)} → ${h.at(-1)!.v.toFixed(d)}` : h.length ? h[0].v.toFixed(d) : '…'
  return (
    <div className="mon">
      <div className="mon-t">{'System optimization'}</div>
      <div className="mon-l"><span className="ok">⊘</span> sha256/s: {arrow(cpu)}</div>
      <div className="mon-l"><span className="ok">⊘</span> compression: {arrow(ratio, 2)}x · L{genome?.compressionLevel}</div>
      <div className="mon-l"><span className="ok">⊘</span> rss: {mem?.rssMB?.toFixed(0) ?? '…'} MB</div>
      <div className="mon-l"><span className="ok">⊘</span> lint: {arrow(lint)} · build errors: {build.at(-1)?.v ?? '…'}</div>
    </div>
  )
}
