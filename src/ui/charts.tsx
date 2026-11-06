// Small SVG charts drawn to the house rules: one hue per chart, no gridline noise,
// a target line where there is a target, pink only for values at risk.
import { motion } from 'motion/react'
import { useId } from 'react'

export interface BarDatum {
  label: string
  value: number
  /** Mark this bar as at risk (pink) — e.g. over a limit. */
  risk?: boolean
  /** Highlight (today). */
  current?: boolean
}

export function Bars({ data, height = 140, target, format = (v) => String(Math.round(v)), color = 'var(--sky)' }: { data: BarDatum[]; height?: number; target?: number; format?: (v: number) => string; color?: string }) {
  const max = Math.max(target ?? 0, ...data.map((d) => d.value), 1) * 1.08
  const w = 100 / data.length
  const plotH = height - 22
  return (
    <div style={{ position: 'relative', height }} role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(', ')}>
      <svg width="100%" height={plotH} viewBox={`0 0 100 ${plotH}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        {data.map((d, i) => {
          const h = Math.max(d.value > 0 ? 3 : 1.5, (d.value / max) * plotH)
          return (
            <motion.rect
              key={i}
              x={i * w + w * 0.2}
              width={w * 0.6}
              rx={Math.min(3, w * 0.3)}
              initial={{ y: plotH, height: 0 }}
              animate={{ y: plotH - h, height: h }}
              transition={{ type: 'spring', bounce: 0, duration: 0.7, delay: i * 0.035 }}
              fill={d.value === 0 ? 'var(--ink-5)' : d.risk ? 'var(--pink)' : color}
              opacity={d.current || d.value === 0 ? 1 : 0.78}
            />
          )
        })}
        {target != null && target > 0 && (
          <line x1="0" x2="100" y1={plotH - (target / max) * plotH} y2={plotH - (target / max) * plotH} stroke="var(--deep)" strokeOpacity=".35" strokeWidth="1" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, marginTop: 6 }}>
        {data.map((d, i) => (
          <span key={i} className="t-caption" style={{ textAlign: 'center', color: d.current ? 'var(--ink)' : 'var(--ink-3)', fontWeight: d.current ? 650 : 500 }}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Calendar heatmap. `values` maps 'YYYY-MM-DD' → 0..1. Columns are weeks (Mon→Sun rows). */
export function Heatmap({ days, values, color = '5,147,198', cell = 14, gap = 4, labelFor }: { days: string[]; values: Record<string, number>; color?: string; cell?: number; gap?: number; labelFor?: (day: string, v: number) => string }) {
  if (!days.length) return null
  const first = new Date(days[0] + 'T00:00:00')
  const offset = (first.getDay() + 6) % 7
  const cols = Math.ceil((days.length + offset) / 7)
  const W = cols * (cell + gap) - gap
  const H = 7 * (cell + gap) - gap
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: '100%', height: 'auto' }} role="img" aria-label="heatmap">
      {days.map((d, i) => {
        const idx = i + offset
        const x = Math.floor(idx / 7) * (cell + gap)
        const y = (idx % 7) * (cell + gap)
        const v = values[d] ?? 0
        return (
          <motion.rect
            key={d}
            x={x}
            y={y}
            width={cell}
            height={cell}
            rx={cell * 0.3}
            fill={v > 0 ? `rgba(${color},${0.18 + v * 0.82})` : 'rgba(2,7,10,.06)'}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ transformOrigin: `${x + cell / 2}px ${y + cell / 2}px` }}
            transition={{ duration: 0.3, delay: Math.min(0.6, i * 0.006) }}
          >
            {labelFor && <title>{labelFor(d, v)}</title>}
          </motion.rect>
        )
      })}
    </svg>
  )
}

/** Straight 2px line, optional faint area, optional target line. */
export function Line({ points, height = 120, target, color = 'var(--sky)', area = true }: { points: number[]; height?: number; target?: number; color?: string; area?: boolean }) {
  const id = useId()
  if (points.length < 2) return <div style={{ height }} />
  const max = Math.max(target ?? 0, ...points) * 1.1 || 1
  const min = 0
  const step = 100 / (points.length - 1)
  const y = (v: number) => height - ((v - min) / (max - min)) * height
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${i * step},${y(p)}`).join(' ')
  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      {area && (
        <>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity=".18" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path d={`${d} L100,${height} L0,${height} Z`} fill={`url(#${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
        </>
      )}
      {target != null && <line x1="0" x2="100" y1={y(target)} y2={y(target)} stroke="var(--deep)" strokeOpacity=".35" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />}
      <motion.path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
    </svg>
  )
}
