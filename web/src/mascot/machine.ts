import type { Job, LedgerEvent, SurvivalState } from '../types'

export type MascotState = 'idle' | 'typing' | 'coding' | 'browsing' | 'reading' | 'thinking' | 'talking' | 'happy' | 'frustrated' | 'surprised' | 'sleeping' | 'waking' | 'celebrating'
export type Override = { state: MascotState; until: number; reason: string } | null

const JOB_STATE: Record<string, MascotState> = { lint: 'coding', 'build-validate': 'coding', compress: 'coding', 'compress-sweep': 'coding', 'nn-train': 'reading', forecast: 'reading', deps: 'browsing', integrity: 'browsing', logs: 'browsing', 'cpu-bench': 'typing', memory: 'typing', selftest: 'typing', 'recovery-check': 'typing' }

/** Base state is derived from what the backend is really doing right now. */
export function baseState(survival: SurvivalState | undefined, brainPhase: string, running: Job[]): MascotState {
  if (brainPhase === 'paused') return 'sleeping'
  void survival
  if (brainPhase === 'llm' || brainPhase === 'inspect' || brainPhase === 'act') return 'thinking'
  for (const j of running) { const s = JOB_STATE[j.type]; if (s) return s }
  return 'idle'
}

/** Transient reactions to real events. Returns null when the event is not interesting for the body. */
export function reaction(e: LedgerEvent, prevSurvival?: string): Override {
  const now = Date.now()
  const o = (state: MascotState, ms: number): Override => ({ state, until: now + ms, reason: e.type })
  switch (e.type) {
    case 'brain.decision': { const m = (e.data as { mood?: string })?.mood; if (m === 'desperate' || m === 'anxious') return o('frustrated', 2600); if (m === 'hopeful') return o('happy', 1800); return null }
    case 'github.commit': case 'github.push': case 'mission.completed': return o('celebrating', 2600)
    case 'mission.started': return o('surprised', 900)
    case 'genome.mutated': return o('happy', 1500)
    case 'look.changed': return o('celebrating', 2200)
    case 'image.created': case 'writing.done': return o('happy', 2000)
    case 'thought.deep.started': case 'debate.started': return o('thinking', 6000)
    case 'treasury.income': return (e.data as { usd?: number })?.usd && (e.data as { usd: number }).usd > 0.3 ? o('happy', 2000) : null
    case 'chat.reply': case 'chat.say': return o('talking', 4000)
    case 'hypothesis.confirmed': return o('happy', 2000)
    case 'hypothesis.refuted': return o('frustrated', 2000)
    case 'chat.message': case 'visitor.poke': case 'visitor.vote': case 'visitor.question': return o('surprised', 1200)
    case 'job.failed': return o('frustrated', 2200)
    case 'experiment.started': return o('surprised', 900)
    case 'survival.state': { const to = (e.data as { to?: string })?.to; if (prevSurvival === 'HIBERNATING' && to !== 'HIBERNATING') return o('waking', 3000); if (to === 'CRITICAL') return o('frustrated', 3000); if (to === 'ALIVE' || to === 'RECOVERING') return o('happy', 2000); return null }
    default: return null
  }
}

export const STATE_LABEL: Record<MascotState, string> = {
  idle: 'IDLE', typing: 'WORKING...', coding: 'CODING...', browsing: 'CHECKING FILES...', reading: 'STUDYING...', thinking: 'THINKING...', talking: 'REPLYING', happy: 'HAPPY', frustrated: 'FRUSTRATED', surprised: 'SURPRISED', sleeping: 'HIBERNATING', waking: 'WAKING UP', celebrating: 'COMMITTED!',
}
