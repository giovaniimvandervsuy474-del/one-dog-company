import { Suspense, useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useStore } from '../store'
import Room from './Room'
import Mascot from './Mascot'
import { STATE_LABEL, type MascotState } from '../mascot/machine'
function CameraAngle({ rear }: { rear: boolean }) {
  const { camera } = useThree()
  useEffect(() => { camera.position.set(rear ? 0 : .3, rear ? 3.3 : 2.4, rear ? -6.35 : 6.35); camera.lookAt(0, 2.15, 0) }, [rear, camera])
  return null
}
export default function Stage() {
  const quality = useStore(s => s.quality), set = useStore(s => s.set)
  const [rear, setRear] = useState(false), [state, setState] = useState<MascotState>('idle')
  useEffect(() => { const move = (e: MouseEvent) => set({ mouse: [(e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)] }); window.addEventListener('mousemove', move); return () => window.removeEventListener('mousemove', move) }, [set])
  return <div className="stage"><Canvas dpr={[1, 1.5]} camera={{ position: [.3, 2.4, 6.35], fov: 43 }} gl={{ antialias: quality === 'high' }} style={{ position: 'absolute', inset: 0 }}><Suspense fallback={null}><CameraAngle rear={rear} /><Room /><Mascot onState={setState} /><OrbitControls target={[0, 2.15, 0]} enablePan={false} enableDamping minDistance={3} maxDistance={12} minPolarAngle={.9} maxPolarAngle={1.45} />{quality !== 'low' && <EffectComposer><Bloom luminanceThreshold={1.1} mipmapBlur intensity={.38} /></EffectComposer>}</Suspense></Canvas><div className="stage-views"><button aria-pressed={!rear} onClick={() => setRear(false)}>Front</button><button aria-pressed={rear} onClick={() => setRear(true)}>Back</button></div><div className="stage-state">{STATE_LABEL[state]}</div></div>
}
