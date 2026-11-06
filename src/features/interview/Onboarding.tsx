// PRD 6.2: first launch — a full interview about Ro. Answers become profile facts.
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { SOSButton } from '../../app/Shell'
import { db } from '../../lib/db'
import { todayKey } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { mentorTask, mentorThinking } from '../../lib/mentor'
import { updateSettings, useSettings, useT } from '../../lib/settings'
import type { FactCategory } from '../../lib/types'
import { Aurora } from '../../ui/Aurora'
import { Icon } from '../../ui/Icon'
import { Range } from '../../ui/kit'
import { Orb } from '../../ui/Orb'
import '../mentor/chat.css'
import './interview.css'

interface Q {
  cat: FactCategory
  topic: [string, string]
  q: [string, string]
  hint?: [string, string]
}

const QUESTIONS: Q[] = [
  { cat: 'life', topic: ['Życie', 'Life'], q: ['Opowiedz o sobie w kilku zdaniach.', 'Tell me about yourself in a few sentences.'], hint: ['Ile masz lat, czym się zajmujesz, z kim mieszkasz, co teraz jest najtrudniejsze.', 'Age, what you do, who you live with, what is hardest right now.'] },
  { cat: 'routine', topic: ['Rutyna', 'Routine'], q: ['Jak wygląda Twój typowy dzień?', 'What does a typical day look like?'], hint: ['Od pobudki do snu. Uczciwie, razem z telefonem w łóżku.', 'From waking up to sleep. Honestly, phone in bed included.'] },
  { cat: 'goal', topic: ['Cele', 'Goals'], q: ['Który cel jest teraz najważniejszy i dlaczego?', 'Which goal matters most right now, and why?'], hint: ['10 tys. miesięcznie, biznes AI, apka, produkt cyfrowy, AI, cera, gitara.', '10k a month, AI business, an app, a digital product, AI, skin, guitar.'] },
  { cat: 'finance', topic: ['Pieniądze', 'Money'], q: ['Ile dziś zarabiasz i z czego?', 'How much do you earn today, and from what?'], hint: ['Korki, praca, biznes, dodatki — mniej więcej, miesięcznie.', 'Tutoring, job, business, family support — roughly, per month.'] },
  { cat: 'weakness', topic: ['Słabości', 'Weak spots'], q: ['W czym najczęściej sam się sabotujesz?', 'How do you usually sabotage yourself?'] },
  { cat: 'trigger', topic: ['Wyzwalacze', 'Triggers'], q: ['Kiedy najczęściej odpalasz scroll, papierosa albo 18+?', 'When do you usually reach for scrolling, a cigarette or 18+?'], hint: ['Pora, miejsce, nastrój, z kim jesteś.', 'Time, place, mood, who you are with.'] },
  { cat: 'trigger', topic: ['Wyzwalacze', 'Triggers'], q: ['Co zwykle dzieje się tuż przed potknięciem?', 'What usually happens right before a slip?'] },
  { cat: 'habit', topic: ['Nawyki', 'Habits'], q: ['Które nawyki już Ci wychodzą, a które padają pierwsze?', 'Which habits already work, and which die first?'] },
  { cat: 'routine', topic: ['Energia', 'Energy'], q: ['O której wstajesz i kładziesz się spać? Kiedy masz najwięcej energii?', 'When do you wake up and go to bed? When is your energy highest?'] },
  { cat: 'finance', topic: ['Pieniądze', 'Money'], q: ['Na co najczęściej przepalasz kasę?', 'What do you waste money on most?'] },
  { cat: 'relationship', topic: ['Ludzie', 'People'], q: ['Kto Cię wspiera, a kto ciągnie w dół? Do kogo możesz napisać w kryzysie?', 'Who supports you, who drags you down? Who can you text in a crisis?'] },
  { cat: 'other', topic: ['Jak mam mówić', 'How I should talk'], q: ['Kiedy odpuszczasz — co Cię naprawdę rusza?', 'When you slack off — what actually gets you moving?'], hint: ['Ostro, liczby, wizja celu, wstyd przed kimś? Napisz wprost.', 'Harsh words, numbers, the vision, being accountable to someone? Say it straight.'] },
]

const DRAFT = 'mentor.onboarding.draft'

