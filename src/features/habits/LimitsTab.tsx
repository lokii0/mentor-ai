import { useMemo, useState } from 'react'
import { navigate } from '../../app/nav'
import { db, useRows } from '../../lib/db'
import { DAYS, dayKey, fmtDay, fmtTime, plural, todayKey } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { askMentor } from '../../lib/mentor'
import { useLang, useT } from '../../lib/settings'
import { bestDays, cleanDays } from '../../lib/stats'
import type { Lang, MeasurementKind, Streak, TriggerLog } from '../../lib/types'
import { Icon } from '../../ui/Icon'
import { Bar, Card, Counter, Empty, Stepper } from '../../ui/kit'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/Toast'
import { MOODS, TriggerSheet, type TriggerPreset } from './TriggerSheet'
import { limitIcon } from './util'

// Scroll minutes are stored per day as measurements of kind 'scroll' (see fork report: add it to MeasurementKind).
const SCROLL_KIND = 'scroll' as MeasurementKind

function band(iso: string, lang: Lang): string {
  const h = new Date(iso).getHours()
  const names = lang === 'en' ? ['morning (5–12)', 'afternoon (12–17)', 'evening (17–22)', 'night (22–5)'] : ['rano (5–12)', 'popołudnie (12–17)', 'wieczór (17–22)', 'noc (22–5)']
  return h >= 5 && h < 12 ? names[0] : h >= 12 && h < 17 ? names[1] : h >= 17 && h < 22 ? names[2] : names[3]
}

function mostCommon(values: string[]): string | null {
  const m = new Map<string, number>()
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1)
  let best: string | null = null
  let n = 0
  m.forEach((c, k) => {
    if (c > n) {
      n = c
      best = k
    }
  })
  return best
}

export function triggerPatterns(entries: TriggerLog[], lang: Lang) {
  const n = entries.length
  const won = entries.filter((e) => e.outcome === 'won').length
  return {
    n,
    won,
    band: mostCommon(entries.map((e) => band(e.at, lang))),
    place: mostCommon(entries.map((e) => e.place.trim())),
    avg: n ? entries.reduce((s, e) => s + e.intensity, 0) / n : 0,
    winRate: n ? Math.round((won / n) * 100) : 0,
  }
}

function LimitBlock({ s, scrollToday, onSlip, onEditLimit, onScroll }: { s: Streak; scrollToday?: number; onSlip: () => void; onEditLimit: () => void; onScroll: (m: number) => void }) {
  const t = useT()
  const lang = useLang()
  const days = cleanDays(s)
  const best = bestDays(s)
  const [minutes, setMinutes] = useState('')
  const limit = s.daily_limit_minutes ?? 0
  const since = new Date(s.started_at)

  return (
    <div className="hb-limit">
      <div className="hb-limit__head">
        <span className="hb-limit__name">
          <Icon name={limitIcon(s.key)} />
          {s.name}
        </span>
        <span className="hb-limit__best">
          {t('rekord', 'best')} {best} {plural(best, lang, DAYS)}
        </span>
      </div>
      <div className="hb-limit__main">
        <Counter value={days} className={`t-hero hb-limit__num ${days === 0 ? 'hb-limit__num--zero' : ''}`} />
        <div className="hb-limit__unit">
          <strong>{lang === 'en' ? `clean ${plural(days, 'en', DAYS)}` : `${plural(days, 'pl', DAYS)} czysto`}</strong>
          <span>
            {t('od', 'since')} {fmtDay(dayKey(since), lang, { day: 'numeric', month: 'long' })}, {fmtTime(s.started_at, lang)}
          </span>
        </div>
      </div>

      {s.key === 'scroll' && (
        <div className="hb-limit__bar">
          {scrollToday != null && limit > 0 && <Bar value={scrollToday / limit} tone={scrollToday > limit ? 'pink' : 'sky'} />}
          <div className="hb-limit__foot">
            <form
              className="hb-scroll"
              onSubmit={(e) => {
                e.preventDefault()
                const m = Number(minutes)
                if (!Number.isFinite(m) || minutes === '' || m < 0) return
                onScroll(Math.round(m))
                setMinutes('')
              }}
            >
              <input className="input input--num" inputMode="numeric" placeholder={t('min dziś', 'min today')} value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} aria-label={t('Minuty scrolla dziś (Screen Time)', 'Scroll minutes today (Screen Time)')} enterKeyHint="done" />
              <button className="btn btn--glass btn--sm" disabled={minutes === ''}>
                {t('Zapisz', 'Save')}
              </button>
            </form>
            <button className="hb-linkbtn" onClick={onEditLimit}>
              {scrollToday != null ? `${scrollToday} / ` : ''}
              {t('limit', 'limit')} {limit} min
            </button>
          </div>
        </div>
      )}

      <div className="hb-limit__foot">
        <span className="t-caption t-3">{s.key === 'scroll' ? t('Wpisz minuty z Czasu przed ekranem.', 'Enter minutes from Screen Time.') : t('Potknięcie zeruje licznik.', 'A slip resets the counter.')}</span>
        <button className="btn btn--danger btn--sm" onClick={onSlip}>
          {t('Potknięcie', 'Slip')}
        </button>
      </div>
    </div>
  )
}

