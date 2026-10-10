import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { t, moodText } from '../i18n'
import { hhmmss } from '../format'

const MOOD: Record<string, [string, string]> = { calm: ['#19f0a0', '◡'], focused: ['#5ad7ff', '—'], anxious: ['#ffb347', '~'], desperate: ['#ff3b5c', '︿'], hopeful: ['#c08cff', '◠'] }

export default function InnerVoice() {
  const events = useStore(s => s.events), lang = useStore(s => s.lang), brainPhase = useStore(s => s.brainPhase), brain = useStore(s => s.brain)
  const lastDecision = [...events].reverse().find(e => e.type === 'brain.decision')
  const decisionId = (lastDecision?.data as { decisionId?: string } | undefined)?.decisionId
  const thoughts = events.filter(e => e.type === 'brain.thought').slice(-12)
  const latestThoughtDecision = (thoughts.at(-1)?.data as { decisionId?: string } | undefined)?.decisionId
  const current = thoughts.filter(e => (e.data as { decisionId?: string }).decisionId === (latestThoughtDecision ?? decisionId))
  const mood = (lastDecision?.data as { mood?: string } | undefined)?.mood ?? 'calm'
  const [typed, setTyped] = useState('')
  const last = current.at(-1)
  useEffect(() => { if (!last) return; let i = 0; setTyped(''); const iv = setInterval(() => { i += 2; setTyped(last.title.slice(0, i)); if (i >= last.title.length) clearInterval(iv) }, 12); return () => clearInterval(iv) }, [last?.id])
  const [c, face] = MOOD[mood] ?? MOOD.calm
  const thinking = brainPhase === 'llm' || brainPhase === 'inspect' || brainPhase === 'act'
  return (
    <div className="panel voice">
      <div className="panel-h"><span className="face" style={{ color: c, borderColor: c }}>{face}</span>{t('innerVoice', lang)} <span className="right"><span style={{ color: c }}>{moodText(mood, lang)}</span><span className="muted"> · {thinking ? t('thinking', lang) : t('waiting', lang)} · #{brain?.cycle ?? 0}</span></span></div>
      <div className="voice-b">
        {current.slice(0, -1).map(e => <div key={e.id} className="thought"><span className="dim">{hhmmss(e.ts)}</span> {e.title}</div>)}
        {last && <div className="thought live"><span className="dim">{hhmmss(last.ts)}</span> {typed}<span className="caret">▍</span></div>}
        {lastDecision && (!latestThoughtDecision || latestThoughtDecision === decisionId) && <div className="thought decision" style={{ borderColor: c }}>{lastDecision.title.replace(/^\[\w+\]\s*/, '')}</div>}
        {!current.length && !lastDecision && <div className="dim">{t('waiting', lang)}</div>}
      </div>
    </div>
  )
}
