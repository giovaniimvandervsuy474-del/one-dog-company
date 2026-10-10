import type { MarketSnapshot } from '../types.ts'
import { DemoMarket } from './demo.ts'
import { SolanaMarket } from './solana.ts'

export interface MarketFeed {
  readonly source: 'DEMO' | 'SOLANA'
  poll(): Promise<MarketSnapshot>
  describe(): string
}

export function createMarket(): MarketFeed {
  const src = process.env.MARKET_SOURCE
  if (src !== 'demo' && process.env.TOKEN_MINT) {
    return new SolanaMarket({ mint: process.env.TOKEN_MINT, treasuryWallet: process.env.TREASURY_WALLET, rpcUrl: process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com' })
  }
  if (src !== 'demo') console.error('[furry-kitty] WARNING: no TOKEN_MINT configured → running the simulated DEMO market (set TOKEN_MINT + TREASURY_WALLET for live)')
  return new DemoMarket()
}
