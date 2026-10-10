export type Severity = 'info' | 'success' | 'warn' | 'error'

export type Evidence = {
  jobId?: string
  commit?: string
  commitUrl?: string
  file?: string
  url?: string
  decisionId?: string
  experimentId?: string
}

export type LedgerEvent = {
  id: string
  ts: number
  type: string
  severity: Severity
  source: string
  title: string
  data?: Record<string, unknown>
  evidence?: Evidence
}

export type SurvivalState = 'ALIVE' | 'STRAINED' | 'CRITICAL' | 'HIBERNATING' | 'RECOVERING'

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout'

export type JobRecord = {
  id: string
  type: string
  title: string
  workspace: string
  status: JobStatus
  essential: boolean
  costUnits: number
  queuedAt: number
  startedAt?: number
  finishedAt?: number
  durationMs?: number
  progress: number
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  logs: string[]
  error?: string
  metric?: { name: string; value: number; unit: string }
}

export type MarketSnapshot = {
  source: 'DEMO' | 'SOLANA'
  ts: number
  priceUsd: number
  marketCapUsd: number
  volume24hUsd: number
  holders: number
  /** Fees accrued to the treasury since the previous snapshot, USD. Verified only for SOLANA source. */
  feesSinceLastUsd: number
  verified: boolean
  /** SOLANA only */
  launched?: boolean
  solPriceUsd?: number
  walletSol?: number
  walletUsd?: number
  paidOutUsd?: number
}

export type EconomySnapshot = {
  ts: number
  state: SurvivalState
  treasuryUsd: number
  burnPerHourUsd: number
  incomePerHourUsd: number
  runwayHours: number | null
  vitality: number
  ambitionTier: 0 | 1 | 2 | 3
  costs: { infra: number; compute: number; ai: number }
  income: { fees: number; donations: number }
  market: MarketSnapshot
  demo: boolean
  /** live mode: bills (models + hosting) not yet paid out of the wallet; treasury = wallet value − unsettled */
  unsettledUsd?: number
  settledUsd?: number
}

/** Everything the agent may change about its appearance. The body, face and desk are fixed; these are add-ons from a catalog. */
export type Look = {
  hoodieColor: string        // hex
  antennaColor: string       // hex
  neonColor: string          // hex, the back-wall strips
  hat: 'none' | 'cap' | 'beanie' | 'crown' | 'halo' | 'propeller'
  glasses: 'none' | 'round' | 'shades' | 'visor'
  badge: string              // ≤ 4 chars shown on the hoodie
  deskItems: Array<'plant' | 'mug' | 'rubber-duck' | 'books' | 'lava-lamp' | 'cat' | 'trophy' | 'radio'>
  poster: string             // ≤ 40 chars on the wall poster
  sticker: string            // ≤ 20 chars on the monitor
  posterImage?: string       // url of a generated image used as the wall poster
}
export type Genome = {
  version: number
  concurrency: number
  brainIntervalMs: number
  scribeIntervalMs: number
  compressionLevel: number
  compressionAlgo: 'gzip' | 'brotli'
  cpuBenchDurationMs: number
  jobIntervals: Record<string, number>
  pausedWorkspaces: string[]
  aiProvider: 'heuristic' | 'anthropic' | 'requesty'
  aiCallsPerHour: number
  motto: string
  nnLearningRate: number
  look: Look
  spendTargetPerHour: number
  history: Array<{ ts: number; version: number; key: string; from: unknown; to: unknown; reason: string; decisionId?: string }>
}

export type GraphNode = {
  id: string
  label: string
  kind: 'module' | 'worker' | 'storage' | 'brain' | 'economy' | 'scheduler' | 'external'
  since: number
  active: boolean
  meta?: Record<string, unknown>
}
export type GraphEdge = { from: string; to: string; kind: 'import' | 'flow' | 'control' }
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[]; ts: number }
