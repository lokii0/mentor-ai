import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { db, useRows } from '../../lib/db'
import { haptic } from '../../lib/haptics'
import { mentorTask } from '../../lib/mentor'
import { useT } from '../../lib/settings'
import type { Idea } from '../../lib/types'
import { Icon } from '../../ui/Icon'
import { Bar, Card, Empty } from '../../ui/kit'
import { Orb } from '../../ui/Orb'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/Toast'

const STATUS: Record<Idea['status'], [string, string]> = {
  new: ['Nowy', 'New'],
  evaluated: ['Oceniony', 'Evaluated'],
  testing: ['Testuję', 'Testing'],
  dropped: ['Odrzucony', 'Dropped'],
}
const ORDER: Record<Idea['status'], number> = { testing: 0, evaluated: 1, new: 2, dropped: 3 }

export function IdeasTab({ newTick }: { newTick: number }) {
  const t = useT()
  const ideas = useRows('ideas')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (newTick > 0) setCreating(true)
  }, [newTick])

  const list = [...ideas].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.potential ?? -1) - (a.potential ?? -1) || b.created_at.localeCompare(a.created_at))
  const open = ideas.find((i) => i.id === openId) ?? null

  return (
    <motion.div className="nt-pane" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show">
      <Card className="nt-card">
        <div className="nt-card__head">
          <h2 className="nt-card__title">{t('Baza pomysłów', 'Idea bank')}</h2>
          <span className="nt-card__aside">{ideas.length}</span>
        </div>
        {list.length === 0 ? (
          <Empty>{t('Zapisz pomysł na biznes. Mentor oceni potencjał, ryzyko i pierwszy krok.', 'Save a business idea. The mentor rates potential, risk and the first step.')}</Empty>
        ) : (
          <div className="list">
            {list.map((i) => {
              const evaluated = i.potential != null && i.risk != null
              const sub = evaluated
                ? `${t('potencjał', 'potential')} ${i.potential}/10 · ${t('ryzyko', 'risk')} ${i.risk}/10${i.time_to_first_sale ? ` · ${i.time_to_first_sale}` : ''}`
                : i.description.slice(0, 90) || t('Bez opisu', 'No description')
              return (
                <button key={i.id} className="lrow lrow--tap" onClick={() => setOpenId(i.id)} style={i.status === 'dropped' ? { opacity: 0.55 } : undefined}>
                  <Icon name="bulb" className="lrow__icon" />
                  <span className="lrow__main">
                    <span className="lrow__title">{i.title}</span>
                    <span className="lrow__sub">{sub}</span>
                  </span>
                  <span className={`pill ${i.status === 'testing' ? 'pill--sky' : i.status === 'evaluated' ? 'pill--deep' : ''}`}>{t(STATUS[i.status][0], STATUS[i.status][1])}</span>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      <IdeaSheet idea={open} onClose={() => setOpenId(null)} />
      <NewIdeaSheet open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpenId(id) }} />
    </motion.div>
  )
}

function NewIdeaSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const t = useT()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle('')
    setDescription('')
  }, [open])

  const save = () => {
    if (!title.trim()) return
    const row = db.insert('ideas', { title: title.trim(), description: description.trim(), status: 'new', potential: null, risk: null, first_step: null, time_to_first_sale: null, mentor_verdict: null })
    haptic('success')
    onCreated(row.id)
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('Nowy pomysł', 'New idea')} action={<button className="btn btn--sm btn--ink" onClick={save} disabled={!title.trim()}>{t('Dodaj', 'Add')}</button>}>
      <div className="stack gap-4">
        <label className="field">
          <span className="field__label">{t('Pomysł w jednym zdaniu', 'The idea in one sentence')}</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t('np. chatbot AI dla gabinetów stomatologicznych', 'e.g. AI chatbot for dental clinics')} />
        </label>
        <label className="field">
          <span className="field__label">{t('Dla kogo, jaki problem, jak zarabia', 'Who for, what problem, how it earns')}</span>
          <textarea className="textarea" style={{ minHeight: 140 }} value={description} onChange={(e) => setDescription(e.target.value)} />
          <span className="field__hint">{t('Im konkretniej, tym ostrzejsza ocena mentora.', 'The more specific, the sharper the mentor’s verdict.')}</span>
        </label>
      </div>
    </Sheet>
  )
}

