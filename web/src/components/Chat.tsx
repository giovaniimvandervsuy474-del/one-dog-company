import { useEffect, useRef, useState } from 'react'
import { post } from '../api'
import { useStore } from '../store'
import { hhmmss } from '../format'

export default function Chat() {
  const chat = useStore(s => s.chat), lang = useStore(s => s.lang)
  const [text, setText] = useState(''), [name, setName] = useState(() => { try { return localStorage.getItem('chatName') ?? '' } catch { return '' } }), [err, setErr] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [chat.length])
  const send = async () => {
    if (!text.trim()) return
    const r = await post<{ ok: boolean; error?: string }>('/api/chat', { name: name || 'anon', text })
    if (!r.ok) setErr(r.error ?? 'error'); else { setErr(''); setText('') }
    try { localStorage.setItem('chatName', name) } catch {}
  }
  return (
    <div className="chat">
      <div className="chat-b" ref={ref}>
        {chat.slice(-40).map(m => <div key={m.id} className={`msg ${m.from}`}><span className="t">{hhmmss(m.ts).slice(0, 5)}</span><b>{m.from === 'ai' ? 'Furry Kitty' : m.name}</b> {m.text.replace(/\/images\/[\w.-]+/g, '').trim()}{m.via && <span className="via"> · {m.via === 'memory' ? 'memory' : m.via === 'gift' ? 'image' : 'llm'}</span>}{(m.text.match(/\/images\/[\w.-]+\.(?:png|jpg)/g) ?? []).map(u => <a key={u} href={u} target="_blank" rel="noreferrer" className="chat-thumb"><img src={u} alt="" loading="lazy" /></a>)}</div>)}
        {!chat.length && <div className="dim" style={{ padding: 6 }}>{'No messages yet. Ask the server how it feels.'}</div>}
      </div>
      <div className="chat-in"><input style={{ width: 70 }} placeholder={'name'} value={name} onChange={e => setName(e.target.value)} /><input placeholder={'Send a message to AI…'} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} /><button className="primary" onClick={send}>➤</button></div>
      {err && <div className="chat-err">{err}</div>}
    </div>
  )
}
