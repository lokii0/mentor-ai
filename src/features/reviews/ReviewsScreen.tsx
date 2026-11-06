import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { db, useRows } from '../../lib/db'
import { addDays, addMonths, DAYS, fmtMoney, fmtMonth, monthDays, monthKey, parseDay, plural, todayKey, weekDays, weekStart } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { mentorTask, mentorThinking } from '../../lib/mentor'
import { useLang, useT } from '../../lib/settings'
import { atom } from '../../lib/store'
import type { Lang } from '../../lib/types'
import { Bars } from '../../ui/charts'
import { Icon } from '../../ui/Icon'
import { Bar, Card, Counter, Empty, Segmented } from '../../ui/kit'
import { rise, stagger } from '../../ui/motion'
import { Orb } from '../../ui/Orb'
import { Page } from '../../ui/Page'
import { toast } from '../../ui/Toast'
import { monthPayload, monthStats, weekPayload, weekStats, type MonthData } from './reviewStats'
import './reviews.css'

const tab = atom<'week' | 'month'>('week')

const loc = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'pl-PL')

function weekLabel(ws: string, lang: Lang): string {
  const a = parseDay(ws)
  const b = parseDay(addDays(ws, 6))
  const m = (d: Date) => new Intl.DateTimeFormat(loc(lang), { month: 'short' }).format(d).replace('.', '')
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${m(b)}` : `${a.getDate()} ${m(a)} – ${b.getDate()} ${m(b)}`
}

function useReviewData(): MonthData {
  const habits = useRows('habits')
  const logs = useRows('habit_logs')
  const streaks = useRows('streaks')
  const relapses = useRows('relapses')
  const triggers = useRows('triggers_log')
  const priorities = useRows('priorities')
  const measurements = useRows('measurements')
  const incomes = useRows('incomes')
  const expenses = useRows('expenses')
  const categories = useRows('categories')
  const budgets = useRows('budgets')
  const goals = useRows('goals')
  const steps = useRows('goal_steps')
  return useMemo(
    () => ({ habits, logs, streaks, relapses, triggers, priorities, measurements, incomes, expenses, categories, budgets, goals, steps }),
    [habits, logs, streaks, relapses, triggers, priorities, measurements, incomes, expenses, categories, budgets, goals, steps],
  )
}

export default function ReviewsScreen() {
  const t = useT()
  const mode = tab.use()
  return (
    <Page title={t('Podsumowania', 'Reviews')}>
      <motion.div variants={rise}>
        <Segmented
          label={t('Okres', 'Period')}
          value={mode}
          onChange={(v) => tab.set(v)}
          options={[
            { value: 'week', label: t('Tydzień', 'Week') },
            { value: 'month', label: t('Miesiąc', 'Month') },
          ]}
        />
      </motion.div>
      <motion.div key={mode} className="stack gap-5" variants={stagger} initial="hidden" animate="show">
        {mode === 'week' ? <Weekly /> : <Monthly />}
      </motion.div>
    </Page>
  )
}

function Picker({ label, sub, onPrev, onNext, canNext, reset }: { label: string; sub?: string; onPrev: () => void; onNext: () => void; canNext: boolean; reset?: { label: string; run: () => void } }) {
  const t = useT()
  return (
    <Card variant="strong">
      <div className="rv-picker">
        <button className="icon-btn icon-btn--sm icon-btn--plain" onClick={() => { haptic('select'); onPrev() }} aria-label={t('Wcześniej', 'Earlier')}>
          <Icon name="chevronLeft" />
        </button>
        <div className="rv-picker__label">
          <span className="rv-picker__main">{label}</span>
          {sub && <span className="rv-picker__sub">{sub}</span>}
        </div>
        {reset && (
          <button className="btn btn--ghost btn--sm" onClick={reset.run}>
            {reset.label}
          </button>
        )}
        <button className="icon-btn icon-btn--sm icon-btn--plain" disabled={!canNext} style={{ opacity: canNext ? 1 : 0.3 }} onClick={() => { haptic('select'); onNext() }} aria-label={t('Później', 'Later')}>
          <Icon name="chevronRight" />
        </button>
      </div>
    </Card>
  )
}

function MentorCard({ title, sub, label, onAsk, feedback, extra }: { title: string; sub: string; label: string; onAsk: () => void; feedback?: string | null; extra?: { label: string; text: string } | null }) {
  const t = useT()
  const thinking = mentorThinking.use()
  return (
    <>
      <Card>
        <div className="rv-mentor">
          <div className="rv-mentor__head">
            <Orb size={40} thinking={thinking} />
            <div className="grow">
              <p className="rv-mentor__title">{title}</p>
              <p className="rv-mentor__sub">{sub}</p>
            </div>
          </div>
          <button className="btn btn--accent btn--block" onClick={onAsk} disabled={thinking}>
            {thinking ? t('Mentor czyta liczby…', 'The mentor is reading the numbers…') : label}
          </button>
        </div>
      </Card>
      {feedback && (
        <Card variant="dark">
          <div className="rv-feedback">
            <Orb size={28} />
            <div className="stack gap-3 grow">
              <div>
                <p className="rv-feedback__label">{t('Zwrot od mentora', 'Mentor feedback')}</p>
                <p className="rv-feedback__text">{feedback}</p>
              </div>
              {extra?.text && (
                <div>
                  <p className="rv-feedback__label">{extra.label}</p>
                  <p className="rv-feedback__text">{extra.text}</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </>
  )
}

// ---------------- Week (Sunday review) ----------------

function Weekly() {
  const t = useT()
  const lang = useLang()
  const current = weekStart()
  const [ws, setWs] = useState(current)
  const data = useReviewData()
  const stats = useMemo(() => weekStats(ws, data), [ws, data])
  const reviews = useRows('weekly_reviews')
  const review = reviews.find((r) => r.week_start === ws)
  const [form, setForm] = useState({ positives: '', negatives: '', plan_next: '' })
  const today = todayKey()
  const isSunday = new Date().getDay() === 0

  useEffect(() => {
    setForm({ positives: review?.positives ?? '', negatives: review?.negatives ?? '', plan_next: review?.plan_next ?? '' })
    // reset when the week (or its saved row) changes, not on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, review?.id])

  const save = (patch: Partial<{ positives: string; negatives: string; plan_next: string; mentor_feedback: string | null }> = {}) => {
    const next = { ...form, ...patch }
    const unchanged = (review?.positives ?? '') === next.positives && (review?.negatives ?? '') === next.negatives && (review?.plan_next ?? '') === next.plan_next
    if (unchanged && patch.mentor_feedback === undefined) return
    db.upsertBy('weekly_reviews', (r) => r.week_start === ws, {
      week_start: ws,
      stats: weekPayload(stats),
      positives: next.positives,
      negatives: next.negatives,
      plan_next: next.plan_next,
      mentor_feedback: patch.mentor_feedback !== undefined ? patch.mentor_feedback : (review?.mentor_feedback ?? null),
    })
  }

  const ask = async () => {
    haptic('tap')
    const res = await mentorTask('weekly_review', { week_start: ws, stats: weekPayload(stats), ...form })
    if (!res) {
      toast(t('Mentor teraz nie odpowiada. Spróbuj za chwilę.', 'The mentor is not answering right now. Try again shortly.'), { icon: 'cloud' })
      return
    }
    save({ mentor_feedback: res.feedback })
    haptic('success')
  }

  const wd = new Intl.DateTimeFormat(loc(lang), { weekday: 'short' })
  const past = [...reviews].filter((r) => r.week_start !== ws).sort((a, b) => b.week_start.localeCompare(a.week_start)).slice(0, 8)

  return (
    <>
      <Picker
        label={weekLabel(ws, lang)}
        sub={ws === current ? t('Ten tydzień', 'This week') : undefined}
        onPrev={() => setWs(addDays(ws, -7))}
        onNext={() => setWs(addDays(ws, 7))}
        canNext={ws < current}
        reset={ws !== current ? { label: t('Teraz', 'Now'), run: () => setWs(current) } : undefined}
      />

      {ws === current && isSunday && !review?.mentor_feedback && (
        <Card>
          <div className="rv-prompt">
            <Orb size={36} mood="alert" />
            <p>{t('Niedziela. Czas na przegląd: liczby są niżej, Ty dopisz, co poszło dobrze, co źle i plan na tydzień.', "Sunday. Time for the review: the numbers are below — you add what went well, what didn't, and next week's plan.")}</p>
          </div>
        </Card>
      )}

      <Card>
        <div className="stats">
          <div className="stat">
            <span className="stat__label">{t('Nawyki', 'Habits')}</span>
            <span className="stat__value"><Counter value={stats.habits_pct} /><span className="stat__unit">%</span></span>
          </div>
          <div className="stat">
            <span className="stat__label">{t('Priorytety', 'Priorities')}</span>
            <span className="stat__value t-num">{stats.priorities.done}<span className="stat__unit">/ {stats.priorities.total}</span></span>
          </div>
          <div className="stat">
            <span className="stat__label">{t('Skupienie', 'Focus')}</span>
            <span className="stat__value"><Counter value={stats.focus_min} /><span className="stat__unit">min</span></span>
          </div>
          <div className="stat">
            <span className="stat__label">{t('Pokusy: wygrane / przegrane', 'Temptations: won / lost')}</span>
            <span className="stat__value t-num">
              {stats.triggers.won}
              <span className="stat__unit">/ </span>
              <span style={{ color: stats.triggers.slipped ? 'var(--pink-ink)' : undefined }}>{stats.triggers.slipped}</span>
            </span>
          </div>
        </div>
        <div className="rv-chart">
          <Bars
            height={132}
            format={(v) => `${Math.round(v)}%`}
            data={stats.daily.map((d) => ({ label: wd.format(parseDay(d.day)).replace('.', ''), value: Math.round(d.pct * 100), current: d.day === today }))}
          />
        </div>
      </Card>

      <Card>
        <div className="rv-card-head">
          <h2 className="sec-head__title">{t('Nawyki w tym tygodniu', 'Habits this week')}</h2>
        </div>
        {stats.habits.length ? (
          <div className="rv-rows">
            {stats.habits.map((h) => (
              <div key={h.id} className="rv-row">
                <div className="rv-row__top">
                  <span className="rv-row__name">{h.name}</span>
                  <span className="rv-row__val">
                    <small>{h.detail}</small>
                    {Math.round(h.pct * 100)}%
                  </span>
                </div>
                <Bar value={h.pct} tone={h.pct < 0.4 ? 'pink' : 'sky'} />
              </div>
            ))}
          </div>
        ) : (
          <Empty>{t('Brak danych o nawykach w tym tygodniu.', 'No habit data for this week.')}</Empty>
        )}
      </Card>

      <Card>
        <div className="rv-card-head">
          <h2 className="sec-head__title">{t('Ograniczenia', 'Limits')}</h2>
        </div>
        <div className="list">
          {stats.limits.map((l) => (
            <div key={l.id} className="lrow">
              <span className="lrow__main">
                <span className="lrow__title">{l.name}</span>
                <span className="lrow__sub">
                  {l.clean} {plural(l.clean, lang, DAYS)} {t('czysto teraz', 'clean now')}
                </span>
              </span>
              <span className={`pill ${l.relapses ? 'pill--pink' : ''}`}>
                {l.relapses
                  ? t(`${l.relapses} ${plural(l.relapses, 'pl', { pl: ['potknięcie', 'potknięcia', 'potknięć'], en: ['slip', 'slips'] })}`, `${l.relapses} ${l.relapses === 1 ? 'slip' : 'slips'}`)
                  : t('bez potknięć', 'no slips')}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="stats">
          <div className="stat">
            <span className="stat__label">{t('Przychód w tygodniu', 'Income this week')}</span>
            <span className="stat__value">{fmtMoney(stats.income, lang)}</span>
          </div>
          <div className="stat">
            <span className="stat__label">{t('Wydatki w tygodniu', 'Spending this week')}</span>
            <span className="stat__value">{fmtMoney(stats.expense, lang)}</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="rv-form">
          <h2 className="sec-head__title">{t('Twoja ocena tygodnia', 'Your take on the week')}</h2>
          <label className="field">
            <span className="field__label">{t('Co poszło dobrze', 'What went well')}</span>
            <textarea className="textarea" rows={3} value={form.positives} onChange={(e) => setForm({ ...form, positives: e.target.value })} onBlur={() => save()} />
          </label>
          <label className="field">
            <span className="field__label">{t('Co poszło źle', "What didn't")}</span>
            <textarea className="textarea" rows={3} value={form.negatives} onChange={(e) => setForm({ ...form, negatives: e.target.value })} onBlur={() => save()} />
          </label>
          <label className="field">
            <span className="field__label">{t('Plan na następny tydzień', 'Plan for next week')}</span>
            <textarea className="textarea" rows={3} value={form.plan_next} onChange={(e) => setForm({ ...form, plan_next: e.target.value })} onBlur={() => save()} />
          </label>
        </div>
      </Card>

      <MentorCard
        title={t('Zwrot od mentora', 'Mentor feedback')}
        sub={t('Na podstawie liczb z tego tygodnia i Twoich notatek.', "Based on this week's numbers and your notes.")}
        label={review?.mentor_feedback ? t('Poproś o nowy zwrot', 'Ask again') : t('Poproś o zwrot', 'Ask for feedback')}
        onAsk={ask}
        feedback={review?.mentor_feedback}
      />

      {past.length > 0 && (
        <Card>
          <div className="rv-card-head">
            <h2 className="sec-head__title">{t('Wcześniejsze przeglądy', 'Earlier reviews')}</h2>
          </div>
          <div className="list rv-history">
            {past.map((r) => {
              const pct = Number((r.stats as { habits_pct?: number })?.habits_pct ?? 0)
              return (
                <button key={r.id} className="lrow lrow--tap" onClick={() => { haptic('select'); setWs(r.week_start) }}>
                  <span className="lrow__main">
                    <span className="lrow__title">{weekLabel(r.week_start, lang)}</span>
                    <span className="lrow__sub">{t(`Nawyki ${pct}%`, `Habits ${pct}%`)}</span>
                  </span>
                  {r.mentor_feedback && <span className="pill pill--sky">{t('zwrot', 'feedback')}</span>}
                  <Icon name="chevronRight" className="lrow__chev" />
                </button>
              )
            })}
          </div>
        </Card>
      )}
    </>
  )
}

// ---------------- Month ----------------

function MonthHeat({ month, heat }: { month: string; heat: Record<string, number> }) {
  const t = useT()
  const lang = useLang()
  const days = monthDays(month)
  const offset = (parseDay(days[0]).getDay() + 6) % 7
  const today = todayKey()
  const wd = new Intl.DateTimeFormat(loc(lang), { weekday: 'narrow' })
  return (
    <div className="rv-cal">
      <div className="rv-cal__grid" role="img" aria-label={t('Kalendarz nawyków w miesiącu', 'Habit calendar for the month')}>
        {weekDays(weekStart(days[0])).map((d) => (
          <span key={d} className="rv-cal__wd">{wd.format(parseDay(d))}</span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {days.map((d, i) => {
          const v = heat[d]
          const future = d > today
          const cls = ['rv-cell', future ? 'rv-cell--future' : '', v != null && v > 0.55 ? 'rv-cell--strong' : '', d === today ? 'rv-cell--today' : ''].join(' ')
          return (
            <motion.span
              key={d}
              className={cls}
              style={v != null && v > 0 ? { background: `rgba(5,147,198,${0.16 + v * 0.84})` } : undefined}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4, delay: Math.min(0.5, i * 0.012) }}
              title={v != null ? `${d}: ${Math.round(v * 100)}%` : d}
            >
              {parseDay(d).getDate()}
            </motion.span>
          )
        })}
      </div>
      <div className="rv-legend" aria-hidden="true">
        {t('mniej', 'less')}
        {[0.2, 0.45, 0.7, 1].map((v) => (
          <span key={v} style={{ background: `rgba(5,147,198,${0.16 + v * 0.84})` }} />
        ))}
        {t('więcej', 'more')}
      </div>
    </div>
  )
}

function Monthly() {
  const t = useT()
  const lang = useLang()
  const current = monthKey()
  const [month, setMonth] = useState(current)
  const data = useReviewData()
  const stats = useMemo(() => monthStats(month, data), [month, data])
  const reviews = useRows('monthly_reviews')
  const review = reviews.find((r) => r.month === month)
  const maxCat = Math.max(1, ...stats.byCategory.map((c) => c.amount))
  const overBudget = stats.total_limit > 0 && stats.expense > stats.total_limit

  const ask = async () => {
    haptic('tap')
    const payload = monthPayload(stats)
    const res = await mentorTask('monthly_review', { month, stats: payload })
    if (!res) {
      toast(t('Mentor teraz nie odpowiada. Spróbuj za chwilę.', 'The mentor is not answering right now. Try again shortly.'), { icon: 'cloud' })
      return
    }
    db.upsertBy('monthly_reviews', (r) => r.month === month, { month, stats: payload, mentor_feedback: res.feedback, recommendations: res.recommendations })
    haptic('success')
  }

  return (
    <>
      <Picker
        label={fmtMonth(month, lang)}
        onPrev={() => setMonth(addMonths(month, -1))}
        onNext={() => setMonth(addMonths(month, 1))}
        canNext={month < current}
        reset={month !== current ? { label: t('Teraz', 'Now'), run: () => setMonth(current) } : undefined}
      />

      <Card>
        <div className="rv-card-head row between">
          <h2 className="sec-head__title">{t('Nawyki dzień po dniu', 'Habits day by day')}</h2>
          <span className="t-num t-strong">{stats.habits_pct}%</span>
        </div>
        <MonthHeat month={month} heat={stats.heat} />
      </Card>

      <Card>
        <div className="rv-hero">
          <span className="stat__label">{t('Przychód', 'Income')}</span>
          <span className="rv-hero__value">
            <Counter value={stats.income} format={(v) => fmtMoney(Math.round(v), lang)} />
          </span>
          <span className="rv-hero__of">
            {t(`z celu ${fmtMoney(stats.income_goal, lang)} · ${Math.round((stats.income / stats.income_goal) * 100)}%`, `of the ${fmtMoney(stats.income_goal, lang)} goal · ${Math.round((stats.income / stats.income_goal) * 100)}%`)}
          </span>
        </div>
        <div className="rv-hero__bar">
          <Bar value={stats.income / stats.income_goal} thick />
        </div>
        <div className="stats" style={{ borderTop: '1px solid var(--hair)' }}>
          <div className="stat">
            <span className="stat__label">{t('Wydatki', 'Spending')}</span>
            <span className="stat__value" style={{ color: overBudget ? 'var(--pink-ink)' : undefined }}>{fmtMoney(stats.expense, lang)}</span>
            {stats.total_limit > 0 && <span className="stat__note">{t(`budżet ${fmtMoney(stats.total_limit, lang)}`, `budget ${fmtMoney(stats.total_limit, lang)}`)}</span>}
          </div>
          <div className="stat">
            <span className="stat__label">{t('Saldo', 'Balance')}</span>
            <span className="stat__value">{fmtMoney(stats.balance, lang, { sign: true })}</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="rv-card-head">
          <h2 className="sec-head__title">{t('Wydatki według kategorii', 'Spending by category')}</h2>
        </div>
        {stats.byCategory.length ? (
          <div className="rv-rows">
            {stats.byCategory.map((c) => {
              const over = c.limit != null && c.limit > 0 && c.amount > c.limit
              return (
                <div key={c.id} className="rv-row">
                  <div className="rv-row__top">
                    <span className="rv-row__name">{c.name}</span>
                    <span className="rv-row__val" style={{ color: over ? 'var(--pink-ink)' : undefined }}>
                      {c.limit ? <small>{t(`limit ${fmtMoney(c.limit, lang)}`, `limit ${fmtMoney(c.limit, lang)}`)}</small> : null}
                      {fmtMoney(c.amount, lang)}
                    </span>
                  </div>
                  <Bar value={c.limit ? c.amount / c.limit : c.amount / maxCat} tone={over ? 'pink' : 'deep'} />
                </div>
              )
            })}
          </div>
        ) : (
          <Empty>{t('W tym miesiącu nie ma jeszcze wydatków.', 'No spending recorded this month yet.')}</Empty>
        )}
      </Card>

      <Card>
        <div className="rv-card-head">
          <h2 className="sec-head__title">{t('Cele', 'Goals')}</h2>
        </div>
        {stats.goals.length ? (
          <div className="rv-rows">
            {stats.goals.map((g) => (
              <div key={g.id} className="rv-row">
                <div className="rv-row__top">
                  <span className="rv-row__name">{g.title}</span>
                  <span className="rv-row__val">
                    {g.total ? `${g.done}/${g.total}` : <small>{t('brak kroków', 'no steps')}</small>}
                  </span>
                </div>
                {g.total > 0 && <Bar value={g.done / g.total} />}
              </div>
            ))}
          </div>
        ) : (
          <Empty>{t('Brak aktywnych celów.', 'No active goals.')}</Empty>
        )}
      </Card>

      <Card>
        <div className="stats">
          <div className="stat">
            <span className="stat__label">{t('Skupienie', 'Focus')}</span>
            <span className="stat__value"><Counter value={stats.focus_min} /><span className="stat__unit">min</span></span>
          </div>
          <div className="stat">
            <span className="stat__label">{t('Priorytety', 'Priorities')}</span>
            <span className="stat__value t-num">{stats.priorities.done}<span className="stat__unit">/ {stats.priorities.total}</span></span>
          </div>
          <div className="stat">
            <span className="stat__label">{t('Potknięcia', 'Slips')}</span>
            <span className="stat__value t-num" style={{ color: stats.relapses ? 'var(--pink-ink)' : undefined }}>{stats.relapses}</span>
          </div>
          <div className="stat">
            <span className="stat__label">{t('Saldo', 'Balance')}</span>
            <span className="stat__value">{fmtMoney(stats.balance, lang, { sign: true })}</span>
          </div>
        </div>
      </Card>

      <MentorCard
        title={t('Wnioski mentora', "Mentor's conclusions")}
        sub={t('Nawyki, przychód vs cel 10 tys., wydatki i cele z całego miesiąca.', 'Habits, income vs the 10k goal, spending and goals for the month.')}
        label={review?.mentor_feedback ? t('Przelicz wnioski od nowa', 'Recompute conclusions') : t('Poproś o wnioski', 'Ask for conclusions')}
        onAsk={ask}
        feedback={review?.mentor_feedback}
        extra={review?.recommendations ? { label: t('Rekomendacje', 'Recommendations'), text: review.recommendations } : null}
      />
    </>
  )
}
