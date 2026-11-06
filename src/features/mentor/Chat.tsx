import { AnimatePresence, motion } from 'motion/react'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { navigate } from '../../app/nav'
import { CRISIS_RESOURCES } from '../../lib/crisis'
import { db } from '../../lib/db'
import { addDays, dayKey, fmtDay, fmtTime, hhmmToMinutes, todayKey } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { applyAction } from '../../lib/mentor'
import { useLang, useT } from '../../lib/settings'
import type { ChatContext, ChatMessage, MentorAction } from '../../lib/types'
import { Icon } from '../../ui/Icon'
import { Orb } from '../../ui/Orb'
import { toast } from '../../ui/Toast'
import './chat.css'

/** Bottom offset of the on-screen keyboard (iOS keeps fixed elements under it otherwise). */
export function useKeyboardInset() {
  const [kb, setKb] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const on = () => setKb(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    vv.addEventListener('resize', on)
    vv.addEventListener('scroll', on)
    on()
    return () => {
      vv.removeEventListener('resize', on)
      vv.removeEventListener('scroll', on)
    }
  }, [])
  return kb
}

const CTX_LABEL: Partial<Record<ChatContext, [string, string]>> = {
  morning: ['Poranny wywiad', 'Morning check-in'],
  onboarding: ['Wywiad startowy', 'Onboarding'],
  sos: ['SOS', 'SOS'],
  return: ['Powrót po przerwie', 'Coming back'],
  review: ['Przegląd', 'Review'],
}

/** Words fade up one after another — only for replies that arrived while you were watching. */
function Reveal({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/(\s+)/), [text])
  const step = Math.min(0.028, 1.6 / Math.max(1, parts.length))
  return (
    <>
      {parts.map((p, i) =>
        /\s+/.test(p) ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <motion.span key={i} className="ch-word" initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.32, delay: i * step }}>
            {p}
          </motion.span>
        ),
      )}
    </>
  )
}

function Typing() {
  return (
    <span className="ch-typing" aria-label="…">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </span>
  )
}

function markDone(m: ChatMessage, idx: number) {
  const done = new Set(m.meta?.done_actions ?? [])
  done.add(idx)
  db.update('chat_messages', m.id, { meta: { ...m.meta, done_actions: [...done] } })
}

