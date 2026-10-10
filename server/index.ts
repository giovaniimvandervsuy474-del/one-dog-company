import { githubStatus, syncProject, startGithubSync } from './pupper/githubSync.ts'
import { productHTML } from './pupper/productSDK.ts'
import { productData } from './pupper/productData.ts'
import { catalog, productFile, enrichBusinessPlans } from './pupper/products.ts'
import './env.ts'
import { budgetStatus } from './requestyBudget.ts'
import * as founder from './founder.ts'
import { developmentStatus, preview, previewCSP } from './pupper/development.ts'
import { researchGraph } from './pupper/graph.ts'
import { pumpFees, startFees } from './pupper/fees.ts'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { bus } from './bus.ts'
import { append, loadRecent, recent, since } from './ledger.ts'
import { loadGenome, getGenome } from './genome.ts'
import * as economy from './economy.ts'
import * as sched from './scheduler.ts'
import * as brain from './brain/index.ts'
import * as scribe from './scribe.ts'
import * as modules from './modules.ts'
import * as gh from './github.ts'
import * as chat from './chat.ts'
import * as vitals from './vitals.ts'
import * as missions from './missions.ts'
import * as admin from './admin.ts'
import * as creative from './creative.ts'
import * as pacer from './pacer.ts'
import { ROOT } from './paths.ts'
import type { LedgerEvent } from './types.ts'

const PORT = Number(process.env.PORT ?? 4000)
const bootTs = Date.now()

// ---------- boot ----------
loadGenome()
loadRecent()
economy.loadEconomy()
sched.registerDefaults({
  getState: economy.getState,
  charge: economy.charge,
  treasurySeries: economy.treasurySeries,
  incomeSeries: economy.incomeSeries,
  selftestSnapshot: () => ({ genome: getGenome(), economy: economy.snapshot(), eventIds: recent(200).map(e => e.id), eventCount: recent(1).length, jobStats: sched.stats }),
})
modules.init()
brain.start()
if (process.env.FOUNDER_ONLY !== '1') scribe.start()
vitals.start()
if (process.env.FOUNDER_ONLY !== '1') missions.start()
if (process.env.FOUNDER_ONLY !== '1') pacer.start()
founder.start()
startGithubSync()
startFees()
pacer.bindPaused(() => brain.paused)
if (process.env.FOUNDER_ONLY !== '1') setInterval(sched.tick, 1000)
append({ type: 'system.boot', source: 'system', severity: 'success', title: `PUPPER FOUNDER booted · genome v${getGenome().version} · ${sched.jobDefs().length} job types · provider ${getGenome().aiProvider}`, data: { pid: process.pid, node: process.version } })

