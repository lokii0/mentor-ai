// Hour calendar 6:00–24:00. Blocks track the pointer 1:1 (respecting the grab offset), rubber-band
// at the edges, snap to 15 minutes on release with the release velocity handed to the spring.
// Touch: long-press a block to move it (so the calendar still scrolls); mouse: drag right away.
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { db } from '../../lib/db'
import { minutesToHHMM, nowMinutes, todayKey } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { useT } from '../../lib/settings'
import type { CalendarBlock } from '../../lib/types'
import { Icon } from '../../ui/Icon'

export const DAY_START = 6 * 60
export const DAY_END = 24 * 60
const HOUR_PX = 64
const PPM = HOUR_PX / 60
const GRID_H = (DAY_END - DAY_START) * PPM
const MIN_LEN = 15

const toPx = (min: number) => (min - DAY_START) * PPM
const lenPx = (min: number) => min * PPM
const snap = (min: number, step = 15) => Math.round(min / step) * step
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

function rubber(over: number, dim: number, c = 0.55) {
  return (over * dim * c) / (dim + c * Math.abs(over))
}
function rubberClamp(v: number, min: number, max: number, dim = 140) {
  if (v < min) return min - rubber(min - v, dim)
  if (v > max) return max + rubber(v - max, dim)
  return v
}

/** Side-by-side lanes for overlapping blocks. */
function lanes(blocks: CalendarBlock[]) {
  const sorted = [...blocks].sort((a, b) => a.start_min - b.start_min || b.end_min - a.end_min)
  const out = new Map<string, { lane: number; lanes: number }>()
  let cluster: CalendarBlock[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1
  const flush = () => {
    for (const b of cluster) out.get(b.id)!.lanes = laneEnds.length
    cluster = []
    laneEnds = []
    clusterEnd = -1
  }
  for (const b of sorted) {
    if (cluster.length && b.start_min >= clusterEnd) flush()
    let lane = laneEnds.findIndex((e) => e <= b.start_min)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(b.end_min)
    } else laneEnds[lane] = b.end_min
    out.set(b.id, { lane, lanes: 1 })
    cluster.push(b)
    clusterEnd = Math.max(clusterEnd, b.end_min)
  }
  flush()
  return out
}

interface Props {
  date: string
  blocks: CalendarBlock[]
  onEdit: (b: CalendarBlock) => void
  onCreate: (startMin: number) => void
}

