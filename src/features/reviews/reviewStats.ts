// Review numbers, computed only from rows. Pure functions.
import { addDays, dayKey, monthDays, monthKey, todayKey, weekDays } from '../../lib/dates'
import { cleanDays, habitDoneOn, habitWeekValue, monthMoney } from '../../lib/stats'
import type {
  Budget, Category, Expense, Goal, GoalStep, Habit, HabitLog, Income, Measurement, Priority, Relapse, Streak, TriggerLog,
} from '../../lib/types'

export interface ReviewData {
  habits: Habit[]
  logs: HabitLog[]
  streaks: Streak[]
  relapses: Relapse[]
  triggers: TriggerLog[]
  priorities: Priority[]
  measurements: Measurement[]
  incomes: Income[]
  expenses: Expense[]
}

const createdDay = (iso: string) => dayKey(new Date(iso))

/** Days of `days` this daily habit could have been done on, up to today. Today only counts once done. */
function dailyRate(h: Habit, logs: HabitLog[], days: string[], today: string): { done: number; possible: number } {
  const from = createdDay(h.created_at)
  let done = 0
  let possible = 0
  for (const d of days) {
    if (d > today || d < from) continue
    const ok = habitDoneOn(h, logs, d)
    if (d === today && !ok) continue
    possible++
    if (ok) done++
  }
  return { done, possible }
}

export interface HabitRate {
  id: string
  name: string
  pct: number // 0..1
  detail: string
}

export interface WeekStats {
  habits: HabitRate[]
  habits_pct: number // 0..100, average of habit rates
  daily: { day: string; pct: number }[] // share of daily habits done each day
  limits: { id: string; name: string; clean: number; relapses: number }[]
  priorities: { done: number; total: number }
  focus_min: number
  income: number
  expense: number
  triggers: { won: number; slipped: number }
}

const active = (habits: Habit[]) => habits.filter((h) => !h.archived).sort((a, b) => a.sort - b.sort)

export function dayCompletion(habits: Habit[], logs: HabitLog[], d: string): number | null {
  const daily = active(habits).filter((h) => h.period === 'day' && createdDay(h.created_at) <= d)
  if (!daily.length) return null
  return daily.filter((h) => habitDoneOn(h, logs, d)).length / daily.length
}

export function weekStats(ws: string, data: ReviewData, today = todayKey()): WeekStats {
  const days = weekDays(ws)
  const set = new Set(days)
  const we = addDays(ws, 6)
  const habits: HabitRate[] = []
  for (const h of active(data.habits)) {
    if (createdDay(h.created_at) > we) continue
    if (h.period === 'week') {
      const v = habitWeekValue(data.logs, h.id, ws)
      habits.push({ id: h.id, name: h.name, pct: h.target > 0 ? Math.min(1, v / h.target) : v > 0 ? 1 : 0, detail: `${v}/${h.target}` })
    } else {
      const r = dailyRate(h, data.logs, days, today)
      if (!r.possible) continue
      habits.push({ id: h.id, name: h.name, pct: r.done / r.possible, detail: `${r.done}/${r.possible}` })
    }
  }
  const habits_pct = habits.length ? Math.round((habits.reduce((s, h) => s + h.pct, 0) / habits.length) * 100) : 0
  const daily = days.map((d) => ({ day: d, pct: d > today ? 0 : (dayCompletion(data.habits, data.logs, d) ?? 0) }))
  const inWeek = (iso: string) => set.has(dayKey(new Date(iso)))
  const limits = [...data.streaks]
    .sort((a, b) => a.sort - b.sort)
    .map((s) => ({ id: s.id, name: s.name, clean: cleanDays(s), relapses: data.relapses.filter((r) => r.streak_id === s.id && inWeek(r.at)).length }))
  const prios = data.priorities.filter((p) => set.has(p.date) && p.text.trim())
  const focus_min = data.measurements.filter((m) => m.kind === 'focus' && set.has(m.date)).reduce((s, m) => s + (m.value ?? 0), 0)
  const income = data.incomes.filter((i) => set.has(i.date)).reduce((s, i) => s + i.amount, 0)
  const expense = data.expenses.filter((e) => set.has(e.date)).reduce((s, e) => s + e.amount, 0)
  const tr = data.triggers.filter((x) => inWeek(x.at))
  return {
    habits,
    habits_pct,
    daily,
    limits,
    priorities: { done: prios.filter((p) => p.done).length, total: prios.length },
    focus_min,
    income,
    expense,
    triggers: { won: tr.filter((x) => x.outcome === 'won').length, slipped: tr.filter((x) => x.outcome === 'slipped').length },
  }
}

