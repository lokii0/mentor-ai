import { describe, expect, it } from 'vitest'
import type { Priority } from '../../lib/types'
import { slotRows } from './slots'

const p = (id: string, sort: number, date = '2026-11-06'): Priority => ({ id, sort, date, text: id, done: false, created_at: `2026-11-06T0${sort < 0 ? 0 : sort}:00:00Z` })

describe('slotRows', () => {
  it('keeps rows in their own slot', () => {
    const s = slotRows([p('c', 2), p('a', 0)], '2026-11-06')
    expect(s.map((r) => r?.id)).toEqual(['a', undefined, 'c'])
  })
  it('fills gaps with strays and caps at three', () => {
    const s = slotRows([p('a', 0), p('x', 7), p('y', 0), p('z', 9)], '2026-11-06')
    expect(s.map((r) => r?.id)).toEqual(['a', 'y', 'x'])
  })
  it('ignores other days', () => {
    expect(slotRows([p('a', 0, '2026-11-05')], '2026-11-06').every((r) => !r)).toBe(true)
  })
})
