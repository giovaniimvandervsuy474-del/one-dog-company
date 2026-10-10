import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
function Network() {
  const graph = useStore(s => s.graph), activity = useStore(s => s.activity), selected = useStore(s => s.selectedNode), set = useStore(s => s.set)
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const shell = useRef<THREE.Group>(null!)
  const points = useMemo(() => graph.nodes.map((_, i) => { const a = i * 2.39996, y = 1 - (i + .5) * 2 / Math.max(1, graph.nodes.length), r = Math.sqrt(1 - y * y); return new THREE.Vector3(Math.cos(a) * r * 1.7, y * 1.7, Math.sin(a) * r * 1.7) }), [graph.nodes])
  const links = useMemo(() => { const positions: number[] = []; const byId = new Map(graph.nodes.map((n, i) => [n.id, points[i]])); for (const e of graph.edges) { const a = byId.get(e.from), b = byId.get(e.to); if (a && b) positions.push(...a.toArray(), ...b.toArray()) } return new Float32Array(positions) }, [graph, points])
  useFrame((_, dt) => { if (!reduced) shell.current.rotation.y += Math.min(dt, .05) * .08 })
  return <><color attach="background" args={['#15101e']} /><ambientLight intensity={2} /><pointLight position={[3, 3, 3]} intensity={15} color="#cfb9ff" /><group ref={shell}>
    <mesh><icosahedronGeometry args={[.6, 1]} /><meshStandardMaterial color="#a88dcc" metalness={.9} roughness={.2} /></mesh><mesh><icosahedronGeometry args={[.8, 1]} /><meshBasicMaterial color="#ffb26b" wireframe transparent opacity={.45} /></mesh>
    {[0, 1, 2].map(i => <mesh key={i} rotation={[i * .8, i * .4, .5]}><torusGeometry args={[1.25 + i * .25, .008, 6, 100]} /><meshBasicMaterial color={i === 1 ? '#ffb26b' : '#ab8cf5'} transparent opacity={.5} /></mesh>)}
    <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[links, 3]} /></bufferGeometry><lineBasicMaterial color="#ad84e0" transparent opacity={.35} /></lineSegments>
    {graph.nodes.map((n, i) => <mesh key={n.id} position={points[i]} onClick={e => { e.stopPropagation(); set({ selectedNode: n.id === selected ? null : n.id }) }}><octahedronGeometry args={[n.id === selected ? .16 : .09]} /><meshBasicMaterial color={n.id === selected || Date.now() - (activity[n.id] ?? 0) < 2500 ? '#ffc184' : '#c6b6e5'} /></mesh>)}
  </group><OrbitControls enablePan={false} enableZoom={false} target={[0, 0, 0]} /></>
}
export default function NovaCore({ mini = false }: { mini?: boolean }) { return <Canvas camera={{ position: [3.4, 2, 4.8], fov: 45 }} dpr={[1, mini ? 1 : 1.5]} style={{ position: 'absolute', inset: 0 }}><Network /></Canvas> }
