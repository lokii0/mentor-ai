import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { db, useRows, useWhere } from '../../lib/db'
import { todayKey } from '../../lib/dates'
import { CRISIS_RESOURCES } from '../../lib/crisis'
import { haptic } from '../../lib/haptics'
import { askMentor, mentorThinking } from '../../lib/mentor'
import { useLang, useT } from '../../lib/settings'
import type { LimitKey } from '../../lib/types'
import { Icon, type IconName } from '../../ui/Icon'
import { Range, Ring } from '../../ui/kit'
import { Orb } from '../../ui/Orb'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/Toast'
import './sos.css'

const BREATHS = 10
const IN_MS = 4000
const OUT_MS = 6000

function Breathing() {
  const t = useT()
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  const [count, setCount] = useState(0)
  const done = count >= BREATHS

  useEffect(() => {
    if (!running) return
    const id = setTimeout(
      () => {
        haptic('select')
        if (phase === 'in') setPhase('out')
        else {
          const next = count + 1
          setCount(next)
          setPhase('in')
          if (next >= BREATHS) {
            setRunning(false)
            haptic('success')
          }
        }
      },
      phase === 'in' ? IN_MS : OUT_MS,
    )
    return () => clearTimeout(id)
  }, [running, phase, count])

  const start = () => {
    haptic('tap')
    if (done) setCount(0)
    setPhase('in')
    setRunning(true)
  }

  const label = done ? t('Zrobione', 'Done') : !running ? (count ? t('Pauza', 'Paused') : t('10 oddechów', '10 breaths')) : phase === 'in' ? t('Wdech', 'Breathe in') : t('Wydech', 'Breathe out')

  return (
    <section className="glass sos-breath" aria-label={t('Ćwiczenie oddechowe', 'Breathing exercise')}>
      <div className="sos-breath__stage">
        <div className="sos-breath__ring">
          <Ring value={count / BREATHS} size={200} stroke={3} color="var(--sky)" track="rgba(9,49,141,.08)" />
        </div>
        <motion.div
          animate={{ scale: running ? (phase === 'in' ? 1.3 : 0.9) : 1 }}
          transition={running ? { duration: (phase === 'in' ? IN_MS : OUT_MS) / 1000, ease: [0.45, 0, 0.55, 1] } : { type: 'spring', bounce: 0, duration: 0.6 }}
        >
          <Orb size={112} mood="calm" />
        </motion.div>
      </div>
      <div className="sos-breath__phase" aria-live="polite">{label}</div>
      <div className="sos-breath__count">
        {count > 0 || running ? t(`Oddech ${Math.min(count + (running ? 1 : 0), BREATHS)} z ${BREATHS}`, `Breath ${Math.min(count + (running ? 1 : 0), BREATHS)} of ${BREATHS}`) : t('Wdech 4 s, wydech 6 s', 'In for 4 s, out for 6 s')}
      </div>
      {running ? (
        <button className="btn btn--glass" onClick={() => setRunning(false)}>
          <Icon name="pause" />
          {t('Pauza', 'Pause')}
        </button>
      ) : (
        <button className="btn btn--sky" onClick={start}>
          <Icon name={done ? 'refresh' : 'play'} />
          {done ? t('Jeszcze raz', 'Again') : count ? t('Wznów', 'Resume') : t('Zacznij', 'Start')}
        </button>
      )}
    </section>
  )
}

