import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { baseState, type MascotState } from '../mascot/machine'
import type { Look } from '../types'
import Accessories from './Accessories'
import { rigPuppy } from './puppyRig'

const DEFAULT_LOOK: Look = { hoodieColor: '#171a24', antennaColor: '#5ad7ff', neonColor: '#8a5cff', hat: 'none', glasses: 'none', badge: 'LFG', deskItems: ['plant', 'mug'], poster: 'JUST BUILD', sticker: '' }

type Expression = { turn: number; tilt: number; lean: number; blink: number; smile: number; surprised: number; frown: number; talk: number; bounce: number; squash: number }
const neutral: Expression = { turn: -.08, tilt: 0, lean: 0, blink: 0, smile: 0, surprised: 0, frown: 0, talk: 0, bounce: 0, squash: 0 }
const expression = (p: Partial<Expression>): Expression => ({ ...neutral, ...p })
const POSES: Record<MascotState, Expression> = {
  idle: expression({}),
  typing: expression({ turn: -.42, lean: .06, blink: .12 }),
  coding: expression({ turn: -.45, lean: .09, blink: .2, tilt: -.025 }),
  browsing: expression({ turn: -.4, tilt: .035 }),
  reading: expression({ turn: -.38, lean: .07, blink: .2 }),
  thinking: expression({ turn: -.2, tilt: .16, blink: .25 }),
  talking: expression({ turn: -.06, smile: .3, talk: 1 }),
  happy: expression({ smile: 1, blink: .35, tilt: -.07, bounce: .035 }),
  frustrated: expression({ frown: 1, blink: .3, tilt: -.09, lean: .08 }),
  surprised: expression({ surprised: 1, lean: -.08, bounce: .025 }),
  sleeping: expression({ blink: 1, tilt: .22, lean: .15, squash: .5 }),
  waking: expression({ surprised: .45, blink: .4, lean: -.08 }),
  celebrating: expression({ smile: 1, blink: .25, bounce: .1, squash: .6 }),
}
const keys = Object.keys(neutral) as Array<keyof Expression>
const morphKeys = ['blink', 'smile', 'surprised', 'frown', 'talk', 'squash', 'earAlert', 'earDroop', 'workPose'] as const

/** User-supplied One Dog Company mascot. Agent events control subtle whole-body poses. */
export default function Mascot({ onState, size = 1.15 }: { onState?: (s: MascotState) => void; size?: number }) {
  const look: Look = { ...DEFAULT_LOOK, ...(useStore(s => s.genome?.look) ?? {}) }
  const { scene, animations } = useGLTF('/models/pupper-executive.glb')
  const { model, faces, rig } = useMemo(() => {
    const model = scene.clone(true)
    const faces: THREE.Mesh[] = []
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      if (object.morphTargetInfluences) {
        object.morphTargetInfluences = [...object.morphTargetInfluences]
        faces.push(object)
      }
    })
    const rig = rigPuppy(model)
    const bounds = new THREE.Box3().setFromObject(model)
    const center = bounds.getCenter(new THREE.Vector3())
    const factor = 2.1 / Math.max(.001, bounds.max.y - bounds.min.y)
    model.scale.setScalar(factor)
    model.position.set(-center.x * factor, -bounds.min.y * factor, -center.z * factor)
    return { model, faces, rig }
  }, [scene])
  const { actions } = useAnimations(animations, model)
  useEffect(() => {
    const typing = actions.Typing
    typing?.reset().setLoop(THREE.LoopRepeat, Infinity).play()
    return () => { typing?.stop() }
  }, [actions])
  const typingBlend = useRef(1)
  const root = useRef<THREE.Group>(null!)
  const pose = useRef<Expression>({ ...neutral })
  const last = useRef<MascotState | null>(null)
  const blink = useRef({ time: 0, next: 2.5 })
  const gaze = useRef(0)
  useFrame((frame, delta) => {
    const dt = Math.min(delta, .05), t = frame.clock.elapsedTime
    const s = useStore.getState(), override = s.mascotOverride
    const state = override && override.until > Date.now() ? override.state : (['starting', 'browsing'].includes(s.researchPhase) ? 'browsing' : s.researchPhase === 'developing' ? 'coding' : ['analyzing','planning','captcha'].includes(s.researchPhase) ? 'thinking' : s.brainPhase === 'paused' ? 'idle' : baseState(s.economy?.state, s.brainPhase, Object.values(s.jobs).filter(j => j.status === 'running')))
    if (state !== last.current) { last.current = state; onState?.(state) }
    const target = POSES[state], p = pose.current, blend = 1 - Math.exp(-dt * 5)
    for (const key of keys) p[key] += (target[key] - p[key]) * blend
    blink.current.time += dt
    let closing = 0
    if (blink.current.time > blink.current.next) {
      const phase = (blink.current.time - blink.current.next) / .2
      closing = phase < 1 ? Math.sin(phase * Math.PI) : 0
      if (phase >= 1) blink.current = { time: 0, next: 2.5 + Math.random() * 3.5 }
    }
    typingBlend.current += ((state === 'sleeping' ? 0 : 1) - typingBlend.current) * blend
    actions.Typing?.setEffectiveWeight(typingBlend.current)
    actions.Typing?.setEffectiveTimeScale(state === 'coding' ? 1.2 : state === 'thinking' ? .75 : 1)
    const working = ['typing', 'coding', 'browsing', 'reading'].includes(state) || (state === 'idle' && s.researchPhase !== 'paused' && t % 8 < 5)
    for (let i = 0; i < rig.elbows.length; i++) {
      const tap = working ? (1 + Math.sin(t * 8 + i * Math.PI)) / 2 : 0
      rig.shoulders[i].rotation.x = .10 + (working ? Math.sin(t * 2 + i) * .014 : 0)
      rig.elbows[i].rotation.x = -.24 + tap * .74
      rig.wrists[i].rotation.x = -.10 + tap * .12
    }
    const values = { ...p, earAlert: p.surprised + p.smile * .3 + (Math.sin(t * 1.4) + 1) * .04, earDroop: state === 'sleeping' ? .9 : p.frown * .75, workPose: typingBlend.current, blink: Math.max(p.blink, closing), talk: p.talk * (.3 + Math.abs(Math.sin(t * 10)) * .7), squash: p.squash * (.5 + Math.sin(t * 8) * .5) }
    for (const mesh of faces) {
      for (const name of morphKeys) {
        const index = mesh.morphTargetDictionary?.[name]
        if (index !== undefined && mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = values[name]
      }
    }
    gaze.current += ((state === 'idle' || state === 'talking' ? s.mouse[0] * .1 : 0) - gaze.current) * blend
    if (root.current) {
      root.current.position.y = .02 + Math.sin(t * (state === 'sleeping' ? 1 : 1.7)) * .012 + Math.abs(Math.sin(t * 7)) * p.bounce + Math.sin(t * 6) * .004 * typingBlend.current
      root.current.rotation.set(p.lean, p.turn + gaze.current, p.tilt + Math.sin(t * .6) * .012)
    }
  })
  return <group ref={root} position={[.25, .02, .05]} scale={size}><primitive object={model} /><Accessories look={look} /></group>
}
useGLTF.preload('/models/pupper-executive.glb')
