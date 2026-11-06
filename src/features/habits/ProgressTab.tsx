import { useEffect, useMemo, useState } from 'react'
import { db, uid, useRows } from '../../lib/db'
import { fmtDay, fmtMoney, fmtNum, lastNDays, monthDays, monthKey, todayKey, weekDays, weekStart } from '../../lib/dates'
import { compressImage, deleteFile, fileUrl, saveFile } from '../../lib/files'
import { haptic } from '../../lib/haptics'
import { useLang, useT } from '../../lib/settings'
import { habitDoneOn, habitValue } from '../../lib/stats'
import type { Habit, HabitLog, Measurement } from '../../lib/types'
import { Bars, Heatmap, Line } from '../../ui/charts'
import { Icon } from '../../ui/Icon'
import { Card, Empty, Stepper } from '../../ui/kit'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/Toast'
import { parseDecimal, setHabitValue } from './util'

function CardHead({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="hb-card__head">
      <h2 className="hb-card__title">{title}</h2>
      {aside != null && <span className="hb-card__aside">{aside}</span>}
    </div>
  )
}

const inMonth = (d: string, m: string) => d.slice(0, 7) === m

// ---------- Month overview ----------

function MonthCard({ habits, logs, measurements }: { habits: Habit[]; logs: HabitLog[]; measurements: Measurement[] }) {
  const t = useT()
  const lang = useLang()
  const month = monthKey()
  const today = todayKey()
  const daily = habits.filter((h) => !h.archived && h.period === 'day')
  const sumPreset = (p: string) => {
    const h = habits.find((x) => x.preset === p)
    return h ? logs.filter((l) => l.habit_id === h.id && inMonth(l.date, month)).reduce((s, l) => s + l.value, 0) : 0
  }
  const training = habits.find((h) => h.preset === 'training')
  const trainingDays = new Set([
    ...measurements.filter((m) => m.kind === 'training' && inMonth(m.date, month)).map((m) => m.date),
    ...(training ? logs.filter((l) => l.habit_id === training.id && l.value > 0 && inMonth(l.date, month)).map((l) => l.date) : []),
  ]).size
  const focus = measurements.filter((m) => m.kind === 'focus' && inMonth(m.date, month)).reduce((s, m) => s + (m.value ?? 0), 0)

  const days = monthDays(month)
  const values = Object.fromEntries(
    days.map((d) => [d, d > today || !daily.length ? 0 : daily.filter((h) => habitDoneOn(h, logs, d)).length / daily.length]),
  )

  return (
    <Card className="hb-card">
      <CardHead title={t('Ten miesiąc', 'This month')} aside={fmtDay(`${month}-01`, lang, { month: 'long' })} />
      <div className="well stats">
        <div className="stat">
          <span className="stat__label">{t('Gitara', 'Guitar')}</span>
          <span className="stat__value">{fmtNum(sumPreset('guitar'), lang)}<span className="stat__unit">min</span></span>
        </div>
        <div className="stat">
          <span className="stat__label">{t('Czytanie', 'Reading')}</span>
          <span className="stat__value">{fmtNum(sumPreset('reading'), lang)}<span className="stat__unit">{t('str.', 'pp.')}</span></span>
        </div>
        <div className="stat">
          <span className="stat__label">{t('Treningi', 'Workouts')}</span>
          <span className="stat__value">{trainingDays}</span>
        </div>
        <div className="stat">
          <span className="stat__label">{t('Skupienie', 'Focus')}</span>
          <span className="stat__value">{fmtNum(focus, lang)}<span className="stat__unit">min</span></span>
        </div>
      </div>
      <div className="stack gap-3" style={{ padding: '0 4px' }}>
        <span className="t-foot t-2 t-strong">{t('Nawyki dzienne — wykonanie', 'Daily habits — completion')}</span>
        <div className="hb-heat">
          <Heatmap days={days} values={values} cell={18} gap={5} labelFor={(d, v) => `${fmtDay(d, lang, { day: 'numeric', month: 'short' })}: ${Math.round(v * 100)}%`} />
        </div>
        <div className="hb-legend">
          <span>0%</span>
          {[0.15, 0.4, 0.7, 1].map((v) => (
            <i key={v} style={{ background: `rgba(5,147,198,${0.18 + v * 0.82})` }} />
          ))}
          <span>100%</span>
        </div>
      </div>
    </Card>
  )
}

// ---------- Client acquisition ----------

