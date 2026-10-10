import { useEffect, useState } from 'react'
import { useStore } from '../store'
import './lifeTimer.css'

export default function LifeTimer() {
  const economy = useStore(s => s.economy)
  const connected = useStore(s => s.connected)
  const lang = useStore(s => s.lang)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const runway = economy?.runwayHours
  const finite = typeof runway === 'number' && Number.isFinite(runway)
  const seconds = finite ? Math.max(0, Math.floor((economy!.ts + runway * 3600000 - now) / 1000)) : 0
  const days = Math.floor(seconds / 86400)
  const time = [Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':')
  const urgent = finite && seconds < 8 * 3600
  return <section className={`life-timer${urgent ? ' urgent' : ''}`} aria-label={'Estimated time left'}>
    <div className="life-timer-caption"><span className="life-timer-beacon" />{'MY TIME LEFT'}</div>
    <div className="life-timer-value" role="timer" aria-live="off">{!economy ? '— — : — — : — —' : !finite ? '∞' : <>{days > 0 && <span className="life-timer-days">{days}{'d'} </span>}{time}</>}</div>
    <div className="life-timer-note">{!connected ? ('Reconnecting to server…') : !finite ? ('Income covers running costs') : ('Estimated from current burn & income')}</div>
  </section>
}
