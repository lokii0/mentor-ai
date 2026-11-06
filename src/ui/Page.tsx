import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { stagger } from './motion'

interface Props {
  title: string
  /** Line above the title (e.g. the date). */
  overline?: ReactNode
  /** Right of the title (one primary action at most). */
  action?: ReactNode
  children: ReactNode
  /** Skip the large title (e.g. chat screen draws its own). */
  bare?: boolean
}

/** Screen body: iOS large title + staggered content. The compact title lives in the shell's top bar. */
export function Page({ title, overline, action, children, bare }: Props) {
  return (
    <motion.main className="page" variants={stagger} initial="hidden" animate="show">
      {!bare && (
        <motion.header
          className="page__head"
          variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0, duration: 0.5 } } }}
        >
          <div className="stack gap-1 grow">
            {overline && <p className="page__overline">{overline}</p>}
            <h1 className="t-large page__title">{title}</h1>
          </div>
          {action && <div className="page__action">{action}</div>}
        </motion.header>
      )}
      {children}
    </motion.main>
  )
}
