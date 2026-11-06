// PRD 6.5: quick add under 5 s — amount on a custom keypad, the most-used category
// pre-selected, today pre-selected, one tap to save.
import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { db, useRows } from '../../lib/db'
import { addDays, fmtDay, fmtMoney, todayKey, yesterdayKey } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { useLang, useT } from '../../lib/settings'
import { Icon } from '../../ui/Icon'
import { Segmented } from '../../ui/kit'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/Toast'
import { catIcon, formatRaw, hasCents, pushKey, rawValue } from './money'
import './finance.css'

type Kind = 'expense' | 'income'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back']

export function QuickAddSheet({ open, onClose, kind: initialKind = 'expense' }: { open: boolean; onClose: () => void; kind?: Kind }) {
  const t = useT()
  const lang = useLang()
  const cats = useRows('categories')
  const incomes = useRows('incomes')
  const expenses = useRows('expenses')

  const [kind, setKind] = useState<Kind>(initialKind)
  const [raw, setRaw] = useState('')
  const [catId, setCatId] = useState<string | null>(null)
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setKind(initialKind)
    setRaw('')
    setCatId(null)
    setDate(todayKey())
    setNote('')
  }, [open, initialKind])

  // Most-used categories (last 60 days) first, so the usual one is already selected.
  const list = useMemo(() => {
    const since = addDays(todayKey(), -60)
    const rows = kind === 'expense' ? expenses : incomes
    const uses = new Map<string, number>()
    for (const r of rows) if (r.date >= since) uses.set(r.category_id, (uses.get(r.category_id) ?? 0) + 1)
    return cats
      .filter((c) => c.kind === kind)
      .sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.sort - b.sort)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats, kind, open])

  const selected = catId ?? list[0]?.id ?? null
  const value = rawValue(raw)
  const canSave = value > 0 && !!selected

  const press = (k: string) => {
    setRaw((r) => pushKey(r, k))
  }

  const save = () => {
    if (!canSave || !selected) return
    const data = { amount: value, category_id: selected, date, note: note.trim() || null }
    const row = kind === 'expense' ? db.insert('expenses', data) : db.insert('incomes', data)
    const table = kind === 'expense' ? ('expenses' as const) : ('incomes' as const)
    const name = list.find((c) => c.id === selected)?.name ?? ''
    haptic('success')
    toast(`${fmtMoney(kind === 'expense' ? -value : value, lang, { sign: true, decimals: hasCents(value) })} · ${name}`, {
      icon: 'check',
      action: { label: t('Cofnij', 'Undo'), run: () => db.remove(table, row.id) },
    })
    onClose()
  }

  // Hardware keyboard (desktop / iPad with keyboard), ignored while typing the note.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === ',' || e.key === '.') press(',')
      else if (e.key === 'Backspace') press('back')
      else if (e.key === 'Enter') save()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const isToday = date === todayKey()
  const isYesterday = date === yesterdayKey()

  return (
    <Sheet open={open} onClose={onClose} title={kind === 'expense' ? t('Nowy wydatek', 'New expense') : t('Nowy przychód', 'New income')}>
      <div className="fin-qa">
        <Segmented
          label={t('Rodzaj', 'Type')}
          value={kind}
          onChange={(v) => {
            setKind(v)
            setCatId(null)
          }}
          options={[
            { value: 'expense', label: t('Wydatek', 'Expense') },
            { value: 'income', label: t('Przychód', 'Income') },
          ]}
        />

        <motion.output
          key={kind}
          className={`fin-amount ${raw ? '' : 'fin-amount--empty'}`}
          aria-live="polite"
          aria-label={t('Kwota', 'Amount')}
          initial={{ opacity: 0.4, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        >
          {kind === 'income' && raw ? '+' : ''}
          {formatRaw(raw, lang)}
          <span className="fin-amount__caret" aria-hidden="true" />
          <span className="fin-amount__cur">zł</span>
        </motion.output>

        <div className="fin-row-scroll no-scrollbar" role="group" aria-label={t('Kategoria', 'Category')}>
          {list.map((c) => (
            <button
              key={c.id}
              className="chip"
              aria-pressed={c.id === selected}
              onClick={() => {
                haptic('select')
                setCatId(c.id)
              }}
            >
              <Icon name={catIcon(c)} />
              {c.name}
            </button>
          ))}
        </div>

        <div className="fin-row-scroll no-scrollbar" role="group" aria-label={t('Data', 'Date')}>
          <button className="chip" aria-pressed={isToday} onClick={() => { haptic('select'); setDate(todayKey()) }}>
            {t('Dziś', 'Today')}
          </button>
          <button className="chip" aria-pressed={isYesterday} onClick={() => { haptic('select'); setDate(yesterdayKey()) }}>
            {t('Wczoraj', 'Yesterday')}
          </button>
          <label className="chip fin-date-chip" aria-pressed={!isToday && !isYesterday}>
            <Icon name="plan" />
            {!isToday && !isYesterday ? fmtDay(date, lang, { day: 'numeric', month: 'short' }) : t('Inny dzień', 'Other day')}
            <input
              type="date"
              value={date}
              max={todayKey()}
              aria-label={t('Wybierz datę', 'Pick a date')}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker?.()
                } catch {
                  /* older browsers open it natively */
                }
              }}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
        </div>

        <input
          className="input"
          placeholder={t('Notatka (opcjonalnie)', 'Note (optional)')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          enterKeyHint="done"
          maxLength={120}
        />

        <div className="fin-pad" role="group" aria-label={t('Klawiatura kwoty', 'Amount keypad')}>
          {KEYS.map((k) => (
            <button
              key={k}
              className={`fin-key ${k === ',' || k === 'back' ? 'fin-key--fn' : ''}`}
              onPointerDown={() => haptic('tap')}
              onClick={() => press(k)}
              aria-label={k === 'back' ? t('Usuń cyfrę', 'Delete digit') : k === ',' ? t('Przecinek', 'Decimal point') : k}
            >
              {k === 'back' ? <Icon name="backspace" /> : k === ',' ? (lang === 'en' ? '.' : ',') : k}
            </button>
          ))}
        </div>

        <button className="btn btn--accent btn--lg btn--block" disabled={!canSave} onClick={save}>
          {canSave
            ? `${t('Zapisz', 'Save')} ${fmtMoney(value, lang, { decimals: hasCents(value) })}`
            : t('Wpisz kwotę', 'Enter an amount')}
        </button>
      </div>
    </Sheet>
  )
}
