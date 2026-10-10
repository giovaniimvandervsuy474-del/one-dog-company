import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import { useStore } from '../store'
import Monitor from './Monitor'
import DeskItem from './DeskItems'
function WorkingKeyboard() {
  const keys = useRef<Array<THREE.Mesh | null>>([])
  useFrame(({ clock }) => {
    const state = useStore.getState()
    const asleep = state.researchPhase === 'paused' || !['starting','browsing','developing'].includes(state.researchPhase) && !['llm','act'].includes(state.brainPhase) && clock.elapsedTime % 8 >= 5
    for (const [index, phase] of [[11, 0], [21, Math.PI]]) {
      const key = keys.current[index]
      if (key) key.position.y = .034 - (asleep ? 0 : Math.max(0, Math.sin(clock.elapsedTime * 8 + phase) - .6) * .03)
    }
  })
  return <group position={[.25,.95,.85]}>
    <mesh><boxGeometry args={[1.35,.05,.43]}/><meshStandardMaterial color="#111c28"/></mesh>
    {Array.from({length:44},(_,i)=><mesh key={i} ref={mesh => { keys.current[i] = mesh }} position={[(i%11-5)*.112,.034,(Math.floor(i/11)-1.5)*.089]}><boxGeometry args={[.09,.022,.064]}/><meshStandardMaterial color="#374c5a" emissive="#4ab5bc" emissiveIntensity={i%5===0?.4:.09}/></mesh>)}
  </group>
}


