import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useStore } from '../store'
import { KIND_COLOR } from '../format'
import { axon, brainLayout, fiberGeometry, hash, makeBrain, type BrainPoint } from './brainGeometry'
import { fiberMaterial, neuronMaterial } from './neuralMaterials'
import type { GraphNode } from '../types'

const MAX_SIGNALS = 96, TRAIL = 9, object = new THREE.Object3D(), color = new THREE.Color(), white = new THREE.Color('#d9f4ff')
type Signal = { path: THREE.Vector3[]; t: number; speed: number; color: THREE.Color }
const nodeSize = (node: GraphNode) => node.kind === 'brain' ? .07 : node.kind === 'module' ? .025 : .04
function sample(path: THREE.Vector3[], t: number, target: THREE.Vector3) { const p = Math.min(path.length - 1.00001, Math.max(0, t) * (path.length - 1)), i = Math.floor(p); return target.copy(path[i]).lerp(path[i + 1], p - i) }

function Scene({ mini = false }: { mini?: boolean }) {
  const graph = useStore(s => s.graph), economy = useStore(s => s.economy), quality = useStore(s => s.quality)
  const mode = useStore(s => s.cameraMode), selected = useStore(s => s.selectedNode), scrubTs = useStore(s => s.scrubTs), set = useStore(s => s.set)
  const [hover, setHover] = useState<string | null>(null)
  const positions = useMemo(() => brainLayout(graph), [graph.nodes]), posRef = useRef(positions); posRef.current = positions
  const model = useMemo(() => makeBrain(mini), [mini])
  const cortexMaterial = useMemo(() => fiberMaterial(.72), []), graphMaterial = useMemo(() => fiberMaterial(.35), [])
  const dotsMaterial = useMemo(neuronMaterial, []), signalMaterial = useMemo(neuronMaterial, []), nodeGlowMaterial = useMemo(neuronMaterial, [])
  const nodesRef = useRef<THREE.InstancedMesh>(null!)
  const controls = useRef<{ target: THREE.Vector3; autoRotate: boolean }>(null!)
  const active = useRef<Signal[]>([]), lastPulse = useRef(-1), lastActive = useRef<BrainPoint>([0, 0, 0])
  const temp = useMemo(() => new THREE.Vector3(), []), origin = useMemo(() => new THREE.Vector3(0, -.15, 0), [])
  const pathways = useMemo(() => {
    const paths: THREE.Vector3[][] = [], routes = new Map<string, THREE.Vector3[]>()
    for (const edge of graph.edges) {
      const a = positions.get(edge.from), b = positions.get(edge.to); if (!a || !b) continue
      const path = axon(new THREE.Vector3(...a), new THREE.Vector3(...b), Math.floor(hash(edge.from + edge.to) * 1e8))
      routes.set(edge.from + '→' + edge.to, path); paths.push(path)
    }
    return { geometry: fiberGeometry(paths, 203), routes }
  }, [graph.edges, positions])
  const routeRef = useRef(pathways.routes); routeRef.current = pathways.routes
  const signals = useMemo(() => {
    const geometry = new THREE.BufferGeometry(), capacity = MAX_SIGNALS * TRAIL
    for (const [name, size] of [['position', 3], ['aColor', 3], ['aSize', 1], ['aPower', 1], ['aPhase', 1]] as const) geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(capacity * size), size).setUsage(THREE.DynamicDrawUsage))
    geometry.setDrawRange(0, 0); return geometry
  }, [])
  const nodeGlows = useMemo(() => {
    const geometry = new THREE.BufferGeometry(), count = Math.max(1, graph.nodes.length)
    for (const [name, size] of [['position', 3], ['aColor', 3], ['aSize', 1], ['aPower', 1], ['aPhase', 1]] as const) geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(count * size), size).setUsage(THREE.DynamicDrawUsage))
    geometry.setDrawRange(0, graph.nodes.length); return geometry
  }, [graph.nodes.length])
  const dust = useMemo(() => {
    const geometry = new THREE.BufferGeometry(), points: number[] = []
    for (let i = 0; i < (mini ? 90 : 420); i++) { const a = hash('dust/a/' + i) * Math.PI * 2, y = hash('dust/y/' + i) * 12 - 6, radius = 5 + hash('dust/r/' + i) * 5; points.push(Math.cos(a) * radius, y, Math.sin(a) * radius) }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); return geometry
  }, [mini])
  useEffect(() => {
    const consume = (state: ReturnType<typeof useStore.getState>) => {
      for (const pulse of state.pulses) {
        if (pulse.id <= lastPulse.current) continue; lastPulse.current = pulse.id
        if (pulse.ambient || state.scrubTs !== null || Date.now() - pulse.born > 4000) continue
        const a = posRef.current.get(pulse.from), b = posRef.current.get(pulse.to); if (!a || !b) continue
        const path = routeRef.current.get(pulse.from + '→' + pulse.to) ?? axon(new THREE.Vector3(...a), new THREE.Vector3(...b), pulse.id + 71)
        lastActive.current = b
        if (active.current.length < MAX_SIGNALS) active.current.push({ path, t: 0, speed: .38 + hash(String(pulse.id)) * .25, color: new THREE.Color(pulse.color).lerp(white, .3) })
      }
    }
    consume(useStore.getState()); return useStore.subscribe(consume)
  }, [])
  useEffect(() => () => { model.neurons.dispose(); model.fibers.dispose() }, [model])
  useEffect(() => () => pathways.geometry.dispose(), [pathways])
  useEffect(() => () => nodeGlows.dispose(), [nodeGlows])
  useEffect(() => () => { signals.dispose(); dust.dispose(); cortexMaterial.dispose(); graphMaterial.dispose(); dotsMaterial.dispose(); signalMaterial.dispose(); nodeGlowMaterial.dispose() }, [signals, dust, cortexMaterial, graphMaterial, dotsMaterial, signalMaterial, nodeGlowMaterial])
  useFrame(({ clock, gl, camera }, delta) => {
    const dt = Math.min(delta, .05), now = Date.now(), state = useStore.getState(), time = clock.elapsedTime
    const energy = economy?.state === 'HIBERNATING' ? .28 : ['planning','analyzing','developing'].includes(state.researchPhase) || state.brainPhase === 'llm' || state.brainPhase === 'act' ? 1.25 : .85
    const scale = gl.domElement.height * camera.projectionMatrix.elements[5] * .5
    for (const material of [cortexMaterial, graphMaterial, dotsMaterial, nodeGlowMaterial, signalMaterial]) { material.uniforms.uTime.value = time; material.uniforms.uEnergy.value = energy; if (material.uniforms.uScale) material.uniforms.uScale.value = scale }
    // Bright travelling signals correspond only to actual store events, never synthetic jobs.
    const attrs = signals.attributes; let k = 0
    for (let i = active.current.length - 1; i >= 0; i--) {
      const signal = active.current[i]; signal.t += dt * signal.speed
      if (signal.t > 1.16) { active.current.splice(i, 1); continue }
      for (let tail = 0; tail < TRAIL; tail++) {
        const t = signal.t - tail * .014; if (t < 0 || t > 1) continue
        sample(signal.path, t, temp); const strength = 1 - tail / TRAIL
        attrs.position.setXYZ(k, temp.x, temp.y, temp.z); attrs.aColor.setXYZ(k, signal.color.r, signal.color.g, signal.color.b)
        attrs.aSize.setX(k, tail === 0 ? .42 : .19 * strength); attrs.aPower.setX(k, tail === 0 ? 3.4 : 1.8 * strength); attrs.aPhase.setX(k, 0); k++
      }
    }
    signals.setDrawRange(0, k); for (const attr of Object.values(attrs)) attr.needsUpdate = true
    const mesh = nodesRef.current, ga = nodeGlows.attributes
    graph.nodes.forEach((node, i) => {
      const p = positions.get(node.id)!; const act = Math.max(0, 1 - (now - (state.activity[node.id] ?? 0)) / 2300)
      const focus = node.id === selected || node.id === hover, hidden = scrubTs !== null && node.since > scrubTs
      const radius = hidden ? 0 : nodeSize(node) * (focus ? 1.7 : 1) * (1 + act * .65)
      object.position.set(...p); object.scale.setScalar(radius); object.updateMatrix(); mesh?.setMatrixAt(i, object.matrix)
      color.set('#69caff').lerp(new THREE.Color(KIND_COLOR[node.kind]), .24).lerp(white, Math.max(act, focus ? .8 : 0)); mesh?.setColorAt(i, color.clone().multiplyScalar(1.3 + act * 2))
      ga.position.setXYZ(i, ...p); ga.aColor.setXYZ(i, color.r, color.g, color.b); ga.aSize.setX(i, hidden ? 0 : .3 + act * .5 + (focus ? .25 : 0)); ga.aPower.setX(i, hidden ? 0 : 1.4 + act * 2 + (focus ? 1 : 0)); ga.aPhase.setX(i, hash(node.id) * 6.28)
    })
    for (const attr of Object.values(ga)) attr.needsUpdate = true
    if (mesh) { mesh.count = graph.nodes.length; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true }
    if (controls.current) { controls.current.autoRotate = mini || mode === 'orbit'; temp.copy(origin); if (!mini && mode === 'follow') temp.set(...lastActive.current).multiplyScalar(.38); controls.current.target.lerp(temp, .025) }
  })
  const click = (event: ThreeEvent<MouseEvent>) => { if (mini || event.instanceId === undefined) return; event.stopPropagation(); const node = graph.nodes[event.instanceId]; if (node) set({ selectedNode: node.id === selected ? null : node.id }) }
  const labels = mini ? [] : graph.nodes.filter(n => n.id === selected || n.id === hover)
  return <>
    <color attach="background" args={['#020812']}/>
    <points geometry={dust}><pointsMaterial color="#28769d" size={.018} transparent opacity={.3} blending={THREE.AdditiveBlending} depthWrite={false}/></points>
    <lineSegments geometry={model.fibers} material={cortexMaterial}/>
    <lineSegments geometry={pathways.geometry} material={graphMaterial}/>
    <points geometry={model.neurons} material={dotsMaterial}/>
    <points geometry={nodeGlows} material={nodeGlowMaterial}/>
    <points geometry={signals} material={signalMaterial} frustumCulled={false}/>
    <instancedMesh key={graph.nodes.length} ref={nodesRef} args={[undefined,undefined,Math.max(1,graph.nodes.length)]} onClick={click} onPointerMove={event => { if (mini || event.instanceId === undefined) return; event.stopPropagation(); setHover(graph.nodes[event.instanceId]?.id ?? null); document.body.style.cursor='pointer' }} onPointerOut={() => { setHover(null); document.body.style.cursor='default' }}>
      <sphereGeometry args={[1,12,12]}/><meshBasicMaterial toneMapped={false}/>
    </instancedMesh>
    {labels.map(node => { const p = positions.get(node.id)!; return <Html key={node.id} position={[p[0],p[1]+.22,p[2]]} center zIndexRange={[2,0]}><div className="label3d neural-label">{node.label}</div></Html> })}
    <OrbitControls ref={controls as never} target={[0,-.15,0]} enablePan={false} enableZoom={!mini} enableRotate={!mini} enableDamping dampingFactor={.07} autoRotate autoRotateSpeed={mini ? .55 : .32} minDistance={6} maxDistance={20}/>
    {!mini && quality === 'high' && <EffectComposer multisampling={2}><Bloom luminanceThreshold={1.15} mipmapBlur intensity={.55} radius={.55}/></EffectComposer>}
  </>
}
export default function Core({ mini = false }: { mini?: boolean }) {
  return <Canvas dpr={mini ? 1.5 : 2} camera={{position:mini ? [7,3,9] : [8,3.5,10],fov:43,near:.1,far:80}} gl={{antialias:true,powerPreference:'high-performance',alpha:false}} style={{position:'absolute',inset:0}}><Scene mini={mini}/></Canvas>
}