// ---------- helpers ----------
type Res = http.ServerResponse
function json(res: Res, body: unknown, status = 200) { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(body)) }
function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> { return new Promise(resolve => { let b = ''; req.on('data', c => { b += c; if (b.length > 10_000) req.destroy() }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')) } catch { resolve({}) } }) }) }
const rate = new Map<string, number>()
function limited(key: string, ms: number) { const now = Date.now(); const last = rate.get(key) ?? 0; if (now - last < ms) return true; rate.set(key, now); return false }

function links() {
  const mint = (process.env.FOUNDER_ONLY === '1' ? process.env.PUPPER_TOKEN_MINT : process.env.TOKEN_MINT) || null, wallet = (process.env.FOUNDER_ONLY === '1' ? process.env.PUPPER_CREATOR_WALLET : process.env.TREASURY_WALLET) || null
  return { mint, wallet, live: process.env.MARKET_SOURCE === 'solana', github: process.env.FOUNDER_ONLY === '1' ? null : 'https://github.com/barongmlabadieohx203-spec/Project-Furry-Kitty',
    pumpfun: mint ? `https://pump.fun/coin/${mint}` : null, dexscreener: mint ? `https://dexscreener.com/solana/${mint}` : null, solscanMint: mint ? `https://solscan.io/token/${mint}` : null, solscanWallet: wallet ? `https://solscan.io/account/${wallet}` : null }
}
function snapshot() {
  return { links: links(), ts: Date.now(), bootTs, events: recent(400).filter(e => process.env.FOUNDER_ONLY !== '1' || (e.type.startsWith('founder.') || e.type.startsWith('system.') || e.type === 'brain.lesson') && e.ts >= brain.status().memory.born), economy: economy.snapshot(), genome: getGenome(), jobs: sched.listJobs(120), workspaces: sched.WORKSPACES, jobDefs: sched.jobDefs().map(d => ({ type: d.type, title: d.title, workspace: d.workspace, essential: d.essential, costUnits: d.costUnits })),
    graph: process.env.FOUNDER_ONLY === '1' ? researchGraph() : modules.get(), brain: brain.status(), stats: sched.stats, metrics: sched.allMetrics(), scribe: { ...scribe.scribeStats, nextAt: scribe.nextAt }, stateHistory: economy.stateHistory(), marketSeries: economy.marketSeries(), missions: missions.status(), gallery: creative.gallery().slice(-24).reverse(), chat: chat.list(60), vitals: { mood: vitals.mood(), system: vitals.system(), day: Math.floor((Date.now() - brain.status().memory.born) / 86400_000) + 1 }, online: clients.size }
}

// ---------- SSE ----------
const clients = new Set<Res>()
function sse(res: Res, event: string, data: unknown) { const s = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`; vitals.countBytes(s.length); res.write(s) }
bus.on('ledger', (e: LedgerEvent) => { if(process.env.FOUNDER_ONLY==='1' && !e.type.startsWith('founder.') && !e.type.startsWith('system.') && e.type!=='brain.lesson') return; for (const c of clients) sse(c, 'ledger', e) })
bus.on('telemetry', t => { for (const c of clients) sse(c, 'telemetry', t) })
setInterval(() => { for (const c of clients) c.write(': ping\n\n') }, 15_000)

// ---------- static (production) ----------
const DIST = path.join(ROOT, 'dist', 'web')
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' }
function serveStatic(req: http.IncomingMessage, res: Res) {
  let p = path.join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]))
  if (!p.startsWith(DIST)) { res.writeHead(403); res.end(); return }
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIST, 'index.html')
  if (!fs.existsSync(p)) { res.writeHead(404); res.end('build the web app first: npm run build'); return }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] ?? 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
}

// ---------- read-only fs for Live Desktop ----------
const FS_ALLOW = process.env.FOUNDER_ONLY === '1' ? ['workspace'] : ['server', 'web/src', 'chronicle', 'config', 'package.json', 'README.md']
function fsSafe(rel: string) { const abs = path.resolve(ROOT, rel); if (!FS_ALLOW.some(a => abs === path.join(ROOT, a) || abs.startsWith(path.join(ROOT, a) + path.sep))) return null; if (abs.includes('node_modules')) return null; if (fs.existsSync(abs)) { const real = fs.realpathSync(abs); if (!FS_ALLOW.some(a => real === path.join(ROOT,a) || real.startsWith(path.join(ROOT,a)+path.sep))) return null }; return abs }
function tree(rel: string, depth = 0): unknown {
  const abs = fsSafe(rel); if (!abs || !fs.existsSync(abs)) return null
  const st = fs.statSync(abs)
  if (!st.isDirectory()) return { name: path.basename(rel), path: rel, type: 'file', size: st.size, mtime: st.mtimeMs }
  const children = depth > 4 ? [] : fs.readdirSync(abs).filter(n => !n.startsWith('.') && n !== 'node_modules').sort().map(n => tree(path.posix.join(rel, n), depth + 1)).filter(Boolean)
  return { name: path.basename(rel) || rel, path: rel, type: 'dir', children }
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const p = url.pathname
  if (process.env.FOUNDER_ONLY === '1' && req.method !== 'GET' && req.method !== 'OPTIONS' && !p.startsWith('/api/admin/') && p !== '/api/products/data') { json(res,{error:'Read-only spectator'},403); return }
  if (process.env.FOUNDER_ONLY === '1' && ['/api/chat','/api/visitor/poke','/api/visitor/vote','/api/github','/api/git/show','/api/studio','/api/gallery','/api/page'].includes(p)) { json(res,{error:'Not available in One Dog Company'},404); return }
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST' }); res.end(); return }
    if (p === '/api/stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' })
      sse(res, 'snapshot', snapshot())
      clients.add(res)
      brain.setOnline(clients.size)
      for (const c of clients) sse(c, 'telemetry', { channel: 'presence', payload: { online: clients.size } })
      req.on('close', () => { clients.delete(res); brain.setOnline(clients.size); for (const c of clients) sse(c, 'telemetry', { channel: 'presence', payload: { online: clients.size } }) })
      return
    }
    if (p === '/api/project-github') return json(res, githubStatus())
    if (p === '/api/health') return json(res, { ok: true, uptimeSeconds: Math.floor((Date.now()-bootTs)/1000), research: founder.status().status, paused: founder.status().paused, development: developmentStatus().status })
    if (p === '/api/pump-fees') return json(res, pumpFees())
    if(p === '/api/products/data'){const id=url.searchParams.get('id')||'';if(!catalog().products.some(p=>p.id===id))return json(res,{error:'Unknown product'},404);if(!['GET','POST'].includes(req.method||''))return json(res,{error:'Method not allowed'},405);try{const body=req.method==='POST'?await readBody(req):null;return json(res,productData(id,String(req.headers.authorization||''),body?body.data:undefined))}catch(e){return json(res,{error:e instanceof Error?e.message:'Workspace unavailable'},400)}}
    if (p === '/api/products') return json(res, catalog())
    if (p === '/api/products/preview' || p === '/api/products/image') { const image=p.endsWith('/image');const data=productFile(url.searchParams.get('id')||'',image?'preview.png':'index.html');res.writeHead(data?200:404,{'content-type':image?'image/png':'text/html; charset=utf-8',...(image?{}:{'content-security-policy':previewCSP}),'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(data?(image?data:productHTML(data.toString())):'Product not found');return }
    if (p === '/api/development') return json(res, developmentStatus())
    if (p === '/api/development/preview') { const html = preview(); res.writeHead(html ? 200 : 404, {'content-type':'text/html; charset=utf-8','content-security-policy':previewCSP,'cache-control':'no-store','x-content-type-options':'nosniff'}); res.end(html ? productHTML(html) : '<h1>No tested prototype yet</h1>'); return }
    if (p === '/api/requesty-budget') return json(res, budgetStatus())
    if (p === '/api/founder') return json(res, founder.status())
    if (p === '/api/founder/frame') { const frame = founder.frame(); if (!frame) return json(res, { error: 'No frame yet' }, 404); res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store' }); res.end(frame); return }
    if (p === '/api/snapshot') return json(res, snapshot())
    if (p === '/api/events') { const limit = Number(url.searchParams.get('limit') ?? 300); const s = Number(url.searchParams.get('since') ?? 0); const type = url.searchParams.get('type'); return json(res, (s ? since(s) : recent(limit)).filter(e => !type || e.type.startsWith(type)).slice(-limit)) }
    if (p === '/api/economy') return json(res, economy.snapshot())
    if (p === '/api/economy/history') return json(res, { history: economy.history().slice(-1500), states: economy.stateHistory(), ledger: economy.cashLedger(300) })
    if (p === '/api/jobs') return json(res, sched.listJobs(200))
    if (p.startsWith('/api/jobs/')) { const j = sched.getJob(p.slice(10)); return j ? json(res, j) : json(res, { error: 'not found' }, 404) }
    if (p === '/api/genome') return json(res, getGenome())
    if (p === '/api/graph') return json(res, process.env.FOUNDER_ONLY === '1' ? researchGraph() : modules.get())
    if (p === '/api/brain') return json(res, brain.status())
    if (p === '/api/metrics') return json(res, sched.allMetrics())
    if (p === '/api/github') return json(res, { info: await gh.info(), commits: await gh.log(80), scribe: scribe.scribeStats })
    if (p === '/api/fs/tree') return json(res, FS_ALLOW.map(a => tree(a)).filter(Boolean))
    if (p === '/api/fs/read') { const abs = fsSafe(url.searchParams.get('path') ?? ''); if (!abs || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return json(res, { error: 'not found' }, 404); const st = fs.statSync(abs); if (st.size > 400_000) return json(res, { error: 'too large', size: st.size }, 413); return json(res, { path: url.searchParams.get('path'), content: fs.readFileSync(abs, 'utf8'), size: st.size, mtime: st.mtimeMs }) }
    if (p === '/api/git/show') { const sha = (url.searchParams.get('sha') ?? '').replace(/[^0-9a-f]/gi, '').slice(0, 40); if (!sha) return json(res, { error: 'sha' }, 400); const out = await gh.git(['show', '--stat', '--patch', '--format=%H%n%an%n%ad%n%s%n%n%b', sha, '--', 'chronicle/DIGEST.md', 'chronicle/state.json', 'config']).catch(() => ''); return json(res, { sha, text: out.slice(0, 60_000) }) }

    // ---------- visitor actions (safe, rate limited, all recorded) ----------
    if (req.method === 'POST' && p === '/api/visitor/poke') {
      const body = await readBody(req); const type = String(body.jobType ?? '')
      if (limited('poke', 15_000)) return json(res, { error: 'cooling down, try again in a few seconds' }, 429)
      const allowed = ['cpu-bench', 'compress', 'memory', 'lint', 'selftest', 'integrity', 'forecast']
      if (!allowed.includes(type)) return json(res, { error: 'job type not allowed for visitors' }, 400)
      if (economy.getState() === 'HIBERNATING') return json(res, { error: 'hibernating: only essential work runs' }, 409)
      const job = sched.enqueue(type, 'a visitor poked the server', undefined, 'visitor')
      append({ type: 'visitor.poke', source: 'visitors', title: `A visitor asked for ${type}`, data: { jobType: type, jobId: job?.id }, evidence: { jobId: job?.id } })
      return json(res, { ok: true, job })
    }
    if (req.method === 'POST' && p === '/api/visitor/vote') {
      const body = await readBody(req); const exp = String(body.experiment ?? '')
      if (!['compress-sweep', 'cpu-duration'].includes(exp)) return json(res, { error: 'unknown experiment' }, 400)
      if (limited('vote', 2_000)) return json(res, { error: 'slow down' }, 429)
      brain.votes[exp] = (brain.votes[exp] ?? 0) + 1
      append({ type: 'visitor.vote', source: 'visitors', title: `A visitor voted for experiment ${exp} (${brain.votes[exp]} votes)`, data: { experiment: exp, votes: brain.votes[exp] } })
      return json(res, { ok: true, votes: brain.votes })
    }
    if (req.method === 'POST' && p === '/api/visitor/ask') {
      const body = await readBody(req); const q = String(body.question ?? '').slice(0, 200)
      if (!q.trim()) return json(res, { error: 'empty' }, 400)
      if (limited('ask', 3_000)) return json(res, { error: 'slow down' }, 429)
      const m = brain.status().memory; const eco = economy.snapshot(); const last = m.decisions.at(-1)
      const answer = answerFromMemory(q, { identity: m.identity, goals: m.goals, lessons: m.lessons, state: eco.state, treasury: eco.treasuryUsd, runway: eco.runwayHours, last: last?.summary, mood: last?.mood })
      append({ type: 'visitor.question', source: 'visitors', title: `Visitor asked: "${q}"`, data: { question: q, answer, answeredBy: 'memory (no LLM)' } })
      return json(res, { ok: true, answer, answeredBy: 'memory lookup, no LLM call' })
    }
    if (req.method === 'GET' && p === '/api/chat') return json(res, chat.list(100))
    if (req.method === 'POST' && p === '/api/chat') {
      const body = await readBody(req)
      const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'local')
      const r = chat.post(ip, String(body.name ?? ''), String(body.text ?? ''))
      return json(res, r, r.ok ? 200 : 429)
    }
    if (p === '/api/links') return json(res, links())
    if (p === '/api/missions') return json(res, missions.status())
    if (p === '/api/gallery') return json(res, creative.gallery().slice(-120).reverse())
    if (p === '/api/studio') return json(res, { thoughts: creative.listFiles('thoughts'), debates: creative.listFiles('debates'), writing: creative.listFiles('writing'), images: creative.gallery().length, models: creative.MODELS })
    if (p.startsWith('/images/')) { const f = path.join(ROOT, 'chronicle', 'images', path.basename(p)); if (!/^[\w.-]+\.(png|jpg)$/.test(path.basename(p)) || !fs.existsSync(f)) return json(res, { error: 'not found' }, 404); res.writeHead(200, { 'content-type': f.endsWith('.jpg') ? 'image/jpeg' : 'image/png', 'cache-control': 'public, max-age=86400' }); fs.createReadStream(f).pipe(res); return }
    if (p === '/agent/' || p === '/agent' || p === '/api/page') {
      const f = path.join(ROOT, 'chronicle', 'page', 'index.html')
      const headers = { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; font-src https:; sandbox", 'x-frame-options': 'SAMEORIGIN', 'cache-control': 'no-cache' }
      if (!fs.existsSync(f)) { res.writeHead(200, headers); res.end('<!doctype html><html><body style="margin:0;background:#05080d;color:#8a9bb0;font:14px system-ui;display:flex;align-items:center;justify-content:center;height:100vh">The server has not written its page yet.</body></html>'); return }
      res.writeHead(200, headers); fs.createReadStream(f).pipe(res); return
    }
    if (p === '/api/vitals') return json(res, { mood: vitals.mood(), system: vitals.system() })
    if (p.startsWith('/api/admin/')) {
      const action = p.slice('/api/admin/'.length)
      if (!admin.authorized(req, url)) return json(res, { error: 'admin token required (X-Admin-Token header)' }, 401)
      if (action === 'project-github-sync' && req.method === 'POST') return json(res, await syncProject())
      if (action === 'products-analyze' && req.method === 'POST') return json(res, await enrichBusinessPlans())
      if (action === 'development-build' && req.method === 'POST') { void founder.retryDevelopment(); return json(res,{ok:true,scheduled:true}) }
      if (action === 'founder-continue' && req.method === 'POST') { void founder.continueFromEvidence(); return json(res,{ok:true,scheduled:true}) }
      if (action === 'founder-pause' && req.method === 'POST') return json(res, await founder.pause())
      if (action === 'founder-resume' && req.method === 'POST') return json(res, founder.resume())
      if (action === 'founder-run' && req.method === 'POST') { const body = await readBody(req); void founder.run(Math.min(300000, Math.max(0, Number(body.durationMs) || 0))); return json(res, { ok: true, scheduled: true }) }
      if (action !== 'status' && req.method !== 'POST') return json(res, { error: 'POST required' }, 405)
      if (action === 'scribe') { void scribe.cycle('manual'); return json(res, { ok: true }) }
      const body = req.method === 'POST' ? await readBody(req) : {}
      return json(res, await admin.handle(action, body))
    }

    if (process.env.NODE_ENV === 'production') return serveStatic(req, res)
    json(res, { error: 'not found', hint: 'run the web app with npm run dev' }, 404)
  } catch (err) { json(res, { error: String(err) }, 500) }
})

function answerFromMemory(q: string, ctx: { identity: string; goals: string[]; lessons: string[]; state: string; treasury: number; runway: number | null; last?: string; mood?: string }) {
  const l = q.toLowerCase()
  const rw = ctx.runway === null ? 'no decline on the current window' : `${ctx.runway.toFixed(1)} hours (estimate)`
  if (/who|what are you/.test(l)) return ctx.identity
  if (/goal|plan/.test(l)) return `My goals right now: ${ctx.goals.join('; ')}.`
  if (/learn|lesson/.test(l)) return ctx.lessons.length ? `Lessons so far: ${ctx.lessons.slice(-3).join(' | ')}` : 'I have not recorded any lessons yet. They appear when something goes wrong and I notice.'
  if (/money|budget|treasury|runway/.test(l)) return `Treasury is $${ctx.treasury.toFixed(2)}, state ${ctx.state}, runway ${rw}.`
  if (/feel|mood|alive/.test(l)) return `State ${ctx.state}. My last decision was made in a ${ctx.mood ?? 'calm'} mood: ${ctx.last ?? 'none yet'}`
  return `I can only answer from memory without spending budget on a language model. State ${ctx.state}, treasury $${ctx.treasury.toFixed(2)}, runway ${rw}. Last decision: ${ctx.last ?? 'none yet'}`
}

server.listen(PORT, process.env.HOST ?? '0.0.0.0', () => console.error(`[pupper] listening on http://localhost:${PORT} · root ${ROOT}`))
process.on('SIGTERM', async () => { append({ type: 'system.shutdown', source: 'system', severity: 'warn', title: 'Shutting down (SIGTERM)' }); await founder.pause(); process.exit(0) })
process.on('SIGINT', async () => { append({ type: 'system.shutdown', source: 'system', severity: 'warn', title: 'Shutting down (SIGINT)' }); await founder.pause(); process.exit(0) })
