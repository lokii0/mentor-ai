// Dziś — the day at a glance: the mentor's last word, open oath, 3 priorities,
// habits, clean-day counters, next block and money. Everything is one tap from action.
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { navigate } from '../../app/nav'
import { db, useRows } from '../../lib/db'
import { DAYS, fmtDay, fmtMoney, minutesToHHMM, monthKey, nowMinutes, plural, relTime, todayKey, weekStart } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { useLang, useT } from '../../lib/settings'
import { cleanDays, habitProgress, habitValue, monthMoney } from '../../lib/stats'
import type { Habit, Oath } from '../../lib/types'
import { Icon } from '../../ui/Icon'
import { Counter, Bar, Ring } from '../../ui/kit'
import { Orb } from '../../ui/Orb'
import { rise } from '../../ui/motion'
import { Page } from '../../ui/Page'
import { toast } from '../../ui/Toast'
import { QuickAddSheet } from '../finance/QuickAdd'
import { setHabitsTab } from '../habits/HabitsScreen'
import { fmtHabit, habitIcon, setHabitValue, sortHabits } from '../habits/util'
import { startFocus } from '../plan/focus'
import { PrioritiesEditor } from '../plan/Priorities'
import './today.css'

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

function left(ms: number, lang: 'pl' | 'en') {
  const m = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(m / 60)
  return lang === 'en' ? (h ? `${h} h ${m % 60} min left` : `${m} min left`) : h ? `zostało ${h} h ${m % 60} min` : `zostało ${m} min`
}

function OathCard({ o, now }: { o: Oath; now: number }) {
  const t = useT()
  const lang = useLang()
  const due = new Date(o.due_at).getTime()
  const overdue = due < now
  const close = (status: 'kept' | 'broken') => {
    haptic(status === 'kept' ? 'success' : 'warning')
    db.update('oaths', o.id, { status })
    if (status === 'kept') toast(t('Dotrzymane. Tak się to robi.', "Kept. That's how it's done."), { icon: 'shieldCheck' })
    else toast(t('Złamane. Mentor wie.', 'Broken. The mentor knows.'), { tone: 'pink', action: { label: t('Pogadaj', 'Talk'), run: () => navigate('mentor') } })
  }
  return (
    <motion.section variants={rise} className={`glass glass--strong td-oath ${overdue ? 'td-oath--due' : ''}`}>
      <div className="td-oath__label">
        <span>{t('Twoja przysięga', 'Your oath')}</span>
        <span className="td-oath__left">{overdue ? t('po terminie', 'overdue') : left(due - now, lang)}</span>
      </div>
      <p className="td-oath__text">{o.text}</p>
      <div className="row gap-2">
        <button className="btn btn--ink btn--sm grow" onClick={() => close('kept')}>
          <Icon name="check" /> {t('Dotrzymałem', 'I kept it')}
        </button>
        {overdue && (
          <button className="btn btn--danger btn--sm grow" onClick={() => close('broken')}>
            {t('Złamałem', 'I broke it')}
          </button>
        )}
      </div>
    </motion.section>
  )
}

function HabitTile({ h, value, progress }: { h: Habit; value: number; progress: number }) {
  const lang = useLang()
  const done = progress >= 1
  const tap = () => {
    haptic(done ? 'tap' : 'select')
    if (h.kind === 'check') setHabitValue(h, todayKey(), value ? 0 : 1)
    else setHabitValue(h, todayKey(), value + (h.step ?? 1))
    if (!done && (h.kind === 'check' || value + (h.step ?? 1) >= h.target)) haptic('success')
  }
  return (
    <button className={`td-habit ${done ? 'td-habit--done' : ''}`} onClick={tap} aria-label={`${h.name}: ${fmtHabit(h, value, lang)}`}>
      <Ring value={progress} size={46} stroke={5}>
        <Icon name={habitIcon(h)} size={18} style={{ color: done ? 'var(--sky)' : 'var(--ink-3)' }} />
      </Ring>
      <span className="td-habit__name">{h.name}</span>
      <span className="td-habit__val">{h.kind === 'check' ? (done ? '✓' : '—') : `${fmtHabit(h, value, lang)}`}</span>
    </button>
  )
}