export function LimitsTab() {
  const t = useT()
  const lang = useLang()
  const streaks = useRows('streaks')
  const relapses = useRows('relapses')
  const triggers = useRows('triggers_log')
  const measurements = useRows('measurements')
  const [slip, setSlip] = useState<Streak | null>(null)
  const [note, setNote] = useState('')
  const [toJournal, setToJournal] = useState(true)
  const [trig, setTrig] = useState<TriggerPreset | null>(null)
  const [limitEdit, setLimitEdit] = useState<Streak | null>(null)
  const [limitVal, setLimitVal] = useState(60)
  const [asking, setAsking] = useState(false)

  const today = todayKey()
  const sorted = [...streaks].sort((a, b) => a.sort - b.sort)
  const scrollRow = measurements.find((m) => m.kind === SCROLL_KIND && m.date === today)
  const recentTriggers = useMemo(() => [...triggers].sort((a, b) => b.at.localeCompare(a.at)), [triggers])
  const last30 = recentTriggers.filter((e) => Date.now() - new Date(e.at).getTime() < 30 * 86400000)
  const pat = triggerPatterns(last30, lang)
  const history = [...relapses].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)
  const streakName = (id: string) => streaks.find((s) => s.id === id)?.name ?? '—'
  const keyName = (k?: string | null) => (k ? streaks.find((s) => s.key === k)?.name ?? k : t('Inne', 'Other'))

  const slippedToday = (s: Streak) => relapses.some((r) => r.streak_id === s.id && dayKey(new Date(r.at)) === today)

  const confirmSlip = () => {
    if (!slip) return
    const days = cleanDays(slip)
    const now = new Date().toISOString()
    db.insert('relapses', { streak_id: slip.id, at: now, days_lost: days, note: note.trim() || null })
    db.update('streaks', slip.id, { started_at: now, best_days: Math.max(slip.best_days, days) })
    haptic('warning')
    const name = slip.name
    const n = note.trim()
    toast(t('Zapisane. Licznik od zera.', 'Saved. Counter back to zero.'), {
      action: {
        label: t('Do mentora', 'To mentor'),
        run: () => {
          navigate('mentor')
          void askMentor({ context: 'chat', message: t(`Potknąłem się: ${name}.${n ? ' ' + n : ''}`, `I slipped: ${name}.${n ? ' ' + n : ''}`) })
        },
      },
    })
    const preset: TriggerPreset = { streak_key: slip.key, outcome: 'slipped' }
    setSlip(null)
    setNote('')
    if (toJournal) setTimeout(() => setTrig(preset), 380)
  }

  const saveScroll = (s: Streak, m: number) => {
    db.upsertBy('measurements', (r) => r.kind === SCROLL_KIND && r.date === today, { date: today, kind: SCROLL_KIND, value: m, unit: 'min', meta: null, note: null })
    const limit = s.daily_limit_minutes ?? 0
    if (limit > 0 && m > limit && !slippedToday(s)) {
      haptic('warning')
      setNote(t(`${m} min scrolla przy limicie ${limit} min.`, `${m} min of scrolling against a ${limit} min limit.`))
      setSlip(s)
    } else {
      haptic('tap')
      toast(limit > 0 && m <= limit ? t('W limicie. Tak trzymaj.', 'Within the limit.') : t('Zapisane', 'Saved'), { icon: 'check' })
    }
  }

  const askPatterns = async () => {
    if (!pat.n) return
    setAsking(true)
    const lines = last30.slice(0, 8).map((e) => `- ${fmtDay(dayKey(new Date(e.at)), lang, { day: 'numeric', month: 'short' })} ${fmtTime(e.at, lang)}, ${keyName(e.streak_key)}, ${e.place || '—'}, ${MOODS[lang][e.mood - 1] ?? ''}, ${e.intensity}/10, ${e.outcome === 'won' ? t('wygrana', 'won') : t('uległem', 'gave in')}${e.before ? `; ${t('przed', 'before')}: ${e.before}` : ''}`)
    const msg = t(
      `Mój dziennik wyzwalaczy z 30 dni: ${pat.n} wpisów, najczęściej ${pat.band ?? '—'}, miejsce: ${pat.place ?? '—'}, średnia siła ${pat.avg.toFixed(1)}/10, wygrane ${pat.won}/${pat.n}.\nOstatnie wpisy:\n${lines.join('\n')}\nJakie widzisz wzorce i co konkretnie mam zmienić?`,
      `My trigger journal for 30 days: ${pat.n} entries, mostly ${pat.band ?? '—'}, place: ${pat.place ?? '—'}, average strength ${pat.avg.toFixed(1)}/10, won ${pat.won}/${pat.n}.\nRecent entries:\n${lines.join('\n')}\nWhat patterns do you see and what exactly should I change?`,
    )
    navigate('mentor')
    await askMentor({ context: 'chat', message: msg })
    setAsking(false)
  }

  return (
    <>
      <Card className="hb-limits">
        {sorted.map((s) => (
          <LimitBlock
            key={s.id}
            s={s}
            scrollToday={s.key === 'scroll' ? scrollRow?.value ?? undefined : undefined}
            onSlip={() => {
              haptic('tap')
              setNote('')
              setSlip(s)
            }}
            onEditLimit={() => {
              setLimitVal(s.daily_limit_minutes ?? 60)
              setLimitEdit(s)
            }}
            onScroll={(m) => saveScroll(s, m)}
          />
        ))}
        {!sorted.length && <Empty>{t('Brak liczników.', 'No counters.')}</Empty>}
      </Card>

      <Card className="hb-trig">
        <div className="hb-trig__head">
          <h2 className="sec-head__title">{t('Dziennik wyzwalaczy', 'Trigger journal')}</h2>
          <button className="btn btn--glass btn--sm" onClick={() => setTrig({})}>
            <Icon name="plus" />
            {t('Wpis', 'Entry')}
          </button>
        </div>
        {pat.n > 0 ? (
          <>
            <div className="well stats hb-trig__stats">
              <div className="stat">
                <span className="stat__label">{t('Najczęściej', 'Most often')}</span>
                <span className="t-sub t-strong">{pat.band ?? '—'}</span>
              </div>
              <div className="stat">
                <span className="stat__label">{t('Miejsce', 'Place')}</span>
                <span className="t-sub t-strong">{pat.place ?? '—'}</span>
              </div>
              <div className="stat">
                <span className="stat__label">{t('Średnia siła', 'Avg. strength')}</span>
                <span className="stat__value">{pat.avg.toFixed(1)}<span className="stat__unit">/10</span></span>
              </div>
              <div className="stat">
                <span className="stat__label">{t('Wygrane', 'Won')}</span>
                <span className="stat__value">{pat.winRate}<span className="stat__unit">%</span></span>
                <span className="stat__note">{pat.won} / {pat.n} · 30 {t('dni', 'days')}</span>
              </div>
            </div>
            <button className="btn btn--ink btn--block" onClick={askPatterns} disabled={asking}>
              <Icon name="mentor" />
              {t('Zapytaj mentora o wzorce', 'Ask the mentor about patterns')}
            </button>
            <div>
              {recentTriggers.slice(0, 10).map((e) => (
                <div key={e.id} className="hb-entry">
                  <span className="hb-entry__title">{e.place || keyName(e.streak_key)}</span>
                  <span className="row gap-2">
                    <span className="hb-entry__val">{e.intensity}/10</span>
                    <span className={`pill ${e.outcome === 'won' ? 'pill--sky' : 'pill--pink'}`}>{e.outcome === 'won' ? t('wygrana', 'won') : t('uległem', 'gave in')}</span>
                  </span>
                  <span className="hb-entry__sub">
                    {fmtDay(dayKey(new Date(e.at)), lang, { day: 'numeric', month: 'short' })} {fmtTime(e.at, lang)} · {keyName(e.streak_key)} · {MOODS[lang][e.mood - 1]}
                    {e.before ? ` · ${e.before}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <Empty>{t('Zapisuj każdą pokusę — po kilku wpisach zobaczysz, kiedy i gdzie przychodzi.', 'Log every urge — after a few entries you will see when and where it comes.')}</Empty>
        )}
      </Card>

      <Card className="hb-trig">
        <div className="hb-trig__head">
          <h2 className="sec-head__title">{t('Historia potknięć', 'Slip history')}</h2>
          <span className="sec-head__aside t-num">{relapses.length}</span>
        </div>
        {history.length ? (
          <div>
            {history.map((r) => (
              <div key={r.id} className="hb-entry">
                <span className="hb-entry__title">{streakName(r.streak_id)}</span>
                <span className="hb-entry__val t-3">−{r.days_lost} {plural(r.days_lost, lang, DAYS)}</span>
                <span className="hb-entry__sub">
                  {fmtDay(dayKey(new Date(r.at)), lang, { day: 'numeric', month: 'long' })} {fmtTime(r.at, lang)}
                  {r.note ? ` · ${r.note}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty>{t('Brak potknięć.', 'No slips.')}</Empty>
        )}
      </Card>

      <Sheet open={!!slip} onClose={() => setSlip(null)} title={slip ? t(`Potknięcie: ${slip.name}`, `Slip: ${slip.name}`) : ''}>
        {slip && (
          <div className="hb-form">
            <p className="t-sub t-2 t-pretty">
              {t(
                `Licznik wróci do zera. Było ${cleanDays(slip)} ${plural(cleanDays(slip), 'pl', DAYS)} czysto. Rekord zostaje: ${bestDays(slip)} ${plural(bestDays(slip), 'pl', DAYS)}.`,
                `The counter goes back to zero. You were clean for ${cleanDays(slip)} ${plural(cleanDays(slip), 'en', DAYS)}. Your best stays: ${bestDays(slip)} ${plural(bestDays(slip), 'en', DAYS)}.`,
              )}
            </p>
            <label className="field">
              <span className="field__label">{t('Co się stało?', 'What happened?')}</span>
              <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Opcjonalnie', 'Optional')} />
            </label>
            <label className="row gap-3 t-sub" style={{ padding: '0 4px', minHeight: 44 }}>
              <input type="checkbox" checked={toJournal} onChange={(e) => setToJournal(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--sky)' }} />
              {t('Dodaj wpis do dziennika wyzwalaczy', 'Add a trigger journal entry')}
            </label>
            <div className="row gap-2">
              <button className="btn btn--glass btn--lg grow" onClick={() => setSlip(null)}>
                {t('Anuluj', 'Cancel')}
              </button>
              <button className="btn btn--accent btn--lg grow" onClick={confirmSlip}>
                {t('Zapisz potknięcie', 'Log the slip')}
              </button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={!!limitEdit} onClose={() => setLimitEdit(null)} title={t('Dzienny limit scrolla', 'Daily scroll limit')}>
        <div className="hb-form">
          <div className="well hb-detail__today">
            <span className="t-sub">{t('Minuty dziennie', 'Minutes per day')}</span>
            <Stepper label={t('Limit', 'Limit')} value={limitVal} step={5} min={5} max={600} onChange={setLimitVal} />
          </div>
          <button
            className="btn btn--accent btn--lg btn--block"
            onClick={() => {
              if (limitEdit) db.update('streaks', limitEdit.id, { daily_limit_minutes: limitVal })
              haptic('success')
              setLimitEdit(null)
            }}
          >
            {t('Zapisz limit', 'Save limit')}
          </button>
        </div>
      </Sheet>

      <TriggerSheet preset={trig} onClose={() => setTrig(null)} />
    </>
  )
}
