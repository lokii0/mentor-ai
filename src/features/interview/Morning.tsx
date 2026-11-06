// PRD 6.2: the morning interview. Quick form about yesterday → chat with the mentor →
// 3 priorities. Blocks the rest of the app until done (SOS stays reachable).
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { SOSButton } from '../../app/Shell'
import { db, useRows } from '../../lib/db'
import { addDays, daysBetween, DAYS, fmtDay, fmtNum, plural, todayKey } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { askMentor, mentorThinking } from '../../lib/mentor'
import { useLang, useT } from '../../lib/settings'
import { cleanDays, habitValue } from '../../lib/stats'
import type { ChatContext, Habit, MorningAnswers } from '../../lib/types'
import { Aurora } from '../../ui/Aurora'
import { Icon } from '../../ui/Icon'
import { Range, Segmented, Stepper } from '../../ui/kit'
import { Orb } from '../../ui/Orb'
import { rise, stagger } from '../../ui/motion'
import { ChatThread, Composer } from '../mentor/Chat'
import { fmtHabit, habitIcon, setHabitValue, sortHabits } from '../habits/util'
import { Vessel } from '../habits/Water'
import { PrioritiesEditor } from '../plan/Priorities'
import '../habits/habits.css'
import './interview.css'

const MOODS: [string, string][] = [['Dno', 'Awful'], ['Słabo', 'Low'], ['OK', 'OK'], ['Dobrze', 'Good'], ['Świetnie', 'Great']]

