import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { explainText } from '../i18n'

export default function Toasts() {
  const toasts = useStore(s => s.toasts), lang = useStore(s => s.lang), events = useStore(s => s.events)
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick(x => x + 1), 500); return () => clearInterval(i) }, [])
  const live = toasts.filter(t => Date.now() - t.ts < 6000)
  return <div className="toasts">{live.map(t => { const ev = [...events].reverse().find(e => e.title === t.title); return <div key={t.id} className="toast" style={{ borderColor: t.color }}><span className="toast-i" style={{ color: t.color }}>{t.icon}</span><div><div className="toast-t">{t.title}</div>{ev && <div className="toast-e">{explainText(ev.type, lang)}</div>}</div></div> })}</div>
}
