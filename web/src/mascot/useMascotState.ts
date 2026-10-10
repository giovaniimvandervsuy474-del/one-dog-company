import { useStore } from '../store'
import { baseState, type MascotState } from './machine'

/** Effective mascot state: a transient reaction wins while it lasts, otherwise the state derived from real activity. */
export function useMascotState(): MascotState {
  const eco = useStore(s => s.economy), brainPhase = useStore(s => s.brainPhase), jobs = useStore(s => s.jobs), ov = useStore(s => s.mascotOverride)
  if (ov && ov.until > Date.now()) return ov.state
  return baseState(eco?.state, brainPhase, Object.values(jobs).filter(j => j.status === 'running'))
}
