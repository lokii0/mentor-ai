// Finance helpers: category icons, keypad amount parsing, transaction merging.
import type { IconName } from '../../ui/Icon'
import type { Category, Expense, Income, Lang } from '../../lib/types'

/** Icons a category can use (keys of the seeded categories + a few extra). */
export const CATEGORY_ICONS: IconName[] = [
  'food', 'home', 'transport', 'subs', 'business', 'health', 'fun', 'clothes', 'invest', 'other',
  'tutoring', 'job', 'family', 'outreach', 'learning', 'guitar', 'training', 'reading', 'phone', 'water',
]

export function catIcon(c: Pick<Category, 'key'> | undefined): IconName {
  const k = c?.key as IconName | undefined
  return k && CATEGORY_ICONS.includes(k) ? k : 'other'
}

/** Keypad input → next raw string. Comma decimal, 2 decimals, 7 integer digits. */
export function pushKey(raw: string, key: string): string {
  if (key === 'back') return raw.slice(0, -1)
  if (key === ',') return raw.includes(',') ? raw : (raw || '0') + ','
  if (raw.includes(',')) {
    if (raw.split(',')[1].length >= 2) return raw
    return raw + key
  }
  if (raw === '0') return key
  if (raw.length >= 7) return raw
  return raw + key
}

export const rawValue = (raw: string) => Math.round((parseFloat(raw.replace(',', '.')) || 0) * 100) / 100

export function formatRaw(raw: string, lang: Lang): string {
  const [int, dec] = raw.split(',')
  const intFmt = new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'pl-PL').format(Number(int || '0'))
  return dec !== undefined ? `${intFmt}${lang === 'en' ? '.' : ','}${dec}` : intFmt
}

/** Parse a typed amount like "45,50" or "1 200.5". */
export function parseAmount(s: string): number {
  const n = parseFloat(s.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

export const hasCents = (n: number) => Math.round(n * 100) % 100 !== 0

export type Tx = { type: 'income'; row: Income } | { type: 'expense'; row: Expense }

export function monthTx(month: string, incomes: Income[], expenses: Expense[]): Tx[] {
  const list: Tx[] = [
    ...incomes.filter((r) => r.date.startsWith(month)).map((row) => ({ type: 'income' as const, row })),
    ...expenses.filter((r) => r.date.startsWith(month)).map((row) => ({ type: 'expense' as const, row })),
  ]
  return list.sort((a, b) => (a.row.date === b.row.date ? b.row.created_at.localeCompare(a.row.created_at) : b.row.date.localeCompare(a.row.date)))
}