function Plant({ position, scale = 1 }: { position: [number,number,number]; scale?: number }) {
  return <group position={position} scale={scale}>
    <mesh position={[0,.12,0]}><cylinderGeometry args={[.18,.13,.24,16]}/><meshStandardMaterial color="#756044" roughness={.95}/></mesh>
    {Array.from({length:12},(_,i)=><mesh key={i} position={[Math.sin(i*2.4)*.18,.35+(i%4)*.1,Math.cos(i*2.4)*.16]} rotation={[.3,i*2.4,.65]} scale={[.095,.29,.06]}><sphereGeometry args={[1,12,10]}/><meshStandardMaterial color={i%2?'#587847':'#304a31'} roughness={1}/></mesh>)}
  </group>
}
export default function Room() {
  return <>
    <color attach="background" args={['#14121b']}/><fog attach="fog" args={['#14121b',12,24]}/>
    <ambientLight intensity={1.05} color="#c4accd"/><directionalLight position={[-2,4,4]} intensity={2.1} color="#ffe0b7"/>
    <pointLight position={[-2,2.7,1.3]} color="#ffb46b" intensity={12} distance={9}/><pointLight position={[3,2,-1]} color="#c6a5c9" intensity={7} distance={8}/><pointLight position={[-3,3,-2]} color="#b795b7" intensity={5} distance={7}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.03,0]}><planeGeometry args={[24,24]}/><meshStandardMaterial color="#30252b" roughness={.85}/></mesh>
    {Array.from({length:16},(_,i)=><mesh key={i} position={[(i-8)*.75,-.015,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.016,24]}/><meshBasicMaterial color="#1b1720"/></mesh>)}
    <mesh position={[0,2.8,-4]}><boxGeometry args={[12,7,.15]}/><meshStandardMaterial color="#403638" roughness={.95}/></mesh>
    {/* A framed city window replaces the dark monitor wall. */}
    <mesh position={[0,3.1,-3.85]}><boxGeometry args={[6.5,4.5,.08]}/><meshStandardMaterial color="#091a31" emissive="#203356" emissiveIntensity={.45}/></mesh>
    {Array.from({length:14},(_,i)=>{const h=.7+(i*7%9)*.16;return <group key={i} position={[(i-6.5)*.43,.95,-3.72]}><mesh position={[0,h/2,0]}><boxGeometry args={[.35,h,.07]}/><meshBasicMaterial color={i%2?'#18304b':'#122239'}/></mesh>{Array.from({length:12},(_,j)=><mesh key={j} position={[(j%3-1)*.09,.15+Math.floor(j/3)*.23,.05]}><planeGeometry args={[.03,.065]}/><meshBasicMaterial color={(i+j)%3?'#789eca':'#f1ba78'}/></mesh>)}</group>})}
    {[-3.3,-1.1,1.1,3.3].map(x=><mesh key={x} position={[x,3.1,-3.6]}><boxGeometry args={[.085,4.6,.17]}/><meshStandardMaterial color="#756353" metalness={.3}/></mesh>)}
    {[.83,3.1,5.4].map(y=><mesh key={y} position={[0,y,-3.6]}><boxGeometry args={[6.7,.08,.17]}/><meshStandardMaterial color="#756353" metalness={.3}/></mesh>)}
    {/* Oak workstation with brass hardware. */}
    <mesh position={[0,.85,1.23]}><boxGeometry args={[6.5,.15,1.65]}/><meshStandardMaterial color="#574033" roughness={.7}/></mesh>
    <mesh position={[0,.932,1.23]}><boxGeometry args={[6.4,.012,1.55]}/><meshStandardMaterial color="#886348" roughness={.8}/></mesh>
    {Array.from({length:8},(_,i)=><mesh key={i} position={[0,.942,.52+i*.2]}><boxGeometry args={[6.4,.001,.007]}/><meshBasicMaterial color="#63432e"/></mesh>)}
    {[-2.9,2.9].map(x=><mesh key={x} position={[x,.4,1.23]}><boxGeometry args={[.13,.8,1.4]}/><meshStandardMaterial color="#59432f" metalness={.65}/></mesh>)}
    <group position={[.25,1.2,-.45]}><mesh><boxGeometry args={[1.4,1.7,.26]}/><meshStandardMaterial color="#262637" roughness={.8}/></mesh><mesh position={[0,0,.16]}><boxGeometry args={[1.15,1.4,.07]}/><meshStandardMaterial color="#444051" roughness={.95}/></mesh></group>
    <WorkingKeyboard/>
    {/* Asymmetric compact screens leave the window and plants visible. */}
    <Monitor position={[-1.5,2.85,-1.65]} rotation={[0,.18,0]} w={2.25} h={1.4} kind="thought"/>
    <Monitor position={[1.02,2.95,-1.85]} rotation={[0,-.08,0]} w={2.35} h={1.35} kind="task"/>
    <Monitor position={[2.2,1.5,-.15]} rotation={[0,-.32,0]} w={1.65} h={1.15} kind="optimization"/>
    <Monitor position={[1.0,1.6,-.65]} rotation={[0,-.08,0]} w={1.4} h={1.0} kind="experiment"/>
    <Monitor position={[-1.55,1.48,1.6]} rotation={[0,Math.PI-.55,0]} w={1.0} h={.65} kind="system" desk/>
    <Plant position={[-2.6,.95,.7]} scale={1.25}/><Plant position={[2.8,.95,.75]} scale={.85}/>
    <Plant position={[-3.5,0,-1.8]} scale={2.6}/><Plant position={[3.5,0,-2.5]} scale={2.2}/>
    {/* Shelves, books and hanging greenery frame the workstation. */}
    {[-3.7,3.7].map(side=><group key={side} position={[side,2,-2.7]}>{[0,1.2].map(y=><group key={y} position={[0,y,0]}><mesh><boxGeometry args={[1.1,.09,.6]}/><meshStandardMaterial color="#785238" roughness={.8}/></mesh><DeskItem kind="books" x={-.2} y={.05} z={0}/><Plant position={[.25,.05,0]} scale={.65}/></group>)}</group>)}
    {Array.from({length:20},(_,i)=><group key={i} position={[-3.45+(i%2)*.45,4.6-Math.floor(i/2)*.23,-3.3]}><mesh rotation={[0,0,i*.6]} scale={[.12,.18,.045]}><sphereGeometry args={[1,10,8]}/><meshStandardMaterial color={i%2?'#5c7545':'#334d32'}/></mesh></group>)}
    <group position={[-2.05,.98,.9]}><mesh position={[0,.65,0]}><cylinderGeometry args={[.025,.025,1.3,12]}/><meshStandardMaterial color="#ad8254" metalness={.8}/></mesh><mesh position={[0,1.35,0]}><coneGeometry args={[.32,.3,24,1,true]}/><meshStandardMaterial color="#be945f" metalness={.6} side={THREE.DoubleSide}/></mesh><mesh position={[0,1.25,0]}><sphereGeometry args={[.08,16,12]}/><meshBasicMaterial color="#ffe3a2"/></mesh><pointLight position={[0,1.2,0]} color="#ffc579" intensity={4} distance={4}/></group>
    <DeskItem kind="mug" x={-.8} y={.95} z={1.35}/><DeskItem kind="books" x={2.15} y={.95} z={1.3}/>
    <group position={[1.05,.955,1.65]} rotation={[-Math.PI/2,0,-.12]}><mesh><planeGeometry args={[.65,.4]}/><meshStandardMaterial color="#e8d5b0" roughness={1}/></mesh><Text position={[0,0,.005]} fontSize={.065} color="#564339" maxWidth={.55} textAlign="center">IDEAS → PRODUCT</Text></group>
    <group position={[-2.75,2,-3.45]} rotation={[0,0,.1]}><mesh><planeGeometry args={[.65,.75]}/><meshStandardMaterial color="#d6b983"/></mesh><Text position={[0,0,.01]} fontSize={.075} color="#584330" maxWidth={.55} textAlign="center">BUILD SOMETHING USEFUL</Text></group>
  </>
}