/** Flat numbers for the mentor and for the saved snapshot. */
export function weekPayload(s: WeekStats): Record<string, unknown> {
  return {
    habits_pct: s.habits_pct,
    habits: s.habits.map((h) => ({ name: h.name, pct: Math.round(h.pct * 100), done: h.detail })),
    limits: s.limits.map((l) => ({ name: l.name, clean_days: l.clean, relapses_this_week: l.relapses })),
    priorities_done: s.priorities.done,
    priorities_total: s.priorities.total,
    focus_min: s.focus_min,
    income: s.income,
    expense: s.expense,
    temptations_won: s.triggers.won,
    temptations_slipped: s.triggers.slipped,
  }
}

export interface MonthData extends ReviewData {
  categories: Category[]
  budgets: Budget[]
  goals: Goal[]
  steps: GoalStep[]
}

export interface MonthStats {
  heat: Record<string, number>
  habits_pct: number
  income: number
  expense: number
  balance: number
  income_goal: number
  total_limit: number
  byCategory: { id: string; name: string; amount: number; limit: number | null }[]
  goals: { id: string; title: string; done: number; total: number }[]
  focus_min: number
  relapses: number
  priorities: { done: number; total: number }
}

export function monthStats(month: string, data: MonthData, today = todayKey()): MonthStats {
  const days = monthDays(month)
  const heat: Record<string, number> = {}
  let sum = 0
  let n = 0
  for (const d of days) {
    if (d > today) continue
    const v = dayCompletion(data.habits, data.logs, d)
    if (v == null) continue
    heat[d] = v
    sum += v
    n++
  }
  const money = monthMoney(month, data.incomes, data.expenses)
  const budget = data.budgets.find((b) => b.month === month)
  const byCategory = data.categories
    .filter((c) => c.kind === 'expense')
    .map((c) => ({ id: c.id, name: c.name, amount: money.byCategory.get(c.id) ?? 0, limit: c.monthly_limit ?? null }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  const goals = data.goals
    .filter((g) => g.status !== 'paused')
    .sort((a, b) => a.sort - b.sort)
    .map((g) => {
      const st = data.steps.filter((s) => s.goal_id === g.id)
      return { id: g.id, title: g.title, done: st.filter((s) => s.done).length, total: st.length }
    })
  const inMonth = (k: string) => monthKey(k) === month
  const prios = data.priorities.filter((p) => inMonth(p.date) && p.text.trim())
  return {
    heat,
    habits_pct: n ? Math.round((sum / n) * 100) : 0,
    income: money.income,
    expense: money.expense,
    balance: money.balance,
    income_goal: budget?.income_goal || 10000,
    total_limit: budget?.total_limit ?? 0,
    byCategory,
    goals,
    focus_min: data.measurements.filter((m) => m.kind === 'focus' && inMonth(m.date)).reduce((s, m) => s + (m.value ?? 0), 0),
    relapses: data.relapses.filter((r) => monthKey(new Date(r.at)) === month).length,
    priorities: { done: prios.filter((p) => p.done).length, total: prios.length },
  }
}

export function monthPayload(s: MonthStats): Record<string, unknown> {
  return {
    habits_pct: s.habits_pct,
    income: s.income,
    income_goal: s.income_goal,
    expense: s.expense,
    balance: s.balance,
    expense_by_category: s.byCategory.map((c) => ({ name: c.name, amount: c.amount, limit: c.limit })),
    goals: s.goals.map((g) => ({ title: g.title, steps_done: g.done, steps_total: g.total })),
    focus_min: s.focus_min,
    relapses: s.relapses,
    priorities_done: s.priorities.done,
    priorities_total: s.priorities.total,
  }
}
