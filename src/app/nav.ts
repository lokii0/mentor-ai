import { atom } from '../lib/store'
import type { IconName } from '../ui/Icon'
import type { Scene } from '../ui/Aurora'

// PRD 5: Mentor → Dziś → Nawyki → Finanse → Plan → Notatki i cele → Podsumowania → Ustawienia
export const ROUTES = ['mentor', 'today', 'habits', 'finance', 'plan', 'notes', 'reviews', 'settings'] as const
export type Route = (typeof ROUTES)[number]

export const ROUTE_META: Record<Route, { pl: string; en: string; icon: IconName; scene: Scene }> = {
  mentor: { pl: 'Mentor', en: 'Mentor', icon: 'mentor', scene: 'mentor' },
  today: { pl: 'Dziś', en: 'Today', icon: 'today', scene: 'today' },
  habits: { pl: 'Nawyki', en: 'Habits', icon: 'habits', scene: 'habits' },
  finance: { pl: 'Finanse', en: 'Money', icon: 'finance', scene: 'finance' },
  plan: { pl: 'Plan', en: 'Plan', icon: 'plan', scene: 'plan' },
  notes: { pl: 'Notatki i cele', en: 'Notes & goals', icon: 'notes', scene: 'notes' },
  reviews: { pl: 'Podsumowania', en: 'Reviews', icon: 'reviews', scene: 'reviews' },
  settings: { pl: 'Ustawienia', en: 'Settings', icon: 'settings', scene: 'settings' },
}

/** Destinations in the phone dock; the rest live in the sidebar sheet. */
export const DOCK: Route[] = ['mentor', 'today', 'habits', 'finance', 'plan']

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0]
  return (ROUTES as readonly string[]).includes(h) ? (h as Route) : 'mentor'
}

export const route = atom<Route>(parse())
/** Direction of the last navigation in ROUTES order — pages slide accordingly. */
export const navDir = atom<1 | -1>(1)

window.addEventListener('hashchange', () => {
  const next = parse()
  navDir.set(ROUTES.indexOf(next) >= ROUTES.indexOf(route.get()) ? 1 : -1)
  route.set(next)
})

const scrollMemory = new Map<Route, number>()

export function navigate(r: Route) {
  if (r === route.get()) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  scrollMemory.set(route.get(), window.scrollY)
  location.hash = '/' + r
}

export function restoreScroll(r: Route) {
  window.scrollTo(0, scrollMemory.get(r) ?? 0)
}

export const sosOpen = atom(false)
export const sidebarOpen = atom(false)
