import { requestyFetch } from '../requestyBudget.ts'
import { chargeAI } from '../economy.ts'
export function providerSchema(value:any):any{if(Array.isArray(value))return value.map(providerSchema);if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.entries(value).filter(([k])=>!['minLength','maxLength','minItems','maxItems','minimum','maximum','pattern','default','format'].includes(k)).map(([k,v])=>[k,providerSchema(v)]))}
export async function modelJSON(system: string, data: unknown, maxTokens = 1800, signal?: AbortSignal, schema?: Record<string,unknown>) {
  if (!process.env.REQUESTY_API_KEY) throw new Error('Research model is not configured')
  const r = await requestyFetch('https://router.requesty.ai/v1/chat/completions', {
    method: 'POST', headers: { authorization: `Bearer ${process.env.REQUESTY_API_KEY}`, 'content-type': 'application/json' },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000),
    body: JSON.stringify({ model: process.env.REQUESTY_FOUNDER_MODEL ?? 'google/gemini-2.5-flash-lite', max_tokens: maxTokens, temperature: .2, response_format: schema ? { type: 'json_schema', json_schema: { name: 'pupper_output', strict: true, schema:providerSchema(schema) } } : { type: 'json_object' }, messages: [{role:'system',content: system}, {role:'user',content: JSON.stringify(data)}] })
  })
  if (!r.ok) { let detail='';try{const e=await r.json();detail=String(e.error?.message||'').replace(/(?:rqsty-sk-|sk-|ghp_|github_pat_)[A-Za-z0-9+\/=_-]+/g,'[redacted]').slice(0,500)}catch{}throw new Error(`Research model rejected the request (HTTP ${r.status})${detail?': '+detail:''}`) }
  const j = await r.json() as {choices?: {message:{content:string};finish_reason?:string}[];usage?:{cost?:number}}
  if (typeof j.usage?.cost === 'number') chargeAI(j.usage.cost, 'One Dog Company research / development')
  if(j.choices?.[0]?.finish_reason === 'length') throw new Error('Model output exceeded its token budget; shorten the response')
  return JSON.parse(j.choices?.[0]?.message.content ?? '{}') as unknown
}
