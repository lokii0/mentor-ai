import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import './orb.css'

export type OrbMood = 'neutral' | 'alert' | 'calm'

interface Props {
  size?: number
  mood?: OrbMood
  thinking?: boolean
  className?: string
  style?: CSSProperties
  layoutId?: string
}

/** The mentor. Breathes at rest, swirls while thinking, flushes pink when Ro slacks, turns soft in crisis mode. */
export function Orb({ size = 120, mood = 'neutral', thinking = false, className, style, layoutId }: Props) {
  return (
    <motion.div
      layoutId={layoutId}
      className={`orb ${className ?? ''}`}
      data-mood={mood}
      data-state={thinking ? 'thinking' : 'idle'}
      style={{ ['--size' as string]: `${size}px`, ...style }}
      animate={thinking ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={thinking ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', bounce: 0, duration: 0.5 }}
      aria-hidden="true"
    >
      <div className="orb__halo" />
      <div className="orb__halo orb__halo--pink" />
      <div className="orb__body">
        <div className="orb__spin">
          <div className="orb__flow orb__flow--a" />
          <div className="orb__flow orb__flow--b" />
        </div>
        <div className="orb__flow orb__flow--alert" />
        <div className="orb__flow orb__flow--calm" />
        <div className="orb__spec" />
        <div className="orb__rim" />
      </div>
    </motion.div>
  )
}
