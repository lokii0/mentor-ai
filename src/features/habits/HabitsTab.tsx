import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { db, useRows } from '../../lib/db'
import { addDays, fmtDay, lastNDays, todayKey, weekStart } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { useLang, useT } from '../../lib/settings'
import { habitDoneOn, habitProgress, habitSeries, habitValue, habitWeekValue } from '../../lib/stats'
import type { Habit, HabitLog } from '../../lib/types'
import { Bars, Heatmap } from '../../ui/charts'
import { Icon } from '../../ui/Icon'
import { Card, Empty, Ring, Stepper } from '../../ui/kit'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/Toast'
import { HabitForm } from './HabitForm'
import { fmtHabit, fmtTarget, habitIcon, seriesLabel, setHabitValue, sortHabits } from './util'
import { WaterCard } from './Water'

function HabitRow({ h, logs, onOpen }: { h: Habit; logs: HabitLog[]; onOpen: () => void }) {
  const t = useT()
  const lang = useLang()
  const today = todayKey()
  const p = habitProgress(h, logs, today)
  const todayVal = habitValue(logs, h.id, today)
  const shown = h.period === 'week' ? habitWeekValue(logs, h.id, today) : todayVal
  const series = habitSeries(h, logs, today)
  const done = p >= 1

  const act = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (h.kind === 'check') {
      const next = todayVal > 0 ? 0 : 1
      haptic(next ? 'success' : 'tap')
      setHabitValue(h, today, next)
    } else {
      const step = h.step || 1
      haptic(todayVal + step >= h.target && todayVal < h.target ? 'success' : 'tap')
      setHabitValue(h, today, todayVal + step)
    }
  }

  return (
    <div role="button" tabIndex={0} className={`hb-row tappable ${done ? 'hb-row--done' : ''}`} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <Ring value={p} size={48} stroke={4.5} label={`${Math.round(p * 100)}%`}>
        <span className="hb-row__icon">
          <Icon name={habitIcon(h)} size={20} />
        </span>
      </Ring>
      <div className="hb-row__main">
        <span className="hb-row__name">{h.name}</span>
        <span className="hb-row__meta">
          <strong>
            {h.kind === 'check' && h.period === 'day'
              ? done
                ? t('Zrobione', 'Done')
                : t('Jeszcze nie', 'Not yet')
              : h.kind === 'check'
                ? `${shown}/${h.target} ${t('w tygodniu', 'this week')}`
                : `${fmtHabit(h, shown, lang)} / ${fmtHabit(h, h.target, lang)}${h.period === 'week' ? t(' w tygodniu', ' this week') : ''}`}
          </strong>
          {series.length > 0 && <span>· {seriesLabel(h, series.length, lang)}</span>}
          {series.shieldUsed && (
            <span className="row gap-1" title={t('Tarcza użyta', 'Shield used')}>
              · <Icon name="shield" /> {t('tarcza użyta', 'shield used')}
            </span>
          )}
        </span>
      </div>
      {h.kind === 'check' ? (
        <button className="hb-check" aria-pressed={todayVal > 0} aria-label={todayVal > 0 ? t('Odznacz', 'Uncheck') : t('Zrobione', 'Mark done')} onClick={act}>
          <Icon name="check" stroke={2.2} />
        </button>
      ) : (
        <button className={`hb-plus ${done ? 'hb-plus--done' : ''}`} aria-label={t(`Dodaj ${h.step}`, `Add ${h.step}`)} onClick={act}>
          <Icon name="plus" stroke={2.2} />
          {h.unit === 'ml' ? `${h.step}` : h.step}
        </button>
      )}
    </div>
  )
}

