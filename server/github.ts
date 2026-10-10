import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, CHRONICLE } from './paths.ts'

const run = promisify(execFile)
const STATE = path.join(CHRONICLE, 'github.json')

export type GitInfo = { remote: string | null; repoUrl: string | null; branch: string; head: string | null; ahead: number; lastPush: number | null; lastPushOk: boolean | null; issue: { number: number; url: string; day: string } | null; commentsPosted: number; ghAvailable: boolean }

let st: { lastPush: number | null; lastPushOk: boolean | null; issue: GitInfo['issue']; commentsPosted: number } = { lastPush: null, lastPushOk: null, issue: null, commentsPosted: 0 }
if (fs.existsSync(STATE)) { try { st = { ...st, ...JSON.parse(fs.readFileSync(STATE, 'utf8')) } } catch {} }
function save() { fs.writeFileSync(STATE, JSON.stringify(st)) }

export async function git(args: string[]) { const { stdout } = await run('git', args, { cwd: ROOT }); return stdout.trim() }

export async function remoteUrl(): Promise<string | null> { try { return await git(['remote', 'get-url', 'origin']) } catch { return null } }
export function toHttps(remote: string | null): string | null {
  if (!remote) return null
  const m = remote.match(/github\.com[:/](.+?)(?:\.git)?$/)
  return m ? `https://github.com/${m[1]}` : null
}
export async function repoSlug(): Promise<string | null> { const u = toHttps(await remoteUrl()); return u ? u.replace('https://github.com/', '') : null }

let ghOk: boolean | null = null
const TOKEN = process.env.GITHUB_TOKEN
/** GitHub access: a fine-grained token (REST API, works on the server) or the gh CLI (local dev). */
export async function ghAvailable() {
  if (TOKEN) return true
  if (ghOk !== null) return ghOk
  try { await run('gh', ['auth', 'status']); ghOk = true } catch { ghOk = false }
  return ghOk
}
async function api<T>(method: string, pathname: string, body?: unknown): Promise<T> {
  const r = await fetch(`https://api.github.com${pathname}`, { method, headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'user-agent': 'project-furry-kitty', 'x-github-api-version': '2022-11-28' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000) })
  if (!r.ok) throw new Error(`GitHub ${method} ${pathname} → ${r.status}: ${(await r.text()).slice(0, 140)}`)
  return r.json() as Promise<T>
}

export async function commit(message: string, paths: string[]): Promise<string | null> {
  await git(['add', '-A', '--', ...paths])
  const staged = await git(['diff', '--cached', '--name-only'])
  if (!staged) return null
  await git(['-c', 'user.name=Furry Kitty', '-c', 'user.email=furry-kitty@users.noreply.github.com', 'commit', '-q', '-m', message])
  return git(['rev-parse', 'HEAD'])
}

export async function push(): Promise<boolean> {
  if (process.env.GITHUB_PUSH === '0') return false
  const remote = await remoteUrl()
  if (!remote) return false
  try {
    const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD'])
    await run('git', ['push', '-q', '-u', 'origin', branch], { cwd: ROOT, timeout: 60_000 })
    st.lastPush = Date.now(); st.lastPushOk = true; save(); return true
  } catch (e) { st.lastPush = Date.now(); st.lastPushOk = false; save(); throw e }
}

export async function ensureDailyIssue(): Promise<GitInfo['issue']> {
  const slug = await repoSlug()
  if (!slug || !(await ghAvailable()) || process.env.GITHUB_COMMENTS === '0') return null
  const day = new Date().toISOString().slice(0, 10)
  if (st.issue && st.issue.day === day) return st.issue
  const title = `Life log ${day}`
  const body = `Autonomous life log of Furry Kitty for ${day}.\n\nEvery scribe cycle posts a comment here with what the system did, decided and measured. Evidence lives in \`chronicle/\` in this repository.`
  if (TOKEN) {
    const open = await api<Array<{ number: number; html_url: string; title: string }>>('GET', `/repos/${slug}/issues?state=all&per_page=30&sort=created&direction=desc`)
    const found = open.find(i => i.title === title)
    if (found) { st.issue = { number: found.number, url: found.html_url, day }; save(); return st.issue }
    const created = await api<{ number: number; html_url: string }>('POST', `/repos/${slug}/issues`, { title, body })
    st.issue = { number: created.number, url: created.html_url, day }; save(); return st.issue
  }
  const { stdout } = await run('gh', ['issue', 'list', '--repo', slug, '--search', `"${title}" in:title`, '--state', 'all', '--json', 'number,url,title', '--limit', '5'])
  const found = (JSON.parse(stdout) as Array<{ number: number; url: string; title: string }>).find(i => i.title === title)
  if (found) { st.issue = { number: found.number, url: found.url, day }; save(); return st.issue }
  const { stdout: created } = await run('gh', ['issue', 'create', '--repo', slug, '--title', title, '--body', body])
  const url = created.trim().split('\n').at(-1)!
  const number = Number(url.split('/').at(-1))
  st.issue = { number, url, day }; save()
  return st.issue
}

export async function comment(body: string): Promise<string | null> {
  const issue = await ensureDailyIssue()
  const slug = await repoSlug()
  if (!issue || !slug) return null
  if (TOKEN) { const c = await api<{ html_url: string }>('POST', `/repos/${slug}/issues/${issue.number}/comments`, { body }); st.commentsPosted++; save(); return c.html_url }
  const { stdout } = await run('gh', ['issue', 'comment', String(issue.number), '--repo', slug, '--body', body])
  st.commentsPosted++; save()
  return stdout.trim().split('\n').at(-1) ?? issue.url
}

export async function info(): Promise<GitInfo> {
  const remote = await remoteUrl()
  let head: string | null = null, branch = 'main', ahead = 0
  try { head = await git(['rev-parse', 'HEAD']) } catch {}
  try { branch = await git(['rev-parse', '--abbrev-ref', 'HEAD']) } catch {}
  if (remote) { try { ahead = Number(await git(['rev-list', '--count', `origin/${branch}..HEAD`])) } catch {} }
  return { remote, repoUrl: toHttps(remote), branch, head, ahead, lastPush: st.lastPush, lastPushOk: st.lastPushOk, issue: st.issue, commentsPosted: st.commentsPosted, ghAvailable: await ghAvailable() }
}

export async function log(n = 60) {
  try {
    const out = await git(['log', `-n${n}`, '--format=%H%x1f%h%x1f%at%x1f%an%x1f%s%x1f%b%x1e'])
    const base = toHttps(await remoteUrl())
    return out.split('\x1e').filter(s => s.trim()).map(rec => { const [sha, short, at, author, subject, body] = rec.trim().split('\x1f'); return { sha, short, ts: Number(at) * 1000, author, subject, body: (body ?? '').trim(), url: base ? `${base}/commit/${sha}` : null } })
  } catch { return [] }
}
