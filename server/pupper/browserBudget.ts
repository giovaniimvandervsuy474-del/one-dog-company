import fs from 'node:fs'
import path from 'node:path'
import { CHRONICLE } from '../paths.ts'
const file = process.env.BROWSER_BUDGET_FILE ?? path.join(CHRONICLE, 'browser-budget.json')
type Entry = {at:number; seconds:number; pending:boolean; id:string}
let entries: Entry[] = [], corrupt = false
try { entries = JSON.parse(fs.readFileSync(file,'utf8')); if (!Array.isArray(entries) || entries.some(e=>!Number.isFinite(e.seconds)||e.seconds<0)) corrupt=true } catch(e) {if((e as NodeJS.ErrnoException).code!=='ENOENT')corrupt=true}
function save(){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(entries));fs.renameSync(file+'.tmp',file)}
export function browserBudget(){for(const e of entries)if(e.pending&&Date.now()>e.at+e.seconds*1000+60000)e.pending=false;const limitMinutes=Math.max(0,Number(process.env.BROWSERBASE_DAILY_MINUTES??60)||0);const usedSeconds=entries.filter(e=>e.pending||e.at>Date.now()-86400000).reduce((s,e)=>s+e.seconds,0);const hourlyRate=Number(process.env.BROWSERBASE_USD_PER_HOUR);return {limitMinutes,usedMinutes:usedSeconds/60,remainingMinutes:Math.max(0,limitMinutes-usedSeconds/60),estimatedCostUsd:Number.isFinite(hourlyRate)&&hourlyRate>=0?usedSeconds/3600*hourlyRate:null,blocked:corrupt||usedSeconds>=limitMinutes*60}}
export function reserveBrowser(seconds:number){if(!Number.isFinite(seconds)||seconds<=0||corrupt||seconds>browserBudget().remainingMinutes*60)throw new Error('Browserbase daily time budget reached');const id=crypto.randomUUID();entries.push({at:Date.now(),seconds,pending:true,id});save();return id}
export function settleBrowser(id:string,seconds:number){const e=entries.find(e=>e.id===id);if(!e)return;e.seconds=Math.min(e.seconds,Math.max(0,seconds));e.pending=false;e.at=Date.now();entries=entries.filter(e=>e.pending||e.at>Date.now()-86400000);save()}
