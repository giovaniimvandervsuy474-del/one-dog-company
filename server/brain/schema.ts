import { z } from 'zod'

export const ActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('schedule_job'), jobType: z.string(), reason: z.string() }),
  z.object({ kind: z.literal('set_concurrency'), value: z.number().int().min(1).max(8), reason: z.string() }),
  z.object({ kind: z.literal('set_job_interval'), jobType: z.string(), ms: z.number().int().min(10_000).max(3_600_000), reason: z.string() }),
  z.object({ kind: z.literal('set_brain_interval'), ms: z.number().int().min(5_000).max(600_000), reason: z.string() }),
  z.object({ kind: z.literal('set_compression'), level: z.number().int().min(1).max(11), algo: z.enum(['gzip', 'brotli']), reason: z.string() }),
  z.object({ kind: z.literal('pause_workspace'), workspace: z.string(), reason: z.string() }),
  z.object({ kind: z.literal('resume_workspace'), workspace: z.string(), reason: z.string() }),
  z.object({ kind: z.literal('run_experiment'), experiment: z.enum(['compress-sweep', 'cpu-duration']), reason: z.string() }),
  z.object({ kind: z.literal('set_goal'), goal: z.string(), reason: z.string() }),
  z.object({ kind: z.literal('remember'), lesson: z.string() }),
  z.object({ kind: z.literal('noop'), reason: z.string() }),
  z.object({ kind: z.literal('choose_mission'), mission: z.string().max(40), reason: z.string() }),
  z.object({ kind: z.literal('custom_mission'), title: z.string().max(120), why: z.string().max(400), steps: z.array(z.discriminatedUnion('op', [
    z.object({ op: z.literal('job'), jobType: z.string(), title: z.string().max(60).optional() }),
    z.object({ op: z.literal('wait'), seconds: z.number().int().min(5).max(300), title: z.string().max(60).optional() }),
    z.object({ op: z.literal('set'), key: z.enum(['concurrency', 'compressionLevel', 'compressionAlgo', 'cpuBenchDurationMs', 'nnLearningRate']), value: z.union([z.number(), z.string()]), title: z.string().max(60).optional() }),
    z.object({ op: z.literal('measure'), metric: z.string(), title: z.string().max(60).optional() }),
    z.object({ op: z.literal('note'), text: z.string().max(600), title: z.string().max(60).optional() }),
    z.object({ op: z.literal('write'), prompt: z.string().max(400), file: z.string().max(60), title: z.string().max(60).optional() }),
  ])).min(2).max(12) }),
  z.object({ kind: z.literal('save_mission'), name: z.string().max(30), title: z.string().max(80), why: z.string().max(200), steps: z.array(z.record(z.string(), z.unknown())).min(2).max(12) }),
  z.object({ kind: z.literal('set_planner'), model: z.enum(['fast', 'smart']), reason: z.string() }),
  z.object({ kind: z.literal('deep_think'), topic: z.string().max(600) }),
  z.object({ kind: z.literal('debate'), question: z.string().max(600) }),
  z.object({ kind: z.literal('imagine'), prompt: z.string().max(800), purpose: z.string().max(300).transform(p => (['portrait', 'poster', 'meme', 'scene', 'gift'].includes(p) ? p : /poster|wall/i.test(p) ? 'poster' : /self|portrait|me\b/i.test(p) ? 'portrait' : /meme|joke/i.test(p) ? 'meme' : /gift|visitor/i.test(p) ? 'gift' : 'scene') as 'portrait' | 'poster' | 'meme' | 'scene' | 'gift') }),
  z.object({ kind: z.literal('write'), genre: z.string().max(30).transform(g => (['story', 'letter', 'essay', 'faq', 'report', 'poem', 'manifesto'].includes(g) ? g : /report|status|update/i.test(g) ? 'report' : /poem|verse/i.test(g) ? 'poem' : /letter|note/i.test(g) ? 'letter' : /story|tale/i.test(g) ? 'story' : /faq|question/i.test(g) ? 'faq' : /manifest/i.test(g) ? 'manifesto' : 'essay') as 'story' | 'letter' | 'essay' | 'faq' | 'report' | 'poem' | 'manifesto'), topic: z.string().max(600) }),
  z.object({ kind: z.literal('set_spend_target'), usdPerHour: z.number().min(0).max(500), reason: z.string() }),
  z.object({ kind: z.literal('write_page'), html: z.string().max(60_000), summary: z.string().max(120) }),
  z.object({ kind: z.literal('customize_look'), changes: z.object({
    hoodieColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), antennaColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), neonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    hat: z.enum(['none', 'cap', 'beanie', 'crown', 'halo', 'propeller']).optional(), glasses: z.enum(['none', 'round', 'shades', 'visor']).optional(),
    badge: z.string().max(4).optional(), deskItems: z.array(z.enum(['plant', 'mug', 'rubber-duck', 'books', 'lava-lamp', 'cat', 'trophy', 'radio'])).max(5).optional(),
    poster: z.string().max(40).optional(), sticker: z.string().max(20).optional(),
  }), reason: z.string() }),
  z.object({ kind: z.literal('hypothesis'), statement: z.string().max(400), metric: z.enum(['cpu-bench', 'compress', 'lint', 'selftest', 'nn-train', 'memory', 'forecast', 'burn', 'income']), expect: z.enum(['up', 'down']), checkAfterMinutes: z.number().int().min(2).max(120) }),
  z.object({ kind: z.literal('write_note'), file: z.string().max(60), text: z.string().max(4000) }),
  z.object({ kind: z.literal('talk'), message: z.string().max(600) }),
  z.object({ kind: z.literal('set_motto'), text: z.string().max(80), reason: z.string() }),
  z.object({ kind: z.literal('set_param'), key: z.enum(['cpuBenchDurationMs', 'nnLearningRate']), value: z.number(), reason: z.string() }),
])
export type Action = z.infer<typeof ActionSchema>

