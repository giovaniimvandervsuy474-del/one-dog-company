import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { useStore } from '../store'

type ScreenKind = 'task' | 'thought' | 'system' | 'experiment' | 'optimization'
type Props = { position: [number, number, number]; rotation?: [number, number, number]; w: number; h: number; kind: ScreenKind; desk?: boolean }
function wrap(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, lineHeight: number, maxLines = 4) {
  const words = value.split(/\s+/); let line = '', row = 0
  for (const word of words) {
    if (ctx.measureText(line + word).width > width && line) {
      ctx.fillText(line.trim(), x, y + row * lineHeight); line = ''; if (++row >= maxLines) return y + row * lineHeight
    }
    line += word + ' '
  }
  if (line) ctx.fillText(line.trim(), x, y + row++ * lineHeight)
  return y + row * lineHeight
}
export default function Monitor({ position, rotation, w, h, kind, desk = false }: Props) {
  const events = useStore(s => s.events), jobs = useStore(s => s.jobs), economy = useStore(s => s.economy), system = useStore(s => s.system), brainPhase = useStore(s => s.brainPhase)
  const brain = useStore(s => s.brain), metrics = useStore(s => s.metrics), genome = useStore(s => s.genome)
  const research = useStore(s => s.research)
  const maxAnisotropy = useThree(s => s.gl.capabilities.getMaxAnisotropy())
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = Math.round(2048 * h / w)
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = maxAnisotropy; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = true
    return { canvas, texture }
  }, [w, h, maxAnisotropy])
  useEffect(() => () => texture.dispose(), [texture])
  useEffect(() => {
    const ctx = canvas.getContext('2d')!; const scale = canvas.width / 1024; const width = 1024, height = canvas.height / scale
    // Draw text at twice the pixel density without changing the physical screen size.
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.fillStyle = '#19141d'; ctx.fillRect(0, 0, width, height)
    const gradient = ctx.createLinearGradient(0, 0, width, height); gradient.addColorStop(0, '#302332'); gradient.addColorStop(1, '#19191f'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#675041'; ctx.fillRect(0, 68, width, 2); ctx.font = 'bold 30px Georgia'; ctx.fillStyle = '#f5e9dc'
    const titles = { task: 'THE BLUEPRINT', thought: 'FIELD JOURNAL', system: 'SYSTEM TELEMETRY', experiment: 'EVIDENCE', optimization: 'PRODUCT LAB' }
    ctx.fillText(titles[kind], 32, 45)
    ctx.font = '18px Arial'; ctx.textAlign = 'right'; ctx.fillStyle = '#edb577'; ctx.fillText('ONE DOG COMPANY / $1DOG', width - 32, 44); ctx.textAlign = 'left'
    if (kind === 'task') {
      ctx.font = 'italic 46px Georgia'; ctx.fillStyle = '#f4d7ac'; wrap(ctx, 'The next useful thing.', 32, 130, width - 64, 50, 1)
      const steps = research?.steps ?? []
      steps.slice(0,4).forEach((step,i) => { const yy = 200+i*94; ctx.fillStyle = step.status === 'running' ? '#654536' : '#302731'; ctx.fillRect(28,yy-34,width-56,78); ctx.font='bold 26px Arial';ctx.fillStyle=step.status==='done'?'#b3c894':'#edb577';ctx.fillText(step.status==='done'?'✓':`0${i+1}`,48,yy);ctx.font='28px Arial';ctx.fillStyle='#f5e9dc';wrap(ctx,step.title,115,yy,width-160,32,1);ctx.font='18px Arial';ctx.fillStyle='#b8a8b8';ctx.fillText(step.status.toUpperCase(),115,yy+27) })
      if (!steps.length) { ctx.font='30px Arial';ctx.fillStyle='#b8a8b8';wrap(ctx,'A small problem. A useful product. Evidence first.',32,205,width-64,45) }
    } else if (kind === 'thought') {
      const activity = events.filter(e => e.type.startsWith('founder.')).slice(-3).reverse()
      ctx.font='italic 46px Georgia';ctx.fillStyle='#f4d7ac';ctx.fillText('Field notes',32,128)
      let yy=205
      for (const item of activity) { ctx.font='21px Arial';ctx.fillStyle='#edb577';ctx.fillText(new Date(item.ts).toLocaleTimeString('en-GB'),32,yy);ctx.font='30px Arial';ctx.fillStyle='#eadfe5'; yy=wrap(ctx,item.title,32,yy+42,width-64,41,2)+45;if(yy>height-35)break }
      if (!activity.length) {ctx.font='30px Arial';ctx.fillStyle='#b8a8b8';wrap(ctx,'Live browser observations appear here.',32,205,width-64,45)}
    } else if (kind === 'experiment') {
      ctx.font='italic 42px Georgia';ctx.fillStyle='#f4d7ac';ctx.fillText('Evidence library',32,128)
      ctx.font='bold 100px Arial';ctx.fillStyle='#edb577';ctx.fillText(String(research?.sources.length??0),32,250)
      ctx.font='24px Arial';ctx.fillStyle='#b8a8b8';ctx.fillText('READABLE SOURCES SAVED',180,215)
      let yy=320
      for (const source of (research?.sources??[]).slice(-3)) {ctx.fillStyle='#eadfe5';ctx.font='29px Arial';yy=wrap(ctx,new URL(source.url).hostname,32,yy,width-64,40,1)+25}
    } else if (kind === 'optimization') {
      ctx.font='italic 42px Georgia';ctx.fillStyle='#f4d7ac';ctx.fillText('From evidence to product',32,128)
      ctx.font='22px Arial';ctx.fillStyle='#edb577';ctx.fillText('NEXT EXPERIMENT',32,205)
      ctx.font='30px Arial';ctx.fillStyle='#eadfe5';wrap(ctx,research?.report?.nextExperiment??'Find one customer problem and verify the evidence before building.',32,255,width-64,46,6)
      ctx.font='22px Arial';ctx.fillStyle='#b8a8b8';ctx.fillText('DEMAND: '+(research?.report?.demand??'UNVALIDATED'),32,height-36)
    } else {
      const rows = [['RESEARCH',research?.status??'CONNECTING'],['SOURCES',String(research?.sources.length??0)],['MEMORY',`${brain?.memory.lessons.length??0} lessons`],['DEVELOPMENT',research?.stage??'waiting']]
      rows.forEach(([label,value],i)=>{const yy=125+i*98;ctx.font='22px Arial';ctx.fillStyle='#b8a8b8';ctx.fillText(label,32,yy);ctx.font='bold 36px Arial';ctx.fillStyle='#f4d7ac';ctx.fillText(value,32,yy+45)})
    }
    texture.needsUpdate = true
  }, [canvas, texture, kind, events, jobs, economy, system, brainPhase, brain, metrics, genome, research])
  return <group position={position} rotation={rotation}>
    <mesh position={[0, 0, -.085]}><boxGeometry args={[w + .15, h + .15, .18]}/><meshStandardMaterial color="#584b48" roughness={.42} metalness={.65}/></mesh>
    <mesh position={[0, 0, .01]}><boxGeometry args={[w + .055, h + .055, .035]}/><meshStandardMaterial color="#211b22" roughness={.5}/></mesh>
    <mesh position={[0, 0, .031]}>
      <planeGeometry args={[w, h]}/><meshBasicMaterial map={texture} toneMapped={false}/>
    </mesh>
    <mesh position={[w / 2 - .1, -h / 2 - .038, .035]}><sphereGeometry args={[.012, 8, 8]}/><meshBasicMaterial color="#efb474" toneMapped={false}/></mesh>
    {desk ? <>
      <mesh position={[0,-h / 2 - .08,-.04]}><boxGeometry args={[.085,.22,.1]}/><meshStandardMaterial color="#344a58" metalness={.75} roughness={.4}/></mesh>
      <mesh position={[0,-h / 2 - .18,0]}><boxGeometry args={[.5,.025,.3]}/><meshStandardMaterial color="#263744" metalness={.75} roughness={.4}/></mesh>
    </> : <>
      <mesh position={[0, 0, -.2]}><boxGeometry args={[.32, .38, .16]}/><meshStandardMaterial color="#263744" metalness={.7} roughness={.4}/></mesh>
      <mesh position={[0, -.3, -.39]} rotation={[-.25, 0, 0]}><boxGeometry args={[.1, .7, .12]}/><meshStandardMaterial color="#344a58" metalness={.75} roughness={.4}/></mesh>
    </>}
    {[-1, 1].flatMap(side => Array.from({ length: 6 }, (_, i) => <mesh key={`${side}-${i}`} position={[side * (w * .28 + i * .045), 0, -.182]}><boxGeometry args={[.018, h * .45, .005]}/><meshStandardMaterial color="#060b11"/></mesh>))}
  </group>
}