function ActionCard({ m, a, idx }: { m: ChatMessage; a: MentorAction; idx: number }) {
  const t = useT()
  const lang = useLang()
  const done = m.meta?.done_actions?.includes(idx)
  const Done = ({ label }: { label: string }) => (
    <motion.span className="ch-act__done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
      <Icon name="check" /> {label}
    </motion.span>
  )

  if (a.type === 'oath') {
    const due = new Date(a.due_at)
    return (
      <div className="ch-act ch-act--oath">
        <span className="ch-act__label">{t('Przysięga', 'Oath')}</span>
        <p className="ch-act__text">{a.text}</p>
        <span className="ch-act__meta">
          {t('Termin', 'Due')}: {dayKey(due) === todayKey() ? t('dziś', 'today') : fmtDay(dayKey(due), lang, { weekday: 'short', day: 'numeric', month: 'short' })}, {fmtTime(a.due_at, lang)}
        </span>
        {done ? (
          <Done label={t('Przysięga zapisana', 'Oath recorded')} />
        ) : (
          <button
            className="btn btn--accent btn--block"
            onClick={() => {
              haptic('success')
              applyAction(a, m.id)
              markDone(m, idx)
              toast(t('Zapisane. Pilnuję terminu.', "Recorded. I'm watching the deadline."), { icon: 'shieldCheck' })
            }}
          >
            {t('Przysięgam', 'I swear')}
          </button>
        )}
      </div>
    )
  }

  if (a.type === 'step') {
    return (
      <div className="ch-act glass glass--strong glass--flat">
        <span className="ch-act__label">{t('Krok na teraz', 'Step for now')}</span>
        <p className="ch-act__text">{a.text}</p>
        {done ? (
          <Done label={t('Zrobione', 'Done')} />
        ) : (
          <button className="btn btn--ink btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => { haptic('success'); markDone(m, idx); toast(t('Dobrze. Następny.', 'Good. Next one.'), { icon: 'check' }) }}>
            <Icon name="check" /> {t('Zrobione', 'Done')}
          </button>
        )}
      </div>
    )
  }

  if (a.type === 'priorities') {
    return (
      <div className="ch-act glass glass--strong glass--flat">
        <span className="ch-act__label">{t('Propozycja priorytetów', 'Proposed priorities')}</span>
        <ul className="ch-act__list">{a.items.map((x, i) => <li key={i}>{x}</li>)}</ul>
        {done ? (
          <Done label={t('Ustawione na dziś', 'Set for today')} />
        ) : (
          <button
            className="btn btn--sky btn--sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              const today = todayKey()
              const existing = db.rows('priorities').filter((p) => p.date === today)
              existing.filter((p) => !p.done).forEach((p) => db.remove('priorities', p.id))
              const keep = existing.filter((p) => p.done).length
              a.items.slice(0, Math.max(0, 3 - keep)).forEach((text, i) => db.insert('priorities', { date: today, text, done: false, sort: keep + i, goal_id: null }))
              haptic('success')
              markDone(m, idx)
              toast(t('Priorytety ustawione', 'Priorities set'), { icon: 'flag' })
            }}
          >
            {t('Ustaw jako priorytety dnia', 'Set as today’s priorities')}
          </button>
        )}
      </div>
    )
  }

  if (a.type === 'blocks') {
    return (
      <div className="ch-act glass glass--strong glass--flat">
        <span className="ch-act__label">{t('Plan dnia', 'Day plan')}</span>
        <ul className="ch-act__list">{a.items.map((b, i) => <li key={i}><span className="t-num t-2">{b.start}–{b.end}</span> {b.title}</li>)}</ul>
        {done ? (
          <Done label={t('W kalendarzu jako propozycje', 'In the calendar as proposals')} />
        ) : (
          <button
            className="btn btn--sky btn--sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              const date = todayKey()
              a.items.forEach((b) => {
                const s = hhmmToMinutes(b.start)
                const e = hhmmToMinutes(b.end)
                if (e > s) db.insert('calendar_blocks', { date, start_min: s, end_min: e, title: b.title, kind: b.kind ?? 'focus', proposed: true, goal_id: null, done: false })
              })
              haptic('success')
              markDone(m, idx)
              toast(t('Wstawione do kalendarza', 'Added to the calendar'), { icon: 'plan', action: { label: t('Zobacz', 'View'), run: () => navigate('plan') } })
            }}
          >
            {t('Wstaw do kalendarza', 'Add to calendar')}
          </button>
        )}
      </div>
    )
  }
  return null
}

function CrisisHelp() {
  const lang = useLang()
  return (
    <div className="ch-help" role="list">
      {CRISIS_RESOURCES.map((r) => (
        <a key={r.number} href={`tel:${r.number.replace(/\s/g, '')}`} role="listitem">
          <b>{r.number}</b>
          <span>{lang === 'en' ? r.en : r.pl}</span>
        </a>
      ))}
    </div>
  )
}

