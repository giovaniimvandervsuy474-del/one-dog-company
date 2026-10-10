import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { t, stateText, deathClock, countdown } from '../i18n'
import { usd, STATE_COLOR } from '../format'

export default function Mission() {
  const eco = useStore(s => s.economy), lang = useStore(s => s.lang), brainNextAt = useStore(s => s.brainNextAt), scribeNextAt = useStore(s => s.scribeNextAt), brainPhase = useStore(s => s.brainPhase)
  const [open, setOpen] = useState(true)
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(i) }, [])
  if (!eco) return null
  const life = eco.runwayHours === null ? 100 : Math.max(2, Math.min(100, (eco.runwayHours / 72) * 100))
  const color = STATE_COLOR[eco.state]
  return (
    <div className="panel mission" style={{ ['--state' as string]: color }}>
      <div className="panel-h" style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>{t('mission', lang)} <span className="right muted">{open ? '▾' : '▸'}</span></div>
      {open && <div className="mission-b">
        <p>{t('missionText', lang, { treasury: usd(eco.treasuryUsd), burn: usd(eco.burnPerHourUsd, 3), income: usd(eco.incomePerHourUsd, 3), runway: deathClock(eco.runwayHours, lang) })}</p>
        {eco.demo && <p className="dim">{t('demoNote', lang)}</p>}
      </div>}
      <div className="lifebar"><div className="lifebar-h"><span>{t('life', lang)} · <b style={{ color }}>{stateText(eco.state, lang)}</b></span><span className="num">{t('deathIn', lang)} <b style={{ color }}>{deathClock(eco.runwayHours, lang)}</b></span></div><div className="bar big"><i style={{ width: `${life}%`, background: color, boxShadow: `0 0 12px ${color}` }} /></div></div>
      <div className="countdowns">
        <span>🧠 {t('nextDecision', lang)}: <b className="num">{brainPhase === 'llm' || brainPhase === 'act' ? t('thinking', lang) : countdown(brainNextAt)}</b></span>
        <span>⎇ {t('nextCommit', lang)}: <b className="num">{countdown(scribeNextAt)}</b></span>
      </div>
    </div>
  )
}
