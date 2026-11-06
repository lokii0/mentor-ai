import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { db, useRows, useWhere } from '../../lib/db'
import { addDays, fmtDay, hhmmToMinutes, minutesToHHMM, parseDay, todayKey, weekDays, weekStart } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { mentorTask, mentorThinking } from '../../lib/mentor'
import { useLang, useT } from '../../lib/settings'
import { atom } from '../../lib/store'
import type { CalendarBlock } from '../../lib/types'
import { Icon } from '../../ui/Icon'
import { Card, SectionHead, Stepper } from '../../ui/kit'
import { spring } from '../../ui/motion'
import { Orb } from '../../ui/Orb'
import { Page } from '../../ui/Page'
import { toast } from '../../ui/Toast'
import { BlockSheet } from './BlockSheet'
import { Calendar, DAY_END } from './Calendar'
import { focusPrefs, focusSession, startFocus } from './focus'
import { PrioritiesEditor } from './Priorities'
import { slotRows } from './slots'
import './plan.css'

/** Selected day survives navigation. */
const planDay = atom(todayKey())

export default function PlanScreen() {
  const t = useT()
  const lang = useLang()
  const day = planDay.use()
  const today = todayKey()
  const blocks = useWhere('calendar_blocks', (b) => b.date === day, [day])
  const prios = useRows('priorities')
  const slots = useMemo(() => slotRows(prios, day), [prios, day])
  const proposed = blocks.filter((b) => b.proposed)
  const thinking = mentorThinking.use()
  const [sheet, setSheet] = useState<{ open: boolean; block?: CalendarBlock; start?: number }>({ open: false })

  const filled = slots.filter((p) => p && p.text.trim())
  const doneCount = filled.filter((p) => p!.done).length

  const planWithMentor = async () => {
    haptic('tap')
    const open = filled.filter((p) => !p!.done).map((p) => p!.text.trim())
    if (!open.length) {
      toast(t('Najpierw wpisz priorytety — mentor rozpisze je na bloki.', 'Write your priorities first — the mentor turns them into blocks.'), { icon: 'flag' })
      return
    }
    const busy = blocks.filter((b) => !b.proposed).map((b) => ({ start: minutesToHHMM(b.start_min), end: minutesToHHMM(b.end_min >= DAY_END ? 0 : b.end_min), title: b.title }))
    const res = await mentorTask('plan_day', { date: day, priorities: open, busy })
    if (!res) {
      toast(t('Mentor teraz nie odpowiada. Spróbuj za chwilę.', 'The mentor is not answering right now. Try again shortly.'), { icon: 'cloud' })
      return
    }
    if (!res.blocks.length) {
      toast(t('Nie ma już wolnego miejsca w tym dniu.', 'There is no free time left on this day.'), { icon: 'clock' })
      return
    }
    proposed.forEach((b) => db.remove('calendar_blocks', b.id))
    db.insertMany(
      'calendar_blocks',
      res.blocks.map((b) => {
        const s = hhmmToMinutes(b.start)
        let e = hhmmToMinutes(b.end)
        if (e <= s) e = Math.min(DAY_END, s + 60)
        return { date: day, title: b.title, kind: b.kind ?? 'focus', start_min: s, end_min: e, proposed: true, goal_id: null, done: false }
      }),
    )
    haptic('success')
  }

  const acceptAll = () => {
    proposed.forEach((b) => db.update('calendar_blocks', b.id, { proposed: false }))
    haptic('success')
  }
  const rejectAll = () => {
    proposed.forEach((b) => db.remove('calendar_blocks', b.id))
    haptic('tap')
  }

  return (
    <Page
      title={t('Plan', 'Plan')}
      overline={fmtDay(day, lang)}
      action={
        day !== today ? (
          <button className="btn btn--glass btn--sm" onClick={() => planDay.set(today)}>
            {t('Dziś', 'Today')}
          </button>
        ) : undefined
      }
    >
      <Card className="glass--strong">
        <WeekStrip day={day} onPick={(d) => planDay.set(d)} />
      </Card>

      <Card className="pad-s">
        <div style={{ padding: '8px 4px 0' }}>
          <SectionHead title={t('3 priorytety', '3 priorities')} aside={filled.length ? `${doneCount}/${filled.length}` : undefined} />
        </div>
        <PrioritiesEditor date={day} />
      </Card>

      <Card>
        <div className="pl-mentor">
          <Orb size={40} thinking={thinking} />
          <div className="pl-mentor__text">
            <p className="pl-mentor__title">{t('Mentor rozpisze dzień', 'The mentor plans the day')}</p>
            <p className="pl-mentor__sub">{t('Wstawi priorytety w wolne godziny jako propozycje.', 'Puts your priorities into free hours as proposals.')}</p>
          </div>
          <button className="btn btn--accent btn--sm" onClick={planWithMentor} disabled={thinking}>
            {thinking ? t('Myśli…', 'Thinking…') : t('Rozpisz', 'Plan it')}
          </button>
        </div>
        <AnimatePresence initial={false}>
          {proposed.length > 0 && (
            <motion.div
              className="pl-proposal"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring}
            >
              <span className="pl-proposal__text">
                {t(`Propozycja: ${proposed.length} ${proposed.length === 1 ? 'blok' : proposed.length < 5 ? 'bloki' : 'bloków'}. Przeciągnij, przyjmij albo odrzuć.`, `Proposal: ${proposed.length} block${proposed.length === 1 ? '' : 's'}. Drag, accept or reject.`)}
              </span>
              <button className="btn btn--sky btn--sm" onClick={acceptAll}>
                <Icon name="check" />
                {t('Przyjmij', 'Accept')}
              </button>
              <button className="btn btn--glass btn--sm" onClick={rejectAll}>
                {t('Odrzuć', 'Reject')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Card className="pl-cal-card">
        <div className="pl-cal-head">
          <h2 className="sec-head__title">{t('Kalendarz', 'Calendar')}</h2>
          <button
            className="icon-btn icon-btn--sm"
            aria-label={t('Dodaj blok', 'Add block')}
            onClick={() => {
              haptic('tap')
              const now = new Date()
              const base = day === today ? Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30 : 9 * 60
              setSheet({ open: true, start: Math.min(DAY_END - 60, Math.max(6 * 60, base)) })
            }}
          >
            <Icon name="plus" />
          </button>
        </div>
        <Calendar date={day} blocks={blocks} onEdit={(b) => setSheet({ open: true, block: b })} onCreate={(m) => setSheet({ open: true, start: m })} />
      </Card>

      <FocusCard day={day} />

      <BlockSheet open={sheet.open} onClose={() => setSheet((s) => ({ ...s, open: false }))} date={day} block={sheet.block} startMin={sheet.start} />
    </Page>
  )
}

function WeekStrip({ day, onPick }: { day: string; onPick: (d: string) => void }) {
  const t = useT()
  const lang = useLang()
  const today = todayKey()
  const ws = weekStart(day)
  const days = weekDays(ws)
  const prios = useRows('priorities')
  const [dir, setDir] = useState(0)
  const wd = useMemo(() => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'pl-PL', { weekday: 'short' }), [lang])

  const shift = (n: 1 | -1) => {
    setDir(n)
    haptic('select')
    onPick(addDays(day, 7 * n))
  }

  return (
    <div className="pl-week">
      <button className="icon-btn icon-btn--sm icon-btn--plain" onClick={() => shift(-1)} aria-label={t('Poprzedni tydzień', 'Previous week')}>
        <Icon name="chevronLeft" />
      </button>
      <motion.div
        key={ws}
        className="pl-week__days"
        role="tablist"
        aria-label={t('Dni tygodnia', 'Days of the week')}
        initial={{ opacity: 0, x: dir * 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={spring}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        dragSnapToOrigin
        style={{ touchAction: 'pan-y' }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -50 || info.velocity.x < -500) shift(1)
          else if (info.offset.x > 50 || info.velocity.x > 500) shift(-1)
        }}
      >
        {days.map((d) => {
          const p = prios.filter((x) => x.date === d && x.text.trim()).slice(0, 3)
          const selected = d === day
          return (
            <button
              key={d}
              role="tab"
              aria-selected={selected}
              className={`pl-day ${d === today ? 'pl-day--today' : ''}`}
              onClick={() => {
                if (!selected) haptic('select')
                onPick(d)
              }}
              aria-label={fmtDay(d, lang)}
            >
              {selected && <motion.span layoutId="pl-day-pill" className="pl-day__pill" transition={{ type: 'spring', bounce: 0, duration: 0.32 }} />}
              <span className="pl-day__wd">{wd.format(parseDay(d)).replace('.', '')}</span>
              <span className="pl-day__num">{parseDay(d).getDate()}</span>
              <span className="pl-day__dots" aria-hidden="true">
                {p.map((x) => (
                  <span key={x.id} className={`pl-day__dot ${x.done ? 'pl-day__dot--done' : ''}`} />
                ))}
              </span>
            </button>
          )
        })}
      </motion.div>
      <button className="icon-btn icon-btn--sm icon-btn--plain" onClick={() => shift(1)} aria-label={t('Następny tydzień', 'Next week')}>
        <Icon name="chevronRight" />
      </button>
    </div>
  )
}

function FocusCard({ day }: { day: string }) {
  const t = useT()
  const prefs = focusPrefs.use()
  const running = focusSession.use()
  const focusRows = useWhere('measurements', (m) => m.kind === 'focus' && m.date === day, [day])
  const prios = useRows('priorities')
  const minutes = focusRows.reduce((s, m) => s + (m.value ?? 0), 0)
  const next = slotRows(prios, todayKey()).find((p) => p && p.text.trim() && !p.done)

  return (
    <Card>
      <div className="pl-focus">
        <div className="pl-focus__main">
          <h2 className="sec-head__title">{t('Skupienie', 'Focus')}</h2>
          <span className="pl-focus__value">
            {minutes}
            <small>{t('min tego dnia', 'min this day')}</small>
          </span>
        </div>
        <Icon name="timer" size={28} style={{ color: 'var(--sky)' }} />
      </div>
      <div className="pl-focus__row">
        <Stepper label={t('Długość skupienia', 'Focus length')} value={prefs.focus} step={5} min={5} max={120} format={(v) => `${v} min`} onChange={(v) => focusPrefs.set({ ...prefs, focus: v })} />
        <button
          className="btn btn--ink"
          disabled={!!running}
          onClick={() => startFocus({ title: next?.text ?? t('Skupienie', 'Focus'), goal_id: next?.goal_id ?? null })}
        >
          <Icon name="play" />
          {running ? t('Trwa', 'Running') : t('Start', 'Start')}
        </button>
      </div>
    </Card>
  )
}
