import { useEffect, useState } from 'react'
import { db, useRows } from '../../lib/db'
import { pad } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { useLang, useT } from '../../lib/settings'
import type { LimitKey, TriggerLog } from '../../lib/types'
import { Range, Segmented } from '../../ui/kit'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/Toast'

export const MOODS = {
  pl: ['Bardzo źle', 'Źle', 'Tak sobie', 'Dobrze', 'Bardzo dobrze'],
  en: ['Very bad', 'Bad', 'So-so', 'Good', 'Very good'],
}

const PLACES = {
  pl: ['Pokój', 'Łóżko', 'Biurko', 'Łazienka', 'Na mieście', 'Praca'],
  en: ['Room', 'Bed', 'Desk', 'Bathroom', 'Out', 'Work'],
}

function localInput(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export interface TriggerPreset {
  streak_key?: LimitKey | null
  outcome?: TriggerLog['outcome']
}

/** Add an entry to the trigger journal (PRD 6.3: time, mood, place, what came before, strength 1–10, outcome). */
export function TriggerSheet({ preset, onClose }: { preset: TriggerPreset | null; onClose: () => void }) {
  const t = useT()
  const streaks = useRows('streaks')
  const lang = useLang()
  const [at, setAt] = useState(localInput())
  const [key, setKey] = useState<LimitKey | null>(null)
  const [mood, setMood] = useState(2)
  const [place, setPlace] = useState('')
  const [before, setBefore] = useState('')
  const [intensity, setIntensity] = useState(6)
  const [outcome, setOutcome] = useState<TriggerLog['outcome']>('won')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!preset) return
    setAt(localInput())
    setKey(preset.streak_key ?? null)
    setOutcome(preset.outcome ?? 'won')
    setMood(2)
    setPlace('')
    setBefore('')
    setIntensity(6)
    setNote('')
  }, [preset])

  const save = () => {
    db.insert('triggers_log', {
      at: new Date(at).toISOString(),
      streak_key: key,
      mood: mood + 1,
      place: place.trim(),
      before: before.trim(),
      intensity,
      outcome,
      note: note.trim() || null,
    })
    haptic('success')
    toast(outcome === 'won' ? t('Zapisane. Wygrana się liczy.', 'Saved. A win counts.') : t('Zapisane w dzienniku.', 'Saved to the journal.'), { icon: 'check' })
    onClose()
  }

  return (
    <Sheet open={!!preset} onClose={onClose} title={t('Wpis do dziennika', 'Journal entry')} tall>
      <form
        className="hb-form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="field">
          <span className="field__label">{t('Wynik', 'Outcome')}</span>
          <Segmented
            label={t('Wynik', 'Outcome')}
            value={outcome}
            onChange={setOutcome}
            options={[
              { value: 'won', label: t('Wygrałem', 'I won') },
              { value: 'slipped', label: t('Uległem', 'I gave in') },
            ]}
          />
        </div>

        <div className="field">
          <span className="field__label">{t('Czego dotyczy', 'What it was about')}</span>
          <div className="chips">
            {[...streaks].sort((a, b) => a.sort - b.sort).map((s) => (
              <button type="button" key={s.id} className="chip" aria-pressed={key === s.key} onClick={() => setKey(key === s.key ? null : s.key)}>
                {s.name}
              </button>
            ))}
            <button type="button" className="chip" aria-pressed={key === null} onClick={() => setKey(null)}>
              {t('Inne', 'Other')}
            </button>
          </div>
        </div>

        <label className="field">
          <span className="field__label">{t('Kiedy', 'When')}</span>
          <input className="input input--num" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </label>

        <div className="field">
          <span className="field__label">{t('Nastrój', 'Mood')}</span>
          <div className="hb-mood" role="radiogroup" aria-label={t('Nastrój', 'Mood')}>
            {MOODS[lang].map((m, i) => (
              <button type="button" key={m} role="radio" aria-checked={mood === i} aria-pressed={mood === i} className="chip" onClick={() => setMood(i)}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">{t('Miejsce', 'Place')}</span>
          <input className="input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder={t('Gdzie byłeś?', 'Where were you?')} />
          <div className="chips" style={{ marginTop: 4 }}>
            {PLACES[lang].map((p) => (
              <button type="button" key={p} className="chip" aria-pressed={place === p} onClick={() => setPlace(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="field__label">{t('Co było tuż przed?', 'What happened right before?')}</span>
          <textarea className="textarea" value={before} onChange={(e) => setBefore(e.target.value)} placeholder={t('np. nuda po pracy, kłótnia, samotny wieczór', 'e.g. bored after work, an argument, alone in the evening')} />
        </label>

        <div className="field">
          <span className="field__label">{t('Siła pokusy', 'Strength of the urge')}</span>
          <div className="hb-intensity">
            <Range label={t('Siła pokusy', 'Strength of the urge')} min={1} max={10} value={intensity} onChange={setIntensity} fill={intensity >= 8 ? 'var(--pink)' : undefined} />
            <output>{intensity}</output>
          </div>
        </div>

        <label className="field">
          <span className="field__label">{t('Notatka', 'Note')}</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Opcjonalnie', 'Optional')} />
        </label>

        <button className="btn btn--accent btn--lg btn--block">{t('Zapisz wpis', 'Save entry')}</button>
      </form>
    </Sheet>
  )
}