export const DecisionSchema = z.object({
  thoughts: z.array(z.string()).max(20).catch([]).describe('3-6 short first-person reasoning steps, in order'),
  summary: z.string().describe('One sentence, first person, what I decided and why'),
  mood: z.enum(['calm', 'focused', 'anxious', 'desperate', 'hopeful']),
  actions: z.array(z.unknown()).max(20).catch([]),
})
export type Decision = Omit<z.infer<typeof DecisionSchema>, 'actions'> & { actions: Action[]; invalid?: Array<{ action: unknown; error: string }> }
/** Keeps every valid action and reports the invalid ones instead of dropping the whole list. */
export function parseDecision(raw: unknown): Decision {
  const base = DecisionSchema.parse(raw)
  const actions: Action[] = []; const invalid: Array<{ action: unknown; error: string }> = []
  for (const a of base.actions) { const r = ActionSchema.safeParse(a); if (r.success) actions.push(r.data); else invalid.push({ action: a, error: r.error.issues[0]?.message ?? 'invalid' }) }
  return { ...base, actions, invalid }
}

export type BrainContext = {
  now: number
  economy: Record<string, unknown>
  genome: Record<string, unknown>
  recentJobs: Array<{ type: string; status: string; durationMs?: number; metric?: unknown; error?: string }>
  metricTrends: Record<string, { last: number; avg: number; n: number }>
  lastExperiment?: Record<string, unknown>
  missions: { active: unknown; recent: Array<{ key: string; status: string; outcome?: string; minutesAgo: number }> }
  hypotheses: Array<{ statement: string; metric: string; expect: string; result?: string; minutesLeft?: number }>
  notes: string[]
  audience: { online: number; lastHour: Record<string, number> }
  library: string[]
  look: unknown
  budget: { targetPerHour: number; spentThisHour: number; spentLast10Min: number; spentToday: number; paceStatus: string }
  studio: { deepThinking: boolean; debating: boolean; images: number; lastImages: string[]; writings: string[]; thoughts: string[] }
  page: { exists: boolean; bytes?: number; updatedMinutesAgo?: number; summary?: string }
  memory: { identity: string; goals: string[]; lessons: string[]; lastDecisions: string[]; motto: string }
  stats: Record<string, number>
}
