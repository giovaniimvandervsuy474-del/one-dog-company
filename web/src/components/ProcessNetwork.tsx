import { useMemo } from 'react'
import { useEffect } from 'react'
import { ReactFlow, ReactFlowProvider, Background, useReactFlow, type Node, type Edge, Handle, Position, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '../store'

type Data = { title: string; sub: string; active: boolean; kind: string }
function PNode({ data }: NodeProps) {
  const d = data as Data
  return <div className={`rf-node ${d.active ? 'active' : ''}`}><Handle type="target" position={Position.Left} style={{ opacity: 0 }} /><div className="k">{d.kind}</div><div>{d.title}</div><div className="q">{d.sub}</div><Handle type="source" position={Position.Right} style={{ opacity: 0 }} /></div>
}
const nodeTypes = { p: PNode }
function Fit({ dep }: { dep: number }) {
  const { fitView } = useReactFlow()
  useEffect(() => { const t = setTimeout(() => fitView({ padding: 0.12, duration: 200 }), 60); const onR = () => fitView({ padding: 0.12 }); window.addEventListener('resize', onR); return () => { clearTimeout(t); window.removeEventListener('resize', onR) } }, [dep, fitView])
  return null
}

export default function ProcessNetwork() {
  const jobs = useStore(s => s.jobs), genome = useStore(s => s.genome), eco = useStore(s => s.economy), workspaces = useStore(s => s.workspaces), scribe = useStore(s => s.scribe), scribePhase = useStore(s => s.scribePhase), brainPhase = useStore(s => s.brainPhase)
  const all = Object.values(jobs)
  const running = all.filter(j => j.status === 'running'), queued = all.filter(j => j.status === 'queued')
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [
      { id: 'market', type: 'p', position: { x: 0, y: 60 }, data: { kind: 'external', title: eco?.market.source === 'DEMO' ? 'Market (DEMO)' : 'Solana market', sub: eco ? `+$${eco.incomePerHourUsd.toFixed(3)}/h` : '', active: false } },
      { id: 'economy', type: 'p', position: { x: 150, y: 60 }, data: { kind: 'economy', title: 'Treasury', sub: eco ? `$${eco.treasuryUsd.toFixed(2)} · ${eco.state}` : '', active: eco?.state === 'CRITICAL' } },
      { id: 'brain', type: 'p', position: { x: 300, y: 0 }, data: { kind: 'brain', title: 'Brain', sub: brainPhase === 'llm' ? 'calling planner' : brainPhase, active: brainPhase !== 'idle' } },
      { id: 'sched', type: 'p', position: { x: 300, y: 120 }, data: { kind: 'scheduler', title: 'Scheduler', sub: `${running.length}/${genome?.concurrency ?? '-'} lanes · ${queued.length} queued`, active: running.length > 0 } },
      { id: 'ledger', type: 'p', position: { x: 760, y: 60 }, data: { kind: 'storage', title: 'Ledger', sub: 'chronicle/events', active: false } },
      { id: 'scribe', type: 'p', position: { x: 910, y: 60 }, data: { kind: 'module', title: 'Scribe', sub: scribePhase !== 'idle' ? scribePhase : `${scribe?.commits ?? 0} commits`, active: scribePhase !== 'idle' } },
      { id: 'github', type: 'p', position: { x: 1060, y: 60 }, data: { kind: 'external', title: 'GitHub', sub: scribe?.lastCommit ? scribe.lastCommit.sha.slice(0, 7) : 'no commit yet', active: scribePhase === 'pushing' } },
    ]
    workspaces.forEach((ws, i) => {
      const r = running.filter(j => j.workspace === ws.id).length, q = queued.filter(j => j.workspace === ws.id).length
      const paused = genome?.pausedWorkspaces.includes(ws.id)
      nodes.push({ id: `ws-${ws.id}`, type: 'p', position: { x: 470 + (i % 2) * 150, y: Math.floor(i / 2) * 58 - 40 }, data: { kind: 'worker', title: ws.title, sub: paused ? 'paused' : r ? `${r} running` : q ? `${q} queued` : 'idle', active: r > 0 } })
    })
    const edges: Edge[] = [
      { id: 'm-e', source: 'market', target: 'economy', animated: (eco?.incomePerHourUsd ?? 0) > 0, style: { stroke: '#19f0a0' } },
      { id: 'e-b', source: 'economy', target: 'brain', style: { stroke: '#5ad7ff' } },
      { id: 'b-s', source: 'brain', target: 'sched', animated: brainPhase === 'act', style: { stroke: '#c08cff' } },
      { id: 'l-sc', source: 'ledger', target: 'scribe', animated: scribePhase !== 'idle', style: { stroke: '#ffb347' } },
      { id: 'sc-g', source: 'scribe', target: 'github', animated: scribePhase === 'pushing', style: { stroke: '#ffffff' } },
    ]
    for (const ws of workspaces) { const act = running.some(j => j.workspace === ws.id); edges.push({ id: `s-${ws.id}`, source: 'sched', target: `ws-${ws.id}`, animated: act, style: { stroke: act ? '#19f0a0' : '#2b3a4e' } }, { id: `${ws.id}-l`, source: `ws-${ws.id}`, target: 'ledger', animated: act, style: { stroke: act ? '#5ad7ff' : '#2b3a4e' } }) }
    return { nodes, edges }
  }, [jobs, genome, eco, workspaces, scribe, scribePhase, brainPhase])
  return (
    <div className="panel">
      <div className="panel-h">Process network <span className="right muted">resource flows · {running.length} active workers</span></div>
      <div className="panel-b" style={{ overflow: 'hidden' }}><ReactFlowProvider><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} zoomOnScroll={false} panOnDrag={false} proOptions={{ hideAttribution: true }} colorMode="dark" style={{ background: 'transparent', width: '100%', height: '100%' }}><Fit dep={nodes.length} /><Background color="rgba(140,170,200,0.08)" gap={18} /></ReactFlow></ReactFlowProvider></div>
    </div>
  )
}