export default function TodayScreen() {
  const t = useT()
  const lang = useLang()
  const now = useNow()
  const today = todayKey()
  const [addOpen, setAddOpen] = useState(false)

  const chat = useRows('chat_messages')
  const oaths = useRows('oaths')
  const habits = useRows('habits')
  const logs = useRows('habit_logs')
  const streaks = useRows('streaks')
  const blocks = useRows('calendar_blocks')
  const incomes = useRows('incomes')
  const expenses = useRows('expenses')
  const budgets = useRows('budgets')
  const measurements = useRows('measurements')
  const reviews = useRows('weekly_reviews')

  const lastMentor = [...chat].reverse().find((m) => m.role === 'mentor')
  const openOaths = oaths.filter((o) => o.status === 'open').sort((a, b) => a.due_at.localeCompare(b.due_at))
  const daily = habits.filter((h) => !h.archived && h.period === 'day').sort(sortHabits)
  const doneCount = daily.filter((h) => habitProgress(h, logs) >= 1).length
  const nowMin = nowMinutes(new Date(now))
  const next = blocks
    .filter((b) => b.date === today && !b.proposed && !b.done && b.end_min > nowMin)
    .sort((a, b) => a.start_min - b.start_min)[0]
  const money = monthMoney(monthKey(), incomes, expenses)
  const goal = budgets.find((b) => b.month === monthKey())?.income_goal ?? 10000
  const spentToday = expenses.filter((e) => e.date === today).reduce((a, e) => a + e.amount, 0)
  const scrollToday = measurements.find((m) => m.kind === 'scroll' && m.date === today)?.value ?? 0
  const isSunday = new Date().getDay() === 0
  const weekReviewed = reviews.some((r) => r.week_start === weekStart())

  return (
    <Page
      title={t('Dziś', 'Today')}
      overline={fmtDay(today, lang)}
      action={
        <button className="btn btn--accent btn--sm" onClick={() => { haptic('tap'); setAddOpen(true) }} aria-label={t('Dodaj wydatek', 'Add expense')}>
          <Icon name="plus" /> {t('Wydatek', 'Expense')}
        </button>
      }
    >
      {lastMentor && (
        <motion.button variants={rise} className="glass glass--dark td-mentor" onClick={() => navigate('mentor')}>
          <Orb size={40} mood={lastMentor.meta?.stage === 'scold' ? 'alert' : lastMentor.meta?.stage === 'warm' ? 'calm' : 'neutral'} />
          <div className="stack grow" style={{ minWidth: 0 }}>
            <p className="td-mentor__text">{lastMentor.content}</p>
            <span className="td-mentor__meta">
              {relTime(lastMentor.created_at, lang)} · {t('Odpowiedz', 'Reply')} <Icon name="arrowRight" />
            </span>
          </div>
        </motion.button>
      )}

      {openOaths.slice(0, 2).map((o) => <OathCard key={o.id} o={o} now={now} />)}

      {isSunday && !weekReviewed && (
        <motion.button variants={rise} className="glass td-sunday" onClick={() => navigate('reviews')}>
          <Icon name="reviews" style={{ color: 'var(--sky)' }} />
          <p className="grow">{t('Niedziela. Czas na przegląd tygodnia.', "Sunday. Time for the weekly review.")}</p>
          <Icon name="chevronRight" size={18} style={{ color: 'var(--ink-3)' }} />
        </motion.button>
      )}

      <motion.section variants={rise} className="glass td-card">
        <div className="td-card__head">
          <h2 className="td-card__title">{t('3 priorytety', '3 priorities')}</h2>
          <button className="td-link" onClick={() => navigate('plan')}>{t('Plan', 'Plan')} <Icon name="chevronRight" /></button>
        </div>
        <PrioritiesEditor date={today} />
      </motion.section>

      <motion.section variants={rise} className="glass td-card">
        <div className="td-card__head">
          <h2 className="td-card__title">{t('Nawyki', 'Habits')}</h2>
          <span className="td-card__aside">{doneCount}/{daily.length}</span>
        </div>
        <div className="td-habits">
          {daily.map((h) => <HabitTile key={h.id} h={h} value={habitValue(logs, h.id, today)} progress={habitProgress(h, logs)} />)}
        </div>
      </motion.section>

      {streaks.length > 0 && (
        <motion.section variants={rise} className="glass td-limits" aria-label={t('Ograniczenia', 'Limits')}>
          {[...streaks].sort((a, b) => a.sort - b.sort).map((s) => {
            const isScroll = s.key === 'scroll'
            const limit = s.daily_limit_minutes ?? 0
            const risk = isScroll && limit > 0 && scrollToday > limit
            return (
              <button
                key={s.id}
                className={`td-limit ${risk ? 'td-limit--risk' : ''}`}
                onClick={() => {
                  setHabitsTab('limits')
                  navigate('habits')
                }}
              >
                <span className="td-limit__num">
                  <Counter value={cleanDays(s)} />
                  <small>{plural(cleanDays(s), lang, DAYS)}</small>
                </span>
                <span className="td-limit__name">{s.name}</span>
                {isScroll && limit > 0 && <span className="t-caption t-3 t-num">{t('dziś', 'today')} {scrollToday}/{limit} min</span>}
              </button>
            )
          })}
        </motion.section>
      )}

      <motion.section variants={rise} className="glass td-card">
        <div className="td-card__head">
          <h2 className="td-card__title">{t('Następny blok', 'Next block')}</h2>
          <button className="td-link" onClick={() => navigate('plan')}>{t('Kalendarz', 'Calendar')} <Icon name="chevronRight" /></button>
        </div>
        {next ? (
          <div className="td-next">
            <span className="td-next__time">{minutesToHHMM(next.start_min)}</span>
            <div className="stack grow" style={{ minWidth: 0 }}>
              <span className="td-next__title">{next.title}</span>
              <span className="td-next__sub t-num">{minutesToHHMM(next.start_min)}–{minutesToHHMM(next.end_min)}</span>
            </div>
            <button className="btn btn--sky btn--sm" onClick={() => { haptic('tap'); startFocus({ title: next.title, block_id: next.id, goal_id: next.goal_id ?? null }) }}>
              <Icon name="play" /> {t('Skupienie', 'Focus')}
            </button>
          </div>
        ) : (
          <p className="t-sub t-3">{t('Nic więcej w kalendarzu na dziś.', 'Nothing else in the calendar today.')}</p>
        )}
      </motion.section>

      <motion.section variants={rise} className="glass td-card">
        <div className="td-card__head">
          <h2 className="td-card__title">{t('Pieniądze', 'Money')}</h2>
          <button className="td-link" onClick={() => navigate('finance')}>{t('Finanse', 'Finance')} <Icon name="chevronRight" /></button>
        </div>
        <div className="td-money">
          <div className="stack gap-1">
            <span className="td-money__big"><Counter value={money.income} format={(v) => fmtMoney(v, lang)} /></span>
            <span className="td-money__sub">{t('przychód w tym miesiącu', 'income this month')} · {t('cel', 'goal')} {fmtMoney(goal, lang)}</span>
          </div>
          <div className="stack gap-1" style={{ textAlign: 'right' }}>
            <span className="t-sub t-strong t-num">{fmtMoney(spentToday, lang)}</span>
            <span className="td-money__sub">{t('wydane dziś', 'spent today')}</span>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Bar value={goal ? money.income / goal : 0} thick />
          </div>
        </div>
      </motion.section>

      <QuickAddSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </Page>
  )
}
