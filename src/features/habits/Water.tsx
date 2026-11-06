import { motion } from 'motion/react'
import { useId } from 'react'
import { haptic } from '../../lib/haptics'
import { todayKey, fmtNum } from '../../lib/dates'
import { useLang, useT } from '../../lib/settings'
import { habitValue } from '../../lib/stats'
import type { Habit, HabitLog } from '../../lib/types'
import { Icon } from '../../ui/Icon'
import { Card } from '../../ui/kit'
import { setHabitValue } from './util'

// Glass vessel geometry (viewBox 0 0 120 200)
const TOP = 12
const BOTTOM = 190
const VESSEL = 'M16 8 H104 Q106 8 105.8 10 L95.5 180 Q95 192 83 192 H37 Q25 192 24.5 180 L14.2 10 Q14 8 16 8 Z'
// One wavelength = 60 units; path is 4 waves wide so a -60 shift loops seamlessly.
const WAVE = 'M-60 0 Q-45 -5 -30 0 T0 0 T30 0 T60 0 T90 0 T120 0 T150 0 T180 0 V220 H-60 Z'

/** SVG glass with a liquid level and a moving surface. */
export function Vessel({ progress, liters }: { progress: number; liters: number }) {
  const id = useId().replace(/:/g, '')
  const p = Math.max(0, Math.min(1, progress))
  const level = BOTTOM - p * (BOTTOM - TOP)
  const ticks = Math.max(1, Math.round(liters))
  return (
    <svg className="hb-water__vessel" viewBox="0 0 120 200" aria-hidden="true">
      <defs>
        <clipPath id={`v${id}`}>
          <path d={VESSEL} />
        </clipPath>
      </defs>
      <path d={VESSEL} fill="rgba(255,255,255,.55)" />
      <g clipPath={`url(#v${id})`}>
        <motion.g initial={{ y: BOTTOM }} animate={{ y: p > 0 ? level : BOTTOM + 6 }} transition={{ type: 'spring', bounce: 0, duration: 1.1 }}>
          <motion.path
            d={WAVE}
            fill="rgba(5,147,198,.35)"
            animate={{ x: [0, 60] }}
            transition={{ duration: 5.5, ease: 'linear', repeat: Infinity }}
          />
          <g transform="translate(0 3)">
            <motion.path d={WAVE} fill="rgba(5,147,198,.78)" animate={{ x: [0, -60] }} transition={{ duration: 3.6, ease: 'linear', repeat: Infinity }} />
          </g>
        </motion.g>
        {/* refraction highlight */}
        <path d="M26 18 L33 176" stroke="rgba(255,255,255,.75)" strokeWidth="5" strokeLinecap="round" />
      </g>
      {Array.from({ length: ticks - 1 }, (_, i) => {
        const y = BOTTOM - ((i + 1) / ticks) * (BOTTOM - TOP)
        const edge = 104 - ((y - 8) / 172) * 8.5 // right wall tapers toward the base
        return <line key={i} x1={edge - 11} x2={edge - 3} y1={y} y2={y} stroke="var(--deep)" strokeOpacity=".22" strokeWidth="1.5" strokeLinecap="round" />
      })}
      <path d={VESSEL} fill="none" stroke="rgba(9,49,141,.2)" strokeWidth="1.5" />
      <path d="M16 8 H104" stroke="rgba(255,255,255,.95)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function WaterCard({ habit, logs }: { habit: Habit; logs: HabitLog[] }) {
  const t = useT()
  const lang = useLang()
  const today = todayKey()
  const v = habitValue(logs, habit.id, today)
  const left = Math.max(0, habit.target - v)
  const add = (ml: number) => {
    haptic(v + ml >= habit.target && v < habit.target ? 'success' : 'tap')
    setHabitValue(habit, today, v + ml)
  }
  return (
    <Card className="hb-water">
      <Vessel progress={habit.target ? v / habit.target : 0} liters={habit.target / 1000} />
      <div className="hb-water__info">
        <span className="hb-water__label">{t('Woda dziś', 'Water today')}</span>
        <div className="hb-water__value">
          {fmtNum(v / 1000, lang, 2)}
          <small>/ {fmtNum(habit.target / 1000, lang, 1)} l</small>
        </div>
        <span className="hb-water__note">
          {left > 0 ? t(`Brakuje ${fmtNum(left / 1000, lang, 2)} l`, `${fmtNum(left / 1000, lang, 2)} l to go`) : t('Cel zrobiony', 'Goal reached')}
        </span>
        <div className="hb-water__btns">
          <button className="btn btn--sky btn--sm" onClick={() => add(250)}>
            <Icon name="plus" />
            250 ml
          </button>
          <button className="btn btn--glass btn--sm" onClick={() => add(500)}>
            <Icon name="plus" />
            500 ml
          </button>
          {v > 0 && (
            <button className="icon-btn icon-btn--sm" aria-label={t('Cofnij 250 ml', 'Undo 250 ml')} onClick={() => { haptic('tap'); setHabitValue(habit, today, v - 250) }}>
              <Icon name="undo" />
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
