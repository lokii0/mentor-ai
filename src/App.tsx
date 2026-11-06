import { AnimatePresence } from 'motion/react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { locked } from './app/lock'
import { Shell, SOSLayer } from './app/Shell'
import { setDbMode, useRows } from './lib/db'
import { todayKey } from './lib/dates'
import { hasPin } from './lib/pin'
import { seedIfEmpty } from './lib/seed'
import { getSettings, updateSettings, useSettings } from './lib/settings'
import { supabase } from './lib/supabase'
import { LockScreen, PinSetup } from './features/lock/LockScreen'
import { SignIn } from './features/lock/SignIn'
import { Aurora } from './ui/Aurora'
import { Toaster } from './ui/Toast'
import type { DailyInterview } from './lib/types'

const Onboarding = lazy(() => import('./features/interview/Onboarding'))
const Morning = lazy(() => import('./features/interview/Morning'))

/** PRD 6.2: the morning interview blocks the app until done (from 4:00; SOS stays reachable). */
function needsMorning(interviews: DailyInterview[]): boolean {
  if (new Date().getHours() < 4) return false
  const today = todayKey()
  return !interviews.some((i) => i.date === today && i.completed)
}

type Phase = 'boot' | 'signin' | 'ready'

export function App() {
  const [phase, setPhase] = useState<Phase>(supabase ? 'boot' : 'ready')
  const [pinReady, setPinReady] = useState(hasPin())
  const isLocked = locked.use()

  useEffect(() => {
    if (!supabase) {
      void seedIfEmpty(getSettings().lang)
      return
    }
    const start = async () => {
      setDbMode('supabase')
      await seedIfEmpty(getSettings().lang)
      setPhase('ready')
    }
    supabase.auth.getSession().then(({ data }) => (data.session ? start() : setPhase('signin')))
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' && phase !== 'ready') void start()
      if (event === 'SIGNED_OUT') {
        setDbMode('local')
        setPhase('signin')
      }
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Stamp every open — the push scheduler backs off when Ro stops opening the app.
  useEffect(() => {
    if (phase === 'ready' && pinReady && !isLocked) updateSettings({ last_open_at: new Date().toISOString() })
  }, [phase, pinReady, isLocked])

  if (phase === 'boot') return <Aurora scene="today" />
  if (phase === 'signin') return <SignIn />

  return (
    <>
      {pinReady && <Gate />}
      <SOSLayer />
      <AnimatePresence>
        {!pinReady && <PinSetup key="setup" onDone={() => setPinReady(true)} />}
        {pinReady && isLocked && <LockScreen key="lock" onUnlock={() => locked.set(false)} />}
      </AnimatePresence>
    </>
  )
}

function Gate() {
  const settings = useSettings()
  const interviews = useRows('daily_interviews')
  const [, tick] = useState(0)

  // Re-check the morning gate when the app comes back after midnight/4:00.
  useEffect(() => {
    const on = () => document.visibilityState === 'visible' && tick((n) => n + 1)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  const fallback = <Aurora scene="mentor" />
  if (!settings.onboarding_done)
    return (
      <Suspense fallback={fallback}>
        <Onboarding />
        <Toaster />
      </Suspense>
    )
  if (needsMorning(interviews))
    return (
      <Suspense fallback={fallback}>
        <Morning />
        <Toaster />
      </Suspense>
    )
  return <Shell />
}
