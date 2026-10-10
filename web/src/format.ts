export const usd = (n: number, d = 2) => (Number.isFinite(n) ? `$${n.toFixed(d)}` : '—')
export const big = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toFixed(0)
export const hhmmss = (ts: number) => new Date(ts).toLocaleTimeString('en-GB', { hour12: false })
export const ago = (ts: number) => { const s = Math.max(0, (Date.now() - ts) / 1000); return s < 60 ? `${s.toFixed(0)}s` : s < 3600 ? `${(s / 60).toFixed(0)}m` : s < 86400 ? `${(s / 3600).toFixed(1)}h` : `${(s / 86400).toFixed(1)}d` }
export const dur = (ms: number) => ms < 1000 ? `${ms.toFixed(0)}ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60000).toFixed(1)}m`
export const hours = (h: number | null) => h === null ? '∞' : h > 99 ? `${(h / 24).toFixed(1)}d` : `${h.toFixed(1)}h`
export const STATE_COLOR: Record<string, string> = { ALIVE: '#19f0a0', STRAINED: '#ffb347', CRITICAL: '#ff3b5c', HIBERNATING: '#6b7a99', RECOVERING: '#5ad7ff' }
export const KIND_COLOR: Record<string, string> = { brain: '#c08cff', scheduler: '#ffd166', worker: '#19f0a0', module: '#8fe3c4', storage: '#ffb347', economy: '#5ad7ff', external: '#ffffff' }
export const SEV_COLOR: Record<string, string> = { info: '#9fb3c8', success: '#19f0a0', warn: '#ffb347', error: '#ff3b5c' }
