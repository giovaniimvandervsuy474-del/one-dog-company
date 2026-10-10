import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { useMascotState } from '../mascot/useMascotState'
import { STATE_LABEL } from '../mascot/machine'
import { useStore } from '../store'
import Mascot from '../scene/Mascot'

/** Close-up of the same Furry Kitty model and agent-driven expressions. */
export default function LiveCam() {
  const state = useMascotState(), lang = useStore(s => s.lang)
  return <div className="panel cam">
    <div className="panel-h">Live cam <span className="right"><span className="rec" />LIVE</span></div>
    <div className="cam-b">
      <Canvas dpr={1} camera={{ position: [.25, 1.8, 4], fov: 31 }} onCreated={({ camera }) => camera.lookAt(.25, 1.6, .05)} style={{ position: 'absolute', inset: 0 }}>
        <ambientLight intensity={1.8} />
        <directionalLight position={[2, 4, 5]} intensity={2} />
        <Suspense fallback={null}><Mascot size={1} /></Suspense>
      </Canvas>
      <div className="cam-label">{STATE_LABEL[state]}</div>
    </div>
  </div>
}
