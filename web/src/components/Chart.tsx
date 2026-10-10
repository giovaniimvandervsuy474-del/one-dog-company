import { useMemo } from 'react'

type Series = { name: string; color: string; points: Array<{ x: number; y: number }> }
export default function Chart({ series, height = 180, yLabel = '', xTime = true, bands = [] as Array<{ from: number; to: number; color: string }> }: { series: Series[]; height?: number; yLabel?: string; xTime?: boolean; bands?: Array<{ from: number; to: number; color: string }> }) {
  const W = 800, H = height, P = { l: 48, r: 12, t: 10, b: 22 }
  const all = series.flatMap(s => s.points)
  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    if (!all.length) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }
    const xs = all.map(p => p.x), ys = all.map(p => p.y)
    const yMin = Math.min(...ys), yMax = Math.max(...ys)
    return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: yMin === yMax ? yMin - 1 : yMin, yMax: yMin === yMax ? yMax + 1 : yMax }
  }, [all])
  const sx = (x: number) => P.l + ((x - xMin) / (xMax - xMin || 1)) * (W - P.l - P.r)
  const sy = (y: number) => P.t + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - P.t - P.b)
  const ticks = 4
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
      {bands.map((b, i) => <rect key={i} x={sx(b.from)} y={P.t} width={Math.max(1, sx(b.to) - sx(b.from))} height={H - P.t - P.b} fill={b.color} opacity="0.12" />)}
      {Array.from({ length: ticks + 1 }, (_, i) => { const y = yMin + ((yMax - yMin) * i) / ticks; return <g key={i}><line x1={P.l} x2={W - P.r} y1={sy(y)} y2={sy(y)} stroke="rgba(140,170,200,0.12)" /><text x={P.l - 6} y={sy(y) + 3} fontSize="10" fill="#55657a" textAnchor="end" fontFamily="JetBrains Mono">{Math.abs(y) >= 1000 ? (y / 1000).toFixed(1) + 'k' : y.toFixed(Math.abs(yMax - yMin) < 2 ? 3 : 1)}</text></g> })}
      {Array.from({ length: 5 }, (_, i) => { const x = xMin + ((xMax - xMin) * i) / 4; return <text key={i} x={sx(x)} y={H - 6} fontSize="10" fill="#55657a" textAnchor="middle" fontFamily="JetBrains Mono">{xTime ? new Date(x).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' }) : x.toFixed(0)}</text> })}
      {series.map(s => s.points.length > 1 && <polyline key={s.name} points={s.points.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />)}
      {series.map((s, i) => <text key={s.name} x={P.l + 8 + i * 120} y={P.t + 10} fontSize="10" fill={s.color} fontFamily="JetBrains Mono">● {s.name}</text>)}
      {yLabel && <text x={W - P.r} y={P.t + 10} fontSize="10" fill="#55657a" textAnchor="end" fontFamily="JetBrains Mono">{yLabel}</text>}
    </svg>
  )
}
