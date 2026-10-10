import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { t, jobText } from '../i18n'

export default function NowBar() {
  const jobs = useStore(s => s.jobs), lang = useStore(s => s.lang)
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(i) }, [])
  const now = Date.now()
  const all = Object.values(jobs)
  const running = all.filter(j => j.status === 'running')
  const recent = all.filter(j => j.status === 'completed' && j.finishedAt && now - j.finishedAt < 9000).sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)).slice(0, 3)
  return (
    <div className="nowbar">
      <span className="nowbar-k">{t('nowDoing', lang)}</span>
      {running.map(j => <span key={j.id} className="nowbar-i"><span className="live-dot" />{jobText(j.type, lang)} <span className="num dim">{Math.round(j.progress * 100)}%</span></span>)}
      {recent.filter(j => !running.some(r => r.type === j.type)).map(j => <span key={j.id} className="nowbar-i" style={{ opacity: Math.max(0.35, 1 - (now - (j.finishedAt ?? now)) / 9000) }}><span style={{ color: '#19f0a0' }}>✓</span>{jobText(j.type, lang)}{j.metric && <span className="num dim">{j.metric.name} {j.metric.value}{j.metric.unit}</span>}</span>)}
      {!running.length && !recent.length && <span className="nowbar-i dim">{t('idle', lang)}</span>}
    </div>
  )
}
