import { useEffect, useState } from 'react'
import { get, post } from '../api'
import { useStore } from '../store'
import { ago, hhmmss } from '../format'

type Info = { remote: string | null; repoUrl: string | null; branch: string; head: string | null; ahead: number; lastPush: number | null; lastPushOk: boolean | null; issue: { number: number; url: string; day: string } | null; commentsPosted: number; ghAvailable: boolean }
type Commit = { sha: string; short: string; ts: number; author: string; subject: string; body: string; url: string | null }

export default function GitHubTab() {
  const scribe = useStore(s => s.scribe), scribePhase = useStore(s => s.scribePhase), events = useStore(s => s.events), genome = useStore(s => s.genome)
  const [data, setData] = useState<{ info: Info; commits: Commit[] } | null>(null), [sel, setSel] = useState<Commit | null>(null), [diff, setDiff] = useState('')
  const load = () => get<{ info: Info; commits: Commit[] }>('/api/github').then(setData)
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i) }, [scribe?.commits])
  useEffect(() => { if (sel) get<{ text: string }>(`/api/git/show?sha=${sel.sha}`).then(r => setDiff(r.text)) }, [sel])
  const ghEvents = events.filter(e => e.type.startsWith('github')).slice(-30).reverse()
  const info = data?.info
  return (
    <div className="tabpage github">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <div className="panel"><div className="panel-h">Repository</div><div className="panel-b" style={{ padding: 12 }}>
          <div className="kv">
            <span className="k">remote</span><span className="v">{info?.repoUrl ? <a href={info.repoUrl} target="_blank" rel="noreferrer">{info.repoUrl}</a> : info?.remote ?? <span style={{ color: '#ffb347' }}>no remote yet · commits stay local</span>}</span>
            <span className="k">branch</span><span className="v">{info?.branch}</span>
            <span className="k">HEAD</span><span className="v">{info?.head?.slice(0, 12)}</span>
            <span className="k">unpushed</span><span className="v">{info?.ahead ?? 0} commits</span>
            <span className="k">last push</span><span className="v">{info?.lastPush ? `${ago(info.lastPush)} ago · ${info.lastPushOk ? 'ok' : 'failed'}` : 'never'}</span>
            <span className="k">life-log issue</span><span className="v">{info?.issue ? <a href={info.issue.url} target="_blank" rel="noreferrer">#{info.issue.number} · {info.issue.day}</a> : info?.ghAvailable ? 'created on first push' : 'gh CLI not available'}</span>
            <span className="k">comments</span><span className="v">{info?.commentsPosted ?? 0}</span>
            <span className="k">scribe</span><span className="v">{scribePhase} · every {((genome?.scribeIntervalMs ?? 0) / 60000).toFixed(0)} min · {scribe?.commits ?? 0} commits · {scribe?.pushes ?? 0} pushes</span>
            {scribe?.lastError && <><span className="k">last error</span><span className="v" style={{ color: '#ff8aa0' }}>{scribe.lastError}</span></>}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}><button onClick={() => post('/api/admin/scribe', {})}>commit chronicle now</button></div>
          <p className="dim" style={{ fontSize: 11, marginBottom: 0 }}>What gets committed: <span className="mono">chronicle/</span> (event ledger, digest, decisions, treasury, integrity manifest) and <span className="mono">config/genome.json</span> (self-modified configuration). A commit proves a recorded change, not that anything was "trained".</p>
        </div></div>
        <div className="panel" style={{ flex: 1 }}><div className="panel-h">GitHub activity</div><div className="panel-b"><div className="feed">{ghEvents.map(e => <div key={e.id} className="ev"><span className="t">{hhmmss(e.ts)}</span><span className="s" style={{ background: e.severity === 'success' ? '#19f0a0' : e.severity === 'warn' ? '#ffb347' : '#ff3b5c' }} /><div className="m"><div className="ty">{e.type}</div><div className="ti">{e.title}{e.evidence?.url && <> · <a href={e.evidence.url} target="_blank" rel="noreferrer">open</a></>}</div></div></div>)}{!ghEvents.length && <div className="empty">no GitHub events yet</div>}</div></div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateRows: sel ? '1fr 1fr' : '1fr', gap: 10, minHeight: 0 }}>
        <div className="panel"><div className="panel-h">Evolution timeline · commits <span className="right muted">{data?.commits.length ?? 0} shown</span></div><div className="panel-b">{data?.commits.map(c => <div key={c.sha} className="commit" onClick={() => setSel(c)}><span className="sha">{c.short}</span>{c.subject}<div className="t">{new Date(c.ts).toLocaleString()} · {c.author}{c.url && <> · <a href={c.url} target="_blank" rel="noreferrer">github</a></>}</div></div>)}{!data?.commits.length && <div className="empty">no commits yet — the scribe commits on its interval and on state changes</div>}</div></div>
        {sel && <div className="panel"><div className="panel-h">{sel.short} · {sel.subject} <span className="right"><button onClick={() => setSel(null)}>✕</button></span></div><div className="panel-b"><pre className="term" style={{ margin: 0 }}>{diff || 'loading…'}</pre></div></div>}
      </div>
    </div>
  )
}
