import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db, useRows } from '../../lib/db'
import { fmtDay } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { mentorTask } from '../../lib/mentor'
import { useLang, useT } from '../../lib/settings'
import type { Goal, GoalStep } from '../../lib/types'
import { Icon } from '../../ui/Icon'
import { Card, Empty, Ring, Segmented } from '../../ui/kit'
import { Orb } from '../../ui/Orb'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/Toast'

type Scope = GoalStep['scope']
const SCOPES: { scope: Scope; pl: string; en: string }[] = [
  { scope: 'milestone', pl: 'Kamienie milowe', en: 'Milestones' },
  { scope: 'week', pl: 'Ten tydzień', en: 'This week' },
  { scope: 'day', pl: 'Kroki na dziś', en: 'Steps for today' },
]
const STATUS_ORDER: Record<Goal['status'], number> = { active: 0, paused: 1, done: 2 }

export function goalProgress(steps: GoalStep[], goalId: string): { done: number; total: number; pct: number } {
  const mine = steps.filter((s) => s.goal_id === goalId)
  const done = mine.filter((s) => s.done).length
  return { done, total: mine.length, pct: mine.length ? done / mine.length : 0 }
}

export function GoalsTab({ newTick }: { newTick: number }) {
  const t = useT()
  const lang = useLang()
  const goals = useRows('goals')
  const steps = useRows('goal_steps')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (newTick > 0) setCreating(true)
  }, [newTick])

  const list = useMemo(() => [...goals].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.sort - b.sort), [goals])
  const open = goals.find((g) => g.id === openId) ?? null
  const active = goals.filter((g) => g.status === 'active').length

  return (
    <motion.div className="nt-pane" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show">
      <Card className="nt-card">
        <div className="nt-card__head">
          <h2 className="nt-card__title">{t('Cele', 'Goals')}</h2>
          <span className="nt-card__aside">{active} {t('aktywne', 'active')}</span>
        </div>
        {list.length === 0 ? (
          <Empty>{t('Brak celów. Dodaj pierwszy — mentor pomoże rozbić go na kroki.', 'No goals. Add one — the mentor will break it into steps.')}</Empty>
        ) : (
          <div className="list">
            {list.map((g) => {
              const p = goalProgress(steps, g.id)
              const sub = [g.metric, g.deadline ? `${t('do', 'by')} ${fmtDay(g.deadline, lang, { day: 'numeric', month: 'short', year: 'numeric' })}` : null, p.total ? `${p.done}/${p.total} ${t('kroków', 'steps')}` : t('bez kroków', 'no steps')]
                .filter(Boolean)
                .join(' · ')
              return (
                <button key={g.id} className="lrow lrow--tap nt-goal" onClick={() => setOpenId(g.id)} style={g.status === 'done' ? { opacity: 0.6 } : undefined}>
                  <Ring value={p.pct} size={44} stroke={4.5} color={g.status === 'paused' ? 'var(--ink-3)' : 'var(--sky)'} label={`${Math.round(p.pct * 100)}%`}>
                    <span className="nt-goal__pct">{Math.round(p.pct * 100)}</span>
                  </Ring>
                  <span className="lrow__main">
                    <span className="lrow__title">{g.title}</span>
                    <span className="lrow__sub">{sub}</span>
                  </span>
                  {g.status !== 'active' && <span className={`pill ${g.status === 'done' ? 'pill--sky' : ''}`}>{g.status === 'done' ? t('Zrobiony', 'Done') : t('Wstrzymany', 'Paused')}</span>}
                  <Icon name="chevronRight" className="lrow__chev" />
                </button>
              )
            })}
          </div>
        )}
      </Card>

      <GoalSheet goal={open} onClose={() => setOpenId(null)} />
      <NewGoalSheet open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpenId(id) }} />
    </motion.div>
  )
}

function NewGoalSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const t = useT()
  const goals = useRows('goals')
  const [title, setTitle] = useState('')
  const [metric, setMetric] = useState('')
  const [deadline, setDeadline] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle('')
    setMetric('')
    setDeadline('')
  }, [open])

  const save = () => {
    if (!title.trim()) return
    const row = db.insert('goals', {
      title: title.trim(),
      metric: metric.trim() || null,
      deadline: deadline || null,
      description: null,
      status: 'active',
      sort: Math.max(-1, ...goals.map((g) => g.sort)) + 1,
    })
    haptic('success')
    onCreated(row.id)
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('Nowy cel', 'New goal')} action={<button className="btn btn--sm btn--ink" onClick={save} disabled={!title.trim()}>{t('Dodaj', 'Add')}</button>}>
      <div className="stack gap-4">
        <label className="field">
          <span className="field__label">{t('Cel', 'Goal')}</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('np. 5 klientów na automatyzację', 'e.g. 5 automation clients')} maxLength={120} enterKeyHint="done" />
        </label>
        <label className="field">
          <span className="field__label">{t('Miara (opcjonalnie)', 'Measure (optional)')}</span>
          <input className="input" value={metric} onChange={(e) => setMetric(e.target.value)} placeholder={t('np. 10 000 zł / mies.', 'e.g. 10,000 PLN / month')} maxLength={60} />
        </label>
        <label className="field">
          <span className="field__label">{t('Termin (opcjonalnie)', 'Deadline (optional)')}</span>
          <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
      </div>
    </Sheet>
  )
}

function GoalSheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const t = useT()
  const allSteps = useRows('goal_steps')
  const [title, setTitle] = useState('')
  const [metric, setMetric] = useState('')
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [drafts, setDrafts] = useState<Record<Scope, string>>({ milestone: '', week: '', day: '' })
  const [proposals, setProposals] = useState<{ title: string; scope: Scope }[]>([])
  const [busy, setBusy] = useState(false)

  // Keep rendering the last goal while the sheet animates out.
  const last = useRef<Goal | null>(null)
  if (goal) last.current = goal
  const g = goal ?? last.current

  const goalId = goal?.id
  useEffect(() => {
    if (!goal) return
    setTitle(goal.title)
    setMetric(goal.metric ?? '')
    setDeadline(goal.deadline ?? '')
    setDescription(goal.description ?? '')
    setDrafts({ milestone: '', week: '', day: '' })
    setProposals([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId])

  const steps = useMemo(() => allSteps.filter((s) => s.goal_id === g?.id).sort((a, b) => a.sort - b.sort), [allSteps, g?.id])
  const p = g ? goalProgress(allSteps, g.id) : { done: 0, total: 0, pct: 0 }

  // Text fields save on close (no write per keystroke).
  const close = () => {
    if (goal) {
      const patch = { title: title.trim() || goal.title, metric: metric.trim() || null, deadline: deadline || null, description: description.trim() || null }
      if (patch.title !== goal.title || patch.metric !== (goal.metric ?? null) || patch.deadline !== (goal.deadline ?? null) || patch.description !== (goal.description ?? null))
        db.update('goals', goal.id, patch)
    }
    onClose()
  }

  const addStep = (scope: Scope, text: string) => {
    if (!goal || !text.trim()) return
    db.insert('goal_steps', { goal_id: goal.id, title: text.trim(), scope, due: null, done: false, sort: Math.max(-1, ...steps.map((s) => s.sort)) + 1 })
    haptic('tap')
  }

  const toggle = (s: GoalStep) => {
    haptic(s.done ? 'select' : 'success')
    db.update('goal_steps', s.id, { done: !s.done })
  }

  const removeStep = (s: GoalStep) => {
    db.remove('goal_steps', s.id)
    toast(t('Krok usunięty', 'Step removed'), { icon: 'trash', action: { label: t('Cofnij', 'Undo'), run: () => db.insert('goal_steps', { ...s }) } })
  }

  const breakdown = async () => {
    if (!goal) return
    setBusy(true)
    const res = await mentorTask('goal_breakdown', { title: goal.title, metric: goal.metric, deadline: goal.deadline, existing: steps.map((s) => s.title) })
    setBusy(false)
    if (!res) {
      toast(t('Rozbijanie celów wymaga mentora AI — podłącz backend (Supabase).', 'Breaking goals down needs the AI mentor — connect the backend (Supabase).'), { icon: 'cloud' })
      return
    }
    const existing = new Set(steps.map((s) => s.title.toLowerCase()))
    setProposals(res.steps.filter((s) => !existing.has(s.title.toLowerCase())))
  }

  const accept = (i: number) => {
    const pr = proposals[i]
    addStep(pr.scope, pr.title)
    setProposals((ps) => ps.filter((_, j) => j !== i))
  }

  const removeGoal = () => {
    if (!goal) return
    const g = goal
    const mine = steps
    mine.forEach((s) => db.remove('goal_steps', s.id))
    db.remove('goals', g.id)
    haptic('warning')
    toast(t('Cel usunięty', 'Goal deleted'), {
      icon: 'trash',
      action: {
        label: t('Cofnij', 'Undo'),
        run: () => {
          db.insert('goals', { ...g })
          mine.forEach((s) => db.insert('goal_steps', { ...s }))
        },
      },
    })
    onClose()
  }

  return (
    <Sheet open={!!goal} onClose={close} tall title={t('Cel', 'Goal')} action={<button className="btn btn--sm btn--ink" onClick={close}>{t('Gotowe', 'Done')}</button>}>
      {g && (
        <div className="stack gap-5">
          <div className="row gap-4">
            <Ring value={p.pct} size={64} stroke={6} label={`${Math.round(p.pct * 100)}%`}>
              <span className="t-num t-strong" style={{ fontSize: 16 }}>{Math.round(p.pct * 100)}%</span>
            </Ring>
            <div className="stack gap-1 grow">
              <input className="nt-title-input" style={{ fontSize: 'var(--t-title3)' }} value={title} onChange={(e) => setTitle(e.target.value)} aria-label={t('Nazwa celu', 'Goal name')} maxLength={120} />
              <span className="t-foot t-3" style={{ paddingLeft: 4 }}>{p.done}/{p.total} {t('kroków zrobionych', 'steps done')}</span>
            </div>
          </div>

          <Segmented
            label={t('Status', 'Status')}
            value={g.status}
            onChange={(v) => { haptic('select'); db.update('goals', g.id, { status: v }) }}
            options={[
              { value: 'active', label: t('Aktywny', 'Active') },
              { value: 'paused', label: t('Wstrzymany', 'Paused') },
              { value: 'done', label: t('Zrobiony', 'Done') },
            ]}
          />

          <div className="row gap-3">
            <label className="field grow">
              <span className="field__label">{t('Miara', 'Measure')}</span>
              <input className="input" value={metric} onChange={(e) => setMetric(e.target.value)} maxLength={60} />
            </label>
            <label className="field grow">
              <span className="field__label">{t('Termin', 'Deadline')}</span>
              <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </label>
          </div>

          <label className="field">
            <span className="field__label">{t('Po co to robisz', 'Why it matters')}</span>
            <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('Jedno, dwa zdania. Mentor to przeczyta.', 'One or two sentences. The mentor reads this.')} />
          </label>

          <div className="stack gap-3">
            <button className="btn btn--ink" style={{ alignSelf: 'flex-start' }} onClick={breakdown} disabled={busy}>
              {busy ? <Orb size={18} thinking /> : <Icon name="mentor" />}
              {busy ? t('Mentor rozpisuje…', 'Mentor is planning…') : t('Rozbij na kroki', 'Break into steps')}
            </button>
            <AnimatePresence>
              {proposals.length > 0 && (
                <motion.div className="well well--sky nt-proposals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ type: 'spring', bounce: 0, duration: 0.35 }}>
                  <div className="row between">
                    <span className="t-foot t-strong">{t('Propozycje mentora', 'Mentor’s proposals')}</span>
                    <button className="btn btn--ghost btn--sm" onClick={() => { proposals.forEach((pr) => addStep(pr.scope, pr.title)); setProposals([]); haptic('success') }}>
                      {t('Dodaj wszystkie', 'Add all')}
                    </button>
                  </div>
                  {proposals.map((pr, i) => (
                    <div key={`${pr.title}-${i}`} className="nt-proposal">
                      <span className="pill pill--deep">{t(SCOPES.find((s) => s.scope === pr.scope)!.pl, SCOPES.find((s) => s.scope === pr.scope)!.en)}</span>
                      <span className="nt-proposal__text">{pr.title}</span>
                      <button className="icon-btn icon-btn--sm" onClick={() => accept(i)} aria-label={t('Dodaj krok', 'Add step')}><Icon name="plus" /></button>
                      <button className="icon-btn icon-btn--sm icon-btn--plain" onClick={() => setProposals((ps) => ps.filter((_, j) => j !== i))} aria-label={t('Odrzuć', 'Dismiss')}><Icon name="close" /></button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {SCOPES.map(({ scope, pl, en }) => {
            const mine = steps.filter((s) => s.scope === scope)
            return (
              <section key={scope} className="nt-steps">
                <div className="nt-steps__head">
                  <h3 className="nt-steps__title">{t(pl, en)}</h3>
                  {mine.length > 0 && <span className="nt-steps__count">{mine.filter((s) => s.done).length}/{mine.length}</span>}
                </div>
                <AnimatePresence initial={false}>
                  {mine.map((s) => (
                    <motion.div key={s.id} layout className="nt-step well" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }}>
                      <button className="nt-step__check" role="checkbox" aria-checked={s.done} aria-label={s.title} onClick={() => toggle(s)}>
                        {s.done && <Icon name="check" stroke={2.4} />}
                      </button>
                      <span className={`nt-step__text ${s.done ? 'nt-step__text--done' : ''}`}>{s.title}</span>
                      <button className="icon-btn icon-btn--sm icon-btn--plain" onClick={() => removeStep(s)} aria-label={t('Usuń krok', 'Delete step')}>
                        <Icon name="trash" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <form
                  className="nt-add"
                  onSubmit={(e) => {
                    e.preventDefault()
                    addStep(scope, drafts[scope])
                    setDrafts((d) => ({ ...d, [scope]: '' }))
                  }}
                >
                  <input
                    className="input"
                    placeholder={t('Dodaj krok', 'Add a step')}
                    value={drafts[scope]}
                    onChange={(e) => setDrafts((d) => ({ ...d, [scope]: e.target.value }))}
                    enterKeyHint="done"
                    maxLength={140}
                  />
                  <button className="icon-btn" type="submit" aria-label={t('Dodaj krok', 'Add step')} disabled={!drafts[scope].trim()}>
                    <Icon name="plus" />
                  </button>
                </form>
              </section>
            )
          })}

          <div className="nt-foot">
            <span className="t-caption t-3">{t('Usuwa cel razem z krokami.', 'Deletes the goal and its steps.')}</span>
            <button className="btn btn--sm btn--danger" onClick={removeGoal}>
              <Icon name="trash" />
              {t('Usuń cel', 'Delete goal')}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
