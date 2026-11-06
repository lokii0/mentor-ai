import { motion } from 'motion/react'
import { useMentorMood } from '../../app/mood'
import { useRows } from '../../lib/db'
import { fmtTime } from '../../lib/dates'
import { askMentor, isDemoMentor, mentorThinking } from '../../lib/mentor'
import { isMentorPaused, useLang, useSettings, useT } from '../../lib/settings'
import { Orb } from '../../ui/Orb'
import { rise } from '../../ui/motion'
import { Page } from '../../ui/Page'
import { ChatThread, Composer } from './Chat'

const SUGGESTIONS: [string, string][] = [
  ['Co mam teraz zrobić?', 'What should I do right now?'],
  ['Zawaliłem dzisiaj.', 'I blew it today.'],
  ['Daj mi pomysł na zarobek w tym tygodniu.', 'Give me a way to earn money this week.'],
]

export default function MentorScreen() {
  const t = useT()
  const lang = useLang()
  const settings = useSettings()
  const all = useRows('chat_messages')
  const thinking = mentorThinking.use()
  const mood = useMentorMood()
  const messages = all.filter((m) => m.context !== 'onboarding')
  const lastMentor = [...messages].reverse().find((m) => m.role === 'mentor')
  const paused = isMentorPaused(settings)
  const orbMood = lastMentor?.meta?.stage === 'warm' || lastMentor?.meta?.crisis ? 'calm' : lastMentor?.meta?.stage === 'scold' || mood === 'alert' ? 'alert' : 'neutral'

  const send = (message: string) => void askMentor({ message, context: 'chat' })

  const status = thinking
    ? t('Pisze…', 'Typing…')
    : paused
      ? t(`Pauza do ${fmtTime(settings.mentor_paused_until!, lang)}`, `Paused until ${fmtTime(settings.mentor_paused_until!, lang)}`)
      : isDemoMentor
        ? t('Tryb lokalny, bez AI', 'Local mode, no AI')
        : t(`Intensywność ${settings.intensity}/10`, `Intensity ${settings.intensity}/10`)

  return (
    <Page title="Mentor" bare>
      <motion.header variants={rise} className="glass ch-head">
        <Orb size={52} mood={orbMood} thinking={thinking} />
        <div className="stack grow">
          <h1 className="ch-head__name">{t('Mentor', 'Mentor')}</h1>
          <p className={`ch-head__status ${thinking ? 'ch-head__status--live' : ''}`} role="status">{status}</p>
        </div>
      </motion.header>
      {isDemoMentor && (
        <motion.p variants={rise} className="ch-note">
          {t('Mentor odpowiada na regułach z Twoich danych. Pełna rozmowa z Claude ruszy po podłączeniu Supabase.', 'The mentor answers with rules over your data. Full Claude conversations start once Supabase is connected.')}
        </motion.p>
      )}

      {messages.length === 0 && !thinking ? (
        <motion.div variants={rise} className="ch-empty">
          <Orb size={120} mood={orbMood} />
          <p className="ch-empty__line">{t('Mów, co jest grane. Bez owijania.', "Tell me what's going on. Straight.")}</p>
          <div className="ch-sugg">
            {SUGGESTIONS.map(([pl, en]) => (
              <button key={pl} className="chip" onClick={() => send(t(pl, en))}>
                {t(pl, en)}
              </button>
            ))}
          </div>
        </motion.div>
      ) : (
        <ChatThread messages={messages} thinking={thinking} />
      )}
      <Composer onSend={send} disabled={thinking} />
    </Page>
  )
}
