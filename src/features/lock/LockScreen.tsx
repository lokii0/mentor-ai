import { motion, useAnimationControls } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { haptic } from '../../lib/haptics'
import { bioSupported, hasBio, registerBio, setPin, unlockWithBio, verifyPin } from '../../lib/pin'
import { updateSettings, useLang, useT } from '../../lib/settings'
import { Icon } from '../../ui/Icon'
import { Segmented } from '../../ui/kit'
import { Orb } from '../../ui/Orb'
import './lock.css'

const LEN = 4

function Keypad({ onDigit, onBack, left }: { onDigit: (d: string) => void; onBack: () => void; left?: React.ReactNode }) {
  const t = useT()
  return (
    <div className="keypad" role="group" aria-label={t('Klawiatura PIN', 'PIN keypad')}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} className="key" onPointerDown={() => haptic('tap')} onClick={() => onDigit(d)}>
          {d}
        </button>
      ))}
      {left ?? <span />}
      <button className="key" onPointerDown={() => haptic('tap')} onClick={() => onDigit('0')}>0</button>
      <button className="key key--plain" onClick={onBack} aria-label={t('Usuń', 'Delete')}>
        <Icon name="backspace" />
      </button>
    </div>
  )
}

function Dots({ n, controls }: { n: number; controls: ReturnType<typeof useAnimationControls> }) {
  return (
    <motion.div className="lock__dots" animate={controls} aria-hidden="true">
      {Array.from({ length: LEN }, (_, i) => (
        <motion.span
          key={i}
          className={`lock__dot ${i < n ? 'lock__dot--on' : ''}`}
          animate={{ scale: i === n - 1 ? [1, 1.35, 1] : 1 }}
          transition={{ duration: 0.22 }}
        />
      ))}
    </motion.div>
  )
}

const shake = { x: [0, -14, 12, -9, 6, -3, 0], transition: { duration: 0.45 } }

/** Shown on every open. Exit animation (orb blooms, night lifts) is driven by the parent's AnimatePresence. */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const t = useT()
  const [code, setCodeState] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const controls = useAnimationControls()
  // Taps can outrun renders — the ref is the source of truth for the digits.
  const codeRef = useRef('')
  const busyRef = useRef(false)
  const setCode = (v: string) => {
    codeRef.current = v
    setCodeState(v)
  }
  const unlockRef = useRef(onUnlock)
  unlockRef.current = onUnlock

  const tryBio = useCallback(async () => {
    if (!hasBio()) return
    if (await unlockWithBio()) {
      haptic('success')
      unlockRef.current()
    }
  }, [])

  // Offer Face ID once per lock, not on every render.
  useEffect(() => {
    void tryBio()
  }, [tryBio])

  const push = async (d: string) => {
    if (busyRef.current || codeRef.current.length >= LEN) return
    const next = codeRef.current + d
    setCode(next)
    setErr(false)
    if (next.length === LEN) {
      busyRef.current = true
      setBusy(true)
      const ok = await verifyPin(next)
      if (ok) {
        haptic('success')
        unlockRef.current()
      } else {
        haptic('error')
        setErr(true)
        await controls.start(shake)
        setCode('')
      }
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <motion.div className="lock" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.55, delay: 0.25 } }}>
      <motion.div className="lock__bg" exit={{ opacity: 0, transition: { duration: 0.5, delay: 0.2 } }} />
      <div className="lock__top">
        <motion.div exit={{ scale: 9, opacity: 0, transition: { duration: 0.75, ease: [0.65, 0, 0.35, 1] } }}>
          <Orb size={132} mood={err ? 'alert' : 'neutral'} thinking={busy} />
        </motion.div>
        <motion.div className="stack gap-3" style={{ alignItems: 'center' }} exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}>
          <div className="lock__word">mentor<span>.ai</span></div>
          <p className={`lock__hint ${err ? 'lock__hint--err' : ''}`} role="status">
            {err ? t('Zły kod. Jeszcze raz.', 'Wrong code. Try again.') : t('Wpisz kod', 'Enter your code')}
          </p>
          <Dots n={code.length} controls={controls} />
        </motion.div>
      </div>
      <motion.div exit={{ opacity: 0, y: 30, transition: { duration: 0.25 } }}>
        <Keypad
          onDigit={push}
          onBack={() => setCode(codeRef.current.slice(0, -1))}
          left={
            hasBio() ? (
              <button className="key key--plain" onClick={tryBio} aria-label="Face ID">
                <Icon name="faceid" />
              </button>
            ) : undefined
          }
        />
      </motion.div>
    </motion.div>
  )
}