export function Calendar({ date, blocks, onEdit, onCreate }: Props) {
  const t = useT()
  const scroller = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(nowMinutes())
  const isToday = date === todayKey()
  const layout = useMemo(() => lanes(blocks), [blocks])
  const firstScroll = useRef(true)

  useEffect(() => {
    const id = setInterval(() => setNow(nowMinutes()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Auto-scroll: to now on today, otherwise to the first block (or 8:00).
  useLayoutEffect(() => {
    const c = scroller.current
    if (!c) return
    const first = blocks.length ? Math.min(...blocks.map((b) => b.start_min)) : 8 * 60
    const target = isToday ? nowMinutes() : first
    const top = Math.max(0, toPx(clamp(target, DAY_START, DAY_END)) - c.clientHeight * 0.3)
    c.scrollTo({ top, behavior: firstScroll.current ? 'auto' : 'smooth' })
    firstScroll.current = false
    // only when the day changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const onGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.pl-block')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const min = DAY_START + Math.floor((e.clientY - rect.top) / PPM / 30) * 30
    haptic('tap')
    onCreate(clamp(min, DAY_START, DAY_END - 30))
  }

  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60)

  return (
    <div className="pl-cal" ref={scroller}>
      <div
        className="pl-cal__grid"
        style={{ height: GRID_H }}
        onClick={onGridClick}
        role="grid"
        aria-label={t('Kalendarz dnia — dotknij pustego miejsca, aby dodać blok', 'Day calendar — tap an empty slot to add a block')}
      >
        {hours.map((m) => (
          <div key={m} className="pl-cal__hour" style={{ top: toPx(m) }}>
            <span className="pl-cal__label">{minutesToHHMM(m === DAY_END ? 0 : m)}</span>
          </div>
        ))}
        {hours.slice(0, -1).map((m) => (
          <div key={`h${m}`} className="pl-cal__half" style={{ top: toPx(m + 30) }} />
        ))}
        {isToday && now >= DAY_START && now <= DAY_END && (
          <div className="pl-now" style={{ top: toPx(now) }} aria-hidden="true">
            <span className="pl-now__label">{minutesToHHMM(now)}</span>
          </div>
        )}
        <AnimatePresence>
          {blocks.map((b) => (
            <BlockView key={b.id} block={b} pos={layout.get(b.id) ?? { lane: 0, lanes: 1 }} scroller={scroller} onTap={() => onEdit(b)} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

type Mode = 'none' | 'pending' | 'move' | 'resize'

function BlockView({ block, pos, scroller, onTap }: { block: CalendarBlock; pos: { lane: number; lanes: number }; scroller: RefObject<HTMLDivElement | null>; onTap: () => void }) {
  const t = useT()
  const start = clamp(block.start_min, DAY_START, DAY_END - MIN_LEN)
  const end = clamp(block.end_min, start + MIN_LEN, DAY_END)
  const top = useMotionValue(toPx(start))
  const height = useMotionValue(lenPx(end - start))
  const label = useTransform([top, height], ([a, h]: number[]) => {
    const s = snap(clamp(DAY_START + a / PPM, DAY_START, DAY_END))
    const e = snap(clamp(DAY_START + (a + h) / PPM, DAY_START, DAY_END))
    return `${minutesToHHMM(s)}–${minutesToHHMM(e === DAY_END ? 0 : e)}`
  })
  const el = useRef<HTMLDivElement>(null)
  const last = useRef({ start, end })
  const st = useRef({ mode: 'none' as Mode, id: -1, startY: 0, clientY: 0, startScroll: 0, base: 0, timer: 0, raf: 0, hist: [] as { y: number; t: number }[] })
  const [active, setActive] = useState<Mode>('none')

  // Changes coming from elsewhere (sheet edits, mentor) glide into place.
  useEffect(() => {
    if (st.current.mode === 'move' || st.current.mode === 'resize') return
    if (last.current.start === start && last.current.end === end) return
    last.current = { start, end }
    animate(top, toPx(start), { type: 'spring', bounce: 0, duration: 0.4 })
    animate(height, lenPx(end - start), { type: 'spring', bounce: 0, duration: 0.4 })
  }, [start, end, top, height])

  // Once a long-press drag starts, the page must not scroll under the finger.
  useEffect(() => {
    const node = el.current
    if (!node) return
    const prevent = (e: TouchEvent) => {
      if (st.current.mode === 'move' || st.current.mode === 'resize') e.preventDefault()
    }
    node.addEventListener('touchmove', prevent, { passive: false })
    return () => node.removeEventListener('touchmove', prevent)
  }, [])

  useEffect(() => () => {
    cancelAnimationFrame(st.current.raf)
    clearTimeout(st.current.timer)
  }, [])

  const delta = () => st.current.clientY - st.current.startY + ((scroller.current?.scrollTop ?? 0) - st.current.startScroll)

  const apply = () => {
    const s = st.current
    if (s.mode === 'move') top.set(rubberClamp(s.base + delta(), 0, GRID_H - height.get()))
    else if (s.mode === 'resize') height.set(rubberClamp(s.base + delta(), lenPx(MIN_LEN), GRID_H - top.get()))
  }

  // Edge auto-scroll while dragging near the top/bottom of the calendar.
  const loop = () => {
    const s = st.current
    const c = scroller.current
    if (!c || (s.mode !== 'move' && s.mode !== 'resize')) return
    const r = c.getBoundingClientRect()
    const edge = 56
    if (s.clientY < r.top + edge) c.scrollTop -= Math.ceil((r.top + edge - s.clientY) / 5)
    else if (s.clientY > r.bottom - edge) c.scrollTop += Math.ceil((s.clientY - (r.bottom - edge)) / 5)
    apply()
    s.raf = requestAnimationFrame(loop)
  }

  const begin = (mode: 'move' | 'resize') => {
    const s = st.current
    s.mode = mode
    s.base = mode === 'move' ? top.get() : height.get()
    setActive(mode)
    haptic('select')
    cancelAnimationFrame(s.raf)
    s.raf = requestAnimationFrame(loop)
  }

  const velocity = () => {
    const h = st.current.hist
    if (h.length < 2) return 0
    const a = h[0]
    const b = h[h.length - 1]
    const dt = (b.t - a.t) / 1000
    return dt > 0 ? (b.y - a.y) / dt : 0
  }

  const finish = () => {
    const s = st.current
    cancelAnimationFrame(s.raf)
    clearTimeout(s.timer)
    const mode = s.mode
    s.mode = 'none'
    setActive('none')
    const v = velocity()
    if (mode === 'move') {
      const dur = end - start
      const ns = clamp(snap(DAY_START + top.get() / PPM), DAY_START, DAY_END - dur)
      animate(top, toPx(ns), { type: 'spring', bounce: 0.15, duration: 0.45, velocity: v })
      if (ns !== start) {
        last.current = { start: ns, end: ns + dur }
        db.update('calendar_blocks', block.id, { start_min: ns, end_min: ns + dur })
        haptic('tap')
      }
    } else if (mode === 'resize') {
      const ne = clamp(snap(start + height.get() / PPM), start + MIN_LEN, DAY_END)
      animate(height, lenPx(ne - start), { type: 'spring', bounce: 0.15, duration: 0.4, velocity: v })
      if (ne !== end) {
        last.current = { start, end: ne }
        db.update('calendar_blocks', block.id, { end_min: ne })
        haptic('tap')
      }
    }
  }

  const track = (e: React.PointerEvent) => {
    const s = st.current
    s.clientY = e.clientY
    s.hist.push({ y: e.clientY, t: e.timeStamp })
    if (s.hist.length > 6) s.hist.shift()
  }

  const arm = (e: React.PointerEvent) => {
    const s = st.current
    s.id = e.pointerId
    s.startY = s.clientY = e.clientY
    s.startScroll = scroller.current?.scrollTop ?? 0
    s.hist = [{ y: e.clientY, t: e.timeStamp }]
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    arm(e)
    const s = st.current
    s.mode = 'pending'
    e.currentTarget.setPointerCapture(e.pointerId)
    if (e.pointerType !== 'mouse') {
      clearTimeout(s.timer)
      s.timer = window.setTimeout(() => {
        if (st.current.mode === 'pending') begin('move')
      }, 320)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const s = st.current
    if (e.pointerId !== s.id) return
    track(e)
    if (s.mode === 'pending') {
      const d = Math.abs(e.clientY - s.startY)
      if (e.pointerType === 'mouse') {
        if (d > 4) begin('move')
      } else if (d > 8) {
        clearTimeout(s.timer) // it's a scroll, not a drag
        s.mode = 'none'
      }
      return
    }
    if (s.mode === 'move' || s.mode === 'resize') apply()
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const s = st.current
    if (e.pointerId !== s.id) return
    if (s.mode === 'pending') {
      clearTimeout(s.timer)
      s.mode = 'none'
      haptic('tap')
      onTap()
    } else if (s.mode === 'move' || s.mode === 'resize') finish()
  }

  const onPointerCancel = () => {
    const s = st.current
    if (s.mode === 'move' || s.mode === 'resize') finish()
    else {
      clearTimeout(s.timer)
      s.mode = 'none'
    }
  }

  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    arm(e)
    e.currentTarget.setPointerCapture(e.pointerId)
    begin('resize')
  }

  const compact = end - start < 45
  const width = 100 / pos.lanes
  const cls = [
    'pl-block',
    block.proposed ? 'pl-block--proposed' : `pl-block--${block.kind}`,
    block.done ? 'pl-block--done' : '',
    compact && !block.proposed ? 'pl-block--compact' : '',
    active === 'move' || active === 'resize' ? 'pl-block--drag' : '',
  ].join(' ')

  return (
    <motion.div
      ref={el}
      className={cls}
      style={{ top, height, left: `calc(${pos.lane * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: active === 'move' ? 1.025 : 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      role="button"
      tabIndex={0}
      aria-label={`${block.title}, ${minutesToHHMM(start)}–${minutesToHHMM(end === DAY_END ? 0 : end)}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onTap()
        }
      }}
    >
      <span className="pl-block__title">{block.title}</span>
      <motion.span className="pl-block__time">{label}</motion.span>
      {block.done && <Icon name="check" className="pl-block__done" />}
      {block.proposed && (
        <span className="pl-block__actions">
          <button
            className="pl-block__act pl-block__act--yes"
            onClick={(e) => {
              e.stopPropagation()
              haptic('success')
              db.update('calendar_blocks', block.id, { proposed: false })
            }}
          >
            <Icon name="check" />
            {t('Przyjmij', 'Accept')}
          </button>
          <button
            className="pl-block__act"
            aria-label={t('Odrzuć propozycję', 'Reject proposal')}
            onClick={(e) => {
              e.stopPropagation()
              haptic('tap')
              db.remove('calendar_blocks', block.id)
            }}
          >
            <Icon name="close" />
          </button>
        </span>
      )}
      {!block.proposed && <div className="pl-block__handle" onPointerDown={onHandleDown} aria-hidden="true" />}
    </motion.div>
  )
}
