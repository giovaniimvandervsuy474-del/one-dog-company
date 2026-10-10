import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { CHRONICLE } from './paths.ts'
const file = process.env.REQUESTY_BUDGET_FILE ?? path.join(CHRONICLE, 'requesty-budget.json'), hour = 3600000
export type Entry = { id: string; at: number; usd: number; pending: boolean; estimated: boolean }
let entries: Entry[] = [], corrupt = false
try { entries = JSON.parse(fs.readFileSync(file, 'utf8')); if (!Array.isArray(entries) || entries.some(e => !Number.isFinite(e.usd) || e.usd < 0 || !Number.isFinite(e.at))) { corrupt = true; entries = [] } } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') corrupt = true }
export function budgetStatus() {
 const cap = Math.min(15, Math.max(0, Number(process.env.REQUESTY_HOURLY_LIMIT_USD ?? 2) || 0))
 const dailyCap = Math.max(0, Number(process.env.REQUESTY_DAILY_LIMIT_USD ?? 24) || 0)
 const used = entries.filter(e => e.pending || e.at > Date.now()-hour).reduce((a,e)=>a+e.usd,0)
 const dailyUsed = entries.filter(e => e.pending || e.at > Date.now()-24*hour).reduce((a,e)=>a+e.usd,0)
 return {limitUsd:cap,committedUsd:used,remainingUsd:Math.max(0,cap-used),dailyLimitUsd:dailyCap,dailyCommittedUsd:dailyUsed,dailyRemainingUsd:Math.max(0,dailyCap-dailyUsed),reportedCostLastHourUsd:entries.filter(e=>!e.pending&&!e.estimated&&e.at>Date.now()-hour).reduce((s,e)=>s+e.usd,0),estimatedReservationsUsd:entries.filter(e=>e.pending||e.estimated&&e.at>Date.now()-hour).reduce((s,e)=>s+e.usd,0),windowMinutes:60,blocked:corrupt||used>=cap||dailyUsed>=dailyCap,unresolvedRequests:entries.filter(e=>e.pending).length}
}
function save() { entries = entries.filter(e => e.pending || e.at > Date.now()-24*hour); fs.mkdirSync(CHRONICLE,{recursive:true}); fs.writeFileSync(file+'.tmp',JSON.stringify(entries));fs.renameSync(file+'.tmp',file) }
export function reserve(usd: number) { if (corrupt || !Number.isFinite(usd) || usd < 0 || usd > Math.min(budgetStatus().remainingUsd,budgetStatus().dailyRemainingUsd) + 1e-10) throw new Error('Requesty spending limit: insufficient budget or unreadable accounting'); const entry = {id:randomUUID(),at:Date.now(),usd,pending:true,estimated:true};entries.push(entry);try { save() } catch(e) { entries.pop();throw e }return entry.id }
export function settle(id: string, cost?: number) { const e=entries.find(e=>e.id===id);if(!e)return;e.at=Date.now();e.pending=false;if(typeof cost==='number' && Number.isFinite(cost) && cost>=0){e.usd=cost;e.estimated=false}save() }
type Price = { id: string; input_price?: number; output_price?: number; pricing?: Array<Record<string,number>> }
let prices: Price[] = [], pricedAt = 0
async function estimate(body: Record<string,unknown>, headers: HeadersInit | undefined) {
  if (!Array.isArray(body.messages) || body.messages.some(m => typeof m.content !== 'string') || body.tools || body.modalities) throw new Error('Requesty budget: unsupported multimodal/tool billing; request blocked')
  if (Date.now()-pricedAt > 300000) { const r=await fetch('https://router.requesty.ai/v1/models',{headers,signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Requesty pricing unavailable; request blocked');prices=(await r.json()).data;pricedAt=Date.now() }
  const p=prices.find(p=>p.id===body.model);if(!p)throw new Error('Requesty model pricing unknown; request blocked')
  const tiers=[p,...(p.pricing??[])];const input=Math.max(...tiers.flatMap(t=>Object.entries(t).filter(([k,v])=>/^(input_price|caching.*price)$/.test(k)&&typeof v==='number').map(([,v])=>v as number)));const output=Math.max(...tiers.map(t=>t.output_price??0))
  const max=Number(body.max_tokens);if(!Number.isFinite(input)||input<0||!Number.isFinite(output)||output<0||!Number.isInteger(max)||max<=0||max>100000)throw new Error('Requesty cost cannot be bounded; request blocked')
  // UTF-8 byte count is a conservative token ceiling; use the most expensive context/cache tier and extra headroom.
  return Math.max(.001,((Buffer.byteLength(JSON.stringify(body.messages))+4096)*input+max*output)*2)
}
export async function requestyFetch(url: string, init: RequestInit): Promise<Response> {
  const body=JSON.parse(String(init.body));const id=reserve(await estimate(body,init.headers))
  let r: Response
  try { r=await fetch(url,init) } catch(e) {settle(id);throw e}
  if (!r.ok) {settle(id,[400,401,402,403,404,429].includes(r.status)?0:undefined);return r}
  if (!body.stream) {try{const data=await r.clone().json();settle(id,data.usage?.cost)}catch{settle(id)}return r}
  if (!r.body) {settle(id);return r}
  let buffer='', cost: number|undefined;const dec=new TextDecoder()
  const monitor=new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){controller.enqueue(chunk);buffer+=dec.decode(chunk,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()??'';for(const line of lines){if(!line.startsWith('data:'))continue;try{const j=JSON.parse(line.slice(5));if(typeof j.usage?.cost==='number')cost=j.usage.cost}catch{}}},flush(){settle(id,cost)}})
  return new Response(r.body.pipeThrough(monitor),{status:r.status,statusText:r.statusText,headers:r.headers})
}

export function reportedSpendSince(ts:number){return entries.filter(e=>!e.pending&&!e.estimated&&e.at>=ts).reduce((s,e)=>s+e.usd,0)}
