import { motion } from 'motion/react'
import { useState } from 'react'
import { useT } from '../../lib/settings'
import { Segmented } from '../../ui/kit'
import { rise, stagger } from '../../ui/motion'
import { Page } from '../../ui/Page'
import { HabitsTab } from './HabitsTab'
import { LimitsTab } from './LimitsTab'
import { ProgressTab } from './ProgressTab'
import './habits.css'

type Tab = 'habits' | 'limits' | 'progress'
let lastTab: Tab = 'habits' // survives navigating away and back

/** Deep link from other screens (e.g. Today → limits). Call before navigate('habits'). */
export function setHabitsTab(v: Tab) {
  lastTab = v
}

export default function HabitsScreen() {
  const t = useT()
  const [tab, setTabState] = useState<Tab>(lastTab)
  const setTab = (v: Tab) => {
    lastTab = v
    setTabState(v)
  }

  return (
    <Page title={t('Nawyki', 'Habits')}>
      <motion.div className="hb-tabs" variants={rise}>
        <Segmented
          label={t('Widok', 'View')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'habits', label: t('Nawyki', 'Habits') },
            { value: 'limits', label: t('Ograniczenia', 'Limits') },
            { value: 'progress', label: t('Postęp', 'Progress') },
          ]}
        />
      </motion.div>
      <motion.div key={tab} className="hb-pane" variants={stagger} initial="hidden" animate="show">
        {tab === 'habits' ? <HabitsTab /> : tab === 'limits' ? <LimitsTab /> : <ProgressTab />}
      </motion.div>
    </Page>
  )
}
