// Motion house style. Critically damped springs by default (no overshoot);
// a little bounce only where a gesture carried momentum (sheet flick, drag release).
import type { Transition, Variants } from 'motion/react'

export const spring: Transition = { type: 'spring', bounce: 0, duration: 0.4 }
export const springFast: Transition = { type: 'spring', bounce: 0, duration: 0.28 }
export const springSoft: Transition = { type: 'spring', bounce: 0, duration: 0.6 }
export const springMomentum: Transition = { type: 'spring', bounce: 0.18, duration: 0.42 }
export const fade: Transition = { duration: 0.2, ease: [0.22, 1, 0.36, 1] }

/** Parent: <motion.div variants={stagger} initial="hidden" animate="show"> */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

/** Child: rises 18px with opacity. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0, duration: 0.55 } },
}

/** Glass materialising: blur + scale + opacity together (Apple: materialize, don't just fade). */
export const materialize: Variants = {
  hidden: { opacity: 0, scale: 0.96, filter: 'blur(8px)' },
  show: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { type: 'spring', bounce: 0, duration: 0.5 } },
  exit: { opacity: 0, scale: 0.98, filter: 'blur(6px)', transition: { duration: 0.18 } },
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
