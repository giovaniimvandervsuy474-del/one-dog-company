import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { get } from '../api'
import { useStore } from '../store'
import { hhmmss } from '../format'

type TreeNode = { name: string; path: string; type: 'file' | 'dir'; size?: number; children?: TreeNode[] }

function Tree({ nodes, sel, onSel, depth = 0 }: { nodes: TreeNode[]; sel: string | null; onSel: (p: string) => void; depth?: number }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ workspace: true, 'workspace/research': true, 'workspace/src': true })
  return <>{nodes.map(n => n.type === 'dir'
    ? <div key={n.path}><div style={{ paddingLeft: depth * 12 }} onClick={() => setOpen(o => ({ ...o, [n.path]: !o[n.path] }))}>{open[n.path] ? '▾' : '▸'} {n.name}/</div>{open[n.path] && n.children && <Tree nodes={n.children} sel={sel} onSel={onSel} depth={depth + 1} />}</div>
    : <div key={n.path} className={sel === n.path ? 'sel' : ''} style={{ paddingLeft: depth * 12 + 10 }} onClick={() => onSel(n.path)}>{n.name}</div>)}</>
}

export default function LiveDesktop() {
  const selectedNode = useStore(s => s.selectedNode), jobs = useStore(s => s.jobs), order = useStore(s => s.jobOrder), brain = useStore(s => s.brain), genome = useStore(s => s.genome)
  const [tree, setTree] = useState<TreeNode[]>([]), [sel, setSel] = useState<string | null>('workspace/README.md'), [file, setFile] = useState<{ content: string; size: number; mtime: number } | null>(null)
  useEffect(() => { const load = () => get<TreeNode[]>('/api/fs/tree').then(setTree); void load(); const timer = setInterval(load,5000); return () => clearInterval(timer) }, [genome?.version])
  useEffect(() => { if (!sel) return; const load = () => get<{ content?: string; size: number; mtime: number; error?: string }>(`/api/fs/read?path=${encodeURIComponent(sel)}`).then(r => setFile(r.content !== undefined ? { content: r.content, size: r.size, mtime: r.mtime } : { content: `// ${r.error}`, size: 0, mtime: 0 })); void load(); const timer = setInterval(load,5000); return () => clearInterval(timer) }, [sel, genome?.version])
  const lang = sel?.endsWith('.ts') || sel?.endsWith('.tsx') ? 'typescript' : sel?.endsWith('.html') ? 'html' : sel?.endsWith('.css') ? 'css' : sel?.endsWith('.json') ? 'json' : sel?.endsWith('.md') ? 'markdown' : 'plaintext'
  const recent = order.slice(-14).map(id => jobs[id]).filter(Boolean).reverse()
  return (
    <div className="tabpage desktop">
      <div className="panel"><div className="panel-h">Sandbox files <span className="right muted">read-only</span></div><div className="panel-b"><div className="tree"><Tree nodes={tree} sel={sel} onSel={setSel} /></div></div></div>
      <div className="panel"><div className="panel-h">{sel ?? 'select a file'} <span className="right muted">{file ? `${file.size} B · ${file.mtime ? hhmmss(file.mtime) : ''}` : ''}</span></div><div className="panel-b" style={{ overflow: 'hidden' }}>{file && <Editor height="100%" language={lang} value={file.content} theme="vs-dark" options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, fontFamily: 'JetBrains Mono', wordWrap: 'on', scrollBeyondLastLine: false }} />}</div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <div className="panel" style={{ flex: 3 }}><div className="panel-h"><span className="live-dot" />Worker terminal <span className="right muted">real stdout of jobs · no scripted text</span></div><div className="panel-b"><div className="term">{recent.map(j => <div key={j.id}><span className="j">[{hhmmss(j.startedAt ?? j.queuedAt)}] {j.id} {j.type} · {j.status}</span>{'\n'}{j.logs.map(l => '  ' + l).join('\n')}{j.error ? `\n  ! ${j.error}` : ''}{'\n'}</div>)}</div></div></div>
        <div className="panel" style={{ flex: 2 }}><div className="panel-h">Agent plan & memory</div><div className="panel-b" style={{ padding: '8px 12px', fontSize: 12 }}>
          <div className="dim" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em' }}>identity</div><p style={{ margin: '2px 0 8px', color: '#c9d6e3' }}>{brain?.memory.identity}</p>
          <div className="dim" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em' }}>goals</div><ul style={{ margin: '2px 0 8px', paddingLeft: 16 }}>{brain?.memory.goals.map(g => <li key={g}>{g}</li>)}</ul>
          <div className="dim" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em' }}>lessons</div><ul style={{ margin: '2px 0', paddingLeft: 16 }}>{brain?.memory.lessons.length ? brain.memory.lessons.slice(-6).map(l => <li key={l}>{l}</li>) : <li className="dim">none yet</li>}</ul>
        </div></div>
      </div>
    </div>
  )
}
