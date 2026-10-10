import { input, log, done, progress, fmt } from './util.ts'

const { series, incomeSeries } = input<{ series: Array<{ ts: number; v: number }>; incomeSeries: Array<{ ts: number; v: number }> }>()
function regress(pts: Array<{ ts: number; v: number }>) {
  const n = pts.length
  if (n < 3) return null
  const t0 = pts[0].ts
  const xs = pts.map(p => (p.ts - t0) / 3600_000), ys = pts.map(p => p.v)
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2 }
  const slope = sxx === 0 ? 0 : sxy / sxx
  const intercept = my - slope * mx
  const r2 = sxx === 0 || syy === 0 ? 0 : (sxy * sxy) / (sxx * syy)
  return { slope, intercept, r2, lastX: xs[n - 1], lastY: ys[n - 1] }
}
progress(0.3)
const r = regress(series)
let runwayHours: number | null = null
if (r && r.slope < 0) runwayHours = r.lastY / -r.slope
const inc = regress(incomeSeries ?? [])
progress(0.8)
if (r) log(`treasury slope ${fmt(r.slope, 4)} $/h (r²=${fmt(r.r2, 3)}) over ${series.length} samples`)
else log('not enough samples for regression yet')
log(runwayHours !== null ? `estimated runway ${fmt(runwayHours, 1)}h (estimate, linear)` : 'treasury not declining on this window → runway unbounded')
if (inc) log(`income trend ${fmt(inc.slope, 4)} $/h²`)
progress(1)
done({ samples: series.length, slopePerHour: r?.slope ?? 0, r2: r?.r2 ?? 0, runwayHours, incomeTrend: inc?.slope ?? 0, estimate: true },
  { name: 'runway', value: runwayHours === null ? -1 : Number(runwayHours.toFixed(1)), unit: 'h' })