function LeadsCard({ habits, logs }: { habits: Habit[]; logs: HabitLog[] }) {
  const t = useT()
  const lang = useLang()
  const rows = useRows('leads_log')
  const today = todayKey()
  const outreach = habits.find((h) => h.preset === 'outreach' && !h.archived)
  const row = rows.find((r) => r.date === today)
  const messagesOn = (d: string) => (outreach ? habitValue(logs, outreach.id, d) : rows.find((r) => r.date === d)?.messages ?? 0)
  const [revenue, setRevenue] = useState(row?.revenue ? String(row.revenue) : '')
  useEffect(() => setRevenue(row?.revenue ? String(row.revenue) : ''), [row?.revenue])

  const write = (patch: Partial<{ messages: number; leads: number; replies: number; clients: number; revenue: number }>) => {
    const base = { messages: messagesOn(today), leads: row?.leads ?? 0, replies: row?.replies ?? 0, clients: row?.clients ?? 0, revenue: row?.revenue ?? 0 }
    db.upsertBy('leads_log', (r) => r.date === today, { date: today, ...base, ...patch })
  }

  const week = weekDays(weekStart(today))
  const wRows = rows.filter((r) => week.includes(r.date))
  const sum = (k: 'leads' | 'replies' | 'clients' | 'revenue') => wRows.reduce((s, r) => s + (r[k] ?? 0), 0)
  const wMessages = week.reduce((s, d) => s + messagesOn(d), 0)
  const replyRate = wMessages ? Math.round((sum('replies') / wMessages) * 100) : 0

  const bars = lastNDays(7, today).map((d) => ({ label: fmtDay(d, lang, { weekday: 'narrow' }), value: messagesOn(d), current: d === today }))

  const fields: { k: 'leads' | 'replies' | 'clients'; pl: string; en: string }[] = [
    { k: 'leads', pl: 'Leady', en: 'Leads' },
    { k: 'replies', pl: 'Odpowiedzi', en: 'Replies' },
    { k: 'clients', pl: 'Klienci', en: 'Clients' },
  ]

  return (
    <Card className="hb-card">
      <CardHead title="Client acquisition" aside={t('dziś', 'today')} />
      <div className="well hb-leads" style={{ padding: '4px 14px' }}>
        <div className="hb-leads__row">
          <span>{t('Wiadomości', 'Messages')}</span>
          <Stepper
            label={t('Wiadomości', 'Messages')}
            value={messagesOn(today)}
            onChange={(v) => {
              if (outreach) setHabitValue(outreach, today, v)
              write({ messages: v })
            }}
          />
        </div>
        {fields.map((f) => (
          <div key={f.k} className="hb-leads__row">
            <span>{t(f.pl, f.en)}</span>
            <Stepper label={t(f.pl, f.en)} value={row?.[f.k] ?? 0} onChange={(v) => write({ [f.k]: v })} />
          </div>
        ))}
        <div className="hb-leads__row">
          <span>{t('Przychód z leadów', 'Revenue from leads')}</span>
          <input
            className="input input--num"
            inputMode="decimal"
            placeholder="0 zł"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
            onBlur={() => {
              const v = parseDecimal(revenue || '0')
              if (Number.isFinite(v) && v !== (row?.revenue ?? 0)) write({ revenue: v })
            }}
            aria-label={t('Przychód z leadów dziś', 'Revenue from leads today')}
          />
        </div>
      </div>

      <div className="stack gap-3" style={{ padding: '0 4px' }}>
        <span className="t-foot t-2 t-strong">{t('Wiadomości — 7 dni', 'Messages — 7 days')}</span>
        <Bars data={bars} target={outreach?.target} height={120} />
      </div>

      <div className="well stats">
        <div className="stat">
          <span className="stat__label">{t('Wiadomości (tydz.)', 'Messages (week)')}</span>
          <span className="stat__value">{wMessages}</span>
          <span className="stat__note">{t(`odpowiedzi ${replyRate}%`, `replies ${replyRate}%`)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">{t('Leady (tydz.)', 'Leads (week)')}</span>
          <span className="stat__value">{sum('leads')}</span>
          <span className="stat__note">{t(`odpowiedzi: ${sum('replies')}`, `replies: ${sum('replies')}`)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">{t('Klienci (tydz.)', 'Clients (week)')}</span>
          <span className="stat__value">{sum('clients')}</span>
        </div>
        <div className="stat">
          <span className="stat__label">{t('Przychód (tydz.)', 'Revenue (week)')}</span>
          <span className="stat__value" style={{ fontSize: 22 }}>{fmtMoney(sum('revenue'), lang)}</span>
        </div>
      </div>
    </Card>
  )
}

// ---------- Weight ----------

function WeightCard({ measurements }: { measurements: Measurement[] }) {
  const t = useT()
  const lang = useLang()
  const [val, setVal] = useState('')
  const today = todayKey()
  const series = measurements.filter((m) => m.kind === 'weight' && m.value != null).sort((a, b) => a.date.localeCompare(b.date))
  const recent = series.slice(-30)
  const latest = series[series.length - 1]
  const delta = recent.length > 1 ? (recent[recent.length - 1].value ?? 0) - (recent[0].value ?? 0) : null

  const save = () => {
    const v = parseDecimal(val)
    if (!Number.isFinite(v) || v < 25 || v > 350) return
    db.upsertBy('measurements', (m) => m.kind === 'weight' && m.date === today, { date: today, kind: 'weight', value: Math.round(v * 10) / 10, unit: 'kg', meta: null, note: null })
    haptic('success')
    setVal('')
  }

  return (
    <Card className="hb-card">
      <CardHead title={t('Waga', 'Weight')} aside={latest ? fmtDay(latest.date, lang, { day: 'numeric', month: 'short' }) : undefined} />
      <div className="row between" style={{ padding: '0 4px', alignItems: 'flex-end' }}>
        <div className="hb-big">
          {latest ? fmtNum(latest.value ?? 0, lang, 1) : '—'}
          <small>kg</small>
        </div>
        {delta != null && (
          <span className="t-foot t-3 t-num">
            {delta > 0 ? '+' : delta < 0 ? '−' : ''}
            {fmtNum(Math.abs(delta), lang, 1)} kg · {recent.length} {t('pomiarów', 'entries')}
          </span>
        )}
      </div>
      {recent.length > 1 ? <Line points={recent.map((m) => m.value ?? 0)} height={110} color="var(--deep)" /> : <Empty>{t('Dwa pomiary i pojawi się wykres.', 'Two entries and a chart appears.')}</Empty>}
      <form
        className="hb-inline"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <input className="input input--num grow" inputMode="decimal" placeholder={t('Dzisiejsza waga, kg', "Today's weight, kg")} value={val} onChange={(e) => setVal(e.target.value)} aria-label={t('Waga w kg', 'Weight in kg')} enterKeyHint="done" />
        <button className="btn btn--glass" disabled={!val}>
          {t('Zapisz', 'Save')}
        </button>
      </form>
    </Card>
  )
}

// ---------- Training ----------

const TRAINING_TYPES = {
  pl: ['Siłownia', 'Kalistenika', 'Bieganie', 'Rower', 'Sport', 'Inne'],
  en: ['Gym', 'Calisthenics', 'Running', 'Cycling', 'Sport', 'Other'],
}

function TrainingCard({ habits, logs, measurements }: { habits: Habit[]; logs: HabitLog[]; measurements: Measurement[] }) {
  const t = useT()
  const lang = useLang()
  const [type, setType] = useState(TRAINING_TYPES[lang][0])
  const [mins, setMins] = useState(45)
  const today = todayKey()
  const training = habits.find((h) => h.preset === 'training' && !h.archived)
  const sessions = measurements.filter((m) => m.kind === 'training').sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
  const week = weekDays(weekStart(today))
  const weekCount = new Set([
    ...sessions.filter((s) => week.includes(s.date)).map((s) => s.date),
    ...(training ? logs.filter((l) => l.habit_id === training.id && l.value > 0 && week.includes(l.date)).map((l) => l.date) : []),
  ]).size

  const save = () => {
    db.insert('measurements', { date: today, kind: 'training', value: mins, unit: 'min', meta: { type }, note: null })
    if (training && habitValue(logs, training.id, today) === 0) setHabitValue(training, today, 1)
    haptic('success')
    toast(t('Trening zapisany', 'Workout saved'), { icon: 'check' })
  }

  return (
    <Card className="hb-card">
      <CardHead title={t('Trening', 'Training')} aside={training ? t(`${weekCount} / ${training.target} w tym tygodniu`, `${weekCount} / ${training.target} this week`) : undefined} />
      <div className="chips" style={{ padding: '0 4px' }}>
        {TRAINING_TYPES[lang].map((x) => (
          <button key={x} className="chip" aria-pressed={type === x} onClick={() => setType(x)}>
            {x}
          </button>
        ))}
      </div>
      <div className="row between gap-3" style={{ padding: '0 4px' }}>
        <Stepper label={t('Minuty', 'Minutes')} value={mins} step={5} min={5} max={300} onChange={setMins} format={(v) => `${v} min`} />
        <button className="btn btn--sky" onClick={save}>
          <Icon name="plus" />
          {t('Zapisz', 'Save')}
        </button>
      </div>
      {sessions.length > 0 && (
        <div className="list">
          {sessions.slice(0, 5).map((s) => (
            <div key={s.id} className="lrow" style={{ paddingLeft: 4, paddingRight: 4 }}>
              <Icon name="training" className="lrow__icon" />
              <div className="lrow__main">
                <span className="lrow__title">{String(s.meta?.type ?? t('Trening', 'Workout'))}</span>
                <span className="lrow__sub">{fmtDay(s.date, lang, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
              <span className="lrow__value">{s.value} min</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ---------- Skin photos (private) ----------

function useFileUrl(path: string | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!path) return
    let alive = true
    let made: string | null = null
    fileUrl(path)
      .then((u) => {
        made = u
        if (alive) setUrl(u)
        else if (u?.startsWith('blob:')) URL.revokeObjectURL(u)
      })
      .catch(() => {})
    return () => {
      alive = false
      if (made?.startsWith('blob:')) URL.revokeObjectURL(made)
    }
  }, [path])
  return url
}

function PhotoThumb({ m, lang, onOpen }: { m: Measurement; lang: 'pl' | 'en'; onOpen: () => void }) {
  const url = useFileUrl(m.meta?.path as string | undefined)
  return (
    <button className="hb-photo" onClick={onOpen} aria-label={fmtDay(m.date, lang)}>
      {url && <img src={url} alt="" loading="lazy" />}
      <span>{fmtDay(m.date, lang, { day: 'numeric', month: 'numeric' })}</span>
    </button>
  )
}

function SkinCard({ measurements }: { measurements: Measurement[] }) {
  const t = useT()
  const lang = useLang()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<Measurement | null>(null)
  const photos = useMemo(() => measurements.filter((m) => m.kind === 'skin_photo').sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)), [measurements])
  const openUrl = useFileUrl(open?.meta?.path as string | undefined)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const blob = await compressImage(file)
      const date = todayKey()
      const path = await saveFile(`skin-${date}-${uid().slice(0, 8)}.jpg`, blob)
      db.insert('measurements', { date, kind: 'skin_photo', value: null, unit: null, meta: { path }, note: null })
      haptic('success')
    } catch {
      toast(t('Nie udało się zapisać zdjęcia', 'Could not save the photo'), { tone: 'pink' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="hb-card">
      <CardHead title={t('Cera', 'Skin')} aside={photos.length ? `${photos.length}` : undefined} />
      {photos.length ? (
        <div className="hb-photos">
          {photos.slice(0, 12).map((m) => (
            <PhotoThumb key={m.id} m={m} lang={lang} onOpen={() => setOpen(m)} />
          ))}
        </div>
      ) : (
        <Empty>{t('Jedno zdjęcie w tym samym świetle co tydzień pokaże więcej niż lustro.', 'One photo a week in the same light shows more than the mirror.')}</Empty>
      )}
      <label className={`btn btn--glass btn--block hb-file ${busy ? 'is-busy' : ''}`}>
        <Icon name="camera" />
        {busy ? t('Zapisuję…', 'Saving…') : t('Dodaj zdjęcie', 'Add photo')}
        <input type="file" accept="image/*" disabled={busy} onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
      <p className="hb-private">{t('Zdjęcia są prywatne i widoczne tylko w apce.', 'Photos are private and visible only in the app.')}</p>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? fmtDay(open.date, lang, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}>
        {open && (
          <div className="stack gap-4">
            {openUrl ? <img className="hb-photo-full" src={openUrl} alt="" /> : <div className="hb-photo-full" style={{ aspectRatio: '3 / 4' }} />}
            <button
              className="btn btn--danger btn--block"
              onClick={async () => {
                const path = open.meta?.path as string | undefined
                db.remove('measurements', open.id)
                if (path) await deleteFile(path).catch(() => {})
                setOpen(null)
                haptic('warning')
              }}
            >
              <Icon name="trash" />
              {t('Usuń zdjęcie', 'Delete photo')}
            </button>
          </div>
        )}
      </Sheet>
    </Card>
  )
}

export function ProgressTab() {
  const habits = useRows('habits')
  const logs = useRows('habit_logs')
  const measurements = useRows('measurements')
  return (
    <>
      <MonthCard habits={habits} logs={logs} measurements={measurements} />
      <LeadsCard habits={habits} logs={logs} />
      <WeightCard measurements={measurements} />
      <TrainingCard habits={habits} logs={logs} measurements={measurements} />
      <SkinCard measurements={measurements} />
    </>
  )
}
