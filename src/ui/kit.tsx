// Small shared controls. Styling lives in styles/components.css.
import { animate, motion, useMotionValue, useTransform, type HTMLMotionProps } from 'motion/react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { haptic } from '../lib/haptics'
import { Icon } from './Icon'
import { rise, springFast } from './motion'

/** Glass panel that rises in when its parent uses the `stagger` variants. */
export function Card({ className = '', variant, children, ...rest }: HTMLMotionProps<'section'> & { variant?: 'strong' | 'thin' | 'dark' | 'float' }) {
  return (
    <motion.section variants={rise} className={`glass ${variant ? `glass--${variant}` : ''} ${className}`} {...rest}>
      {children}
    </motion.section>
  )
}

export function SectionHead({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="sec-head">
      <h2 className="sec-head__title">{title}</h2>
      {aside && <div className="sec-head__aside">{aside}</div>}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      onClick={() => {
        haptic('select')
        onChange(!checked)
      }}
    />
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const id = useId()
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className="seg__btn"
          onClick={() => {
            if (o.value !== value) haptic('select')
            onChange(o.value)
          }}
        >
          {o.value === value && <motion.span layoutId={`seg-${id}`} className="seg__thumb" transition={springFast} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, step = 1, min = 0, max = Infinity, format, label }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; format?: (v: number) => string; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button aria-label="−" onClick={() => { haptic('tap'); onChange(Math.max(min, value - step)) }}><Icon name="minus" /></button>
      <output aria-live="polite">{format ? format(value) : value}</output>
      <button aria-label="+" onClick={() => { haptic('tap'); onChange(Math.min(max, value + step)) }}><Icon name="plus" /></button>
    </div>
  )
}

export function Range({ value, min, max, step = 1, onChange, label, fill }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; fill?: string }) {
  const p = ((value - min) / (max - min)) * 100
  return (
    <input
      type="range"
      className="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ ['--p' as string]: `${p}%`, ['--range-fill' as string]: fill }}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

/** Number that counts to its new value (rounded font, tabular figures). */
export function Counter({ value, format = (v) => String(Math.round(v)), className = '', duration = 0.9 }: { value: number; format?: (v: number) => string; className?: string; duration?: number }) {
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => format(v))
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      mv.set(0)
    }
    const c = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] })
    return () => c.stop()
  }, [value, mv, duration])
  return <motion.span className={`t-num ${className}`}>{text}</motion.span>
}

/** Progress ring. One hue; pink only when something is at risk. */
export function Ring({ value, size = 56, stroke = 6, color = 'var(--sky)', track = 'var(--ink-5)', children, label }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode; label?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ type: 'spring', bounce: 0, duration: 0.9 }}
        />
      </svg>
      {children && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>}
    </div>
  )
}

export function Bar({ value, tone = 'sky', thick }: { value: number; tone?: 'sky' | 'pink' | 'deep'; thick?: boolean }) {
  return (
    <div className={`bar ${thick ? 'bar--thick' : ''}`}>
      <motion.div
        className={`bar__fill ${tone !== 'sky' ? `bar__fill--${tone}` : ''}`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: Math.max(0, Math.min(1, value)) }}
        transition={{ type: 'spring', bounce: 0, duration: 0.8 }}
      />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}
