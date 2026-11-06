import { describe, expect, it } from 'vitest'
import { detectCrisis } from './crisis'
import { addDays, plural, DAYS, weekStart } from './dates'
import { cleanDays, habitSeries } from './stats'
import type { Habit, HabitLog, Streak } from './types'

describe('detectCrisis (safety exception)', () => {
  it.each([
    'Nie chcę już żyć',
    'nie chce mi sie zyc',
    'myślę o samobójstwie',
    'chyba się zabiję',
    'chcę umrzeć',
    'znowu się tnę',
    'lepiej by było beze mnie',
    'I want to die',
    'thinking about suicide',
    'I want to end my life',
  ])('flags "%s"', (s) => expect(detectCrisis(s)).toBe(true))

  it.each([
    'Nie chce mi się dziś nic robić',
    'zawaliłem dzień, leniwy jestem',
    'zabiłem ten projekt, w końcu skończony',
    'I spend my life scrolling, help',
    'skoczę z radości jak podpiszę klienta',
    'I am so lazy today',
  ])('does not flag laziness: "%s"', (s) => expect(detectCrisis(s)).toBe(false))
})

const base = { created_at: '2026-01-01T00:00:00Z', step: 1, unit: null, reminder_times: null, preset: null, archived: false, sort: 0 }
const daily: Habit = { ...base, id: 'h', name: 'Gitara', kind: 'check', target: 1, period: 'day', shield: true }
const log = (date: string, value = 1): HabitLog => ({ id: date, created_at: date, habit_id: 'h', date, value })

describe('habitSeries', () => {
  const today = '2026-11-06'
  it('counts consecutive days and does not break on an unfinished today', () => {
    const logs = [1, 2, 3].map((n) => log(addDays(today, -n)))
    expect(habitSeries(daily, logs, today).length).toBe(3)
  })
  it('shield forgives exactly one miss', () => {
    const logs = [1, 3, 4].map((n) => log(addDays(today, -n)))
    expect(habitSeries(daily, logs, today)).toEqual({ length: 3, shieldUsed: true })
    const twoMisses = [1, 4, 5].map((n) => log(addDays(today, -n)))
    expect(habitSeries(daily, twoMisses, today).length).toBe(1)
  })
  it('no shield: one miss ends the series', () => {
    const logs = [1, 3, 4].map((n) => log(addDays(today, -n)))
    expect(habitSeries({ ...daily, shield: false }, logs, today).length).toBe(1)
  })
})

describe('limits and dates', () => {
  it('clean days are whole days since the reset', () => {
    const s = { started_at: '2026-11-01T08:00:00Z' } as Streak
    expect(cleanDays(s, new Date('2026-11-06T07:59:00Z'))).toBe(4)
    expect(cleanDays(s, new Date('2026-11-06T08:00:00Z'))).toBe(5)
  })
  it('Polish plurals', () => {
    expect([1, 2, 5, 12, 22, 25].map((n) => plural(n, 'pl', DAYS))).toEqual(['dzień', 'dni', 'dni', 'dni', 'dni', 'dni'])
  })
  it('weeks start on Monday', () => {
    expect(weekStart('2026-11-08')).toBe('2026-11-02') // Sunday → Monday before
    expect(weekStart('2026-11-02')).toBe('2026-11-02')
  })
})