export default function Onboarding() {
  const t = useT()
  const settings = useSettings()
  const thinking = mentorThinking.use()
  const [answers, setAnswers] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(DRAFT) || '[]')
    } catch {
      return []
    }
  })
  const [i, setI] = useState(() => Math.min(answers.findIndex((a) => !a) === -1 ? answers.length : answers.findIndex((a) => !a), QUESTIONS.length))
  const [dir, setDir] = useState(1)
  const [intensity, setIntensity] = useState(settings.intensity ?? 10)

  useEffect(() => {
    localStorage.setItem(DRAFT, JSON.stringify(answers))
  }, [answers])

  const total = QUESTIONS.length + 1
  const go = (n: number) => {
    setDir(n > i ? 1 : -1)
    setI(n)
    haptic('select')
  }

  const finish = async () => {
    haptic('success')
    const transcript = QUESTIONS.map((q, k) => ({ q: t(q.q[0], q.q[1]), a: answers[k] ?? '', category: q.cat }))
    const res = await mentorTask('onboarding_extract', { transcript })
    const facts = res?.facts?.length ? res.facts : transcript.filter((x) => x.a.trim()).map((x) => ({ category: x.category, text: x.a.trim() }))
    db.insertMany('profile_facts', facts.map((f) => ({ category: f.category, text: f.text, source: 'onboarding' as const })))
    db.insert('daily_interviews', { date: todayKey(), about_date: todayKey(), kind: 'onboarding', answers: { transcript }, completed: true })
    db.insert('chat_messages', {
      role: 'mentor',
      context: 'chat',
      content: t(
        'Dobra, znam podstawy. Zasady są proste: mówię wprost, chwalę tylko za wyniki, a jak odpuścisz — usłyszysz to. Od jutra każdy dzień zaczynamy porannym wywiadem. Teraz ustal 3 priorytety na dziś.',
        "Right, I know the basics. The rules are simple: I talk straight, I praise only results, and when you slack off you'll hear it. From tomorrow every day starts with the morning check-in. Now set 3 priorities for today.",
      ),
      meta: { stage: 'plan' },
    })
    updateSettings({ intensity, onboarding_done: true })
    localStorage.removeItem(DRAFT)
  }

  const q = QUESTIONS[i]
  const isLast = i >= QUESTIONS.length

  return (
    <div className="iv">
      <Aurora scene="mentor" />
      <div className="iv-top">
        <Orb size={34} thinking={thinking} />
        <div className="stack grow">
          <span className="iv-top__title">{t('Wywiad startowy', 'Getting to know you')}</span>
          <span className="iv-top__sub">{t('Odpowiedzi trafią do Twojego profilu.', 'Answers go to your profile.')}</span>
        </div>
        <SOSButton />
      </div>
      <div className="iv-progress" aria-hidden="true">
        <motion.div initial={false} animate={{ scaleX: (i + 1) / total }} transition={{ type: 'spring', bounce: 0, duration: 0.6 }} />
      </div>

      <div className="iv-stage">
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.section
            key={i}
            custom={dir}
            className="iv-q"
            initial={{ opacity: 0, x: 40 * dir, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -40 * dir, filter: 'blur(6px)' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
          >
            {!isLast ? (
              <>
                <span className="iv-q__topic">{t(q.topic[0], q.topic[1])}</span>
                <h1 className="iv-q__text">{t(q.q[0], q.q[1])}</h1>
                {q.hint && <p className="iv-q__hint">{t(q.hint[0], q.hint[1])}</p>}
                <textarea
                  className="textarea iv-answer glass glass--strong"
                  value={answers[i] ?? ''}
                  autoFocus
                  aria-label={t(q.q[0], q.q[1])}
                  onChange={(e) => setAnswers((a) => Object.assign([...a], { [i]: e.target.value }))}
                  placeholder={t('Pisz jak do brata, nie do HR-u.', 'Write like to a brother, not to HR.')}
                />
              </>
            ) : (
              <>
                <span className="iv-q__topic">{t('Ostatnia rzecz', 'One last thing')}</span>
                <h1 className="iv-q__text">{t('Jak ostro mam mówić, gdy odpuszczasz?', 'How hard should I go when you slack off?')}</h1>
                <p className="iv-q__hint">{t('10 to bez litości — za zachowanie, nigdy za to, kim jesteś. Zmienisz to w ustawieniach.', '10 means no mercy — about behaviour, never about who you are. You can change it in settings.')}</p>
                <div className="glass glass--strong pad stack gap-3">
                  <div className="row between">
                    <span className="t-sub t-2">{t('Intensywność', 'Intensity')}</span>
                    <span className="t-num t-title2">{intensity}/10</span>
                  </div>
                  <Range value={intensity} min={1} max={10} onChange={setIntensity} label={t('Intensywność', 'Intensity')} fill={intensity >= 8 ? 'var(--pink)' : 'var(--sky)'} />
                </div>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="iv-nav">
        {i > 0 && (
          <button className="icon-btn" onClick={() => go(i - 1)} aria-label={t('Wstecz', 'Back')}>
            <Icon name="chevronLeft" />
          </button>
        )}
        {!isLast && (
          <button className="btn btn--ghost" onClick={() => go(i + 1)}>
            {t('Pomiń', 'Skip')}
          </button>
        )}
        <div className="grow" />
        {isLast ? (
          <button className="btn btn--accent btn--lg" disabled={thinking} onClick={finish}>
            {thinking ? t('Mentor czyta…', 'Mentor is reading…') : t('Zaczynamy', "Let's go")}
            {!thinking && <Icon name="arrowRight" />}
          </button>
        ) : (
          <button className="btn btn--ink btn--lg" disabled={!(answers[i] ?? '').trim()} onClick={() => go(i + 1)}>
            {t('Dalej', 'Next')}
            <Icon name="arrowRight" />
          </button>
        )}
      </div>
    </div>
  )
}
