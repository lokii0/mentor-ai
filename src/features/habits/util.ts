import { db } from '../../lib/db'
import { fmtNum, plural } from '../../lib/dates'
import type { Habit, Lang, LimitKey } from '../../lib/types'
import type { IconName } from '../../ui/Icon'

export const WEEKS = { pl: ['tydzień', 'tygodnie', 'tygodni'] as [string, string, string], en: ['week', 'weeks'] as [string, string] }

export function habitIcon(h: Habit): IconName {
  if (h.preset) return h.preset
  return h.kind === 'duration' ? 'timer' : h.kind === 'check' ? 'habits' : 'target'
}

export function limitIcon(key: LimitKey): IconName {
  return key === 'adult' ? 'adult' : key === 'smoking' ? 'smoking' : key === 'scroll' ? 'scroll' : 'shield'
}

export const sortHabits = (a: Habit, b: Habit) => a.sort - b.sort || a.created_at.localeCompare(b.created_at)

/** "2,25 l", "30 min", "15 str.", "1" */
export function fmtHabit(h: Habit, v: number, lang: Lang): string {
  if (h.unit === 'ml') return `${fmtNum(v / 1000, lang, 2)} l`
  if (h.kind === 'check') return fmtNum(v, lang)
  return h.unit ? `${fmtNum(v, lang)} ${h.unit}` : fmtNum(v, lang)
}

export function fmtTarget(h: Habit, lang: Lang): string {
  const per = h.period === 'week' ? (lang === 'en' ? '/ week' : '/ tydz.') : lang === 'en' ? '/ day' : '/ dzień'
  if (h.kind === 'check') return h.period === 'week' ? `${h.target}× ${per}` : lang === 'en' ? 'daily' : 'codziennie'
  return `${fmtHabit(h, h.target, lang)} ${per}`
}

export function seriesLabel(h: Habit, n: number, lang: Lang): string {
  const unit = h.period === 'week' ? plural(n, lang, WEEKS) : plural(n, lang, { pl: ['dzień', 'dni', 'dni'], en: ['day', 'days'] })
  return lang === 'en' ? `series ${n} ${unit}` : `seria ${n} ${unit}`
}

/** One log row per habit+day. */
export function setHabitValue(h: Habit, date: string, value: number) {
  db.upsertBy('habit_logs', (r) => r.habit_id === h.id && r.date === date, { habit_id: h.id, date, value: Math.max(0, Math.round(value * 100) / 100), note: null })
}

export const parseDecimal = (s: string) => Number(s.replace(',', '.').replace(/\s/g, ''))