function PlanSteps() {
  const t = useT()
  const prios = useWhere('priorities', (p) => p.date === todayKey() && !p.done)
  const [ticked, setTicked] = useState<Set<number>>(new Set())
  const first = [...prios].sort((a, b) => a.sort - b.sort)[0]
  const steps: { icon: IconName; title: string; sub: string }[] = [
    { icon: 'door', title: t('Wyjdź z pokoju', 'Leave the room'), sub: t('Zmień miejsce — teraz, nie za chwilę.', 'Change the place — now, not in a minute.') },
    { icon: 'breath', title: t('10 oddechów', '10 breaths'), sub: t('Ćwiczenie jest wyżej.', 'The exercise is above.') },
    { icon: 'phone', title: t('Zadzwoń albo napisz do kogoś', 'Call or text someone'), sub: t('Nie musisz mówić, o co chodzi.', "You don't have to say what it's about.") },
    {
      icon: 'swap',
      title: t('Przełącz się na zadanie', 'Switch to a task'),
      sub: first ? t(`Np. „${first.text}” — 10 minut.`, `E.g. "${first.text}" — 10 minutes.`) : t('Cokolwiek konkretnego na 10 minut.', 'Anything concrete for 10 minutes.'),
    },
  ]
  return (
    <section className="glass sos-steps" aria-label={t('Plan awaryjny', 'Emergency plan')}>
      <div className="sec-head" style={{ padding: '14px 16px 0', marginBottom: 2 }}>
        <h3 className="sec-head__title">{t('Plan awaryjny', 'Emergency plan')}</h3>
        <span className="sec-head__aside t-num">{ticked.size}/{steps.length}</span>
      </div>
      {steps.map((s, i) => {
        const on = ticked.has(i)
        return (
          <button
            key={i}
            className={`sos-step ${on ? 'sos-step--done' : ''}`}
            aria-pressed={on}
            onClick={() => {
              haptic(on ? 'tap' : 'success')
              setTicked((x) => {
                const n = new Set(x)
                if (on) n.delete(i)
                else n.add(i)
                return n
              })
            }}
          >
            <Icon name={s.icon} size={20} />
            <span className="sos-step__text">
              <span className="sos-step__title">{s.title}</span>
              <span className="sos-step__sub">{s.sub}</span>
            </span>
            <span className="sos-tick">
              <Icon name="check" stroke={2.4} />
            </span>
          </button>
        )
      })}
    </section>
  )
}

function CrisisCard() {
  const t = useT()
  const lang = useLang()
  return (
    <div className="well well--sky sos-crisis" role="note">
      <p>{t('Nie musisz z tym zostawać sam. Możesz zadzwonić teraz:', "You don't have to stay alone with this. You can call now:")}</p>
      {CRISIS_RESOURCES.map((r) => (
        <a key={r.number} className="sos-tel" href={`tel:${r.number.replace(/\s/g, '')}`}>
          <strong>{r.number}</strong>
          <span>{lang === 'en' ? r.en : r.pl}</span>
        </a>
      ))}
    </div>
  )
}

