// Focus (pomodoro) session. Lives in localStorage so it survives navigation and reloads.
// The FocusPill (mounted by the Shell) ticks it and completes it when time is up.
import { db } from '../../lib/db'
import { dayKey } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { atom } from '../../lib/store'

export interface FocusSession {
  mode: 'focus' | 'break'
  /** When the current running stretch started (epoch ms). */
  startedAt: number
  /** Milliseconds accumulated before the last pause. */
  accumulated: number
  paused: boolean
  minutes: number
  title: string
  block_id: string | null
  goal_id: string | null
}

export interface FocusPrefs {
  focus: number
  brk: number
}

const KEY = 'mentor.focus'
const PREFS = 'mentor.focus.prefs'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, v: unknown) {
  try {
    if (v == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* storage full / private mode — session just won't persist */
  }
}

export const focusSession = atom<FocusSession | null>(read<FocusSession>(KEY))
focusSession.subscribe(() => write(KEY, focusSession.get()))

export const focusPrefs = atom<FocusPrefs>(read<FocusPrefs>(PREFS) ?? { focus: 25, brk: 5 })
focusPrefs.subscribe(() => write(PREFS, focusPrefs.get()))

/** Full-screen timer vs. the small pill. */
export const focusExpanded = atom(false)

export function elapsedMs(s: FocusSession, now = Date.now()): number {
  return s.accumulated + (s.paused ? 0 : now - s.startedAt)
}

export function remainingMs(s: FocusSession, now = Date.now()): number {
  return Math.max(0, s.minutes * 60_000 - elapsedMs(s, now))
}

export function startFocus(opts: { title: string; block_id?: string | null; goal_id?: string | null; minutes?: number }) {
  focusSession.set({
    mode: 'focus',
    startedAt: Date.now(),
    accumulated: 0,
    paused: false,
    minutes: opts.minutes ?? focusPrefs.get().focus,
    title: opts.title,
    block_id: opts.block_id ?? null,
    goal_id: opts.goal_id ?? null,
  })
  focusExpanded.set(true)
  haptic('tap')
}

export function pauseFocus() {
  const s = focusSession.get()
  if (!s || s.paused) return
  focusSession.set({ ...s, paused: true, accumulated: elapsedMs(s) })
}

export function resumeFocus() {
  const s = focusSession.get()
  if (!s || !s.paused) return
  focusSession.set({ ...s, paused: false, startedAt: Date.now() })
}

function logFocus(minutes: number, s: FocusSession, endAt: number) {
  if (minutes < 1) return
  db.insert('measurements', {
    date: dayKey(new Date(endAt)),
    kind: 'focus',
    value: minutes,
    unit: 'min',
    meta: { block_id: s.block_id, goal_id: s.goal_id, title: s.title },
    note: null,
  })
}

/** Stop early. Real focused minutes still count. Returns the logged minutes. */
export function stopFocus(): number {
  const s = focusSession.get()
  focusSession.set(null)
  focusExpanded.set(false)
  if (!s || s.mode !== 'focus') return 0
  const min = Math.floor(elapsedMs(s) / 60_000)
  logFocus(min, s, Date.now())
  return min
}

/** Called by the ticker. Finishes a due session; focus rolls into a break (unless the break is long over). */
export function completeIfDue(now = Date.now()): 'focus' | 'break' | null {
  const s = focusSession.get()
  if (!s || s.paused || remainingMs(s, now) > 0) return null
  const endAt = s.startedAt + (s.minutes * 60_000 - s.accumulated)
  if (s.mode === 'focus') {
    logFocus(s.minutes, s, endAt)
    const brk = focusPrefs.get().brk
    if (brk > 0 && now - endAt < brk * 60_000) {
      focusSession.set({ ...s, mode: 'break', startedAt: endAt, accumulated: 0, minutes: brk })
    } else {
      focusSession.set(null)
      focusExpanded.set(false)
    }
    return 'focus'
  }
  focusSession.set(null)
  focusExpanded.set(false)
  return 'break'
}

export function fmtClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
