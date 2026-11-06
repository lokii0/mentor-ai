import type { Priority } from '../../lib/types'

export const SLOTS = 3

/** Slot i shows the row with sort === i; strays (other sort values) fill the gaps in order. */
export function slotRows(all: Priority[], date: string): (Priority | undefined)[] {
  const rows = all.filter((p) => p.date === date).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at))
  const slots: (Priority | undefined)[] = Array(SLOTS).fill(undefined)
  const rest: Priority[] = []
  for (const r of rows) {
    if (r.sort >= 0 && r.sort < SLOTS && !slots[r.sort]) slots[r.sort] = r
    else rest.push(r)
  }
  for (let i = 0; i < SLOTS && rest.length; i++) if (!slots[i]) slots[i] = rest.shift()
  return slots
}
