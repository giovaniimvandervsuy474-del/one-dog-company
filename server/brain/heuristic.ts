import type { BrainContext, Decision, Action } from './schema.ts'

/**
 * Rule-based planner. Runs when no LLM provider is configured, and as the fallback when the LLM is
 * unavailable or over budget. Every rule is deterministic and explainable; the output shape is the
 * same schema the LLM provider must produce, so the rest of the system cannot tell them apart.
 */
export function decide(ctx: BrainContext): Decision {
  const actions: Action[] = []
  const thoughts: string[] = []
  const eco = ctx.economy as { state: string; runwayHours: number | null; treasuryUsd: number; burnPerHourUsd: number; incomePerHourUsd: number; ambitionTier: number }
  const g = ctx.genome as { concurrency: number; compressionLevel: number; compressionAlgo: string; pausedWorkspaces: string[]; jobIntervals: Record<string, number>; cpuBenchDurationMs: number }
  const runway = eco.runwayHours ?? Infinity
  const failed = ctx.recentJobs.filter(j => j.status !== 'completed')
  const failRate = ctx.recentJobs.length ? failed.length / ctx.recentJobs.length : 0
  let mood: Decision['mood'] = 'calm'
  thoughts.push(`Checking vitals: treasury $${eco.treasuryUsd.toFixed(2)}, burn $${eco.burnPerHourUsd.toFixed(3)}/h, income $${eco.incomePerHourUsd.toFixed(3)}/h.`)
  thoughts.push(runway === Infinity ? 'Income covers burn right now; runway is unbounded on this window.' : `At this rate I run out of money in ${runway.toFixed(1)} hours.`)
  thoughts.push(`${ctx.recentJobs.length} jobs finished recently, ${failed.length} of them failed (${(failRate * 100).toFixed(0)}%).`)
  if (eco.ambitionTier > 0) thoughts.push(`Market cap tier ${eco.ambitionTier}: I can afford more lanes.`)

  if (eco.state === 'HIBERNATING') {
    mood = 'desperate'
    if (g.concurrency > 1) actions.push({ kind: 'set_concurrency', value: 1, reason: 'hibernating: single lane only' })
    for (const ws of ['research', 'optimization', 'evolution']) if (!g.pausedWorkspaces.includes(ws)) actions.push({ kind: 'pause_workspace', workspace: ws, reason: 'hibernating: non-essential' })
    actions.push({ kind: 'schedule_job', jobType: 'forecast', reason: 'watch for recovery' })
  } else if (eco.state === 'CRITICAL') {
    mood = 'anxious'
    if (g.concurrency > 2) actions.push({ kind: 'set_concurrency', value: 2, reason: 'critical: cut compute burn' })
    if (!g.pausedWorkspaces.includes('research')) actions.push({ kind: 'pause_workspace', workspace: 'research', reason: 'critical: NN training is a luxury' })
    if ((g.jobIntervals['cpu-bench'] ?? 0) < 60_000) actions.push({ kind: 'set_job_interval', jobType: 'cpu-bench', ms: 60_000, reason: 'critical: fewer benchmarks' })
    actions.push({ kind: 'schedule_job', jobType: 'recovery-check', reason: 'verify we can recover safely' })
  } else if (eco.state === 'STRAINED') {
    mood = 'focused'
    if (g.concurrency > 3) actions.push({ kind: 'set_concurrency', value: 3, reason: 'strained: trim parallelism' })
    if ((g.jobIntervals['nn-train'] ?? 0) < 40_000) actions.push({ kind: 'set_job_interval', jobType: 'nn-train', ms: 40_000, reason: 'strained: slow down research' })
    if (g.cpuBenchDurationMs > 1000) actions.push({ kind: 'schedule_job', jobType: 'forecast', reason: 'strained: refresh runway estimate' })
  } else if (eco.state === 'RECOVERING') {
    mood = 'hopeful'
    const next = g.pausedWorkspaces[0]
    if (next) actions.push({ kind: 'resume_workspace', workspace: next, reason: 'recovering: restore one workspace at a time' })
    else if (g.concurrency < 3) actions.push({ kind: 'set_concurrency', value: g.concurrency + 1, reason: 'recovering: widen lanes gradually' })
  } else {
    // ALIVE
    mood = 'calm'
    if (g.pausedWorkspaces.length) actions.push({ kind: 'resume_workspace', workspace: g.pausedWorkspaces[0], reason: 'alive: nothing should stay paused' })
    const target = 3 + Math.min(2, eco.ambitionTier)
    if (g.concurrency < target && failRate < 0.1) actions.push({ kind: 'set_concurrency', value: g.concurrency + 1, reason: `alive, tier ${eco.ambitionTier}: grow toward ${target} lanes` })
    if ((g.jobIntervals['nn-train'] ?? 0) > 16_000) actions.push({ kind: 'set_job_interval', jobType: 'nn-train', ms: 16_000, reason: 'alive: research back to normal cadence' })
    if ((g.jobIntervals['cpu-bench'] ?? 0) > 14_000) actions.push({ kind: 'set_job_interval', jobType: 'cpu-bench', ms: 14_000, reason: 'alive: benchmarks back to normal cadence' })
  }

  // evolution: run a compression sweep periodically, then adopt the best level
  const exp = ctx.lastExperiment as { ts?: number; best?: { level: number; algo: string; score: number }; rows?: Array<{ level: number; score: number }> } | undefined
  const expAge = exp?.ts ? ctx.now - exp.ts : Infinity
  if (eco.state === 'ALIVE' || eco.state === 'STRAINED') {
    if (expAge > 20 * 60_000) actions.push({ kind: 'run_experiment', experiment: 'compress-sweep', reason: 'evolution: re-measure compression trade-off' })
    else if (exp?.best && (exp.best.level !== g.compressionLevel || exp.best.algo !== g.compressionAlgo)) {
      actions.push({ kind: 'set_compression', level: exp.best.level, algo: exp.best.algo as 'gzip' | 'brotli', reason: `experiment ${new Date(exp.ts!).toISOString().slice(11, 19)} showed level ${exp.best.level} has best ratio/time score ${exp.best.score.toFixed(3)}` })
    }
  }

  // reliability
  if (failRate > 0.25) { actions.push({ kind: 'remember', lesson: `Failure rate hit ${(failRate * 100).toFixed(0)}% at ${new Date(ctx.now).toISOString()}; prefer fewer concurrent jobs.` }); if (g.concurrency > 2) actions.push({ kind: 'set_concurrency', value: g.concurrency - 1, reason: 'reliability: too many failures' }) }
  const lint = ctx.metricTrends['lint']
  if (lint && lint.last > lint.avg * 1.5 && lint.n > 3) actions.push({ kind: 'remember', lesson: `Static findings rose to ${lint.last} (avg ${lint.avg.toFixed(0)})` })
  // self-regulate thinking frequency: think less when strained, more when alive
  const bi = (ctx.genome as { brainIntervalMs: number }).brainIntervalMs
  if ((eco.state === 'CRITICAL' || eco.state === 'HIBERNATING') && bi < 120_000) actions.push({ kind: 'set_brain_interval', ms: 120_000, reason: 'survival: think every 2 minutes to save planning cost' })
  else if (eco.state === 'STRAINED' && bi < 60_000) actions.push({ kind: 'set_brain_interval', ms: 60_000, reason: 'strained: halve planning frequency' })
  else if (eco.state === 'ALIVE' && bi > 30_000) actions.push({ kind: 'set_brain_interval', ms: 30_000, reason: 'alive: normal planning cadence' })
  if (actions.length === 0) actions.push({ kind: 'noop', reason: 'all vitals nominal; conserving budget' })

  if (expAge > 20 * 60_000) thoughts.push('My compression settings are stale; time to re-measure.')
  else if (exp?.best) thoughts.push(`Last sweep says level ${exp.best.level} ${exp.best.algo} is best (score ${exp.best.score.toFixed(3)}).`)
  thoughts.push(actions.length === 1 && actions[0].kind === 'noop' ? 'Nothing needs changing. I will conserve budget.' : `Decided: ${actions.map(a => a.kind.replace(/_/g, ' ')).join(', ')}.`)
  const runwayStr = runway === Infinity ? 'unbounded' : `${runway.toFixed(1)}h`
  const summary = `State ${eco.state}, runway ${runwayStr}, treasury $${eco.treasuryUsd.toFixed(2)}, burn $${eco.burnPerHourUsd.toFixed(3)}/h vs income $${eco.incomePerHourUsd.toFixed(3)}/h. ${actions.length === 1 && actions[0].kind === 'noop' ? 'Holding course.' : `Taking ${actions.length} action(s): ${actions.map(a => a.kind).join(', ')}.`}`
  return { thoughts: thoughts.slice(0, 8), summary, mood, actions: actions.slice(0, 6) }
}
