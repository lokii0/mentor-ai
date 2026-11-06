import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, useEffect, useLayoutEffect, useState, type ComponentType } from 'react'
import { haptic } from '../lib/haptics'
import { useT, useLang, updateSettings } from '../lib/settings'
import { hasBackend } from '../lib/supabase'
import { Aurora, type Scene } from '../ui/Aurora'
import { Icon } from '../ui/Icon'
import { Orb } from '../ui/Orb'
import { springFast } from '../ui/motion'
import { Toaster } from '../ui/Toast'
import { lockNow } from './lock'
import { DOCK, navDir, navigate, restoreScroll, route, ROUTE_META, ROUTES, sidebarOpen, sosOpen, type Route } from './nav'
import { useMentorMood } from './mood'
import './shell.css'

const SCREENS: Record<Route, ComponentType> = {
  mentor: lazy(() => import('../features/mentor/MentorScreen')),
  today: lazy(() => import('../features/today/TodayScreen')),
  habits: lazy(() => import('../features/habits/HabitsScreen')),
  finance: lazy(() => import('../features/finance/FinanceScreen')),
  plan: lazy(() => import('../features/plan/PlanScreen')),
  notes: lazy(() => import('../features/notes/NotesScreen')),
  reviews: lazy(() => import('../features/reviews/ReviewsScreen')),
  settings: lazy(() => import('../features/settings/SettingsScreen')),
}

const SOSSheet = lazy(() => import('../features/sos/SOSSheet'))
// Running focus (pomodoro) session, visible on every screen.
const FocusPill = lazy(() => import('../features/plan/FocusPill'))

function useScrolled(threshold = 36) {
  const [s, set] = useState(false)
  useEffect(() => {
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => set(window.scrollY > threshold))
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => {
      window.removeEventListener('scroll', on)
      cancelAnimationFrame(raf)
    }
  }, [threshold])
  return s
}

export function SOSButton() {
  const t = useT()
  return (
    <button
      className="sos-btn"
      onClick={() => {
        haptic('warning')
        sosOpen.set(true)
      }}
      aria-label={t('SOS — plan awaryjny', 'SOS — emergency plan')}
    >
      <Icon name="sos" />
      SOS
    </button>
  )
}

/** The overlay itself; mounted by the app root so it works during interviews too. */
export function SOSLayer() {
  const open = sosOpen.use()
  return (
    <Suspense fallback={null}>
      {open && <SOSSheet onClose={() => sosOpen.set(false)} />}
    </Suspense>
  )
}

function TopBar({ r }: { r: Route }) {
  const t = useT()
  const scrolled = useScrolled()
  const meta = ROUTE_META[r]
  return (
    <header className="topbar">
      <motion.div className="topbar__mat" initial={false} animate={{ opacity: scrolled ? 1 : 0 }} transition={{ duration: 0.2 }} />
      <div className="topbar__left">
        <button className="icon-btn topbar__menu" aria-label={t('Menu', 'Menu')} onClick={() => { haptic('tap'); sidebarOpen.set(true) }}>
          <Icon name="menu" />
        </button>
      </div>
      <motion.div className="topbar__title" initial={false} animate={{ opacity: scrolled ? 1 : 0, y: scrolled ? 0 : 6 }} transition={springFast}>
        {t(meta.pl, meta.en)}
      </motion.div>
      <div className="topbar__right">
        <SOSButton />
      </div>
    </header>
  )
}

function Dock({ r, mood }: { r: Route; mood: 'neutral' | 'alert' }) {
  const t = useT()
  return (
    <nav className="dock glass glass--dark" aria-label={t('Nawigacja', 'Navigation')}>
      {DOCK.map((d) => {
        const m = ROUTE_META[d]
        const active = d === r
        return (
          <button
            key={d}
            className="dock__item"
            aria-current={active ? 'page' : undefined}
            onPointerDown={() => haptic('select')}
            onClick={() => navigate(d)}
          >
            {active && <motion.span layoutId="dock-pill" className="dock__pill" transition={springFast} />}
            <span className="dock__icon">
              {d === 'mentor' ? <Orb size={20} mood={mood} /> : <Icon name={m.icon} size={22} />}
            </span>
            <span className="dock__label">{t(m.pl, m.en)}</span>
          </button>
        )
      })}
    </nav>
  )
}

