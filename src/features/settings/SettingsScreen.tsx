import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { lockNow } from '../../app/lock'
import { db, dbMode, useRows } from '../../lib/db'
import { fmtTime, todayKey } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { bioSupported, disableBio, hasBio, registerBio, setPin, verifyPin } from '../../lib/pin'
import { disablePush, enablePush, pushState, type PushState } from '../../lib/push'
import { isMentorPaused, updateSettings, useSettings, useT } from '../../lib/settings'
import { supabase } from '../../lib/supabase'
import type { FactCategory, ProfileFact } from '../../lib/types'
import { Icon } from '../../ui/Icon'
import { Range, Segmented, Toggle } from '../../ui/kit'
import { rise } from '../../ui/motion'
import { Page } from '../../ui/Page'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/Toast'
import './settings.css'

const CATS: { value: FactCategory; pl: string; en: string }[] = [
  { value: 'life', pl: 'Życie', en: 'Life' },
  { value: 'goal', pl: 'Cele', en: 'Goals' },
  { value: 'weakness', pl: 'Słabości', en: 'Weak spots' },
  { value: 'trigger', pl: 'Wyzwalacze', en: 'Triggers' },
  { value: 'pattern', pl: 'Wzorce', en: 'Patterns' },
  { value: 'routine', pl: 'Rutyna', en: 'Routine' },
  { value: 'habit', pl: 'Nawyki', en: 'Habits' },
  { value: 'finance', pl: 'Finanse', en: 'Money' },
  { value: 'relationship', pl: 'Ludzie', en: 'People' },
  { value: 'other', pl: 'Inne', en: 'Other' },
]

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function Row({ icon, title, sub, children, onClick }: { icon: string; title: string; sub?: string; children?: React.ReactNode; onClick?: () => void }) {
  const C = onClick ? 'button' : 'div'
  return (
    <C className={`lrow ${onClick ? 'lrow--tap' : ''}`} onClick={onClick}>
      <Icon name={icon} className="lrow__icon" />
      <div className="lrow__main">
        <span className="lrow__title" style={{ whiteSpace: 'normal' }}>{title}</span>
        {sub && <span className="lrow__sub" style={{ whiteSpace: 'normal' }}>{sub}</span>}
      </div>
      {children}
      {onClick && !children && <Icon name="chevronRight" className="lrow__chev" />}
    </C>
  )
}

