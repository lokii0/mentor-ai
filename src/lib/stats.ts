// Shared computations over table rows. Pure functions — used by screens, the mentor context and reviews.
import { addDays, daysSince, monthKey, todayKey, weekDays, weekStart } from './dates'
import type { Category, Expense, Habit, HabitLog, Income, Streak } from './types'

/** Logged value of a habit on a given day (logs are one row per habit+day). */
export function habitValue(logs: HabitLog[], habitId: string, date: string): number {
  let v = 0
  for (const l of logs) if (l.habit_id === habitId && l.date === date) v += l.value
  return v
}

/** Sum over the Monday-based week containing `date`. */
export function habitWeekValue(logs: HabitLog[], habitId: string, date: string = todayKey()): number {
  const days = new Set(weekDays(weekStart(date)))
  let v = 0
  for (const l of logs) if (l.habit_id === habitId && days.has(l.date)) v += l.value
  return v
}

/** 0..1 progress for today's (or this week's) target. */
export function habitProgress(h: Habit, logs: HabitLog[], date: string = todayKey()): number {
  const v = h.period === 'week' ? habitWeekValue(logs, h.id, date) : habitValue(logs, h.id, date)
  return h.target > 0 ? Math.min(1, v / h.target) : v > 0 ? 1 : 0
}

export function habitDoneOn(h: Habit, logs: HabitLog[], date: string): boolean {
  if (h.period === 'week') return habitValue(logs, h.id, date) > 0
  return habitValue(logs, h.id, date) >= h.target
}

/**
 * Current series for a daily habit, in days. Today counts if already done; an unfinished
 * today doesn't break the series. Shield (PRD 6.3): one miss inside the series is forgiven.
 * Weekly habits count consecutive weeks that hit the target.
 */
export function habitSeries(h: Habit, logs: HabitLog[], today: string = todayKey()): { length: number; shieldUsed: boolean } {
  if (h.period === 'week') {
    let n = 0
    let shieldUsed = false
    let ws = weekStart(today)
    const thisWeekDone = habitWeekValue(logs, h.id, ws) >= h.target
    if (thisWeekDone) n++
    ws = addDays(ws, -7)
    for (let i = 0; i < 104; i++) {
      if (habitWeekValue(logs, h.id, ws) >= h.target) n++
      else if (h.shield && !shieldUsed && n > 0) shieldUsed = true
      else break
      ws = addDays(ws, -7)
    }
    return { length: n, shieldUsed }
  }
  let n = 0
  let shieldUsed = false
  if (habitDoneOn(h, logs, today)) n++
  let d = addDays(today, -1)
  for (let i = 0; i < 730; i++) {
    if (habitDoneOn(h, logs, d)) n++
    else if (h.shield && !shieldUsed && n > 0 && habitDoneOn(h, logs, addDays(d, -1))) shieldUsed = true
    else break
    d = addDays(d, -1)
  }
  return { length: n, shieldUsed }
}

/** Clean days for a limit counter (18+, cigarettes, scroll). No shield — a slip resets. */
export function cleanDays(s: Streak, now: Date = new Date()): number {
  return daysSince(s.started_at, now)
}

export function bestDays(s: Streak, now: Date = new Date()): number {
  return Math.max(s.best_days, cleanDays(s, now))
}

export interface MonthMoney {
  income: number
  expense: number
  balance: number
  byCategory: Map<string, number>
}

export function monthMoney(month: string, incomes: Income[], expenses: Expense[]): MonthMoney {
  let income = 0
  let expense = 0
  const byCategory = new Map<string, number>()
  for (const i of incomes) if (monthKey(i.date) === month) income += i.amount
  for (const e of expenses)
    if (monthKey(e.date) === month) {
      expense += e.amount
      byCategory.set(e.category_id, (byCategory.get(e.category_id) ?? 0) + e.amount)
    }
  return { income, expense, balance: income - expense, byCategory }
}

export function categoryName(cats: Category[], id: string): string {
  return cats.find((c) => c.id === id)?.name ?? '—'
}