function SidebarContent({ r, onPick }: { r: Route; onPick?: () => void }) {
  const t = useT()
  const lang = useLang()
  return (
    <>
      <div className="sidebar__brand">
        <Orb size={30} />
        <div className="sidebar__name">mentor<span>.ai</span></div>
      </div>
      <nav className="sidebar__nav" aria-label={t('Sekcje', 'Sections')}>
        {ROUTES.map((d) => {
          const m = ROUTE_META[d]
          const active = d === r
          return (
            <button
              key={d}
              className="sidebar__item"
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                haptic('select')
                navigate(d)
                onPick?.()
              }}
            >
              {active && <motion.span layoutId={onPick ? 'side-pill-m' : 'side-pill'} className="sidebar__pill" transition={springFast} />}
              <Icon name={m.icon} />
              <span>{t(m.pl, m.en)}</span>
            </button>
          )
        })}
      </nav>
      <div className="sidebar__foot">
        <div className="row gap-2">
          <button className="btn btn--glass btn--sm grow" onClick={() => updateSettings({ lang: lang === 'pl' ? 'en' : 'pl' })}>
            <Icon name="globe" />
            {lang === 'pl' ? 'English' : 'Polski'}
          </button>
          <button className="btn btn--glass btn--sm grow" onClick={() => { onPick?.(); lockNow() }}>
            <Icon name="lock" />
            {t('Zablokuj', 'Lock')}
          </button>
        </div>
        <div className="sidebar__status">
          <span className={`sidebar__dot ${hasBackend ? '' : 'sidebar__dot--local'}`} />
          {hasBackend ? t('Połączono z chmurą', 'Synced to cloud') : t('Tryb lokalny — dane na tym urządzeniu', 'Local mode — data on this device')}
        </div>
      </div>
    </>
  )
}

function SidebarDrawer({ r }: { r: Route }) {
  const open = sidebarOpen.use()
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" style={{ zIndex: 89 }} onClick={() => sidebarOpen.set(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside
            className="sidebar glass glass--strong glass--float"
            initial={{ x: '-110%' }}
            animate={{ x: 0 }}
            exit={{ x: '-110%' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.38 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.9, right: 0.04 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80 || info.velocity.x < -600) sidebarOpen.set(false)
            }}
          >
            <SidebarContent r={r} onPick={() => sidebarOpen.set(false)} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export function Shell() {
  const r = route.use()
  const dir = navDir.use()
  const sos = sosOpen.use()
  const mood = useMentorMood()
  const Screen = SCREENS[r]
  const scene: Scene = sos ? 'calm' : mood === 'alert' && r !== 'settings' ? 'alert' : ROUTE_META[r].scene

  useLayoutEffect(() => restoreScroll(r), [r])

  return (
    <div className="shell shell--wide">
      <Aurora scene={scene} />
      <TopBar r={r} />
      <aside className="sidebar sidebar--fixed glass glass--strong">
        <SidebarContent r={r} />
      </aside>
      <SidebarDrawer r={r} />
      <Suspense fallback={<div className="page" />}>
        <motion.div
          key={r}
          // No filter here: a lingering filter/transform would trap position:fixed children.
          initial={{ opacity: 0, x: 18 * dir }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.42 }}
        >
          <Screen />
        </motion.div>
      </Suspense>
      <Suspense fallback={null}>
        <FocusPill />
      </Suspense>
      <Dock r={r} mood={mood} />
      <Toaster />
    </div>
  )
}
