import { motion } from 'motion/react'
import { useState } from 'react'
import { haptic } from '../../lib/haptics'
import { useT } from '../../lib/settings'
import { Icon } from '../../ui/Icon'
import { Segmented } from '../../ui/kit'
import { rise } from '../../ui/motion'
import { Page } from '../../ui/Page'
import { GoalsTab } from './GoalsTab'
import { IdeasTab } from './IdeasTab'
import { NotesTab } from './NotesTab'
import './notes.css'

type Tab = 'notes' | 'goals' | 'ideas'
const KEY = 'nt.tab'

function readTab(): Tab {
  try {
    const v = sessionStorage.getItem(KEY)
    return v === 'goals' || v === 'ideas' ? v : 'notes'
  } catch {
    return 'notes'
  }
}

export default function NotesScreen() {
  const t = useT()
  const [tab, setTab] = useState<Tab>(readTab)
  // Bumped by the header "+" — the active tab opens its "new" sheet.
  const [newTick, setNewTick] = useState(0)

  const pick = (v: Tab) => {
    setTab(v)
    setNewTick(0)
    try {
      sessionStorage.setItem(KEY, v)
    } catch {
      /* per-tab memory is a nicety */
    }
  }

  const addLabel = tab === 'notes' ? t('Nowa notatka', 'New note') : tab === 'goals' ? t('Nowy cel', 'New goal') : t('Nowy pomysł', 'New idea')

  return (
    <Page
      title={t('Notatki i cele', 'Notes & goals')}
      action={
        <button className="btn btn--accent" aria-label={addLabel} onClick={() => { haptic('tap'); setNewTick((n) => n + 1) }}>
          <Icon name="plus" />
          {t('Dodaj', 'Add')}
        </button>
      }
    >
      <motion.div className="nt-tabs" variants={rise}>
        <Segmented
          label={t('Sekcja', 'Section')}
          value={tab}
          onChange={pick}
          options={[
            { value: 'notes', label: t('Notatki', 'Notes') },
            { value: 'goals', label: t('Cele', 'Goals') },
            { value: 'ideas', label: t('Pomysły', 'Ideas') },
          ]}
        />
      </motion.div>
      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.4 }}>
        {tab === 'notes' && <NotesTab newTick={newTick} />}
        {tab === 'goals' && <GoalsTab newTick={newTick} />}
        {tab === 'ideas' && <IdeasTab newTick={newTick} />}
      </motion.div>
    </Page>
  )
}
