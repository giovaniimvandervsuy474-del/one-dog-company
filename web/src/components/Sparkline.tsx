export default function Sparkline({ data, color = '#19f0a0', w = 90, h = 22 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2) return <svg className="spark" width={w} height={h} />
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 2 - ((v - min) / span) * (h - 4)}`).join(' ')
  return <svg className="spark" width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" opacity="0.9" /><circle cx={w} cy={h - 2 - ((data[data.length - 1] - min) / span) * (h - 4)} r="1.8" fill={color} /></svg>
}