function MiniChat() {
  const t = useT()
  const sos = useWhere('chat_messages', (m) => m.context === 'sos')
  const thinking = mentorThinking.use()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const recent = [...sos].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-6)
  const crisis = recent.some((m) => m.meta?.crisis)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [recent.length, thinking])

  const send = (msg: string) => {
    const m = msg.trim()
    if (!m || thinking) return
    haptic('tap')
    setText('')
    void askMentor({ message: m, context: 'sos' })
  }

  const quick = [t('Ciągnie mnie i nie wiem, co zrobić', "I'm being pulled and don't know what to do"), t('Nudzę się i zaczynam scrollować', "I'm bored and starting to scroll"), t('Mam ochotę zapalić', 'I want a cigarette')]

  return (
    <section className="glass sos-chat" aria-label={t('Szybka rozmowa z mentorem', 'Quick talk with the mentor')}>
      <div className="sos-chat__head">
        <Orb size={30} mood={crisis ? 'calm' : 'neutral'} thinking={thinking} />
        <h3 className="sec-head__title">{t('Napisz do mentora', 'Message the mentor')}</h3>
      </div>
      {crisis && <CrisisCard />}
      {recent.length > 0 ? (
        <div className="sos-msgs">
          <AnimatePresence initial={false}>
            {recent.map((m) => (
              <motion.div
                key={m.id}
                className={`sos-msg ${m.role === 'user' ? 'sos-msg--me' : 'sos-msg--mentor'}`}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              >
                {m.content}
              </motion.div>
            ))}
            {thinking && (
              <motion.div key="typing" className="sos-typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={t('Mentor pisze', 'Mentor is typing')}>
                {[0, 1, 2].map((i) => (
                  <motion.i key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={endRef} />
        </div>
      ) : (
        <div className="chips">
          {quick.map((q) => (
            <button key={q} className="chip" onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      <form
        className="sos-compose"
        onSubmit={(e) => {
          e.preventDefault()
          send(text)
        }}
      >
        <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Co się dzieje?', "What's happening?")} enterKeyHint="send" aria-label={t('Wiadomość do mentora', 'Message to the mentor')} />
        <button className="sos-send" disabled={!text.trim() || thinking} aria-label={t('Wyślij', 'Send')}>
          <Icon name="send" stroke={2.2} />
        </button>
      </form>
    </section>
  )
}

function WinLog() {
  const t = useT()
  const streaks = useRows('streaks')
  const [key, setKey] = useState<LimitKey | null>(null)
  const [intensity, setIntensity] = useState(7)
  const [saved, setSaved] = useState(false)
  const sorted = [...streaks].sort((a, b) => a.sort - b.sort)

  const win = () => {
    db.insert('triggers_log', { at: new Date().toISOString(), streak_key: key, mood: 3, place: '', before: 'SOS', intensity, outcome: 'won', note: null })
    haptic('success')
    toast(t('Zapisane. Wygrana się liczy.', 'Saved. A win counts.'), { icon: 'shieldCheck' })
    setSaved(true)
    setTimeout(() => setSaved(false), 2400)
  }

  return (
    <section className="glass sos-win" aria-label={t('Wygrana z pokusą', 'Beat the urge')}>
      <h3 className="sec-head__title">{t('Pokusa minęła?', 'Did the urge pass?')}</h3>
      <div className="chips">
        {sorted.map((s) => (
          <button key={s.id} className="chip" aria-pressed={key === s.key} onClick={() => setKey(key === s.key ? null : s.key)}>
            {s.name}
          </button>
        ))}
        <button className="chip" aria-pressed={key === null} onClick={() => setKey(null)}>
          {t('Inne', 'Other')}
        </button>
      </div>
      <div className="field">
        <span className="field__label">{t('Jak silna była?', 'How strong was it?')}</span>
        <div className="sos-win__row">
          <Range label={t('Siła pokusy', 'Strength of the urge')} min={1} max={10} value={intensity} onChange={setIntensity} />
          <output>{intensity}</output>
        </div>
      </div>
      <button className="btn btn--accent btn--lg btn--block" onClick={win} disabled={saved}>
        <Icon name={saved ? 'check' : 'shieldCheck'} />
        {saved ? t('Zapisane', 'Saved') : t('Wygrałem z pokusą', 'I beat the urge')}
      </button>
    </section>
  )
}

/** Always reachable (also during the morning interview). Closes on Esc or swipe down. */
export default function SOSSheet({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [open, setOpen] = useState(true)
  const close = () => {
    setOpen(false)
    setTimeout(onClose, 360) // let the sheet slide out before unmounting
  }
  return (
    <Sheet open={open} onClose={close} title="SOS" tall>
      <div className="sos">
        <p className="sos-lead">
          {t('Zatrzymaj się. To fala — przejdzie.', 'Stop. This is a wave — it will pass.')}
          <span>{t('Najmocniejsza jest przez kilka minut. Przeczekaj ją tutaj.', 'It peaks for a few minutes. Ride it out here.')}</span>
        </p>
        <Breathing />
        <PlanSteps />
        <MiniChat />
        <WinLog />
        <p className="sos-foot">
          {t('Jeśli to coś więcej niż pokusa: ', 'If this is more than an urge: ')}
          <a href="tel:116123">116 123</a> · <a href="tel:112">112</a>
        </p>
      </div>
    </Sheet>
  )
}
