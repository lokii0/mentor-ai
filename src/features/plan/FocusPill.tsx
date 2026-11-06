// Running focus session: a small pill above the dock on every screen, or the full-screen timer.
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { haptic } from '../../lib/haptics'
import { useT } from '../../lib/settings'
import { Icon } from '../../ui/Icon'
import { Ring, Stepper } from '../../ui/kit'
import { materialize } from '../../ui/motion'
import { toast } from '../../ui/Toast'
import {
  completeIfDue,
  elapsedMs,
  fmtClock,
  focusExpanded,
  focusPrefs,
  focusSession,
  pauseFocus,
  remainingMs,
  resumeFocus,
  stopFocus,
} from './focus'
import './plan.css'

export default function FocusPill() {
  const t = useT()
  const s = focusSession.use()
  const expanded = focusExpanded.use()
  const prefs = focusPrefs.use()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!s) return
    const tick = () => {
      const n = Date.now()
      setNow(n)
      const done = completeIfDue(n)
      if (done === 'focus') {
        haptic('success')
        toast(t('Skupienie zaliczone. Przerwa.', 'Focus done. Take a break.'), { icon: 'check' })
      } else if (done === 'break') {
        haptic('warning')
        toast(t('Koniec przerwy. Wracasz do roboty.', 'Break is over. Back to work.'), { icon: 'timer' })
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s])

  // Esc closes the full-screen timer back into the pill.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && focusExpanded.set(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  const remaining = s ? remainingMs(s, now) : 0
  const progress = s ? Math.min(1, elapsedMs(s, now) / (s.minutes * 60_000)) : 0
  const isBreak = s?.mode === 'break'
  const color = isBreak ? 'var(--deep)' : 'var(--sky)'

  const stop = () => {
    const min = stopFocus()
    haptic('tap')
    if (min > 0) toast(t(`Zapisano ${min} min skupienia.`, `Logged ${min} min of focus.`), { icon: 'timer' })
  }

  return (
    <AnimatePresence>
      {s && !expanded && (
        <div className="pl-pill-wrap" key="pill">
          <motion.button
            className="pl-pill glass glass--dark"
            onClick={() => {
              haptic('tap')
              focusExpanded.set(true)
            }}
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.94 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            whileTap={{ scale: 0.96 }}
            aria-label={t('Otwórz licznik skupienia', 'Open focus timer')}
          >
            <Ring value={progress} size={32} stroke={3.5} color={isBreak ? '#7fa2ff' : '#7fdcff'} track="rgba(255,255,255,.14)">
              <Icon name={s.paused ? 'pause' : 'timer'} size={14} />
            </Ring>
            <span className="pl-pill__time">{fmtClock(remaining)}</span>
            <span className="pl-pill__title">{isBreak ? t('Przerwa', 'Break') : s.title}</span>
          </motion.button>
        </div>
      )}

      {s && expanded && (
        <motion.div
          key="overlay"
          className="pl-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('Licznik skupienia', 'Focus timer')}
          variants={materialize}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <div className="pl-overlay__top">
            <button className="icon-btn" onClick={() => focusExpanded.set(false)} aria-label={t('Zwiń', 'Minimise')}>
              <Icon name="chevronDown" />
            </button>
            <span className="pl-overlay__mode">{isBreak ? t('Przerwa', 'Break') : t('Skupienie', 'Focus')}</span>
            <span style={{ width: 44 }} />
          </div>

          <div className="pl-overlay__center">
            <Ring value={progress} size={272} stroke={10} color={color} label={fmtClock(remaining)}>
              <div className="stack" style={{ alignItems: 'center', gap: 6 }}>
                <span className="pl-overlay__time" aria-live="off">{fmtClock(remaining)}</span>
                <span className="pl-overlay__sub">
                  {s.paused ? t('Pauza', 'Paused') : t(`z ${s.minutes} min`, `of ${s.minutes} min`)}
                </span>
              </div>
            </Ring>
            <p className="pl-overlay__title">{isBreak ? t('Wstań, napij się wody, nie bierz telefonu.', 'Stand up, drink water, leave the phone.') : s.title}</p>
          </div>

          <div className="stack gap-6" style={{ alignItems: 'center' }}>
            <div className="pl-overlay__controls">
              <button className="pl-round pl-round--ghost" onClick={stop} aria-label={t('Zakończ', 'Stop')}>
                <Icon name="stop" />
              </button>
              <button
                className="pl-round pl-round--main"
                onClick={() => {
                  haptic('tap')
                  if (s.paused) resumeFocus()
                  else pauseFocus()
                }}
                aria-label={s.paused ? t('Wznów', 'Resume') : t('Pauza', 'Pause')}
              >
                <Icon name={s.paused ? 'play' : 'pause'} />
              </button>
              <button className="pl-round pl-round--ghost" onClick={() => focusExpanded.set(false)} aria-label={t('Zwiń', 'Minimise')}>
                <Icon name="chevronDown" />
              </button>
            </div>
            <div className="pl-overlay__prefs">
              <div className="pl-pref">
                <Stepper
                  label={t('Długość skupienia', 'Focus length')}
                  value={prefs.focus}
                  step={5}
                  min={5}
                  max={120}
                  format={(v) => `${v}`}
                  onChange={(v) => focusPrefs.set({ ...prefs, focus: v })}
                />
                {t('skupienie, min', 'focus, min')}
              </div>
              <div className="pl-pref">
                <Stepper
                  label={t('Długość przerwy', 'Break length')}
                  value={prefs.brk}
                  step={1}
                  min={0}
                  max={30}
                  onChange={(v) => focusPrefs.set({ ...prefs, brk: v })}
                />
                {t('przerwa, min', 'break, min')}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
