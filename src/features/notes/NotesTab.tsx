import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { navigate } from '../../app/nav'
import { db, useRows } from '../../lib/db'
import { fmtDay, relTime, todayKey, dayKey } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { askMentor } from '../../lib/mentor'
import { useLang, useT } from '../../lib/settings'
import type { Note } from '../../lib/types'
import { Icon } from '../../ui/Icon'
import { Card, Empty, Segmented, Toggle } from '../../ui/kit'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/Toast'

type Kind = Note['kind']

export const KIND_LABEL: Record<Kind, [string, string]> = {
  journal: ['Dziennik', 'Journal'],
  idea: ['Pomysł', 'Idea'],
  business: ['Biznes', 'Business'],
  other: ['Inne', 'Other'],
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')

export function parseTags(s: string): string[] {
  return [...new Set(s.split(/[,#\n]/).map((x) => x.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean))].slice(0, 12)
}

function splitNote(n: Note): { title: string; preview: string } {
  if (n.title?.trim()) return { title: n.title.trim(), preview: n.body.trim() }
  const [first, ...rest] = n.body.trim().split('\n')
  return { title: first || '—', preview: rest.join(' ').trim() }
}

export function NotesTab({ newTick }: { newTick: number }) {
  const t = useT()
  const lang = useLang()
  const notes = useRows('notes')
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [editing, setEditing] = useState<Note | 'new' | null>(null)

  useEffect(() => {
    if (newTick > 0) setEditing('new')
  }, [newTick])

  const tags = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of notes) for (const tg of n.tags ?? []) m.set(tg, (m.get(tg) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  }, [notes])

  const list = useMemo(() => {
    const nq = norm(q.trim())
    return notes
      .filter((n) => !tag || (n.tags ?? []).includes(tag))
      .filter((n) => !nq || norm(`${n.title ?? ''} ${n.body} ${(n.tags ?? []).join(' ')}`).includes(nq))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))
  }, [notes, q, tag])

  const when = (n: Note) => {
    const iso = n.updated_at ?? n.created_at
    const d = dayKey(new Date(iso))
    return d === todayKey() ? relTime(iso, lang) : fmtDay(d, lang, { day: 'numeric', month: 'short' })
  }

  const askInsights = () => {
    const recent = [...notes].sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at)).slice(0, 12)
    if (!recent.length) return
    const lines = recent.map((n) => {
      const { title, preview } = splitNote(n)
      return `- [${t(KIND_LABEL[n.kind][0], KIND_LABEL[n.kind][1])}] ${title}${preview ? `: ${preview.slice(0, 220)}` : ''}`
    })
    const message =
      lang === 'en'
        ? `Here are my latest notes:\n${lines.join('\n')}\n\nWhat patterns do you see, what am I avoiding, and what is the one thing I should act on this week?`
        : `Oto moje ostatnie notatki:\n${lines.join('\n')}\n\nJakie widzisz wzorce, czego unikam i jaką jedną rzecz mam z tego zrobić w tym tygodniu?`
    haptic('tap')
    void askMentor({ context: 'chat', message })
    navigate('mentor')
  }

  return (
    <motion.div className="nt-pane" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show">
      <motion.div className="stack gap-3" variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0, duration: 0.5 } } }}>
        <label className="nt-search">
          <Icon name="search" />
          <input
            className="input"
            type="search"
            placeholder={t('Szukaj w notatkach', 'Search notes')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            enterKeyHint="search"
            aria-label={t('Szukaj w notatkach', 'Search notes')}
          />
        </label>
        {tags.length > 0 && (
          <div className="nt-scroll" role="group" aria-label={t('Tagi', 'Tags')}>
            <button className="chip" aria-pressed={tag === null} onClick={() => { haptic('select'); setTag(null) }}>
              {t('Wszystkie', 'All')}
            </button>
            {tags.map((tg) => (
              <button key={tg} className="chip" aria-pressed={tag === tg} onClick={() => { haptic('select'); setTag(tag === tg ? null : tg) }}>
                #{tg}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      <Card className="nt-card">
        {list.length === 0 ? (
          <Empty>
            {notes.length === 0
              ? t('Pusto. Zapisuj, co myślisz — mentor wyciągnie z tego wnioski.', 'Empty. Write down what you think — the mentor will draw conclusions.')
              : t('Nic nie pasuje do wyszukiwania.', 'Nothing matches the search.')}
          </Empty>
        ) : (
          <div className="list">
            {list.map((n) => {
              const { title, preview } = splitNote(n)
              return (
                <button key={n.id} className="lrow lrow--tap nt-note" onClick={() => setEditing(n)}>
                  <span className="nt-note__main">
                    <span className="nt-note__title">{title}</span>
                    {preview && <span className="nt-note__body">{preview}</span>}
                    <span className="nt-note__meta">
                      <span className="pill">{t(KIND_LABEL[n.kind][0], KIND_LABEL[n.kind][1])}</span>
                      {(n.tags ?? []).slice(0, 3).map((tg) => (
                        <span key={tg}>#{tg}</span>
                      ))}
                      <span>· {when(n)}</span>
                    </span>
                  </span>
                  {n.pinned && <Icon name="pin" className="nt-note__pin" />}
                </button>
              )
            })}
          </div>
        )}
      </Card>

      <Card className="pad stack gap-3">
        <p className="t-sub t-2 t-pretty">
          {t('Mentor przeczyta ostatnie notatki i powie, co z nich wynika.', 'The mentor reads your latest notes and tells you what follows from them.')}
        </p>
        <button className="btn btn--ink" style={{ alignSelf: 'flex-start' }} onClick={askInsights} disabled={!notes.length}>
          <Icon name="mentor" />
          {t('Wnioski mentora', "Mentor's take")}
        </button>
      </Card>

      <NoteSheet note={editing} onClose={() => setEditing(null)} />
    </motion.div>
  )
}

/** Editor. Like Apple Notes: closing the sheet (button or swipe) saves; an empty new note is discarded. */
function NoteSheet({ note, onClose }: { note: Note | 'new' | null; onClose: () => void }) {
  const t = useT()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [kind, setKind] = useState<Kind>('journal')
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    if (!note) return
    if (note === 'new') {
      setTitle('')
      setBody('')
      setTags('')
      setKind('journal')
      setPinned(false)
    } else {
      setTitle(note.title ?? '')
      setBody(note.body)
      setTags((note.tags ?? []).join(', '))
      setKind(note.kind)
      setPinned(!!note.pinned)
    }
  }, [note])

  const parsed = parseTags(tags)

  const commit = () => {
    if (!note) return
    const data = { title: title.trim() || null, body: body.trim(), tags: parsed, kind, pinned }
    if (note === 'new') {
      if (data.body || data.title) {
        db.insert('notes', { ...data, body: data.body })
        haptic('success')
      }
    } else {
      const changed =
        (note.title ?? null) !== data.title || note.body !== data.body || note.kind !== kind || !!note.pinned !== pinned || (note.tags ?? []).join() !== parsed.join()
      if (changed) db.update('notes', note.id, data)
    }
    onClose()
  }

  const remove = () => {
    if (!note || note === 'new') return
    const row = note
    db.remove('notes', row.id)
    haptic('warning')
    toast(t('Notatka usunięta', 'Note deleted'), { icon: 'trash', action: { label: t('Cofnij', 'Undo'), run: () => db.insert('notes', { ...row }) } })
    onClose()
  }

  return (
    <Sheet
      open={!!note}
      onClose={commit}
      tall
      title={note === 'new' ? t('Nowa notatka', 'New note') : t('Notatka', 'Note')}
      action={<button className="btn btn--sm btn--ink" onClick={commit}>{t('Gotowe', 'Done')}</button>}
    >
      <div className="nt-editor">
        <input className="nt-title-input" placeholder={t('Tytuł', 'Title')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label={t('Tytuł', 'Title')} />
        <textarea
          className="textarea nt-body-input"
          placeholder={t('Co masz w głowie?', "What's on your mind?")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label={t('Treść', 'Body')}
        />
        <Segmented
          label={t('Rodzaj', 'Kind')}
          value={kind}
          onChange={setKind}
          options={(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ value: k, label: t(KIND_LABEL[k][0], KIND_LABEL[k][1]) }))}
        />
        <label className="field">
          <span className="field__label">{t('Tagi (oddziel przecinkiem)', 'Tags (comma separated)')}</span>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('np. klienci, apka', 'e.g. clients, app')} autoCapitalize="none" />
        </label>
        {parsed.length > 0 && (
          <div className="nt-tags">
            {parsed.map((tg) => (
              <span key={tg} className="pill pill--sky">#{tg}</span>
            ))}
          </div>
        )}
        <div className="nt-row well">
          <span className="nt-row__label" style={{ paddingLeft: 12 }}>{t('Przypnij na górze', 'Pin to top')}</span>
          <span style={{ paddingRight: 8 }}>
            <Toggle checked={pinned} onChange={setPinned} label={t('Przypnij', 'Pin')} />
          </span>
        </div>
        {note !== 'new' && note && (
          <div className="nt-foot">
            <span className="t-caption t-3">{t('Zamknięcie zapisuje zmiany.', 'Closing saves your changes.')}</span>
            <button className="btn btn--sm btn--danger" onClick={remove}>
              <Icon name="trash" />
              {t('Usuń', 'Delete')}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
