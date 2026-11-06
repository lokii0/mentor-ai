import { useEffect, useState } from 'react'
import { db, useRows } from '../../lib/db'
import { hhmmToMinutes, minutesToHHMM } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { useT } from '../../lib/settings'
import type { BlockKind, CalendarBlock } from '../../lib/types'
import { Icon } from '../../ui/Icon'
import { Toggle } from '../../ui/kit'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/Toast'
import { DAY_END } from './Calendar'
import { startFocus } from './focus'

export const KINDS: { value: BlockKind; pl: string; en: string }[] = [
  { value: 'focus', pl: 'Skupienie', en: 'Focus' },
  { value: 'habit', pl: 'Nawyk', en: 'Habit' },
  { value: 'meeting', pl: 'Spotkanie', en: 'Meeting' },
  { value: 'break', pl: 'Przerwa', en: 'Break' },
  { value: 'other', pl: 'Inne', en: 'Other' },
]

interface Props {
  open: boolean
  onClose: () => void
  date: string
  block?: CalendarBlock
  /** For a new block: where the empty slot was tapped. */
  startMin?: number
}

const toInput = (m: number) => minutesToHHMM(m >= DAY_END ? 0 : m)
const fromInput = (s: string, fallback: number) => (s ? hhmmToMinutes(s) : fallback)

export function BlockSheet({ open, onClose, date, block, startMin }: Props) {
  const t = useT()
  const goals = useRows('goals').filter((g) => g.status === 'active')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<BlockKind>('focus')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [goalId, setGoalId] = useState<string>('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) return
    if (block) {
      setTitle(block.title)
      setKind(block.kind)
      setStart(toInput(block.start_min))
      setEnd(toInput(block.end_min))
      setGoalId(block.goal_id ?? '')
      setDone(!!block.done)
    } else {
      const s = startMin ?? 9 * 60
      setTitle('')
      setKind('focus')
      setStart(toInput(s))
      setEnd(toInput(Math.min(DAY_END, s + 60)))
      setGoalId('')
      setDone(false)
    }
  }, [open, block, startMin])

  const range = () => {
    const s = fromInput(start, 9 * 60)
    let e = fromInput(end, s + 60)
    if (e === 0) e = DAY_END // 00:00 = end of day
    return { s, e }
  }

  const kindLabel = (k: BlockKind) => {
    const m = KINDS.find((x) => x.value === k)!
    return t(m.pl, m.en)
  }

  const save = () => {
    const { s, e } = range()
    if (e <= s) {
      haptic('error')
      toast(t('Koniec musi być po początku.', 'The end must be after the start.'), { icon: 'clock' })
      return
    }
    const name = title.trim() || kindLabel(kind)
    const patch = { title: name, kind, start_min: s, end_min: e, goal_id: goalId || null, done }
    if (block) db.update('calendar_blocks', block.id, { ...patch, proposed: false })
    else db.insert('calendar_blocks', { date, proposed: false, ...patch })
    haptic('success')
    onClose()
  }

  const remove = () => {
    if (!block) return
    db.remove('calendar_blocks', block.id)
    haptic('warning')
    toast(t('Blok usunięty', 'Block deleted'), {
      icon: 'trash',
      action: {
        label: t('Cofnij', 'Undo'),
        run: () => {
          const { id, created_at, ...rest } = block
          db.insert('calendar_blocks', { ...rest, id, created_at })
        },
      },
    })
    onClose()
  }

  const focusNow = () => {
    if (!block) return
    startFocus({ title: block.title, block_id: block.id, goal_id: block.goal_id ?? null })
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={block ? t('Blok', 'Block') : t('Nowy blok', 'New block')}
      action={
        <button className="btn btn--accent btn--sm" onClick={save}>
          {t('Zapisz', 'Save')}
        </button>
      }
    >
      <div className="stack gap-5">
        <label className="field">
          <span className="field__label">{t('Co robisz', 'What you do')}</span>
          <input
            className="input"
            value={title}
            maxLength={80}
            placeholder={t('np. Oferta dla 3 firm', 'e.g. Offer for 3 companies')}
            enterKeyHint="done"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </label>

        <div className="field">
          <span className="field__label">{t('Rodzaj', 'Kind')}</span>
          <div className="chips" role="radiogroup" aria-label={t('Rodzaj', 'Kind')}>
            {KINDS.map((k) => (
              <button
                key={k.value}
                className="chip"
                role="radio"
                aria-checked={kind === k.value}
                aria-pressed={kind === k.value}
                onClick={() => {
                  haptic('select')
                  setKind(k.value)
                }}
              >
                {t(k.pl, k.en)}
              </button>
            ))}
          </div>
        </div>

        <div className="pl-times">
          <label className="field">
            <span className="field__label">{t('Od', 'From')}</span>
            <input className="input input--num" type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">{t('Do', 'To')}</span>
            <input className="input input--num" type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>

        {goals.length > 0 && (
          <label className="field">
            <span className="field__label">{t('Cel (opcjonalnie)', 'Goal (optional)')}</span>
            <select className="select" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">{t('Bez celu', 'No goal')}</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {block && (
          <>
            <div className="row between well pad-s">
              <span className="t-sub t-strong">{t('Zrobione', 'Done')}</span>
              <Toggle checked={done} onChange={setDone} label={t('Zrobione', 'Done')} />
            </div>
            <div className="pl-sheet-actions">
              <button className="btn btn--ink" onClick={focusNow}>
                <Icon name="timer" />
                {t('Start skupienia', 'Start focus')}
              </button>
              <button className="btn btn--danger" onClick={remove}>
                <Icon name="trash" />
                {t('Usuń', 'Delete')}
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}
