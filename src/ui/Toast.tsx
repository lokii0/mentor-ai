import { AnimatePresence, motion } from 'motion/react'
import { atom } from '../lib/store'
import { Icon, type IconName } from './Icon'

interface ToastItem {
  id: number
  text: string
  icon?: IconName
  tone?: 'dark' | 'pink'
  action?: { label: string; run: () => void }
}

const toasts = atom<ToastItem[]>([])
let n = 0

export function toast(text: string, opts: Omit<ToastItem, 'id' | 'text'> = {}) {
  const id = ++n
  toasts.set((t) => [...t.slice(-2), { id, text, ...opts }])
  setTimeout(() => toasts.set((t) => t.filter((x) => x.id !== id)), opts.action ? 5000 : 2600)
}

export function Toaster() {
  const items = toasts.use()
  return (
    <div className="toast-wrap" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={`toast glass glass--dark`}
            style={t.tone === 'pink' ? { background: 'rgba(216,57,149,.92)' } : undefined}
            initial={{ opacity: 0, y: -16, scale: 0.94, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, scale: 0.96, filter: 'blur(4px)' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          >
            {t.icon && <Icon name={t.icon} />}
            <span>{t.text}</span>
            {t.action && (
              <button
                className="btn btn--sm"
                style={{ background: 'rgba(255,255,255,.14)', color: '#fff', marginLeft: 4 }}
                onClick={() => {
                  t.action!.run()
                  toasts.set((x) => x.filter((y) => y.id !== t.id))
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
