import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { navigate } from '../../app/nav'
import { useRows } from '../../lib/db'
import { addMonths, fmtDay, fmtMoney, fmtMonth, monthDays, monthKey, todayKey } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { askMentor } from '../../lib/mentor'
import { useLang, useT } from '../../lib/settings'
import { categoryName, monthMoney } from '../../lib/stats'
import type { Category } from '../../lib/types'
import { Bars } from '../../ui/charts'
import { Icon } from '../../ui/Icon'
import { Bar, Card, Counter, Empty, Segmented } from '../../ui/kit'
import { Page } from '../../ui/Page'
import { QuickAddSheet } from './QuickAdd'
import { BudgetSheet, CategorySheet, TxSheet, type CategoryTarget } from './sheets'
import { catIcon, hasCents, monthTx, type Tx } from './money'
import './finance.css'

const DEFAULT_GOAL = 10000

export default function FinanceScreen() {
  const t = useT()
  const lang = useLang()
  const incomes = useRows('incomes')
  const expenses = useRows('expenses')
  const cats = useRows('categories')
  const budgets = useRows('budgets')

  const current = monthKey()
  const [month, setMonth] = useState(current)
  const [quick, setQuick] = useState<'expense' | 'income' | null>(null)
  const [tx, setTx] = useState<Tx | null>(null)
  const [catTarget, setCatTarget] = useState<CategoryTarget>(null)
  const [budgetOpen, setBudgetOpen] = useState(false)

  const money = useMemo(() => monthMoney(month, incomes, expenses), [month, incomes, expenses])
  const budget = budgets.find((b) => b.month === month)
  // A month without its own budget row inherits the latest earlier goal.
  const inheritedGoal = useMemo(
    () => [...budgets].filter((b) => b.month <= month).sort((a, b) => b.month.localeCompare(a.month))[0]?.income_goal ?? DEFAULT_GOAL,
    [budgets, month],
  )
  const goal = budget?.income_goal || inheritedGoal
  const limit = budget?.total_limit ?? 0

  const money0 = (n: number, sign = false) => fmtMoney(n, lang, { sign, decimals: hasCents(n) })

  return (
    <Page
      title={t('Finanse', 'Money')}
      action={
        <button className="btn btn--accent" onClick={() => { haptic('tap'); setQuick('expense') }} aria-label={t('Dodaj wpis', 'Add entry')}>
          <Icon name="plus" />
          {t('Dodaj', 'Add')}
        </button>
      }
    >
      <Card className="fin-hero" variant="float">
        <div className="fin-month">
          <button className="icon-btn icon-btn--sm icon-btn--plain" onClick={() => { haptic('select'); setMonth((m) => addMonths(m, -1)) }} aria-label={t('Poprzedni miesiąc', 'Previous month')}>
            <Icon name="chevronLeft" />
          </button>
          <span className="fin-month__label">{fmtMonth(month, lang)}</span>
          <button
            className="icon-btn icon-btn--sm icon-btn--plain"
            onClick={() => { haptic('select'); setMonth((m) => addMonths(m, 1)) }}
            disabled={month >= current}
            style={month >= current ? { opacity: 0.3 } : undefined}
            aria-label={t('Następny miesiąc', 'Next month')}
          >
            <Icon name="chevronRight" />
          </button>
        </div>

        <div className="fin-balance">
          <span className="fin-balance__label">{t('Saldo miesiąca', 'Balance this month')}</span>
          <Counter
            key={month}
            value={money.balance}
            format={(v) => fmtMoney(Math.round(v), lang, { sign: true })}
            className={`t-hero fin-balance__value ${money.balance < 0 ? 'fin-balance__value--neg' : ''}`}
          />
        </div>

        <div className="stats">
          <div className="stat">
            <span className="stat__label">{t('Przychody', 'Income')}</span>
            <span className="stat__value">{money0(money.income)}</span>
          </div>
          <div className="stat">
            <span className="stat__label">{t('Wydatki', 'Expenses')}</span>
            <span className="stat__value">{money0(money.expense)}</span>
          </div>
        </div>

        <div className="fin-track">
          <div className="fin-track__row">
            <span>{t('Do celu', 'To the goal')} {fmtMoney(goal, lang)}</span>
            <b>{goal > 0 ? Math.round((money.income / goal) * 100) : 0}%</b>
          </div>
          <Bar value={goal > 0 ? money.income / goal : 0} tone="deep" thick />
          <span className="fin-track__note">
            {money.income >= goal
              ? t('Cel miesiąca osiągnięty.', 'Monthly goal reached.')
              : `${t('Brakuje', 'Missing')} ${fmtMoney(goal - money.income, lang)}`}
          </span>
        </div>

        {limit > 0 && (
          <div className="fin-track">
            <div className="fin-track__row">
              <span>{t('Wydane z limitu', 'Spent of limit')} {fmtMoney(limit, lang)}</span>
              <b style={money.expense > limit ? { color: 'var(--pink-ink)' } : undefined}>{Math.round((money.expense / limit) * 100)}%</b>
            </div>
            <Bar value={money.expense / limit} tone={money.expense > limit ? 'pink' : 'sky'} thick />
            <span className={`fin-track__note ${money.expense > limit ? 'fin-track__note--risk' : ''}`}>
              {money.expense > limit
                ? `${t('Limit przekroczony o', 'Over the limit by')} ${fmtMoney(money.expense - limit, lang)}`
                : `${t('Zostało', 'Left')} ${fmtMoney(limit - money.expense, lang)}`}
            </span>
          </div>
        )}

        <button className="btn btn--glass btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => setBudgetOpen(true)}>
          <Icon name="settings" />
          {t('Budżet i cel', 'Budget & goal')}
        </button>
      </Card>

      <SpendChart month={month} limit={limit} />

      <CategoriesCard month={month} byCategory={money.byCategory} onPick={(c) => setCatTarget({ category: c })} onAdd={(k) => setCatTarget({ create: k })} />

      <TransactionsCard month={month} onPick={setTx} onAddIncome={() => setQuick('income')} />

      <Card className="pad stack gap-3">
        <p className="t-sub t-2 t-pretty">
          {t('Mentor przejrzy ten miesiąc i powie wprost, gdzie przepalasz kasę.', 'The mentor reviews this month and tells you straight where money is leaking.')}
        </p>
        <button
          className="btn btn--ink"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            haptic('tap')
            void askMentor({ context: 'chat', message: mentorSummary(month, lang, money, goal, limit, cats, expenses) })
            navigate('mentor')
          }}
        >
          <Icon name="mentor" />
          {t('Zapytaj mentora o wydatki', 'Ask the mentor about spending')}
        </button>
      </Card>

      <QuickAddSheet open={quick !== null} kind={quick ?? 'expense'} onClose={() => setQuick(null)} />
      <TxSheet tx={tx} onClose={() => setTx(null)} />
      <CategorySheet target={catTarget} onClose={() => setCatTarget(null)} />
      <BudgetSheet open={budgetOpen} month={month} budget={budget} defaultGoal={inheritedGoal} onClose={() => setBudgetOpen(false)} />
    </Page>
  )
}