export default function Morning() {
  const t = useT()
  const lang = useLang()
  const today = todayKey()
  const yesterday = addDays(today, -1)
  const habits = useRows('habits')
  const logs = useRows('habit_logs')
  const streaks = useRows('streaks')
  const interviews = useRows('daily_interviews')
  const chat = useRows('chat_messages')
  const prios = useRows('priorities')
  const thinking = mentorThinking.use()

  const current = interviews.find((i) => i.date === today && i.kind === 'morning')
  const lastDone = interviews.filter((i) => i.completed && i.date < today).map((i) => i.date).sort().pop()
  const gap = lastDone ? daysBetween(lastDone, today) : 0
  const isReturn = gap >= 3
  const context: ChatContext = isReturn ? 'return' : 'morning'

  const active = useMemo(() => habits.filter((h) => !h.archived).sort(sortHabits), [habits])
  const water = active.find((h) => h.preset === 'water')
  const meals = active.find((h) => h.preset === 'meals')
  const listed = active.filter((h) => h !== water && h !== meals)
  const scroll = streaks.find((s) => s.key === 'scroll')
  const scrollLimit = scroll?.daily_limit_minutes ?? 60

  const [vals, setVals] = useState<Record<string, number>>(() => Object.fromEntries(active.map((h) => [h.id, habitValue(logs, h.id, yesterday)])))
  const [waterMl, setWater] = useState(() => (water ? habitValue(logs, water.id, yesterday) : 0))
  const [mealsN, setMeals] = useState(() => (meals ? habitValue(logs, meals.id, yesterday) : 0))
  const [adultClean, setAdult] = useState(true)
  const [smokeClean, setSmoke] = useState(true)
  const [scrollMin, setScrollMin] = useState(0)
  const [mood, setMood] = useState(0)
  const [well, setWell] = useState('')
  const [wrong, setWrong] = useState('')

  const step: 'form' | 'chat' = current ? 'chat' : 'form'
  const todayPrios = prios.filter((p) => p.date === today && p.text.trim())
  const thread = chat.filter((m) => (m.context === 'morning' || m.context === 'return') && m.created_at.slice(0, 10) >= addDays(today, -1) && new Date(m.created_at) >= new Date(current?.created_at ?? Date.now()))

  const summary = (): string => {
    const en = lang === 'en'
    const hv = (h: Habit) => (h.kind === 'check' ? (vals[h.id] ? (en ? 'yes' : 'tak') : en ? 'no' : 'nie') : `${fmtHabit(h, vals[h.id] ?? 0, lang)} / ${fmtHabit(h, h.target, lang)}`)
    const lines = [
      isReturn ? t(`Wracam po ${gap - 1} ${plural(gap - 1, 'pl', DAYS)} przerwy.`, `I'm back after ${gap - 1} ${plural(gap - 1, 'en', DAYS)} away.`) : '',
      t(`Raport z wczoraj (${fmtDay(yesterday, 'pl', { weekday: 'short', day: 'numeric', month: 'long' })}):`, `Report for yesterday (${fmtDay(yesterday, 'en', { weekday: 'short', day: 'numeric', month: 'long' })}):`),
      `- ${t('Nawyki', 'Habits')}: ${listed.map((h) => `${h.name} ${hv(h)}`).join(', ')}`,
      `- ${t('Woda', 'Water')}: ${fmtNum(waterMl / 1000, lang, 2)} l${water ? ` / ${fmtNum(water.target / 1000, lang, 1)} l` : ''} · ${t('Posiłki', 'Meals')}: ${mealsN}/${meals?.target ?? 3}`,
      `- 18+: ${adultClean ? t('czysto', 'clean') : t('potknięcie', 'slip')} · ${t('Papierosy', 'Cigarettes')}: ${smokeClean ? t('czysto', 'clean') : t('zapaliłem', 'smoked')} · Scroll: ${scrollMin} min (${t('limit', 'limit')} ${scrollLimit})`,
      mood ? `- ${t('Nastrój', 'Mood')}: ${t(MOODS[mood - 1][0], MOODS[mood - 1][1]).toLowerCase()}` : '',
      well.trim() ? `- ${t('Dobrze', 'Went well')}: ${well.trim()}` : '',
      wrong.trim() ? `- ${t('Źle', 'Went wrong')}: ${wrong.trim()}` : '',
    ]
    return lines.filter(Boolean).join('\n')
  }

  const slip = (key: string) => {
    const s = streaks.find((x) => x.key === key)
    if (!s) return
    const already = db.rows('relapses').some((r) => r.streak_id === s.id && r.at.slice(0, 10) >= yesterday)
    if (already) return
    const days = cleanDays(s)
    const now = new Date().toISOString()
    db.insert('relapses', { streak_id: s.id, at: now, days_lost: days, note: t('Z porannego wywiadu', 'From the morning check-in') })
    db.update('streaks', s.id, { started_at: now, best_days: Math.max(s.best_days, days) })
  }

  const submit = () => {
    haptic('success')
    for (const h of listed) if ((vals[h.id] ?? 0) !== habitValue(logs, h.id, yesterday)) setHabitValue(h, yesterday, vals[h.id] ?? 0)
    if (water) setHabitValue(water, yesterday, waterMl)
    if (meals) setHabitValue(meals, yesterday, mealsN)
    if (!adultClean) slip('adult')
    if (!smokeClean) slip('smoking')
    if (scroll && scrollMin > scrollLimit) slip('scroll')
    if (scrollMin > 0) db.upsertBy('measurements', (m) => m.kind === 'scroll' && m.date === yesterday, { date: yesterday, kind: 'scroll', value: scrollMin, unit: 'min', meta: null, note: null })
    const answers: MorningAnswers = {
      habits: vals,
      water_ml: waterMl,
      meals: mealsN,
      clean: { adult: adultClean, smoking: smokeClean, scroll_minutes: scrollMin },
      mood,
      went_well: well.trim(),
      went_wrong: wrong.trim(),
    }
    db.insert('daily_interviews', { date: today, about_date: yesterday, kind: 'morning', answers, completed: false })
    window.scrollTo({ top: 0 })
    void askMentor({ message: summary(), context })
  }

  const finish = () => {
    if (!current) return
    haptic('success')
    db.update('daily_interviews', current.id, { completed: true })
  }

  return (
    <div className={`iv ${step === 'chat' ? 'iv-chat-wrap' : ''}`}>
      <Aurora scene={isReturn ? 'alert' : 'today'} />
      <div className="iv-top">
        <Orb size={34} thinking={thinking} mood={isReturn ? 'alert' : 'neutral'} />
        <div className="stack grow">
          <span className="iv-top__title">{t('Poranny wywiad', 'Morning check-in')}</span>
          <span className="iv-top__sub">{fmtDay(today, lang)}</span>
        </div>
        <SOSButton />
      </div>
      <div style={{ margin: '8px 0 16px', pointerEvents: 'none' }} aria-hidden="true">
        <Segmented
          label={t('Etap', 'Step')}
          value={step}
          onChange={() => {}}
          options={[{ value: 'form', label: t('Wczoraj', 'Yesterday') }, { value: 'chat', label: t('Rozmowa i plan', 'Talk & plan') }]}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {step === 'form' ? (
          <motion.div key="form" className="stack gap-4" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0, y: -12, transition: { duration: 0.18 } }}>
            {isReturn && (
              <motion.div variants={rise} className="glass iv-return" style={{ boxShadow: 'inset 0 0 0 1px var(--pink-24), var(--lift-1)' }}>
                <Icon name="flag" style={{ color: 'var(--pink)', flex: 'none' }} />
                <p>{t(`Nie było Cię ${gap - 1} ${plural(gap - 1, 'pl', DAYS)}. Najpierw uczciwy raport, potem rozmowa.`, `You were gone for ${gap - 1} ${plural(gap - 1, 'en', DAYS)}. Honest report first, then we talk.`)}</p>
              </motion.div>
            )}

            <motion.section variants={rise} className="glass iv-sec">
              <h2 className="iv-sec__title">{t('Nawyki wczoraj', 'Habits yesterday')}</h2>
              <div>
                {listed.map((h) => (
                  <div key={h.id} className="iv-habit">
                    <Icon name={habitIcon(h)} size={20} style={{ color: 'var(--ink-3)' }} />
                    <div className="iv-habit__name">
                      {h.name}
                      <div className="iv-habit__target">{h.kind === 'check' ? (h.period === 'week' ? t('w tym tygodniu liczy się do celu', 'counts toward the weekly goal') : '') : `${t('cel', 'goal')} ${fmtHabit(h, h.target, lang)}`}</div>
                    </div>
                    {h.kind === 'check' ? (
                      <button
                        className="iv-check"
                        aria-pressed={!!vals[h.id]}
                        aria-label={h.name}
                        onClick={() => {
                          haptic('select')
                          setVals((v) => ({ ...v, [h.id]: v[h.id] ? 0 : 1 }))
                        }}
                      >
                        <Icon name="check" stroke={2.4} />
                      </button>
                    ) : (
                      <Stepper
                        label={h.name}
                        value={vals[h.id] ?? 0}
                        step={h.step ?? 1}
                        onChange={(v) => setVals((s) => ({ ...s, [h.id]: v }))}
                        format={(v) => (h.unit === 'min' ? `${v}` : String(v))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </motion.section>

            {water && (
              <motion.section variants={rise} className="glass iv-sec">
                <h2 className="iv-sec__title">{t('Woda i jedzenie', 'Water and food')}</h2>
                <div className="iv-water">
                  <Vessel progress={waterMl / water.target} liters={water.target / 1000} />
                  <div className="stack gap-3">
                    <div className="iv-water__big">
                      {fmtNum(waterMl / 1000, lang, 2)}
                      <small>/ {fmtNum(water.target / 1000, lang, 1)} l</small>
                    </div>
                    <Range value={waterMl} min={0} max={Math.max(6000, water.target)} step={250} onChange={setWater} label={t('Woda wczoraj', 'Water yesterday')} />
                  </div>
                </div>
                {meals && (
                  <div className="row between">
                    <span className="t-sub t-strong">{t('Posiłki', 'Meals')}</span>
                    <Stepper label={t('Posiłki', 'Meals')} value={mealsN} min={0} max={6} onChange={setMeals} />
                  </div>
                )}
              </motion.section>
            )}

            <motion.section variants={rise} className="glass iv-sec">
              <h2 className="iv-sec__title">{t('Czysto?', 'Clean?')}</h2>
              <p className="iv-sec__note">{t('Uczciwie. Potknięcie zeruje licznik — to część umowy.', 'Honestly. A slip resets the counter — that is the deal.')}</p>
              <div>
                <div className="iv-clean">
                  <span className="iv-clean__name">{t('Treści 18+', 'Adult content')}</span>
                  <div style={{ width: 190 }}>
                    <Segmented label="18+" value={adultClean ? 'y' : 'n'} onChange={(v) => setAdult(v === 'y')} options={[{ value: 'y', label: t('Czysto', 'Clean') }, { value: 'n', label: t('Potknięcie', 'Slip') }]} />
                  </div>
                </div>
                <div className="iv-clean">
                  <span className="iv-clean__name">{t('Papierosy', 'Cigarettes')}</span>
                  <div style={{ width: 190 }}>
                    <Segmented label={t('Papierosy', 'Cigarettes')} value={smokeClean ? 'y' : 'n'} onChange={(v) => setSmoke(v === 'y')} options={[{ value: 'y', label: t('Czysto', 'Clean') }, { value: 'n', label: t('Zapaliłem', 'Smoked') }]} />
                  </div>
                </div>
                <div className="iv-clean">
                  <div className="stack">
                    <span className="iv-clean__name">Scroll</span>
                    <span className="t-caption t-3">{t(`Z Czasu przed ekranem · limit ${scrollLimit} min`, `From Screen Time · limit ${scrollLimit} min`)}</span>
                  </div>
                  <input
                    className="input input--num"
                    style={{ width: 110, textAlign: 'right', color: scrollMin > scrollLimit ? 'var(--pink-ink)' : undefined }}
                    inputMode="numeric"
                    aria-label={t('Minuty scrolla', 'Scroll minutes')}
                    value={scrollMin || ''}
                    placeholder="0 min"
                    onChange={(e) => setScrollMin(Math.min(1440, Number(e.target.value.replace(/\D/g, '')) || 0))}
                  />
                </div>
              </div>
            </motion.section>

            <motion.section variants={rise} className="glass iv-sec">
              <h2 className="iv-sec__title">{t('Jak było?', 'How was it?')}</h2>
              <div className="iv-mood" role="group" aria-label={t('Nastrój', 'Mood')}>
                {MOODS.map((m, k) => (
                  <button key={k} aria-pressed={mood === k + 1} onClick={() => { haptic('select'); setMood(k + 1) }}>
                    {t(m[0], m[1])}
                  </button>
                ))}
              </div>
              <label className="field">
                <span className="field__label">{t('Co poszło dobrze?', 'What went well?')}</span>
                <input className="input" value={well} onChange={(e) => setWell(e.target.value)} placeholder={t('Jedno, dwa zdania', 'One or two sentences')} />
              </label>
              <label className="field">
                <span className="field__label">{t('Co poszło źle?', 'What went wrong?')}</span>
                <input className="input" value={wrong} onChange={(e) => setWrong(e.target.value)} placeholder={t('Bez wymówek', 'No excuses')} />
              </label>
            </motion.section>

            <motion.div variants={rise} className="iv-dock">
              <button className={`btn btn--lg btn--block ${mood ? 'btn--accent' : 'btn--glass'}`} disabled={!mood} style={mood ? undefined : { opacity: 1, color: 'var(--ink-2)' }} onClick={submit}>
                {mood ? t('Do mentora', 'To the mentor') : t('Wybierz nastrój', 'Pick a mood')}
                {!!mood && <Icon name="arrowRight" />}
              </button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="chat" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.5 }}>
            <ChatThread messages={thread} thinking={thinking} />
            <section className="glass iv-finish">
              <h2 className="iv-sec__title">{t('3 priorytety na dziś', '3 priorities for today')}</h2>
              <PrioritiesEditor date={today} />
              <button className="btn btn--ink btn--lg btn--block" disabled={todayPrios.length < 3} onClick={finish}>
                {todayPrios.length < 3 ? t(`Brakuje ${3 - todayPrios.length} z 3`, `${3 - todayPrios.length} of 3 missing`) : t('Zaczynam dzień', 'Start the day')}
              </button>
            </section>
            <Composer onSend={(m) => void askMentor({ message: m, context })} disabled={thinking} placeholder={t('Odpowiedz mentorowi…', 'Answer your mentor…')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
