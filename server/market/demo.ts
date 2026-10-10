import type { MarketSnapshot } from '../types.ts'

/**
 * DEMO market. Everything here is simulated and labelled as such. It exists so the survival loop
 * (fees → treasury → state) can be exercised before a real token exists. Replace with SolanaMarket.
 * Fee model mirrors a typical launchpad/LP arrangement: creator share of trading fees on volume.
 */
export class DemoMarket {
  readonly source = 'DEMO' as const
  private price = 0.000042
  private holders = 318
  private lastTs = Date.now()
  private volumePerHour = 40 // USD, baseline; survival depends on this staying above burn
  private baseline = 40
  private feeRate = 0.01 // 1% of volume accrues as fees
  private creatorShare = 0.5

  describe() { return 'DEMO market: simulated price, volume and fees. No real funds.' }

  async poll(): Promise<MarketSnapshot> {
    const now = Date.now()
    const dtH = (now - this.lastTs) / 3600_000
    this.lastTs = now
    // random walk with mild mean reversion; occasional spikes to exercise RECOVERING
    const shock = Math.random() < 0.02 ? (Math.random() < 0.5 ? 1.6 : 0.6) : 1
    this.price *= Math.exp((Math.random() - 0.5) * 0.08) * shock
    this.volumePerHour = Math.max(2, this.volumePerHour * Math.exp((Math.random() - 0.5) * 0.25) * (shock !== 1 ? shock * 1.5 : 1))
    this.volumePerHour += (this.baseline - this.volumePerHour) * 0.03 // mean reversion
    if (Math.random() < 0.003) this.baseline = Math.max(5, Math.min(400, this.baseline * (Math.random() < 0.5 ? 0.5 : 2))) // regime change
    this.holders = Math.max(50, Math.round(this.holders + (Math.random() - 0.45) * 4))
    const supply = 1_000_000_000
    const fees = this.volumePerHour * dtH * this.feeRate * this.creatorShare
    return {
      source: 'DEMO', ts: now, priceUsd: this.price, marketCapUsd: this.price * supply,
      volume24hUsd: this.volumePerHour * 24, holders: this.holders, feesSinceLastUsd: fees, verified: false,
    }
  }
}
