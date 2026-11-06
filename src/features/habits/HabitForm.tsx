import { useState } from 'react'
import { db } from '../../lib/db'
import { haptic } from '../../lib/haptics'
import { useT } from '../../lib/settings'
import type { Habit, HabitKind } from '../../lib/types'
import { Icon } from '../../ui/Icon'
import { Segmented, Toggle } from '../../ui/kit'
import { toast } from '../../ui/Toast'
import { parseDecimal } from './util'

/** Add or edit a habit. Calls onDone after saving. */
export function HabitForm({ initial, onDone }: { initial?: Habit; onDone: () => void }) {
  const t = useT()
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<HabitKind>(initial?.kind ?? 'check')
  const [target, setTarget] = useState(String(initial?.target ?? 1))
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [period, setPeriod] = useState<'day' | 'week'>(initial?.period ?? 'day')
  const [step, setStep] = useState(String(initial?.step ?? 1))
  const [times, setTimes] = useState<string[]>(initial?.reminder_times ?? [])
  const [shield, setShield] = useState(initial?.shield ?? true)

  const targetN = parseDecimal(target)
  const stepN = parseDecimal(step)
  const valid = name.trim().length > 0 && targetN > 0 && (kind === 'check' || stepN > 0)

  const save = () => {
    if (!valid) return
    const data = {
      name: name.trim(),
      kind,
      target: targetN,
      unit: kind === 'duration' ? 'min' : kind === 'count' ? unit.trim() || null : null,
      period,
      step: kind === 'check' ? 1 : stepN,
      reminder_times: times.filter(Boolean).sort(),
      shield,
    }
    if (initial) db.update('habits', initial.id, data)
    else {
      const sort = Math.max(-1, ...db.rows('habits').map((h) => h.sort)) + 1
      db.insert('habits', { ...data, preset: null, archived: false, sort })
    }
    haptic('success')
    toast(initial ? t('Zapisano zmiany', 'Changes saved') : t('Nawyk dodany', 'Habit added'), { icon: 'check' })
    onDone()
  }

  return (
    <form
      className="hb-form"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <label className="field">
        <span className="field__label">{t('Nazwa', 'Name')}</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('np. Medytacja', 'e.g. Meditation')} enterKeyHint="done" />
      </label>

      <div className="field">
        <span className="field__label">{t('Typ', 'Type')}</span>
        <Segmented
          label={t('Typ nawyku', 'Habit type')}
          value={kind}
          onChange={(v) => {
            setKind(v)
            if (v === 'check' && period === 'day') setTarget('1')
          }}
          options={[
            { value: 'check', label: t('Tak / nie', 'Yes / no') },
            { value: 'count', label: t('Licznik', 'Counter') },
            { value: 'duration', label: t('Czas', 'Time') },
          ]}
        />
      </div>

      <div className="field">
        <span className="field__label">{t('Okres celu', 'Target period')}</span>
        <Segmented
          label={t('Okres', 'Period')}
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'day', label: t('Dzień', 'Day') },
            { value: 'week', label: t('Tydzień', 'Week') },
          ]}
        />
      </div>

      <div className="hb-form__row">
        <label className="field">
          <span className="field__label">
            {kind === 'check' ? (period === 'week' ? t('Razy w tygodniu', 'Times per week') : t('Cel', 'Target')) : kind === 'duration' ? t('Cel (min)', 'Target (min)') : t('Cel', 'Target')}
          </span>
          <input className="input input--num" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} disabled={kind === 'check' && period === 'day'} />
        </label>
        {kind === 'count' ? (
          <label className="field">
            <span className="field__label">{t('Jednostka', 'Unit')}</span>
            <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t('np. str.', 'e.g. pp.')} />
          </label>
        ) : kind === 'duration' ? (
          <label className="field">
            <span className="field__label">{t('Krok (min)', 'Step (min)')}</span>
            <input className="input input--num" inputMode="numeric" value={step} onChange={(e) => setStep(e.target.value)} />
          </label>
        ) : (
          <span />
        )}
      </div>
      {kind === 'count' && (
        <label className="field">
          <span className="field__label">{t('Szybkie dodawanie o', 'Quick add step')}</span>
          <input className="input input--num" inputMode="decimal" value={step} onChange={(e) => setStep(e.target.value)} />
        </label>
      )}

      <div className="field">
        <span className="field__label">{t('Przypomnienia', 'Reminders')}</span>
        <div className="hb-times">
          {times.map((tm, i) => (
            <span key={i} className="hb-time">
              <input type="time" value={tm} aria-label={t('Godzina', 'Time')} onChange={(e) => setTimes((x) => x.map((y, j) => (j === i ? e.target.value : y)))} />
              <button type="button" aria-label={t('Usuń', 'Remove')} onClick={() => setTimes((x) => x.filter((_, j) => j !== i))}>
                <Icon name="close" />
              </button>
            </span>
          ))}
          <button type="button" className="chip" onClick={() => setTimes((x) => [...x, '09:00'])}>
            <Icon name="plus" />
            {t('Godzina', 'Time')}
          </button>
        </div>
        <span className="field__hint">{t('Przypomnienia przychodzą jako neutralny „Check-in”.', 'Reminders arrive as a neutral "Check-in".')}</span>
      </div>

      <div className="well hb-form__switch">
        <div>
          <strong className="t-sub">{t('Tarcza ratunkowa', 'Rescue shield')}</strong>
          <p>{t('Jedna przerwa nie zeruje serii.', 'One missed day does not reset the series.')}</p>
        </div>
        <Toggle checked={shield} onChange={setShield} label={t('Tarcza ratunkowa', 'Rescue shield')} />
      </div>

      <button className="btn btn--accent btn--lg btn--block" disabled={!valid}>
        {initial ? t('Zapisz', 'Save') : t('Dodaj nawyk', 'Add habit')}
      </button>
    </form>
  )
}
