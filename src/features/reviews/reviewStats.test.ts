import { describe, expect, it } from 'vitest'
import type { Habit, HabitLog } from '../../lib/types'
import { weekStats, type ReviewData } from './reviewStats'

const habit: Habit = { id: 'h', name: 'Gitara', kind: 'duration', target: 30, period: 'day', shield: false, sort: 0, created_at: '2026-10-01T08:00:00' }
const log = (date: string, value: number): HabitLog => ({ id: date, habit_id: 'h', date, value, created_at: date })
const empty: ReviewData = { habits: [habit], logs: [], streaks: [], relapses: [], triggers: [], priorities: [], measurements: [], incomes: [], expenses: [] }

describe('weekStats', () => {
  it('counts only elapsed days and does not punish an unfinished today', () => {
    // week Mon 2 Nov – Sun 8 Nov 2026; today = Wed 4 Nov
    const s = weekStats('2026-11-02', { ...empty, logs: [log('2026-11-02', 30), log('2026-11-03', 10)] }, '2026-11-04')
    expect(s.habits[0].detail).toBe('1/2')
    expect(s.habits_pct).toBe(50)
  })
  it('counts today once it is done', () => {
    const s = weekStats('2026-11-02', { ...empty, logs: [log('2026-11-02', 30), log('2026-11-04', 45)] }, '2026-11-04')
    expect(s.habits[0].detail).toBe('2/3')
  })
})
