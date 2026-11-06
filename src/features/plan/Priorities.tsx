// Exactly three priorities per day (PRD 6.6). No wrapper card — embedded in Plan, Today and the morning interview.
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db, useRows } from '../../lib/db'
import { haptic } from '../../lib/haptics'
import { useT } from '../../lib/settings'
import type { Priority } from '../../lib/types'
import { Icon } from '../../ui/Icon'
import { Sheet } from '../../ui/Sheet'
import { SLOTS, slotRows } from './slots'
import './plan.css'

export function PrioritiesEditor({ date }: { date: string }) {
  const t = useT()
  const all = useRows('priorities')
  const slots = useMemo(() => slotRows(all, date), [all, date])
  const [goalSlot, setGoalSlot] = useState<number | null>(null)
  const filled = slots.filter((r) => r && r.text.trim())
  const allDone = filled.length === SLOTS && filled.every((r) => r!.done)

  return (
    <div className="pl-prios">
      <ol className="pl-prios__list">
        {slots.map((row, i) => (
          <PrioritySlot key={`${date}-${i}`} index={i} date={date} row={row} onGoal={() => setGoalSlot(i)} />
        ))}
      </ol>
      <AnimatePresence>
        {allDone && (
          <motion.p
            className="pl-prios__all"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
          >
            {t('Wszystkie trzy zrobione. Tak wygląda dzień.', 'All three done. That is what a day looks like.')}
          </motion.p>
        )}
      </AnimatePresence>
      <GoalPicker row={goalSlot !== null ? slots[goalSlot] : undefined} open={goalSlot !== null} onClose={() => setGoalSlot(null)} />
    </div>
  )
}

function CheckMark({ on }: { on: boolean }) {
  return (
    <motion.svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      aria-hidden="true"
      initial={false}
      animate={on ? { scale: [1, 1.16, 1] } : { scale: 1 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.circle
        cx="14"
        cy="14"
        r="12"
        strokeWidth="1.7"
        initial={false}
        animate={{ fill: on ? 'rgba(5,147,198,1)' : 'rgba(5,147,198,0)', stroke: on ? 'rgba(5,147,198,1)' : 'rgba(2,7,10,0.24)' }}
        transition={{ duration: 0.2 }}
      />
      <motion.path
        d="M8.6 14.6l3.6 3.5 7.3-7.8"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={{ duration: on ? 0.28 : 0.12, delay: on ? 0.06 : 0, ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.svg>
  )
}

function PrioritySlot({ index, date, row, onGoal }: { index: number; date: string; row?: Priority; onGoal: () => void }) {
  const t = useT()
  const goals = useRows('goals')
  const [draft, setDraft] = useState(row?.text ?? '')
  const [editing, setEditing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const goal = row?.goal_id ? goals.find((g) => g.id === row.goal_id) : undefined
  const done = !!row?.done

  useEffect(() => {
    if (!editing) setDraft(row?.text ?? '')
  }, [row?.text, editing])

  useEffect(() => {
    if (editing && done) input.current?.focus()
  }, [editing, done])

  const commit = () => {
    const text = draft.trim()
    if (row) {
      if (!text) db.remove('priorities', row.id)
      else if (text !== row.text) db.update('priorities', row.id, { text })
    } else if (text) {
      db.insert('priorities', { date, text, done: false, sort: index, goal_id: null })
    }
  }

  const toggle = () => {
    if (!row) return
    const next = !row.done
    db.update('priorities', row.id, { done: next })
    haptic(next ? 'success' : 'tap')
  }

  const placeholders = [
    t('Najważniejsza rzecz dziś', 'The most important thing today'),
    t('Druga', 'Second'),
    t('Trzecia', 'Third'),
  ]

  return (
    <li className="pl-prio">
      <button
        className="pl-check"
        role="checkbox"
        aria-checked={done}
        aria-label={t(`Zrobione: priorytet ${index + 1}`, `Done: priority ${index + 1}`)}
        disabled={!row || !row.text.trim()}
        onClick={toggle}
      >
        <CheckMark on={done} />
      </button>
      <div className="pl-prio__main">
        {done && !editing ? (
          <button className="pl-prio__text" onClick={() => setEditing(true)} aria-label={t('Edytuj priorytet', 'Edit priority')}>
            {row!.text}
            <motion.span className="pl-prio__strike" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />
          </button>
        ) : (
          <input
            ref={input}
            className="pl-prio__input"
            value={draft}
            placeholder={placeholders[index]}
            maxLength={140}
            enterKeyHint="done"
            aria-label={t(`Priorytet ${index + 1}`, `Priority ${index + 1}`)}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={() => {
              setEditing(false)
              commit()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
        )}
        {goal && (
          <button className="pill pill--deep pl-prio__goal" onClick={onGoal}>
            {goal.title}
          </button>
        )}
      </div>
      {row && row.text.trim() && !goal && (
        <button className="icon-btn icon-btn--sm icon-btn--plain" aria-label={t('Połącz z celem', 'Link to a goal')} onClick={onGoal}>
          <Icon name="target" />
        </button>
      )}
    </li>
  )
}

function GoalPicker({ row, open, onClose }: { row?: Priority; open: boolean; onClose: () => void }) {
  const t = useT()
  const goals = useRows('goals').filter((g) => g.status === 'active').sort((a, b) => a.sort - b.sort)
  const pick = (goal_id: string | null) => {
    if (row) db.update('priorities', row.id, { goal_id })
    haptic('select')
    onClose()
  }
  return (
    <Sheet open={open && !!row} onClose={onClose} title={t('Do którego celu?', 'Which goal?')}>
      <div className="glass glass--flat list" style={{ borderRadius: 'var(--r-l)' }}>
        {goals.map((g) => (
          <button key={g.id} className="lrow lrow--tap" onClick={() => pick(g.id)}>
            <Icon name="target" className="lrow__icon" />
            <span className="lrow__main">
              <span className="lrow__title">{g.title}</span>
              {g.metric && <span className="lrow__sub">{g.metric}</span>}
            </span>
            {row?.goal_id === g.id && <Icon name="check" className="lrow__chev" style={{ color: 'var(--sky)' }} />}
          </button>
        ))}
        <button className="lrow lrow--tap" onClick={() => pick(null)}>
          <Icon name="close" className="lrow__icon" />
          <span className="lrow__main">
            <span className="lrow__title">{t('Bez celu', 'No goal')}</span>
          </span>
          {row && !row.goal_id && <Icon name="check" className="lrow__chev" style={{ color: 'var(--sky)' }} />}
        </button>
      </div>
    </Sheet>
  )
}
