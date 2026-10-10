import type { MarketSnapshot } from '../types.ts'

/**
 * Live market adapter (MARKET_SOURCE=solana). Read-only: no keys, no signing.
 * - token price / market cap / volume: DexScreener for TOKEN_MINT (zeros + launched=false until a pair exists);
 * - SOL/USD: DexScreener's deepest SOL pair;
 * - treasury: SOL balance of TREASURY_WALLET via RPC, valued in USD;
 * - income: only verified balance increases of that wallet. Market cap, volume, buys and sells never count.
 */
const SOL_MINT = 'So11111111111111111111111111111111111111112'
export class SolanaMarket {
  readonly source = 'SOLANA' as const
  private cfg: { mint: string; treasuryWallet?: string; rpcUrl: string }
  private lastLamports: number | null = null
  private solPrice = 0
  private lastSolPriceAt = 0
  launched = false
  walletSol = 0
  walletUsd = 0
  paidOutUsd = 0   // balance decreases since last poll, valued in USD (treated as bills being paid)
  constructor(cfg: { mint: string; treasuryWallet?: string; rpcUrl: string }) { this.cfg = cfg }

  describe() { return `SOLANA market: mint ${this.cfg.mint.slice(0, 6)}… treasury ${this.cfg.treasuryWallet?.slice(0, 6) ?? 'unset'}… (read-only RPC)` }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const r = await fetch(this.cfg.rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(10_000) })
    const j = await r.json() as { result: T; error?: { message: string } }
    if (j.error) throw new Error(j.error.message)
    return j.result
  }
  private async dex(mint: string) {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { signal: AbortSignal.timeout(10_000) })
    const j = await r.json() as { pairs?: Array<{ dexId: string; priceUsd: string; priceNative: string; marketCap?: number; fdv?: number; volume?: { h24?: number }; liquidity?: { usd?: number } }> }
    return j.pairs ?? []
  }

  async poll(): Promise<MarketSnapshot> {
    const now = Date.now()
    let priceUsd = 0, marketCapUsd = 0, volume24hUsd = 0
    try {
      const pairs = (await this.dex(this.cfg.mint)).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
      const pair = pairs[0]
      if (pair) { this.launched = true; priceUsd = Number(pair.priceUsd) || 0; marketCapUsd = pair.marketCap ?? pair.fdv ?? 0; volume24hUsd = pair.volume?.h24 ?? 0; if (Number(pair.priceNative) > 0 && priceUsd > 0) this.solPrice = priceUsd / Number(pair.priceNative) }
      else this.launched = false
    } catch { /* keep last values */ }
    if (now - this.lastSolPriceAt > 60_000 || this.solPrice <= 0) {
      try { const p = (await this.dex(SOL_MINT)).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]; if (p && Number(p.priceUsd) > 0) { this.solPrice = Number(p.priceUsd); this.lastSolPriceAt = now } } catch {}
    }
    let fees = 0, verified = false
    if (this.cfg.treasuryWallet) {
      try {
        const bal = await this.rpc<{ value: number }>('getBalance', [this.cfg.treasuryWallet])
        this.walletSol = bal.value / 1e9
        this.walletUsd = this.walletSol * this.solPrice
        this.paidOutUsd = 0
        if (this.lastLamports !== null && bal.value > this.lastLamports && this.solPrice > 0) { fees = ((bal.value - this.lastLamports) / 1e9) * this.solPrice; verified = true }
        else if (this.lastLamports !== null && bal.value < this.lastLamports && this.solPrice > 0) this.paidOutUsd = ((this.lastLamports - bal.value) / 1e9) * this.solPrice
        this.lastLamports = bal.value
      } catch { /* RPC unavailable: no verified income this tick, wallet value kept */ }
    }
    return { source: 'SOLANA', ts: now, priceUsd, marketCapUsd, volume24hUsd, holders: 0, feesSinceLastUsd: fees, verified, launched: this.launched, solPriceUsd: this.solPrice, walletSol: this.walletSol, walletUsd: this.walletUsd, paidOutUsd: this.paidOutUsd }
  }
}
