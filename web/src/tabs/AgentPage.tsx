import { useStore } from '../store'

/** The page the server writes for itself. Served from chronicle/page/index.html with scripts stripped and a sandboxed iframe. */
export default function AgentPage() {
  const v = useStore(s => s.pageVersion), lang = useStore(s => s.lang), events = useStore(s => s.events)
  const last = [...events].reverse().find(e => e.type === 'page.updated')
  return (
    <div className="tabpage" style={{ gridTemplateRows: 'auto 1fr' }}>
      <div className="panel" style={{ padding: '8px 12px', flexDirection: 'row', alignItems: 'center', gap: 12, fontSize: 12 }}>
        <b>MY PAGE</b><span className="muted">{'The server writes and rewrites this page itself. Scripts are stripped and the page is sandboxed.'}</span>
        {last && <span className="dim mono" style={{ marginLeft: 'auto' }}>{new Date(last.ts).toLocaleString()} · {(last.data as { summary?: string })?.summary}</span>}
        <a href="/agent/" target="_blank" rel="noreferrer">open ↗</a>
      </div>
      <div className="panel" style={{ background: '#05080d' }}><iframe key={v} src="/agent/" sandbox="" title="agent page" style={{ width: '100%', height: '100%', border: 0, background: '#05080d' }} /></div>
    </div>
  )
}
