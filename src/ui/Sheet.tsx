import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react'
import { useEffect, useId, type ReactNode } from 'react'
import { Icon } from './Icon'
import { spring, springMomentum } from './motion'

interface Props {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** Right side of the header (e.g. a Save button). */
  action?: ReactNode
  /** Tall sheets (forms) fill most of the screen. */
  tall?: boolean
}

/** Apple-style projection: where would a flick come to rest? */
const project = (v: number, d = 0.998) => ((v / 1000) * d) / (1 - d)

/** Bottom sheet. Drag the grabber down (or flick) to dismiss; velocity carries into the close. */
export function Sheet({ open, onClose, title, children, action, tall }: Props) {
  const controls = useDragControls()
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const projected = info.offset.y + project(info.velocity.y)
    if (projected > 220 || info.velocity.y > 900) onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            style={tall ? { height: 'calc(100dvh - var(--safe-t) - 40px)' } : undefined}
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: spring }}
            exit={{ y: '100%', transition: { ...spring, duration: 0.32 } }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.9 }}
            dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
            dragSnapToOrigin
            onDragEnd={onDragEnd}
            transition={springMomentum}
          >
            <div className="sheet__grab" onPointerDown={(e) => controls.start(e)} style={{ touchAction: 'none' }} />
            {(title || action) && (
              <div className="sheet__head" onPointerDown={(e) => controls.start(e)} style={{ touchAction: 'none' }}>
                <h2 id={titleId} className="sheet__title">{title}</h2>
                <div className="row gap-2">
                  {action}
                  <button className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Zamknij">
                    <Icon name="close" />
                  </button>
                </div>
              </div>
            )}
            <div className="sheet__body grow">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