export default function SettingsScreen() {
  const t = useT()
  const s = useSettings()
  const facts = useRows('profile_facts')
  const paused = isMentorPaused(s)
  const [push, setPush] = useState<PushState>('unsupported')
  const [bio, setBio] = useState({ supported: false, on: hasBio() })
  const [pinOpen, setPinOpen] = useState(false)
  const [fact, setFact] = useState<ProfileFact | 'new' | null>(null)
  const [wipeOpen, setWipeOpen] = useState(false)
  const [dns, setDns] = useState(s.dns_note ?? '')
  // Slider: local value while dragging, one write after it settles.
  const [intensity, setIntensity] = useState(s.intensity)
  useEffect(() => setIntensity(s.intensity), [s.intensity])
  useEffect(() => {
    if (intensity === s.intensity) return
    const id = setTimeout(() => updateSettings({ intensity }), 400)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intensity])

  useEffect(() => {
    void pushState().then(setPush)
    void bioSupported().then((supported) => setBio((b) => ({ ...b, supported })))
  }, [])

  const grouped = useMemo(() => CATS.map((c) => ({ ...c, items: facts.filter((f) => f.category === c.value) })).filter((g) => g.items.length), [facts])

  const pauseFor = (hours: number | 'tomorrow') => {
    const d = new Date()
    if (hours === 'tomorrow') {
      d.setDate(d.getDate() + 1)
      d.setHours(6, 0, 0, 0)
    } else d.setTime(d.getTime() + hours * 3600_000)
    haptic('select')
    updateSettings({ mentor_paused_until: d.toISOString() })
  }

  const pushLabel: Record<PushState, string> = {
    on: t('Włączone. Co 2 h między 6:00 a 23:00, neutralne treści.', 'On. Every 2 h between 6:00 and 23:00, neutral texts.'),
    off: t('Wyłączone.', 'Off.'),
    denied: t('Zablokowane w ustawieniach iOS. Włącz je w Ustawienia → Powiadomienia → mentor.ai.', 'Blocked in iOS settings. Allow them in Settings → Notifications → mentor.ai.'),
    'needs-install': t('Na iPhonie działają tylko z ekranu głównego: Udostępnij → Do ekranu początkowego.', 'On iPhone they only work from the Home Screen: Share → Add to Home Screen.'),
    'no-backend': t('Wymagają backendu (Supabase + klucze VAPID).', 'They need the backend (Supabase + VAPID keys).'),
    unsupported: t('Ta przeglądarka nie obsługuje Web Push.', 'This browser does not support Web Push.'),
  }

  const exportJson = async () => {
    const data = await db.exportAll()
    download(`mentor-ai-${todayKey()}.json`, JSON.stringify(data, null, 2), 'application/json')
    toast(t('Eksport gotowy', 'Export ready'), { icon: 'download' })
  }

  const exportCsv = async () => {
    const data = await db.exportAll()
    const cats = new Map((data.categories as { id: string; name: string }[]).map((c) => [c.id, c.name]))
    const rows = [
      ['type', 'date', 'amount', 'category', 'note'],
      ...(data.incomes as { date: string; amount: number; category_id: string; note?: string }[]).map((r) => ['income', r.date, r.amount, cats.get(r.category_id) ?? '', r.note ?? '']),
      ...(data.expenses as { date: string; amount: number; category_id: string; note?: string }[]).map((r) => ['expense', r.date, r.amount, cats.get(r.category_id) ?? '', r.note ?? '']),
    ]
    download(`mentor-ai-finanse-${todayKey()}.csv`, '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv')
    const habits = new Map((data.habits as { id: string; name: string }[]).map((h) => [h.id, h.name]))
    const logs = [['date', 'habit', 'value'], ...(data.habit_logs as { date: string; habit_id: string; value: number }[]).map((l) => [l.date, habits.get(l.habit_id) ?? '', l.value])]
    setTimeout(() => download(`mentor-ai-nawyki-${todayKey()}.csv`, '﻿' + logs.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv'), 400)
  }

  return (
    <Page title={t('Ustawienia', 'Settings')}>
      <motion.section variants={rise} className="glass st-card">
        <h2 className="st-title">{t('Mentor', 'Mentor')}</h2>
        <div className="st-block">
          <div className="row between">
            <span className="t-sub t-strong">{t('Intensywność', 'Intensity')}</span>
            <span className="t-num t-title3">{intensity}/10</span>
          </div>
          <Range value={intensity} min={1} max={10} label={t('Intensywność', 'Intensity')} fill={intensity >= 8 ? 'var(--pink)' : 'var(--sky)'} onChange={setIntensity} />
          <p className="st-note">{t('Ostro za zachowanie, nigdy za to, kim jesteś. Wyjątek bezpieczeństwa działa zawsze.', 'Hard on behaviour, never on who you are. The safety exception always applies.')}</p>
        </div>
        <div className="st-block">
          <span className="t-sub t-strong">{t('Pauza mentora', 'Pause the mentor')}</span>
          {paused ? (
            <div className="row between gap-3">
              <span className="t-sub t-2">{t(`Spokojny ton i brak powiadomień do ${fmtTime(s.mentor_paused_until!, 'pl')}`, `Calm tone and no pushes until ${fmtTime(s.mentor_paused_until!, 'en')}`)}</span>
              <button className="btn btn--ink btn--sm" onClick={() => updateSettings({ mentor_paused_until: null })}>{t('Wznów', 'Resume')}</button>
            </div>
          ) : (
            <div className="chips">
              <button className="chip" onClick={() => pauseFor(1)}>{t('1 godzina', '1 hour')}</button>
              <button className="chip" onClick={() => pauseFor(3)}>{t('3 godziny', '3 hours')}</button>
              <button className="chip" onClick={() => pauseFor('tomorrow')}>{t('Do jutra', 'Until tomorrow')}</button>
            </div>
          )}
        </div>
        <div className="st-block">
          <span className="t-sub t-strong">{t('Język', 'Language')}</span>
          <Segmented label={t('Język', 'Language')} value={s.lang} onChange={(v) => updateSettings({ lang: v })} options={[{ value: 'pl', label: 'Polski' }, { value: 'en', label: 'English' }]} />
        </div>
      </motion.section>

      <motion.section variants={rise} className="glass st-card">
        <div className="row between">
          <h2 className="st-title">{t('Profil Ro', 'Your profile')}</h2>
          <button className="btn btn--ghost btn--sm" onClick={() => setFact('new')}><Icon name="plus" /> {t('Dodaj', 'Add')}</button>
        </div>
        <p className="st-note">{t('Co mentor o Tobie wie. Z wywiadów, notatek i rozmów. Możesz to poprawić albo usunąć.', 'What the mentor knows about you, from interviews, notes and chats. Fix or delete anything.')}</p>
        {grouped.length === 0 ? (
          <p className="empty">{t('Profil jest pusty.', 'The profile is empty.')}</p>
        ) : (
          grouped.map((g) => (
            <div key={g.value} className="st-facts">
              <span className="st-facts__cat">{t(g.pl, g.en)}</span>
              <div className="list well">
                {g.items.map((f) => (
                  <button key={f.id} className="lrow lrow--tap" onClick={() => setFact(f)}>
                    <span className="lrow__main"><span className="st-fact">{f.text}</span></span>
                    <Icon name="chevronRight" className="lrow__chev" />
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </motion.section>

      <motion.section variants={rise} className="glass st-card">
        <h2 className="st-title">{t('Blokada i prywatność', 'Lock and privacy')}</h2>
        <div className="list">
          <Row icon="lock" title={t('Zmień kod PIN', 'Change PIN')} onClick={() => setPinOpen(true)} />
          {bio.supported && (
            <Row icon="faceid" title="Face ID" sub={t('Odblokowanie twarzą, kod jako zapas', 'Unlock with your face, the code as fallback')}>
              <Toggle
                label="Face ID"
                checked={bio.on}
                onChange={async (v) => {
                  if (v) {
                    const on = await registerBio()
                    setBio((b) => ({ ...b, on }))
                  } else {
                    disableBio()
                    setBio((b) => ({ ...b, on: false }))
                  }
                }}
              />
            </Row>
          )}
          <div className="lrow">
            <Icon name="timer" className="lrow__icon" />
            <div className="lrow__main"><span className="lrow__title">{t('Auto-blokada', 'Auto-lock')}</span></div>
            <div style={{ width: 200 }}>
              <Segmented label={t('Auto-blokada', 'Auto-lock')} value={String(s.autolock_min)} onChange={(v) => updateSettings({ autolock_min: Number(v) })} options={['1', '2', '3', '5'].map((v) => ({ value: v, label: `${v} min` }))} />
            </div>
          </div>
          <Row icon="lock" title={t('Zablokuj teraz', 'Lock now')} onClick={lockNow} />
        </div>
      </motion.section>

      <motion.section variants={rise} className="glass st-card">
        <h2 className="st-title">{t('Powiadomienia', 'Notifications')}</h2>
        <div className="row between gap-4">
          <p className="t-sub t-2 grow">{pushLabel[push]}</p>
          {(push === 'off' || push === 'on') && (
            <Toggle
              label={t('Powiadomienia', 'Notifications')}
              checked={push === 'on'}
              onChange={async (v) => setPush(v ? await enablePush() : await disablePush())}
            />
          )}
        </div>
      </motion.section>

      <motion.section variants={rise} className="glass st-card">
        <h2 className="st-title">{t('Blokada systemowa 18+', 'System-level 18+ blocking')}</h2>
        <p className="st-note">{t('Apka nie zablokuje stron w telefonie. Zanotuj, co masz włączone (np. NextDNS, CleanBrowsing, Czas przed ekranem z kodem u zaufanej osoby) — mentor będzie o tym pamiętał.', "The app can't block websites on the phone. Note what you have on (e.g. NextDNS, CleanBrowsing, Screen Time with a code held by someone you trust) — the mentor will remember.")}</p>
        <textarea className="textarea" value={dns} onChange={(e) => setDns(e.target.value)} onBlur={() => dns !== (s.dns_note ?? '') && updateSettings({ dns_note: dns.trim() || null })} placeholder={t('Co jest włączone?', 'What is enabled?')} aria-label={t('Notatka o blokadzie', 'Blocking note')} />
      </motion.section>

      <motion.section variants={rise} className="glass st-card">
        <h2 className="st-title">{t('Dane', 'Data')}</h2>
        <div className="list">
          <Row icon="cloud" title={dbMode === 'supabase' ? t('W chmurze (Supabase)', 'In the cloud (Supabase)') : t('Lokalnie na tym urządzeniu', 'On this device only')} sub={dbMode === 'supabase' ? t('Szyfrowane w tranzycie, dostęp tylko dla Ciebie (RLS).', 'Encrypted in transit, only you have access (RLS).') : t('Podłącz Supabase, żeby mieć kopię w chmurze.', 'Connect Supabase for a cloud copy.')} />
          <Row icon="download" title={t('Eksport JSON (wszystko)', 'Export JSON (everything)')} onClick={exportJson} />
          <Row icon="download" title={t('Eksport CSV (finanse i nawyki)', 'Export CSV (money and habits)')} onClick={exportCsv} />
          {supabase && <Row icon="logout" title={t('Wyloguj', 'Sign out')} onClick={() => void supabase!.auth.signOut()} />}
          <button className="lrow lrow--tap" onClick={() => setWipeOpen(true)}>
            <Icon name="trash" className="lrow__icon" style={{ color: 'var(--pink)' }} />
            <span className="lrow__main"><span className="lrow__title" style={{ color: 'var(--pink-ink)' }}>{t('Usuń wszystkie dane', 'Delete all data')}</span></span>
          </button>
        </div>
      </motion.section>

      <p className="st-foot">mentor.ai · v0.1 · {dbMode === 'supabase' ? 'cloud' : 'local'}</p>

      <PinSheet open={pinOpen} onClose={() => setPinOpen(false)} />
      <FactSheet fact={fact} onClose={() => setFact(null)} />
      <WipeSheet open={wipeOpen} onClose={() => setWipeOpen(false)} />
    </Page>
  )
}

function PinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [err, setErr] = useState('')
  const clean = (v: string) => v.replace(/\D/g, '').slice(0, 4)
  const save = async () => {
    if (!(await verifyPin(cur))) return setErr(t('Obecny kod się nie zgadza.', 'The current code is wrong.'))
    if (next.length !== 4) return setErr(t('Nowy kod ma 4 cyfry.', 'The new code has 4 digits.'))
    await setPin(next)
    haptic('success')
    toast(t('Kod zmieniony', 'Code changed'), { icon: 'lock' })
    setCur('')
    setNext('')
    setErr('')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('Zmień kod', 'Change code')}>
      <div className="stack gap-4">
        <label className="field">
          <span className="field__label">{t('Obecny kod', 'Current code')}</span>
          <input className="input input--num" type="password" inputMode="numeric" autoComplete="off" value={cur} onChange={(e) => setCur(clean(e.target.value))} />
        </label>
        <label className="field">
          <span className="field__label">{t('Nowy kod (4 cyfry)', 'New code (4 digits)')}</span>
          <input className="input input--num" type="password" inputMode="numeric" autoComplete="off" value={next} onChange={(e) => setNext(clean(e.target.value))} />
        </label>
        {err && <p className="t-foot t-pink" role="alert">{err}</p>}
        <button className="btn btn--accent btn--lg btn--block" disabled={cur.length !== 4 || next.length !== 4} onClick={save}>{t('Zapisz', 'Save')}</button>
      </div>
    </Sheet>
  )
}

function FactSheet({ fact, onClose }: { fact: ProfileFact | 'new' | null; onClose: () => void }) {
  const t = useT()
  const [text, setText] = useState('')
  const [cat, setCat] = useState<FactCategory>('other')
  useEffect(() => {
    if (fact && fact !== 'new') {
      setText(fact.text)
      setCat(fact.category)
    } else {
      setText('')
      setCat('other')
    }
  }, [fact])
  const save = () => {
    const v = text.trim()
    if (!v) return
    if (fact === 'new') db.insert('profile_facts', { text: v, category: cat, source: 'manual' })
    else if (fact) db.update('profile_facts', fact.id, { text: v, category: cat })
    haptic('success')
    onClose()
  }
  const remove = () => {
    if (!fact || fact === 'new') return
    const copy = fact
    db.remove('profile_facts', fact.id)
    onClose()
    toast(t('Usunięto z profilu', 'Removed from profile'), { action: { label: t('Cofnij', 'Undo'), run: () => db.insert('profile_facts', { id: copy.id, created_at: copy.created_at, text: copy.text, category: copy.category, source: copy.source }) } })
  }
  return (
    <Sheet open={!!fact} onClose={onClose} title={fact === 'new' ? t('Nowy fakt', 'New fact') : t('Fakt o Tobie', 'A fact about you')}>
      <div className="stack gap-4">
        <div className="chips">
          {CATS.map((c) => (
            <button key={c.value} className="chip" aria-pressed={cat === c.value} onClick={() => setCat(c.value)}>{t(c.pl, c.en)}</button>
          ))}
        </div>
        <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} aria-label={t('Treść', 'Text')} autoFocus />
        <div className="row gap-2">
          {fact !== 'new' && <button className="btn btn--danger grow" onClick={remove}><Icon name="trash" /> {t('Usuń', 'Delete')}</button>}
          <button className="btn btn--ink grow" disabled={!text.trim()} onClick={save}>{t('Zapisz', 'Save')}</button>
        </div>
      </div>
    </Sheet>
  )
}

function WipeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const word = t('USUŃ', 'DELETE')
  const [typed, setTyped] = useState('')
  const wipe = async () => {
    haptic('error')
    await db.wipe()
    localStorage.removeItem('mentor.onboarding.draft')
    location.reload()
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('Usunąć wszystko?', 'Delete everything?')}>
      <div className="stack gap-4">
        <p className="t-sub t-2">{t('Znikną nawyki, liczniki, finanse, notatki, rozmowy i profil. Tego nie da się cofnąć. Najpierw zrób eksport, jeśli chcesz kopię.', 'Habits, counters, money, notes, chats and the profile will be gone. This cannot be undone. Export first if you want a copy.')}</p>
        <label className="field">
          <span className="field__label">{t(`Wpisz ${word}, żeby potwierdzić`, `Type ${word} to confirm`)}</span>
          <input className="input" autoCapitalize="characters" autoCorrect="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </label>
        <button className="btn btn--accent btn--lg btn--block" disabled={typed.trim().toUpperCase() !== word} onClick={wipe}>{t('Usuń wszystkie dane', 'Delete all data')}</button>
      </div>
    </Sheet>
  )
}