export function ChatThread({ messages, thinking }: { messages: ChatMessage[]; thinking: boolean }) {
  const t = useT()
  const lang = useLang()
  const initial = useRef<Set<string> | null>(null)
  if (initial.current === null) initial.current = new Set(messages.map((m) => m.id))

  // Stick to the bottom as messages arrive.
  const count = messages.length
  const first = useRef(true)
  useLayoutEffect(() => {
    const go = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: first.current ? 'auto' : 'smooth' })
    go()
    first.current = false
  }, [count, thinking])

  const today = todayKey()
  const yesterday = addDays(today, -1)
  let lastDay = ''
  let lastCtx: ChatContext | '' = ''

  return (
    <div className="ch-thread" aria-live="polite">
      {messages.map((m, i) => {
        const d = dayKey(new Date(m.created_at))
        const showDay = d !== lastDay
        lastDay = d
        const showCtx = m.context !== lastCtx && m.context !== 'chat' && CTX_LABEL[m.context]
        lastCtx = m.context
        const me = m.role === 'user'
        const prev = messages[i - 1]
        const firstOfGroup = !prev || prev.role !== m.role || showDay
        const fresh = !initial.current!.has(m.id) && !me
        const stage = m.meta?.stage
        const warm = stage === 'warm' || (!!m.meta?.crisis && !me)
        const actions = !me && !warm ? (m.meta?.actions ?? []) : []
        return (
          <Fragment key={m.id}>
            {showDay && <div className="ch-day">{d === today ? t('Dziś', 'Today') : d === yesterday ? t('Wczoraj', 'Yesterday') : fmtDay(d, lang, { weekday: 'short', day: 'numeric', month: 'long' })}</div>}
            {showCtx && <div className="ch-ctx">{t(CTX_LABEL[m.context]![0], CTX_LABEL[m.context]![1])} · {fmtTime(m.created_at, lang)}</div>}
            <motion.div
              className={`ch-row ${me ? 'ch-row--me' : ''}`}
              initial={initial.current!.has(m.id) ? false : { opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
              style={{ transformOrigin: me ? 'right bottom' : 'left bottom' }}
            >
              {!me && <span className="ch-avatar">{firstOfGroup ? <Orb size={22} mood={warm ? 'calm' : stage === 'scold' ? 'alert' : 'neutral'} /> : null}</span>}
              <div className={`ch-bubble ${me ? 'ch-bubble--me' : warm ? 'ch-bubble--warm' : 'ch-bubble--mentor'} ${stage === 'scold' ? 'ch-bubble--scold' : ''}`}>
                {fresh ? <Reveal text={m.content} /> : m.content}
              </div>
            </motion.div>
            {warm && <CrisisHelp />}
            {actions.length > 0 && (
              <motion.div className="ch-actions" initial={fresh ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: fresh ? 0.9 : 0, type: 'spring', bounce: 0, duration: 0.5 }}>
                {actions.map((a, idx) => <ActionCard key={idx} m={m} a={a} idx={idx} />)}
              </motion.div>
            )}
          </Fragment>
        )
      })}
      <AnimatePresence>
        {thinking && (
          <motion.div key="typing" className="ch-row" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
            <span className="ch-avatar"><Orb size={22} thinking /></span>
            <div className="ch-bubble ch-bubble--mentor"><Typing /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Composer({ onSend, disabled, placeholder, autoFocus }: { onSend: (text: string) => void; disabled?: boolean; placeholder?: string; autoFocus?: boolean }) {
  const t = useT()
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const kb = useKeyboardInset()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(140, el.scrollHeight) + 'px'
  }, [text])

  const send = () => {
    const v = text.trim()
    if (!v || disabled) return
    haptic('tap')
    onSend(v)
    setText('')
  }

  return (
    <form
      className={`ch-composer glass glass--strong glass--float ${kb > 80 ? 'ch-composer--kb' : ''}`}
      style={{ ['--kb' as string]: `${kb > 80 ? kb : 0}px` }}
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
    >
      <textarea
        ref={ref}
        rows={1}
        value={text}
        autoFocus={autoFocus}
        placeholder={placeholder ?? t('Napisz do mentora…', 'Message your mentor…')}
        aria-label={t('Wiadomość', 'Message')}
        enterKeyHint="send"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
            e.preventDefault()
            send()
          }
        }}
      />
      <button className="ch-send" type="submit" disabled={!text.trim() || disabled} aria-label={t('Wyślij', 'Send')}>
        <Icon name="send" stroke={2.2} />
      </button>
    </form>
  )
}