// ---------- Daily spending ----------

function SpendChart({ month, limit }: { month: string; limit: number }) {
  const t = useT()
  const lang = useLang()
  const expenses = useRows('expenses')
  const days = monthDays(month)
  const today = todayKey()
  const daily = limit > 0 ? limit / days.length : undefined

  const data = useMemo(() => {
    const sums = new Map<string, number>()
    for (const e of expenses) if (e.date.startsWith(month)) sums.set(e.date, (sums.get(e.date) ?? 0) + e.amount)
    return days.map((d, i) => {
      const v = sums.get(d) ?? 0
      return {
        label: i % 7 === 0 ? String(i + 1) : '',
        value: v,
        risk: daily !== undefined && v > daily,
        current: d === today,
      }
    })
  }, [expenses, month, days, daily, today])

  const total = data.reduce((s, d) => s + d.value, 0)
  const activeDays = data.filter((d) => d.value > 0).length

  return (
    <Card className="fin-card">
      <div className="fin-card__head">
        <h2 className="fin-card__title">{t('Wydatki dziennie', 'Daily spending')}</h2>
        <span className="fin-card__aside">
          {activeDays ? `${t('śr.', 'avg')} ${fmtMoney(Math.round(total / activeDays), lang)} / ${t('dzień', 'day')}` : ''}
        </span>
      </div>
      <div className="fin-card__body">
        {total > 0 ? (
          <Bars data={data} height={132} target={daily} format={(v) => fmtMoney(v, lang)} />
        ) : (
          <Empty>{t('W tym miesiącu nie ma jeszcze wydatków.', 'No spending this month yet.')}</Empty>
        )}
        {daily !== undefined && total > 0 && (
          <p className="t-caption t-3" style={{ marginTop: 8 }}>
            {t('Linia: dzienny limit', 'Line: daily allowance')} {fmtMoney(Math.round(daily), lang)}
          </p>
        )}
      </div>
    </Card>
  )
}

