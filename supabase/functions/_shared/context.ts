// Builds the mentor's view of Ro's data. Queries run with the caller's JWT, so RLS
// guarantees only Ro's own rows are read.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

const TZ = 'Europe/Warsaw'

export function warsawNow() {
  const now = new Date()
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'long' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  const date = `${parts.year}-${parts.month}-${parts.day}`
  return { now, date, time: `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`, hour: Number(parts.hour) % 24, weekday: parts.weekday as string }
}

export function addDays(date: string, n: number) {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

export async function loadSnapshot(sb: SupabaseClient) {
  const { date } = warsawNow()
  const from14 = addDays(date, -13)
  const from30 = addDays(date, -29)
  const month = date.slice(0, 7)
  const q = (t: string) => sb.from(t).select('*')
  const [settings, facts, habits, logs, streaks, relapses, triggers, prios, blocks, goals, steps, oaths, incomes, expenses, cats, budgets, interviews, notes, ideas, leads, focus] =
    await Promise.all([
      q('settings').limit(1),
      q('profile_facts').order('created_at', { ascending: false }).limit(120),
      q('habits').eq('archived', false).order('sort'),
      q('habit_logs').gte('date', from14),
      q('streaks').order('sort'),
      q('relapses').gte('at', from30 + 'T00:00:00Z').order('at', { ascending: false }),
      q('triggers_log').gte('at', from30 + 'T00:00:00Z').order('at', { ascending: false }).limit(40),
      q('priorities').gte('date', addDays(date, -1)).order('sort'),
      q('calendar_blocks').eq('date', date).order('start_min'),
      q('goals').neq('status', 'done').order('sort'),
      q('goal_steps').eq('done', false).order('sort').limit(60),
      q('oaths').order('created_at', { ascending: false }).limit(10),
      q('incomes').gte('date', month + '-01'),
      q('expenses').gte('date', month + '-01'),
      q('categories'),
      q('budgets').eq('month', month).limit(1),
      q('daily_interviews').order('date', { ascending: false }).limit(3),
      q('notes').order('created_at', { ascending: false }).limit(8),
      q('ideas').order('created_at', { ascending: false }).limit(10),
      q('leads_log').gte('date', addDays(date, -6)),
      q('measurements').eq('kind', 'focus').gte('date', addDays(date, -6)),
    ])
  return {
    date,
    settings: (settings.data?.[0] ?? {}) as Row,
    facts: (facts.data ?? []) as Row[],
    habits: (habits.data ?? []) as Row[],
    logs: (logs.data ?? []) as Row[],
    streaks: (streaks.data ?? []) as Row[],
    relapses: (relapses.data ?? []) as Row[],
    triggers: (triggers.data ?? []) as Row[],
    prios: (prios.data ?? []) as Row[],
    blocks: (blocks.data ?? []) as Row[],
    goals: (goals.data ?? []) as Row[],
    steps: (steps.data ?? []) as Row[],
    oaths: (oaths.data ?? []) as Row[],
    incomes: (incomes.data ?? []) as Row[],
    expenses: (expenses.data ?? []) as Row[],
    cats: (cats.data ?? []) as Row[],
    budget: (budgets.data?.[0] ?? null) as Row | null,
    interviews: (interviews.data ?? []) as Row[],
    notes: (notes.data ?? []) as Row[],
    ideas: (ideas.data ?? []) as Row[],
    leads: (leads.data ?? []) as Row[],
    focus: (focus.data ?? []) as Row[],
  }
}

export type Snapshot = Awaited<ReturnType<typeof loadSnapshot>>

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Compact, factual text the model reads before Ro's message. Numbers only from rows. */
export function snapshotText(s: Snapshot, context: string): string {
  const { time, weekday } = warsawNow()
  const st = s.settings
  const paused = st.mentor_paused_until && new Date(st.mentor_paused_until) > new Date()
  const lines: string[] = []
  lines.push(`[DANE Z APKI — ${s.date} ${weekday} ${time}, strefa Europe/Warsaw]`)
  lines.push(`Język: ${st.lang ?? 'pl'} · Intensywność: ${st.intensity ?? 10}/10${paused ? ' · PAUZA MENTORA aktywna' : ''} · Kontekst: ${context}`)
  if (st.last_open_at) lines.push(`Ostatnie otwarcie apki przed teraz: ${st.last_open_at}`)

  if (s.facts.length) {
    lines.push('\nPROFIL RO (pamięć):')
    for (const f of s.facts.slice(0, 80)) lines.push(`- [${f.category}] ${f.text}`)
  }

  lines.push('\nNAWYKI (dziś / cel; ostatnie 7 dni wykonane):')
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(s.date, -i))
  for (const h of s.habits) {
    const val = (d: string) => s.logs.filter((l) => l.habit_id === h.id && l.date === d).reduce((a, l) => a + Number(l.value), 0)
    if (h.period === 'week') {
      const wk = last7.reduce((a, d) => a + val(d), 0)
      lines.push(`- ${h.name}: ${wk}/${h.target} w ostatnich 7 dniach (cel tygodniowy)`)
    } else {
      const done7 = last7.filter((d) => val(d) >= Number(h.target)).length
      lines.push(`- ${h.name}: dziś ${val(s.date)}${h.unit ? ' ' + h.unit : ''} / ${h.target}${h.unit ? ' ' + h.unit : ''}; dni z celem w 7: ${done7}/7`)
    }
  }

  if (s.streaks.length) {
    lines.push('\nOGRANICZENIA (czyste dni / rekord):')
    for (const k of s.streaks) {
      const clean = daysSince(k.started_at)
      lines.push(`- ${k.name}: ${clean} dni (rekord ${Math.max(k.best_days, clean)})${k.daily_limit_minutes ? `, limit ${k.daily_limit_minutes} min/dzień` : ''}`)
    }
    if (s.relapses.length) lines.push(`Potknięcia w 30 dniach: ${s.relapses.length} (ostatnie: ${s.relapses[0].at})`)
  }
  if (s.triggers.length) {
    const won = s.triggers.filter((t) => t.outcome === 'won').length
    lines.push(`Dziennik wyzwalaczy (30 dni): ${s.triggers.length} wpisów, wygrane ${won}. Ostatnie:`)
    for (const t of s.triggers.slice(0, 6)) lines.push(`- ${t.at} · siła ${t.intensity}/10 · miejsce: ${t.place || '—'} · przed: ${t.before || '—'} · wynik: ${t.outcome}`)
  }

  const today = s.prios.filter((p) => p.date === s.date)
  lines.push(`\nPRIORYTETY DZIŚ: ${today.length ? today.map((p) => `${p.done ? '[x]' : '[ ]'} ${p.text}`).join(' | ') : 'brak — nie ustalone'}`)
  const yest = s.prios.filter((p) => p.date === addDays(s.date, -1))
  if (yest.length) lines.push(`Wczoraj: ${yest.filter((p) => p.done).length}/${yest.length} zrobione`)
  if (s.blocks.length) lines.push(`KALENDARZ DZIŚ: ${s.blocks.map((b) => `${hhmm(b.start_min)}–${hhmm(b.end_min)} ${b.title}${b.done ? ' (zrobione)' : ''}${b.proposed ? ' (propozycja)' : ''}`).join('; ')}`)

  const openOaths = s.oaths.filter((o) => o.status === 'open')
  if (openOaths.length) lines.push(`OTWARTE PRZYSIĘGI: ${openOaths.map((o) => `„${o.text}” (termin ${o.due_at}${new Date(o.due_at) < new Date() ? ', PO TERMINIE' : ''})`).join('; ')}`)
  const broken = s.oaths.filter((o) => o.status === 'broken').length
  const kept = s.oaths.filter((o) => o.status === 'kept').length
  if (kept || broken) lines.push(`Ostatnie przysięgi: dotrzymane ${kept}, złamane ${broken}`)

  if (s.goals.length) {
    lines.push('\nCELE:')
    for (const g of s.goals) {
      const open = s.steps.filter((x) => x.goal_id === g.id).slice(0, 3).map((x) => x.title)
      lines.push(`- ${g.title}${g.metric ? ` (${g.metric})` : ''}${g.deadline ? `, termin ${g.deadline}` : ''}${open.length ? ` · otwarte kroki: ${open.join('; ')}` : ''}`)
    }
  }

  const inc = s.incomes.reduce((a, r) => a + Number(r.amount), 0)
  const exp = s.expenses.reduce((a, r) => a + Number(r.amount), 0)
  const goal = s.budget?.income_goal ?? 10000
  lines.push(`\nFINANSE (miesiąc ${s.date.slice(0, 7)}): przychód ${inc.toFixed(0)} zł / cel ${goal} zł; wydatki ${exp.toFixed(0)} zł${s.budget?.total_limit ? ` / limit ${s.budget.total_limit} zł` : ''}`)
  const byCat = new Map<string, number>()
  for (const e of s.expenses) byCat.set(e.category_id, (byCat.get(e.category_id) ?? 0) + Number(e.amount))
  const topCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (topCats.length) lines.push(`Największe kategorie: ${topCats.map(([id, v]) => `${s.cats.find((c) => c.id === id)?.name ?? '?'} ${v.toFixed(0)} zł`).join(', ')}`)
  const recent = [...s.expenses].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6)
  if (recent.length) lines.push(`Ostatnie wydatki: ${recent.map((e) => `${e.date} ${Number(e.amount).toFixed(0)} zł ${s.cats.find((c) => c.id === e.category_id)?.name ?? ''}${e.note ? ` (${e.note})` : ''}`).join('; ')}`)

  if (s.leads.length) {
    const sum = (k: string) => s.leads.reduce((a, r) => a + Number(r[k] ?? 0), 0)
    lines.push(`Client acquisition 7 dni: wiadomości ${sum('messages')}, leady ${sum('leads')}, odpowiedzi ${sum('replies')}, klienci ${sum('clients')}, przychód z leadów ${sum('revenue')} zł`)
  }
  const focusMin = s.focus.reduce((a, r) => a + Number(r.value ?? 0), 0)
  if (focusMin) lines.push(`Skupienie (pomodoro) 7 dni: ${focusMin} min`)

  const iv = s.interviews.find((i) => i.kind === 'morning')
  if (iv) lines.push(`\nOSTATNI PORANNY WYWIAD (${iv.date}, o dniu ${iv.about_date}): ${JSON.stringify(iv.answers)}`)
  if (s.notes.length) {
    lines.push('\nOSTATNIE NOTATKI:')
    for (const n of s.notes.slice(0, 6)) lines.push(`- ${n.title ? n.title + ': ' : ''}${String(n.body).slice(0, 220).replace(/\s+/g, ' ')}${n.tags?.length ? ` [${n.tags.join(', ')}]` : ''}`)
  }
  if (s.ideas.length) lines.push(`POMYSŁY: ${s.ideas.map((i) => i.title).join('; ')}`)
  lines.push('[KONIEC DANYCH]')
  return lines.join('\n')
}
