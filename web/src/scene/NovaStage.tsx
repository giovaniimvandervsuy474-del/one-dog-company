import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'

const amber = '#ffb26b', lilac = '#b5a0ff'
function Orbit({ radius, tilt, speed }: { radius: number; tilt: number; speed: number }) {
  const ref = useRef<THREE.Group>(null!)
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  useFrame((_, dt) => { if (!reduced) ref.current.rotation.y += Math.min(dt, .05) * speed })
  return <group ref={ref} rotation={[tilt, 0, .3]}>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[radius, .012, 8, 120]} /><meshBasicMaterial color={lilac} transparent opacity={.35} /></mesh>
    <mesh position={[radius, 0, 0]}><octahedronGeometry args={[.065]} /><meshBasicMaterial color={amber} /></mesh>
  </group>
}
function Agent() {
  const body = useRef<THREE.Group>(null!), iris = useRef<THREE.Mesh>(null!), arms = useRef<THREE.Group>(null!)
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const phase = useStore(s => s.brainPhase), jobs = useStore(s => s.jobs), connected = useStore(s => s.connected)
  const working = connected && (['llm', 'act', 'inspect'].includes(phase) || Object.values(jobs).some(j => j.status === 'running'))
  const paused = phase === 'paused'
  useFrame(({ clock, pointer }, dt) => {
    const t = reduced ? 0 : clock.elapsedTime
    body.current.position.y = 2.1 + Math.sin(t * (working ? 1.7 : .7)) * .1
    body.current.rotation.y = THREE.MathUtils.damp(body.current.rotation.y, pointer.x * .35, 3, dt)
    body.current.rotation.z = Math.sin(t * .8) * .035
    iris.current.scale.y = paused ? .15 : Math.sin(t * .8) > .997 ? .08 : 1
    arms.current.rotation.z = Math.sin(t * (working ? 2 : .6)) * .13
  })
  return <group ref={body} position={[0, 2.1, 0]}>
    <mesh><capsuleGeometry args={[.57, .45, 12, 40]} /><meshStandardMaterial color="#c6c1d1" metalness={.85} roughness={.25} /></mesh>
    <mesh position={[0, .13, .47]} scale={[.91, .57, .4]}><sphereGeometry args={[.55, 40, 24]} /><meshStandardMaterial color="#0c0913" metalness={.4} roughness={.19} /></mesh>
    <mesh ref={iris} position={[0, .16, .68]} scale={[1, .7, .4]}><sphereGeometry args={[.16, 24, 16]} /><meshBasicMaterial color={paused ? '#8b779d' : working ? amber : lilac} /></mesh>
    <mesh position={[0, -.1, .675]}><boxGeometry args={[.14, .018, .018]} /><meshBasicMaterial color={amber} /></mesh>
    <mesh position={[0, -.48, .25]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.16, .018, 8, 32]} /><meshBasicMaterial color={lilac} /></mesh>
    <group ref={arms}>
      {[-1, 1].map(side => <group key={side} position={[side * .77, -.05, 0]} rotation={[0, 0, side * -.35]}><mesh scale={[.22, .55, .28]}><octahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#91869c" metalness={.9} roughness={.2} /></mesh><mesh position={[0, -.4, .07]}><sphereGeometry args={[.065, 16, 12]} /><meshBasicMaterial color={amber} /></mesh></group>)}
    </group>
    <mesh position={[0, .96, 0]}><sphereGeometry args={[.065, 16, 12]} /><meshBasicMaterial color={amber} /></mesh>
    <mesh position={[0, .82, 0]}><cylinderGeometry args={[.018, .018, .22, 8]} /><meshStandardMaterial color="#a99baa" metalness={1} roughness={.2} /></mesh>
    <pointLight position={[0, 0, 1]} color={amber} intensity={working ? 3 : 1} distance={4} />
    <group position={[0, -.14, 0]}><Orbit radius={1.17} tilt={.22} speed={working ? .65 : .15} /></group>
  </group>
}
function Station() {
  const compact = useThree(s => s.size.width < 500)
  const jobs = useStore(s => s.jobs), events = useStore(s => s.events), reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const debris = useRef<THREE.Group>(null!)
  const recent = Object.values(jobs).filter(j => j.status === 'running').slice(0, 3)
  useFrame((_, dt) => { if (!reduced) debris.current.rotation.y += Math.min(dt, .05) * .035 })
  return <>
    <color attach="background" args={['#100d18']} /><fog attach="fog" args={['#100d18', 10, 22]} />
    <ambientLight intensity={.9} color="#bcb0dc" /><directionalLight position={[3, 5, 4]} intensity={4} color="#ead8ff" /><pointLight position={[-3, 2, 3]} intensity={17} color="#e99d68" /><pointLight position={[2, 3, -3]} intensity={16} color="#9374ef" />
    <mesh position={[0, -.1, 0]}><cylinderGeometry args={[2.3, 2.65, .35, 12]} /><meshStandardMaterial color="#282132" metalness={.8} roughness={.4} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .1, 0]}><ringGeometry args={[1.95, 2.02, 96]} /><meshBasicMaterial color={amber} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, .2, 0]}><cylinderGeometry args={[.85, 1.1, .22, 12]} /><meshStandardMaterial color="#40334d" metalness={.75} roughness={.25} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .32, 0]}><ringGeometry args={[.65, .74, 64]} /><meshBasicMaterial color={lilac} side={THREE.DoubleSide} /></mesh>
    {[0, 1, 2].map(i => <group key={i} rotation={[0, i * Math.PI * 2 / 3, 0]}><mesh position={[0, .3, 1.4]} rotation={[0, 0, -.18]}><boxGeometry args={[.12, .45, .65]} /><meshStandardMaterial color="#8c7c92" metalness={.8} roughness={.2} /></mesh></group>)}
    <group position={[0, 2, 0]}><Orbit radius={2.8} tilt={.38} speed={reduced ? 0 : -.1} /><Orbit radius={3.35} tilt={-.3} speed={reduced ? 0 : .06} /></group>
    <group ref={debris}>{Array.from({ length: 18 }, (_, i) => { const a = i * 2.399; return <mesh key={i} position={[Math.cos(a) * (3.8 + i % 3 * .45), .5 + (i % 5) * .65, Math.sin(a) * (3.8 + i % 3 * .45)]} rotation={[i, i * .4, i * .6]}><octahedronGeometry args={[.04 + i % 3 * .03]} /><meshStandardMaterial color={i % 3 ? '#5a466e' : '#c6a991'} metalness={.6} roughness={.4} /></mesh> })}</group>
    {[-1, 1].map(side => <group key={side} position={[side * 3.2, .85, -1.8]} rotation={[0, side * -.3, 0]}><mesh><boxGeometry args={[.4, 2.2, .6]} /><meshStandardMaterial color="#292130" metalness={.7} roughness={.3} /></mesh><mesh position={[0, 0, .31]}><boxGeometry args={[.045, 1.6, .01]} /><meshBasicMaterial color={side === 1 ? lilac : amber} /></mesh></group>)}
    <Agent />
    <Html position={compact ? [-1.4, 2.45, .1] : [-2.4, 2.25, .1]} center distanceFactor={7} zIndexRange={[2, 0]}><div className="nova-hologram"><small>EXECUTION QUEUE</small><b>{recent.length ? `${recent.length} процессов` : 'Режим ожидания'}</b>{recent.map(j => <p key={j.id}>{j.title} · {Math.round(j.progress * 100)}%</p>)}{!recent.length && <p>Нет активных задач</p>}</div></Html>
    <Html position={compact ? [1.3, 1.1, .5] : [2.45, 1.3, .5]} center distanceFactor={7} zIndexRange={[2, 0]}><div className="nova-hologram nova-hologram-warm"><small>LAST SIGNAL</small><p>{events.at(-1)?.title ?? 'Ожидает подключения к серверу'}</p></div></Html>
  </>
}
export default function NovaStage() {
  const [view, setView] = useState<'orbit' | 'front'>('front')
  return <div className="stage nova-stage"><Canvas key={view} dpr={[1, 1.5]} camera={{ position: view === 'front' ? [0, 3.6, 8.4] : [5.5, 4.5, 6.5], fov: 45 }} gl={{ antialias: true }}><Station /><OrbitControls target={[0, 1.6, 0]} enablePan={false} minDistance={5} maxDistance={12} minPolarAngle={.5} maxPolarAngle={1.5} enableDamping /></Canvas><div className="nova-camera"><button aria-pressed={view === 'front'} onClick={() => setView('front')}>01 / Портрет</button><button aria-pressed={view === 'orbit'} onClick={() => setView('orbit')}>02 / Орбита</button></div></div>
}