// ---------- Categories ----------

function CategoriesCard({ month, byCategory, onPick, onAdd }: { month: string; byCategory: Map<string, number>; onPick: (c: Category) => void; onAdd: (k: 'income' | 'expense') => void }) {
  const t = useT()
  const lang = useLang()
  const cats = useRows('categories')
  const incomes = useRows('incomes')
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [all, setAll] = useState(false)

  const incomeBy = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of incomes) if (i.date.startsWith(month)) m.set(i.category_id, (m.get(i.category_id) ?? 0) + i.amount)
    return m
  }, [incomes, month])

  const sums = kind === 'expense' ? byCategory : incomeBy
  const rows = cats
    .filter((c) => c.kind === kind)
    .map((c) => ({ c, v: sums.get(c.id) ?? 0 }))
    .sort((a, b) => b.v - a.v || a.c.sort - b.c.sort)
  const shown = all ? rows : rows.slice(0, 6)

  return (
    <Card className="fin-card">
      <div className="fin-card__head">
        <h2 className="fin-card__title">{t('Kategorie', 'Categories')}</h2>
        <div style={{ width: 200 }}>
          <Segmented
            label={t('Rodzaj', 'Type')}
            value={kind}
            onChange={(v) => { setKind(v); setAll(false) }}
            options={[
              { value: 'expense', label: t('Wydatki', 'Expenses') },
              { value: 'income', label: t('Przychody', 'Income') },
            ]}
          />
        </div>
      </div>
      <motion.div className="list" key={kind} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        {shown.map(({ c, v }) => {
          const lim = kind === 'expense' ? c.monthly_limit ?? 0 : 0
          const over = lim > 0 && v > lim
          return (
            <button key={c.id} className={`lrow lrow--tap fin-cat ${over ? 'fin-cat--over' : ''} ${v === 0 ? 'fin-cat--zero' : ''}`} onClick={() => onPick(c)}>
              <Icon name={catIcon(c)} className="lrow__icon" />
              <span className="fin-cat__main">
                <span className="fin-cat__name">{c.name}</span>
                {lim > 0 && <Bar value={v / lim} tone={over ? 'pink' : 'sky'} />}
              </span>
              <span className="fin-cat__value">
                <span className="fin-cat__amount">{fmtMoney(v, lang, { decimals: hasCents(v) })}</span>
                {lim > 0 && <span className="fin-cat__limit">{t('z', 'of')} {fmtMoney(lim, lang)}</span>}
              </span>
            </button>
          )
        })}
      </motion.div>
      <div className="fin-card__foot row gap-2">
        {rows.length > 6 && (
          <button className="btn btn--ghost btn--sm" onClick={() => setAll((a) => !a)}>
            {all ? t('Pokaż mniej', 'Show less') : `${t('Pokaż wszystkie', 'Show all')} (${rows.length})`}
          </button>
        )}
        <button className="btn btn--ghost btn--sm" onClick={() => onAdd(kind)}>
          <Icon name="plus" />
          {t('Nowa kategoria', 'New category')}
        </button>
      </div>
    </Card>
  )
}

// ---------- Transactions ----------