function HabitDetail({ h, logs, onEdit, onClose }: { h: Habit; logs: HabitLog[]; onEdit: () => void; onClose: () => void }) {
  const t = useT()
  const lang = useLang()
  const today = todayKey()
  const todayVal = habitValue(logs, h.id, today)
  const series = habitSeries(h, logs, today)

  const bars = useMemo(() => {
    if (h.period === 'week') {
      const ws = weekStart(today)
      return Array.from({ length: 8 }, (_, i) => {
        const start = addDays(ws, (i - 7) * 7)
        return { label: fmtDay(start, lang, { day: 'numeric', month: 'numeric' }), value: habitWeekValue(logs, h.id, start), current: i === 7 }
      })
    }
    return lastNDays(7, today).map((d) => ({
      label: fmtDay(d, lang, { weekday: 'narrow' }),
      value: h.unit === 'ml' ? habitValue(logs, h.id, d) / 1000 : habitValue(logs, h.id, d),
      current: d === today,
    }))
  }, [h, logs, lang, today])

  const heatDays = lastNDays(84, today)
  const heat = Object.fromEntries(heatDays.map((d) => [d, h.period === 'week' ? (habitValue(logs, h.id, d) > 0 ? 1 : 0) : Math.min(1, h.target ? habitValue(logs, h.id, d) / h.target : 0)]))
  const done30 = lastNDays(30, today).filter((d) => (h.period === 'week' ? habitValue(logs, h.id, d) > 0 : habitDoneOn(h, logs, d))).length

  return (
    <div className="hb-detail">
      <div className="well hb-detail__today">
        <div className="stack">
          <span className="t-foot t-2">{t('Dziś', 'Today')}</span>
          <span className="t-title3 t-num">{h.kind === 'check' ? (todayVal > 0 ? t('Zrobione', 'Done') : t('Jeszcze nie', 'Not yet')) : fmtHabit(h, todayVal, lang)}</span>
        </div>
        {h.kind === 'check' ? (
          <button className="hb-check" aria-pressed={todayVal > 0} aria-label={t('Przełącz', 'Toggle')} onClick={() => { haptic('select'); setHabitValue(h, today, todayVal > 0 ? 0 : 1) }}>
            <Icon name="check" stroke={2.2} />
          </button>
        ) : (
          <Stepper label={h.name} value={todayVal} step={h.step || 1} onChange={(v) => setHabitValue(h, today, v)} format={(v) => (h.unit === 'ml' ? fmtHabit(h, v, lang) : String(v))} />
        )}
      </div>

      <div className="well stats">
        <div className="stat">
          <span className="stat__label">{t('Seria', 'Series')}</span>
          <span className="stat__value">{series.length}</span>
          <span className="stat__note">{series.shieldUsed ? t('z użytą tarczą', 'shield used') : h.shield ? t('tarcza dostępna', 'shield available') : t('bez tarczy', 'no shield')}</span>
        </div>
        <div className="stat">
          <span className="stat__label">{t('Dni z wpisem (30)', 'Days logged (30)')}</span>
          <span className="stat__value">{done30}</span>
          <span className="stat__note">{fmtTarget(h, lang)}</span>
        </div>
      </div>

      <div className="well hb-detail__chart">
        <h3>{h.period === 'week' ? t('Ostatnie 8 tygodni', 'Last 8 weeks') : t('Ostatnie 7 dni', 'Last 7 days')}</h3>
        <Bars data={bars} target={h.unit === 'ml' ? h.target / 1000 : h.target} format={(v) => (h.unit === 'ml' ? `${v.toFixed(1)} l` : String(v))} />
      </div>

      <div className="well hb-detail__chart">
        <h3>{t('12 tygodni', '12 weeks')}</h3>
        <div className="hb-heat">
          <Heatmap days={heatDays} values={heat} cell={16} gap={4} labelFor={(d, v) => `${fmtDay(d, lang, { day: 'numeric', month: 'short' })}: ${Math.round(v * 100)}%`} />
        </div>
      </div>

      <div className="hb-actions">
        <button className="btn btn--glass grow" onClick={onEdit}>
          <Icon name="edit" />
          {t('Edytuj', 'Edit')}
        </button>
        <button
          className="btn btn--danger grow"
          onClick={() => {
            db.update('habits', h.id, { archived: true })
            haptic('warning')
            onClose()
            toast(t('Nawyk zarchiwizowany', 'Habit archived'), { action: { label: t('Cofnij', 'Undo'), run: () => db.update('habits', h.id, { archived: false }) } })
          }}
        >
          {t('Archiwizuj', 'Archive')}
        </button>
      </div>
    </div>
  )
}

export function HabitsTab() {
  const t = useT()
  const habits = useRows('habits')
  const logs = useRows('habit_logs')
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)

  const active = habits.filter((h) => !h.archived).sort(sortHabits)
  const archived = habits.filter((h) => h.archived).sort(sortHabits)
  const water = active.find((h) => h.preset === 'water')
  const daily = active.filter((h) => h.period === 'day')
  const weekly = active.filter((h) => h.period === 'week')
  const open = habits.find((h) => h.id === openId) ?? null
  const doneToday = daily.filter((h) => habitProgress(h, logs) >= 1).length

  const close = () => {
    setOpenId(null)
    setEditing(false)
  }

  return (
    <>
      {water && <WaterCard habit={water} logs={logs} />}

      <Card>
        <div className="sec-head" style={{ padding: '18px 20px 0' }}>
          <h2 className="sec-head__title">{t('Codziennie', 'Daily')}</h2>
          <span className="sec-head__aside t-num">{doneToday}/{daily.length}</span>
        </div>
        {daily.length ? (
          <div className="hb-list">
            {daily.map((h) => (
              <HabitRow key={h.id} h={h} logs={logs} onOpen={() => setOpenId(h.id)} />
            ))}
          </div>
        ) : (
          <Empty>{t('Brak codziennych nawyków.', 'No daily habits.')}</Empty>
        )}
      </Card>

      {weekly.length > 0 && (
        <Card>
          <div className="sec-head" style={{ padding: '18px 20px 0' }}>
            <h2 className="sec-head__title">{t('W tygodniu', 'Weekly')}</h2>
            <span className="sec-head__aside">{t('od poniedziałku', 'from Monday')}</span>
          </div>
          <div className="hb-list">
            {weekly.map((h) => (
              <HabitRow key={h.id} h={h} logs={logs} onOpen={() => setOpenId(h.id)} />
            ))}
          </div>
        </Card>
      )}

      <motion.div className="hb-addrow" variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}>
        <button className="btn btn--glass btn--block" onClick={() => setAdding(true)}>
          <Icon name="plus" />
          {t('Dodaj nawyk', 'Add habit')}
        </button>
      </motion.div>

      {archived.length > 0 && (
        <details className="hb-archived">
          <summary>{t(`Zarchiwizowane (${archived.length})`, `Archived (${archived.length})`)}</summary>
          <div className="list">
            {archived.map((h) => (
              <div key={h.id} className="lrow">
                <Icon name={habitIcon(h)} className="lrow__icon" />
                <div className="lrow__main">
                  <span className="lrow__title">{h.name}</span>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => db.update('habits', h.id, { archived: false })}>
                  {t('Przywróć', 'Restore')}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      <Sheet open={!!open} onClose={close} title={open ? (editing ? t('Edytuj nawyk', 'Edit habit') : open.name) : ''} tall={editing}>
        {open && (editing ? <HabitForm initial={open} onDone={() => setEditing(false)} /> : <HabitDetail h={open} logs={logs} onEdit={() => setEditing(true)} onClose={close} />)}
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title={t('Nowy nawyk', 'New habit')} tall>
        <HabitForm onDone={() => setAdding(false)} />
      </Sheet>
    </>
  )
}
