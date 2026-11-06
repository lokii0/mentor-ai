// Starting data from the PRD (section 3 goals, 6.3 habits, 6.5 categories).
import { db, loadAll } from './db'
import { monthKey } from './dates'
import { DEFAULT_SETTINGS } from './settings'
import type { Habit, Lang } from './types'

type NewHabit = Omit<Habit, 'id' | 'created_at' | 'user_id' | 'updated_at'>

export function defaultHabits(lang: Lang): NewHabit[] {
  const pl = lang === 'pl'
  return [
    { name: pl ? 'Woda' : 'Water', kind: 'count', unit: 'ml', target: 5000, step: 250, period: 'day', shield: true, preset: 'water', sort: 0 },
    { name: pl ? 'Posiłki' : 'Meals', kind: 'count', unit: null, target: 3, step: 1, period: 'day', shield: true, preset: 'meals', sort: 1 },
    { name: pl ? 'Trening' : 'Training', kind: 'check', unit: null, target: 3, step: 1, period: 'week', shield: true, preset: 'training', sort: 2 },
    { name: pl ? 'Gitara' : 'Guitar', kind: 'duration', unit: 'min', target: 30, step: 10, period: 'day', shield: true, preset: 'guitar', sort: 3 },
    { name: pl ? 'Czytanie' : 'Reading', kind: 'count', unit: pl ? 'str.' : 'pp.', target: 15, step: 5, period: 'day', shield: true, preset: 'reading', sort: 4 },
    { name: 'Client acquisition', kind: 'count', unit: pl ? 'wiad.' : 'msgs', target: 20, step: 5, period: 'day', shield: true, preset: 'outreach', sort: 5 },
    { name: pl ? 'Nauka' : 'Learning', kind: 'check', unit: null, target: 1, step: 1, period: 'day', shield: true, preset: 'learning', sort: 6 },
    { name: pl ? 'Tworzenie' : 'Creating', kind: 'check', unit: null, target: 1, step: 1, period: 'day', shield: true, preset: 'creating', sort: 7 },
    { name: pl ? 'Weekly brainstorm' : 'Weekly brainstorm', kind: 'check', unit: null, target: 1, step: 1, period: 'week', shield: false, preset: 'brainstorm', sort: 8 },
  ]
}

const GOALS_PL = [
  ['Przychód 10 000 zł/mies.', '10 000 zł / mies.'],
  ['Prowadzenie biznesu (AI dla firm)', null],
  ['Apka, z której zarabiam', null],
  ['Produkt cyfrowy: stworzyć i sprzedać', null],
  ['Zarabianie z AI', null],
  ['Czysta cera', null],
  ['Lepsza gra na gitarze', null],
] as const
const GOALS_EN = [
  ['Income of 10,000 PLN/month', '10,000 PLN / month'],
  ['Run a business (AI for companies)', null],
  ['Build an app that makes money', null],
  ['Create and sell a digital product', null],
  ['Earn with AI', null],
  ['Clear skin', null],
  ['Play guitar better', null],
] as const

export async function seedIfEmpty(lang: Lang = 'pl') {
  await loadAll(['settings', 'habits', 'streaks', 'categories', 'goals', 'budgets'])
  const pl = lang === 'pl'

  if (!db.rows('settings').length) db.insert('settings', { ...DEFAULT_SETTINGS, lang })

  if (!db.rows('habits').length) db.insertMany('habits', defaultHabits(lang))

  if (!db.rows('streaks').length) {
    const now = new Date().toISOString()
    db.insertMany('streaks', [
      { key: 'adult', name: pl ? 'Treści 18+' : 'Adult content', started_at: now, best_days: 0, sort: 0 },
      { key: 'smoking', name: pl ? 'Papierosy' : 'Cigarettes', started_at: now, best_days: 0, sort: 1 },
      { key: 'scroll', name: 'Doomscrolling', started_at: now, best_days: 0, daily_limit_minutes: 60, sort: 2 },
    ])
  }

  if (!db.rows('categories').length) {
    const inc = pl
      ? [['tutoring', 'Korki'], ['job', 'Praca'], ['business', 'Biznes'], ['family', 'Dodatki rodzinne']]
      : [['tutoring', 'Tutoring'], ['job', 'Job'], ['business', 'Business'], ['family', 'Family support']]
    const exp = pl
      ? [['food', 'Jedzenie'], ['home', 'Dom / czynsz'], ['transport', 'Transport'], ['subs', 'Subskrypcje / AI / narzędzia'], ['business', 'Biznes'], ['health', 'Zdrowie / skóra'], ['fun', 'Rozrywka'], ['clothes', 'Ubrania'], ['invest', 'Inwestycje'], ['other', 'Inne']]
      : [['food', 'Food'], ['home', 'Home / rent'], ['transport', 'Transport'], ['subs', 'Subscriptions / AI / tools'], ['business', 'Business'], ['health', 'Health / skin'], ['fun', 'Entertainment'], ['clothes', 'Clothes'], ['invest', 'Investments'], ['other', 'Other']]
    db.insertMany('categories', [
      ...inc.map(([key, name], i) => ({ kind: 'income' as const, key, name, sort: i, monthly_limit: null })),
      ...exp.map(([key, name], i) => ({ kind: 'expense' as const, key, name, sort: i, monthly_limit: null })),
    ])
  }

  if (!db.rows('goals').length) {
    db.insertMany(
      'goals',
      (pl ? GOALS_PL : GOALS_EN).map(([title, metric], i) => ({ title, metric, status: 'active' as const, sort: i, description: null, deadline: null })),
    )
  }

  if (!db.rows('budgets').some((b) => b.month === monthKey())) {
    db.insert('budgets', { month: monthKey(), total_limit: 0, income_goal: 10000 })
  }
}