function TransactionsCard({ month, onPick, onAddIncome }: { month: string; onPick: (tx: Tx) => void; onAddIncome: () => void }) {
  const t = useT()
  const lang = useLang()
  const incomes = useRows('incomes')
  const expenses = useRows('expenses')
  const cats = useRows('categories')
  const [limit, setLimit] = useState(40)

  const list = useMemo(() => monthTx(month, incomes, expenses), [month, incomes, expenses])
  const shown = list.slice(0, limit)

  const groups: { date: string; items: Tx[]; net: number }[] = []
  for (const tx of shown) {
    let g = groups[groups.length - 1]
    if (!g || g.date !== tx.row.date) {
      g = { date: tx.row.date, items: [], net: 0 }
      groups.push(g)
    }
    g.items.push(tx)
    g.net += tx.type === 'income' ? tx.row.amount : -tx.row.amount
  }

  return (
    <Card className="fin-card">
      <div className="fin-card__head">
        <h2 className="fin-card__title">{t('Wpisy', 'Entries')}</h2>
        <button className="btn btn--ghost btn--sm" onClick={onAddIncome}>
          <Icon name="plus" />
          {t('Przychód', 'Income')}
        </button>
      </div>
      {groups.length === 0 ? (
        <Empty>{t('Brak wpisów w tym miesiącu. Dodawaj od razu — zajmuje to pięć sekund.', 'No entries this month. Log right away — it takes five seconds.')}</Empty>
      ) : (
        groups.map((g) => (
          <div key={g.date}>
            <div className="fin-day">
              <span>{g.date === todayKey() ? t('Dziś', 'Today') : fmtDay(g.date, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              <span>{fmtMoney(g.net, lang, { sign: true, decimals: hasCents(g.net) })}</span>
            </div>
            <div className="list">
              {g.items.map((tx) => {
                const cat = cats.find((c) => c.id === tx.row.category_id)
                const name = categoryName(cats, tx.row.category_id)
                const income = tx.type === 'income'
                const amt = income ? tx.row.amount : -tx.row.amount
                return (
                  <button key={tx.row.id} className="lrow lrow--tap" onClick={() => onPick(tx)}>
                    <Icon name={catIcon(cat)} className="lrow__icon" />
                    <span className="lrow__main">
                      <span className="lrow__title">{tx.row.note || name}</span>
                      {tx.row.note && <span className="lrow__sub">{name}</span>}
                    </span>
                    <span className={`fin-tx__amount ${income ? 'fin-tx__amount--in' : ''}`}>
                      {fmtMoney(amt, lang, { sign: true, decimals: hasCents(amt) })}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))
      )}
      {list.length > limit && (
        <div className="fin-card__foot">
          <button className="btn btn--ghost btn--sm" onClick={() => setLimit((l) => l + 40)}>
            {t('Pokaż więcej', 'Show more')} ({list.length - limit})
          </button>
        </div>
      )}
    </Card>
  )
}

// ---------- Mentor brief (facts only) ----------

function mentorSummary(
  month: string,
  lang: 'pl' | 'en',
  money: { income: number; expense: number; balance: number; byCategory: Map<string, number> },
  goal: number,
  limit: number,
  cats: Category[],
  expenses: { amount: number; category_id: string; date: string; note?: string | null }[],
): string {
  const m = (n: number) => fmtMoney(n, lang, { decimals: hasCents(n) })
  const top = [...money.byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, v]) => {
      const c = cats.find((x) => x.id === id)
      const lim = c?.monthly_limit ? ` (limit ${m(c.monthly_limit)})` : ''
      return `${c?.name ?? '—'} ${m(v)}${lim}`
    })
  const recent = expenses
    .filter((e) => e.date.startsWith(month))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((e) => `${m(e.amount)} ${categoryName(cats, e.category_id)}${e.note ? ` — ${e.note}` : ''}`)
  const pct = goal > 0 ? Math.round((money.income / goal) * 100) : 0
  const label = fmtMonth(month, lang)

  if (lang === 'en') {
    return [
      `Review my money for ${label}: income ${m(money.income)}, expenses ${m(money.expense)}, balance ${m(money.balance)}.`,
      `Income goal ${m(goal)} — ${pct}% reached.${limit > 0 ? ` Spending limit ${m(limit)}.` : ''}`,
      top.length ? `Biggest categories: ${top.join('; ')}.` : 'No expenses logged yet.',
      recent.length ? `Largest expenses: ${recent.join('; ')}.` : '',
      'Where am I wasting money and what do I change this week?',
    ].filter(Boolean).join('\n')
  }
  return [
    `Przejrzyj moje finanse za ${label}: przychody ${m(money.income)}, wydatki ${m(money.expense)}, saldo ${m(money.balance)}.`,
    `Cel przychodu ${m(goal)} — zrobione ${pct}%.${limit > 0 ? ` Limit wydatków ${m(limit)}.` : ''}`,
    top.length ? `Największe kategorie: ${top.join('; ')}.` : 'Nie ma jeszcze wpisanych wydatków.',
    recent.length ? `Największe wydatki: ${recent.join('; ')}.` : '',
    'Gdzie marnuję pieniądze i co mam zmienić w tym tygodniu?',
  ].filter(Boolean).join('\n')
}
