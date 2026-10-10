import { useTexture } from '@react-three/drei'
import { Suspense } from 'react'

function Plane({ url, position, w, h }: { url: string; position: [number, number, number]; w: number; h: number }) {
  const tex = useTexture(url)
  return <mesh position={position}><planeGeometry args={[w, h]} /><meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.35} /></mesh>
}
/** A generated image the agent chose as its wall poster. */
export default function PosterImage(props: { url: string; position: [number, number, number]; w: number; h: number }) {
  return <Suspense fallback={null}><Plane {...props} /></Suspense>
}
