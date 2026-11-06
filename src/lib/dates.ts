// Local-calendar date helpers. Day keys are 'YYYY-MM-DD' in the device's zone (Europe/Warsaw for Ro).
import type { Lang } from './types'

export const pad = (n: number) => String(n).padStart(2, '0')

export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDay(k: string): Date {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayKey = () => dayKey()
export const yesterdayKey = () => addDays(todayKey(), -1)

export function addDays(k: string, n: number): string {
  const d = parseDay(k)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

/** Monday of the week containing k. */
export function weekStart(k: string = todayKey()): string {
  const d = parseDay(k)
  const dow = (d.getDay() + 6) % 7 // Mon=0
  return addDays(k, -dow)
}

export function weekDays(start: string = weekStart()): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function monthKey(k: string | Date = todayKey()): string {
  return typeof k === 'string' ? k.slice(0, 7) : dayKey(k).slice(0, 7)
}

export function monthDays(month: string = monthKey()): string[] {
  const [y, m] = month.split('-').map(Number)
  const n = new Date(y, m, 0).getDate()
  return Array.from({ length: n }, (_, i) => `${month}-${pad(i + 1)}`)
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000)
}

/** Whole days elapsed since an ISO timestamp (clean-day counters). */
export function daysSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000))
}

export function lastNDays(n: number, end: string = todayKey()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1))
}

export function minutesToHHMM(m: number): string {
  const h = Math.floor(m / 60) % 24
  return `${pad(h)}:${pad(Math.round(m % 60))}`
}

export function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + (m || 0)
}

export const nowMinutes = (d: Date = new Date()) => d.getHours() * 60 + d.getMinutes()

const locale = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'pl-PL')

export function fmtDay(k: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  const s = new Intl.DateTimeFormat(locale(lang), opts).format(parseDay(k))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function fmtMonth(month: string, lang: Lang): string {
  const s = new Intl.DateTimeFormat(locale(lang), { month: 'long', year: 'numeric' }).format(parseDay(month + '-01'))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function fmtTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function fmtMoney(n: number, lang: Lang, opts: { sign?: boolean; decimals?: boolean } = {}): string {
  const s = new Intl.NumberFormat(locale(lang), {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  }).format(Math.abs(n))
  const sign = n < 0 ? '−' : opts.sign && n > 0 ? '+' : ''
  return `${sign}${s} zł`
}

export function fmtNum(n: number, lang: Lang, digits = 0): string {
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(n)
}

/** "2 dni", "5 dni", "1 dzień" — Polish plural rules. */
export function plural(n: number, lang: Lang, forms: { pl: [string, string, string]; en: [string, string] }): string {
  if (lang === 'en') return n === 1 ? forms.en[0] : forms.en[1]
  const [one, few, many] = forms.pl
  if (n === 1) return one
  const d = n % 10
  const t = n % 100
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return few
  return many
}

export const DAYS = { pl: ['dzień', 'dni', 'dni'] as [string, string, string], en: ['day', 'days'] as [string, string] }

export function relTime(iso: string, lang: Lang, now: Date = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' })
  if (diff < 60) return rtf.format(-Math.round(diff), 'second')
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute')
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour')
  return rtf.format(-Math.round(diff / 86400), 'day')
}