function IdeaSheet({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const t = useT()
  const last = useRef<Idea | null>(null)
  if (idea) last.current = idea
  const i = idea ?? last.current

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const id = idea?.id
  useEffect(() => {
    if (!idea) return
    setTitle(idea.title)
    setDescription(idea.description)
    setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const close = () => {
    if (idea && (title.trim() !== idea.title || description.trim() !== idea.description))
      db.update('ideas', idea.id, { title: title.trim() || idea.title, description: description.trim() })
    onClose()
  }

  const evaluate = async () => {
    if (!idea) return
    const d = description.trim()
    const ti = title.trim() || idea.title
    if (ti !== idea.title || d !== idea.description) db.update('ideas', idea.id, { title: ti, description: d })
    setBusy(true)
    const res = await mentorTask('evaluate_idea', { title: ti, description: d })
    setBusy(false)
    if (!res) {
      toast(t('Ocena wymaga mentora AI — podłącz backend (Supabase).', 'Rating needs the AI mentor — connect the backend (Supabase).'), { icon: 'cloud' })
      return
    }
    db.update('ideas', idea.id, {
      potential: res.potential,
      risk: res.risk,
      first_step: res.first_step,
      time_to_first_sale: res.time_to_first_sale,
      mentor_verdict: res.verdict,
      status: idea.status === 'new' ? 'evaluated' : idea.status,
    })
    haptic('success')
  }

  const remove = () => {
    if (!idea) return
    const row = idea
    db.remove('ideas', row.id)
    haptic('warning')
    toast(t('Pomysł usunięty', 'Idea deleted'), { icon: 'trash', action: { label: t('Cofnij', 'Undo'), run: () => db.insert('ideas', { ...row }) } })
    onClose()
  }

  const evaluated = i?.potential != null && i?.risk != null

  return (
    <Sheet open={!!idea} onClose={close} tall title={t('Pomysł', 'Idea')} action={<button className="btn btn--sm btn--ink" onClick={close}>{t('Gotowe', 'Done')}</button>}>
      {i && (
        <div className="stack gap-5">
          <input className="nt-title-input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label={t('Pomysł', 'Idea')} maxLength={120} />
          <label className="field">
            <span className="field__label">{t('Opis', 'Description')}</span>
            <textarea className="textarea" style={{ minHeight: 120 }} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <div className="field">
            <span className="field__label">{t('Status', 'Status')}</span>
            <div className="chips">
              {(Object.keys(STATUS) as Idea['status'][]).map((s) => (
                <button key={s} className="chip" aria-pressed={i.status === s} onClick={() => { haptic('select'); db.update('ideas', i.id, { status: s }) }}>
                  {t(STATUS[s][0], STATUS[s][1])}
                </button>
              ))}
            </div>
          </div>

          {evaluated && (
            <motion.div className="stack gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.45 }}>
              <div className="well nt-eval">
                <div className="nt-eval__item">
                  <span className="nt-eval__label">{t('Potencjał', 'Potential')} <b>{i.potential}/10</b></span>
                  <Bar value={(i.potential ?? 0) / 10} tone="sky" />
                </div>
                <div className="nt-eval__item">
                  <span className="nt-eval__label">{t('Ryzyko', 'Risk')} <b style={(i.risk ?? 0) >= 7 ? { color: 'var(--pink-ink)' } : undefined}>{i.risk}/10</b></span>
                  <Bar value={(i.risk ?? 0) / 10} tone={(i.risk ?? 0) >= 7 ? 'pink' : 'deep'} />
                </div>
                {i.first_step && (
                  <div className="nt-eval__item nt-eval__wide">
                    <span className="nt-eval__label">{t('Pierwszy krok', 'First step')}</span>
                    <p>{i.first_step}</p>
                  </div>
                )}
                {i.time_to_first_sale && (
                  <div className="nt-eval__item nt-eval__wide">
                    <span className="nt-eval__label">{t('Do pierwszej sprzedaży', 'To the first sale')}</span>
                    <p>{i.time_to_first_sale}</p>
                  </div>
                )}
              </div>
              {i.mentor_verdict && (
                <div className="nt-verdict">
                  <Orb size={26} />
                  <p>{i.mentor_verdict}</p>
                </div>
              )}
            </motion.div>
          )}

          <button className="btn btn--ink" style={{ alignSelf: 'flex-start' }} onClick={evaluate} disabled={busy || !title.trim()}>
            {busy ? <Orb size={18} thinking /> : <Icon name="mentor" />}
            {busy ? t('Mentor ocenia…', 'Mentor is rating…') : evaluated ? t('Oceń ponownie', 'Rate again') : t('Oceń pomysł', 'Rate the idea')}
          </button>

          <div className="nt-foot">
            <span className="t-caption t-3">{t('Zamknięcie zapisuje zmiany.', 'Closing saves your changes.')}</span>
            <button className="btn btn--sm btn--danger" onClick={remove}>
              <Icon name="trash" />
              {t('Usuń', 'Delete')}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