/** First run: welcome → choose PIN → confirm → Face ID offer. */
export function PinSetup({ onDone }: { onDone: () => void }) {
  const t = useT()
  const lang = useLang()
  const [step, setStep] = useState<'welcome' | 'pick' | 'confirm' | 'bio'>('welcome')
  const [first, setFirst] = useState('')
  const [code, setCodeState] = useState('')
  const [err, setErr] = useState(false)
  const controls = useAnimationControls()
  const codeRef = useRef('')
  const setCode = (v: string) => {
    codeRef.current = v
    setCodeState(v)
  }

  const push = async (d: string) => {
    if (codeRef.current.length >= LEN) return
    const next = codeRef.current + d
    setCode(next)
    setErr(false)
    if (next.length < LEN) return
    if (step === 'pick') {
      setTimeout(() => {
        setFirst(next)
        setCode('')
        setStep('confirm')
      }, 160)
    } else if (step === 'confirm') {
      if (next === first) {
        await setPin(next)
        haptic('success')
        if (await bioSupported()) setStep('bio')
        else onDone()
      } else {
        haptic('error')
        setErr(true)
        await controls.start(shake)
        setCode('')
        setFirst('')
        setStep('pick')
      }
    }
  }

  return (
    <motion.div className="lock" exit={{ opacity: 0, transition: { duration: 0.5, delay: 0.2 } }}>
      <motion.div className="lock__bg" exit={{ opacity: 0, transition: { duration: 0.5 } }} />
      {step === 'welcome' ? (
        <>
          <div className="lock__top" style={{ marginTop: '6vh' }}>
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', bounce: 0.2, duration: 1.1 }}>
              <Orb size={168} />
            </motion.div>
            <motion.div className="lock__welcome" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, type: 'spring', bounce: 0, duration: 0.7 }}>
              <div className="lock__word">mentor<span>.ai</span></div>
              <p className="lock__tag">{t('Starszy brat od roboty. Bez słodzenia.', 'An older brother for the work. No sugar-coating.')}</p>
              <p className="lock__sub">{t('Najpierw kod, potem rozmowa o tym, kim jesteś i dokąd idziesz.', 'First a code, then a talk about who you are and where you are going.')}</p>
            </motion.div>
          </div>
          <motion.div className="stack gap-4" style={{ width: 'min(100%, 360px)' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, type: 'spring', bounce: 0, duration: 0.6 }}>
            <Segmented
              label={t('Język', 'Language')}
              value={lang}
              onChange={(v) => updateSettings({ lang: v })}
              options={[{ value: 'pl', label: 'Polski' }, { value: 'en', label: 'English' }]}
            />
            <button className="btn btn--accent btn--lg btn--block" onClick={() => { haptic('tap'); setStep('pick') }}>
              {t('Zaczynamy', "Let's start")}
              <Icon name="arrowRight" />
            </button>
          </motion.div>
        </>
      ) : step === 'bio' ? (
        <>
          <div className="lock__top" style={{ marginTop: '10vh' }}>
            <div style={{ color: 'var(--sky)' }}><Icon name="faceid" size={72} stroke={1.3} /></div>
            <div className="lock__welcome">
              <p className="lock__tag">{t('Odblokowywać Face ID?', 'Unlock with Face ID?')}</p>
              <p className="lock__sub">{t('Kod zostaje jako zapas.', 'The code stays as a fallback.')}</p>
            </div>
          </div>
          <div className="stack gap-3" style={{ width: 'min(100%, 360px)' }}>
            <button className="btn btn--sky btn--lg btn--block" onClick={async () => { await registerBio(); onDone() }}>
              {t('Włącz Face ID', 'Enable Face ID')}
            </button>
            <button className="btn btn--lg btn--block" style={{ color: 'var(--on-dark-2)' }} onClick={onDone}>
              {t('Nie teraz', 'Not now')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="lock__top">
            <Orb size={96} mood={err ? 'alert' : 'neutral'} />
            <div className="stack gap-3" style={{ alignItems: 'center' }}>
              <p className="lock__tag">{step === 'pick' ? t('Ustaw 4-cyfrowy kod', 'Choose a 4-digit code') : t('Powtórz kod', 'Repeat the code')}</p>
              <p className={`lock__hint ${err ? 'lock__hint--err' : ''}`} role="status">
                {err ? t('Kody się różnią. Od nowa.', "Codes don't match. Start over.") : t('Apka zapyta o niego przy każdym otwarciu.', 'The app asks for it every time it opens.')}
              </p>
              <Dots n={code.length} controls={controls} />
            </div>
          </div>
          <Keypad onDigit={push} onBack={() => setCode(codeRef.current.slice(0, -1))} />
        </>
      )}
    </motion.div>
  )
}
