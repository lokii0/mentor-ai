// The mentor's mood drives the orb and the ambient field.
// Alert = an oath is overdue, or it's evening and today's priorities are untouched.
import { useEffect, useState } from 'react'
import { useRows } from '../lib/db'
import { todayKey } from '../lib/dates'

export function useMentorMood(): 'neutral' | 'alert' {
  const oaths = useRows('oaths')
  const prios = useRows('priorities')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  const overdue = oaths.some((o) => o.status === 'open' && new Date(o.due_at).getTime() < now)
  const hour = new Date(now).getHours()
  const today = prios.filter((p) => p.date === todayKey())
  const idleEvening = hour >= 20 && today.length > 0 && today.every((p) => !p.done)
  return overdue || idleEvening ? 'alert' : 'neutral'
}
