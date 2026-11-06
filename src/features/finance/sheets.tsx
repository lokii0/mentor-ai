// Edit sheets: a transaction, a category, the month's budget.
import { useEffect, useState } from 'react'
import { db, useRows } from '../../lib/db'
import { fmtMonth, todayKey } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { useLang, useT } from '../../lib/settings'
import type { Budget, Category } from '../../lib/types'
import { Icon } from '../../ui/Icon'
import { Segmented } from '../../ui/kit'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/Toast'
import { CATEGORY_ICONS, catIcon, parseAmount, type Tx } from './money'

const numStr = (n: number | null | undefined) => (n ? String(n).replace('.', ',') : '')

// ---------- Transaction ----------

export function TxSheet({ tx, onClose }: { tx: Tx | null; onClose: () => void }) {
  const t = useT()
  const cats = useRows('categories')
  const [amount, setAmount] = useState('')
  const [catId, setCatId] = useState('')
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!tx) return
    setAmount(numStr(tx.row.amount))
    setCatId(tx.row.category_id)
    setDate(tx.row.date)
    setNote(tx.row.note ?? '')
  }, [tx])

  const list = cats.filter((c) => c.kind === tx?.type).sort((a, b) => a.sort - b.sort)
  const value = parseAmount(amount)

  const save = () => {
    if (!tx || value <= 0) return
    const patch = { amount: value, category_id: catId, date, note: note.trim() || null }
    if (tx.type === 'expense') db.update('expenses', tx.row.id, patch)
    else db.update('incomes', tx.row.id, patch)
    haptic('success')
    toast(t('Zapisano', 'Saved'), { icon: 'check' })
    onClose()
  }

  const remove = () => {
    if (!tx) return
    const { row, type } = tx
    if (type === 'expense') db.remove('expenses', row.id)
    else db.remove('incomes', row.id)
    haptic('warning')
    toast(t('Usunięto wpis', 'Entry deleted'), {
      icon: 'trash',
      action: {
        label: t('Cofnij', 'Undo'),
        run: () => (type === 'expense' ? db.insert('expenses', { ...row }) : db.insert('incomes', { ...row })),
      },
    })
    onClose()
  }

  return (
    <Sheet
      open={!!tx}
      onClose={onClose}
      title={tx?.type === 'income' ? t('Przychód', 'Income') : t('Wydatek', 'Expense')}
      action={<button className="btn btn--sm btn--ink" onClick={save} disabled={value <= 0}>{t('Zapisz', 'Save')}</button>}
    >
      <div className="fin-form">
        <label className="field">
          <span className="field__label">{t('Kwota (zł)', 'Amount (PLN)')}</span>
          <input className="input input--num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <div className="field">
          <span className="field__label">{t('Kategoria', 'Category')}</span>
          <div className="chips">
            {list.map((c) => (
              <button key={c.id} className="chip" aria-pressed={c.id === catId} onClick={() => { haptic('select'); setCatId(c.id) }}>
                <Icon name={catIcon(c)} />
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="field__label">{t('Data', 'Date')}</span>
          <input className="input" type="date" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{t('Notatka', 'Note')}</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
        </label>
        <div className="fin-danger-row">
          <span className="t-foot t-3">{t('Usunięcie można cofnąć przez kilka sekund.', 'Deleting can be undone for a few seconds.')}</span>
          <button className="btn btn--sm btn--danger" onClick={remove}>
            <Icon name="trash" />
            {t('Usuń', 'Delete')}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

// ---------- Category ----------

export type CategoryTarget = { category: Category } | { create: 'income' | 'expense' } | null

export function CategorySheet({ target, onClose }: { target: CategoryTarget; onClose: () => void }) {
  const t = useT()
  const cats = useRows('categories')
  const incomes = useRows('incomes')
  const expenses = useRows('expenses')
  const editing = target && 'category' in target ? target.category : null
  const [kind, setKind] = useState<'income' | 'expense'>('expense')
  const [name, setName] = useState('')
  const [key, setKey] = useState<string>('other')
  const [limit, setLimit] = useState('')

  useEffect(() => {
    if (!target) return
    if ('category' in target) {
      setKind(target.category.kind)
      setName(target.category.name)
      setKey(catIcon(target.category))
      setLimit(numStr(target.category.monthly_limit))
    } else {
      setKind(target.create)
      setName('')
      setKey('other')
      setLimit('')
    }
  }, [target])

  const used = editing ? (editing.kind === 'expense' ? expenses : incomes).some((r) => r.category_id === editing.id) : false

  const save = () => {
    const n = name.trim()
    if (!n) return
    const monthly_limit = kind === 'expense' ? parseAmount(limit) || null : null
    if (editing) db.update('categories', editing.id, { name: n, key, monthly_limit })
    else {
      const sort = Math.max(-1, ...cats.filter((c) => c.kind === kind).map((c) => c.sort)) + 1
      db.insert('categories', { kind, name: n, key, monthly_limit, sort })
    }
    haptic('success')
    onClose()
  }

  const remove = () => {
    if (!editing || used) return
    db.remove('categories', editing.id)
    haptic('warning')
    toast(t('Kategoria usunięta', 'Category deleted'), {
      icon: 'trash',
      action: { label: t('Cofnij', 'Undo'), run: () => db.insert('categories', { ...editing }) },
    })
    onClose()
  }

  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      title={editing ? t('Kategoria', 'Category') : t('Nowa kategoria', 'New category')}
      action={<button className="btn btn--sm btn--ink" onClick={save} disabled={!name.trim()}>{t('Zapisz', 'Save')}</button>}
    >
      <div className="fin-form">
        {!editing && (
          <Segmented
            label={t('Rodzaj', 'Type')}
            value={kind}
            onChange={setKind}
            options={[
              { value: 'expense', label: t('Wydatki', 'Expenses') },
              { value: 'income', label: t('Przychody', 'Income') },
            ]}
          />
        )}
        <label className="field">
          <span className="field__label">{t('Nazwa', 'Name')}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </label>
        <div className="field">
          <span className="field__label">{t('Ikona', 'Icon')}</span>
          <div className="fin-icons" role="group" aria-label={t('Ikona', 'Icon')}>
            {CATEGORY_ICONS.map((ic) => (
              <button key={ic} className="fin-icon-opt" aria-pressed={key === ic} aria-label={ic} onClick={() => { haptic('select'); setKey(ic) }}>
                <Icon name={ic} />
              </button>
            ))}
          </div>
        </div>
        {kind === 'expense' && (
          <label className="field">
            <span className="field__label">{t('Limit miesięczny (zł)', 'Monthly limit (PLN)')}</span>
            <input className="input input--num" inputMode="decimal" placeholder={t('Bez limitu', 'No limit')} value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>
        )}
        {editing && (
          <div className="fin-danger-row">
            <span className="t-foot t-3">
              {used ? t('Ma wpisy — nie można jej usunąć.', 'Has entries — it can’t be deleted.') : t('Nie ma wpisów.', 'No entries yet.')}
            </span>
            <button className="btn btn--sm btn--danger" onClick={remove} disabled={used}>
              <Icon name="trash" />
              {t('Usuń', 'Delete')}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}

// ---------- Budget ----------

export function BudgetSheet({ open, month, budget, defaultGoal, onClose }: { open: boolean; month: string; budget?: Budget; defaultGoal: number; onClose: () => void }) {
  const t = useT()
  const lang = useLang()
  const [limit, setLimit] = useState('')
  const [goal, setGoal] = useState('')

  useEffect(() => {
    if (!open) return
    setLimit(numStr(budget?.total_limit))
    setGoal(numStr(budget?.income_goal ?? defaultGoal))
  }, [open, budget, defaultGoal])

  const save = () => {
    const patch = { total_limit: parseAmount(limit), income_goal: parseAmount(goal) || defaultGoal }
    if (budget) db.update('budgets', budget.id, patch)
    else db.insert('budgets', { month, ...patch })
    haptic('success')
    toast(t('Budżet zapisany', 'Budget saved'), { icon: 'check' })
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${t('Budżet', 'Budget')} · ${fmtMonth(month, lang)}`}
      action={<button className="btn btn--sm btn--ink" onClick={save}>{t('Zapisz', 'Save')}</button>}
    >
      <div className="fin-form">
        <label className="field">
          <span className="field__label">{t('Cel przychodu (zł / mies.)', 'Income goal (PLN / month)')}</span>
          <input className="input input--num" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{t('Limit wydatków (zł / mies.)', 'Spending limit (PLN / month)')}</span>
          <input className="input input--num" inputMode="decimal" placeholder={t('Bez limitu', 'No limit')} value={limit} onChange={(e) => setLimit(e.target.value)} />
          <span className="field__hint">{t('Limity kategorii ustawisz, dotykając kategorii.', 'Set category limits by tapping a category.')}</span>
        </label>
      </div>
    </Sheet>
  )
}
