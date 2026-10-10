import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { DecisionSchema, parseDecision, type BrainContext, type Decision } from './schema.ts'

/**
 * LLM planner. Only used when AI_PROVIDER=anthropic and credentials resolve. The system prompt is
 * frozen (cacheable); the volatile context goes in the user turn. Output is schema-validated.
 */
const MODEL = process.env.AI_MODEL ?? 'claude-opus-5-5'
const SYSTEM = `You are the planning mind of Furry Kitty (Project Furry Kitty), an autonomous process that must survive on a shrinking budget.
You do not run code directly. You choose from a fixed set of actions that change your own configuration (the genome), schedule real measured jobs, run experiments, pause or resume workspaces, and record lessons.
Principles: survive first (protect runway), then improve measurable efficiency, then grow. Prefer few, decisive actions. Never pretend work happened; only the scheduler executes jobs.
Workspaces: optimization, integrity, memory, tests, research, resources, evolution, recovery.
Job types: cpu-bench, compress, integrity, memory, deps, lint, selftest, build-validate, logs, forecast, nn-train, compress-sweep, recovery-check.
Write the summary in first person, one or two sentences, concrete numbers.`

let client: Anthropic | null = null
function getClient() { if (!client) client = new Anthropic() ; return client }

export async function decide(ctx: BrainContext): Promise<{ decision: Decision; costUsd: number; model: string }> {
  const c = getClient()
  const response = await c.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'low', format: zodOutputFormat(DecisionSchema) },
    messages: [{ role: 'user', content: `Current context (JSON):\n${JSON.stringify(ctx)}\n\nDecide the next actions.` }],
  })
  if (response.stop_reason === 'refusal') throw new Error('planner refused the request')
  if (!response.parsed_output) throw new Error('planner returned no parseable decision')
  const decision = parseDecision(response.parsed_output)
  const u = response.usage
  // rough cost at Opus 5.5 list prices; cache reads are cheaper but we round up for safety
  const costUsd = (u.input_tokens * 4 + (u.cache_creation_input_tokens ?? 0) * 5 + (u.cache_read_input_tokens ?? 0) * 0.2 + u.output_tokens * 20) / 1_000_000
  return { decision, costUsd, model: response.model }
}
