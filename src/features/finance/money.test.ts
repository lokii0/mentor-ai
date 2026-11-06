import { describe, expect, it } from 'vitest'
import { formatRaw, monthTx, parseAmount, pushKey, rawValue } from './money'

const type = (keys: string[]) => keys.reduce((r, k) => pushKey(r, k), '')

describe('keypad amount', () => {
  it('builds integers and drops a leading zero', () => {
    expect(type(['0', '4', '5'])).toBe('45')
  })
  it('allows one comma and at most two decimals', () => {
    expect(type(['1', ',', '5', ',', '0', '9'])).toBe('1,50')
    expect(type([',', '5'])).toBe('0,5')
  })
  it('caps the integer part at 7 digits', () => {
    expect(type('123456789'.split(''))).toBe('1234567')
  })
  it('backspace removes the last character', () => {
    expect(pushKey('12,5', 'back')).toBe('12,')
    expect(pushKey('', 'back')).toBe('')
  })
  it('parses to a rounded number', () => {
    expect(rawValue('45,50')).toBe(45.5)
    expect(rawValue('')).toBe(0)
    expect(parseAmount('1 200,25')).toBe(1200.25)
    expect(parseAmount('abc')).toBe(0)
  })
  it('formats with grouping and keeps typed decimals', () => {
    // pl-PL groups from 5 digits (non-breaking space); 4-digit numbers stay ungrouped.
    expect(formatRaw('12345,5', 'pl').replace(/\s/g, ' ')).toBe('12 345,5')
    expect(formatRaw('1234', 'pl')).toBe('1234')
    expect(formatRaw('1234,5', 'en')).toBe('1,234.5')
    expect(formatRaw('', 'pl')).toBe('0')
  })
})

describe('monthTx', () => {
  it('merges incomes and expenses of the month, newest first', () => {
    const base = { category_id: 'c', note: null }
    const list = monthTx(
      '2026-11',
      [{ id: 'i1', created_at: '2026-11-03T10:00:00Z', amount: 100, date: '2026-11-03', ...base }],
      [
        { id: 'e1', created_at: '2026-11-03T12:00:00Z', amount: 20, date: '2026-11-03', ...base },
        { id: 'e2', created_at: '2026-11-05T09:00:00Z', amount: 5, date: '2026-11-05', ...base },
        { id: 'e3', created_at: '2026-10-30T09:00:00Z', amount: 9, date: '2026-10-30', ...base },
      ],
    )
    expect(list.map((x) => x.row.id)).toEqual(['e2', 'e1', 'i1'])
  })
})
