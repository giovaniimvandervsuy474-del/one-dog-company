import { input, log, done, progress } from './util.ts'

/** Reads a few public, read-only sources and returns raw headlines. Summarising is a separate, recorded LLM step. */
const { topic = 'ai' } = input<{ topic: string }>()
const ALLOW = ['https://hacker-news.firebaseio.com/', 'https://api.dexscreener.com/', 'https://api.github.com/repos/']
async function get(url: string) { if (!ALLOW.some(a => url.startsWith(a))) throw new Error('url not allowed'); const r = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'user-agent': 'the-last-server/0.1' } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }
log(`reading Hacker News front page (topic hint: ${topic})`)
const ids = (await get('https://hacker-news.firebaseio.com/v0/topstories.json') as number[]).slice(0, 30)
const items: Array<{ id: number; title: string; score: number; url?: string; by: string }> = []
for (const [i, id] of ids.entries()) {
  try { const it = await get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`) as { title?: string; score?: number; url?: string; by?: string }; if (it?.title) items.push({ id, title: it.title, score: it.score ?? 0, url: it.url, by: it.by ?? '' }) } catch {}
  if (i % 5 === 0) progress(i / ids.length)
}
const kw = /\b(ai|llm|gpt|claude|model|agent|neural|gpu|compute|server|token|solana|crypto|open.?source|rust|node|typescript)\b/i
const relevant = items.filter(x => kw.test(x.title)).slice(0, 8)
log(`${items.length} stories read, ${relevant.length} look relevant`)
for (const r of relevant.slice(0, 5)) log(`  ${r.score}▲ ${r.title}`)
progress(1)
done({ source: 'hacker-news', read: items.length, relevant, top: items.slice(0, 10).map(x => ({ title: x.title, score: x.score, url: x.url })) }, { name: 'relevant', value: relevant.length, unit: '' })
