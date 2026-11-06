// mentor — the only place that talks to the Claude API.
// POST { mode: 'chat', context, message, user_message_id, lang }  → { reply: ChatMessage }
// POST { mode: 'task', task, payload, lang }                       → { result }
// Auth: the caller's Supabase JWT (verify_jwt on). All reads/writes go through RLS.
import Anthropic from 'npm:@anthropic-ai/sdk@1.6.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cors, json } from '../_shared/cors.ts'
import { CRISIS_NOTE, detectCrisis, REPLY_SCHEMA, SYSTEM_PROMPT } from '../_shared/prompt.ts'
import { loadSnapshot, snapshotText } from '../_shared/context.ts'
import { publishableKey } from '../_shared/keys.ts'

// Default per current guidance; set MENTOR_MODEL (e.g. claude-sonnet-5-5) to trade quality for cost.
const MODEL = Deno.env.get('MENTOR_MODEL') ?? 'claude-opus-5-5'
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

type Effort = 'low' | 'medium' | 'high'

/** One structured call. Server-side fallback re-runs a declined request on Anthropic's recommended model. */
async function ask<T>(opts: { messages: unknown[]; schema: object; effort: Effort; system?: string }): Promise<T | null> {
  const params = {
    model: MODEL,
    max_tokens: 16000,
    system: [{ type: 'text', text: opts.system ?? SYSTEM_PROMPT }],
    cache_control: { type: 'ephemeral' },
    messages: opts.messages,
    output_config: { effort: opts.effort, format: { type: 'json_schema', schema: opts.schema } },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  }
  // deno-lint-ignore no-explicit-any
  const res: any = await anthropic.beta.messages.create(params as any)
  if (res.stop_reason === 'refusal') {
    console.warn('[mentor] refusal', res.stop_details?.category)
    return null
  }
  const text = (res.content as { type: string; text?: string }[])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
  try {
    return JSON.parse(text) as T
  } catch {
    console.error('[mentor] unparsable output', res.stop_reason)
    return null
  }
}

interface ChatOut {
  reply: string
  stage: 'scold' | 'oath' | 'warm' | 'plan' | 'none'
  actions: { type: 'oath' | 'step' | 'priorities' | 'blocks'; text: string; due_at: string; items: string[]; blocks: { title: string; start: string; end: string; kind: string }[] }[]
  learned_facts: { category: string; text: string }[]
}

function toActions(a: ChatOut['actions']) {
  return a
    .map((x) => {
      if (x.type === 'oath' && x.text && !Number.isNaN(Date.parse(x.due_at))) return { type: 'oath', text: x.text, due_at: new Date(x.due_at).toISOString() }
      if (x.type === 'step' && x.text) return { type: 'step', text: x.text }
      if (x.type === 'priorities' && x.items.length) return { type: 'priorities', items: x.items.slice(0, 3) }
      if (x.type === 'blocks' && x.blocks.length) return { type: 'blocks', items: x.blocks }
      return null
    })
    .filter(Boolean)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, publishableKey(), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return json({ error: 'unauthorized' }, 401)

  const body = await req.json()
  try {
    if (body.mode === 'chat') return await chat(sb, body)
    if (body.mode === 'task') return await task(sb, body)
    return json({ error: 'mode' }, 400)
  } catch (e) {
    console.error('[mentor]', e)
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429)
    if (e instanceof Anthropic.APIError) return json({ error: 'upstream', status: e.status }, 502)
    return json({ error: 'internal' }, 500)
  }
})

// deno-lint-ignore no-explicit-any
async function chat(sb: any, body: { context: string; message: string; user_message_id: string; lang: string }) {
  const { context, message } = body
  const crisis = detectCrisis(message)

  const [{ data: hist }, snap] = await Promise.all([
    sb.from('chat_messages').select('role,content,context,created_at').order('created_at', { ascending: false }).limit(30),
    loadSnapshot(sb),
  ])

  await sb.from('chat_messages').upsert({
    id: body.user_message_id,
    role: 'user',
    content: message,
    context,
    meta: crisis ? { crisis: true } : null,
  })

  const history = ((hist ?? []) as { role: string; content: string }[])
    .reverse()
    .map((m) => ({ role: m.role === 'mentor' ? 'assistant' : 'user', content: m.content }))
  while (history.length && history[0].role !== 'user') history.shift()

  const messages: unknown[] = [
    ...history,
    {
      role: 'user',
      content: [
        { type: 'text', text: snapshotText(snap, context) },
        { type: 'text', text: `[kontekst: ${context}]\n${message}` },
      ],
    },
  ]
  if (crisis) messages.push({ role: 'system', content: CRISIS_NOTE })

  const out = await ask<ChatOut>({ messages, schema: REPLY_SCHEMA, effort: 'medium' })
  const lang = snap.settings.lang ?? body.lang
  const content =
    out?.reply ??
    (crisis
      ? lang === 'en'
        ? "I'm here. If you're in danger right now, call 112. You can also call 116 123 — the adult crisis line in Poland. Is there someone you trust you can call tonight?"
        : 'Jestem tu. Jeśli coś Ci teraz grozi, dzwoń na 112. Możesz też zadzwonić pod 116 123 — telefon zaufania dla dorosłych w kryzysie. Czy jest ktoś zaufany, do kogo możesz dziś zadzwonić?'
      : lang === 'en'
        ? "I couldn't answer that one. Rephrase it and send again."
        : 'Nie dałem rady na to odpowiedzieć. Napisz to inaczej i wyślij jeszcze raz.')

  const facts = (out?.learned_facts ?? []).filter((f) => f.text?.trim()).slice(0, 3)
  if (facts.length) await sb.from('profile_facts').insert(facts.map((f) => ({ ...f, source: 'mentor' })))

  const { data: reply, error } = await sb
    .from('chat_messages')
    .insert({
      role: 'mentor',
      content,
      context,
      meta: { stage: crisis ? 'warm' : out?.stage ?? 'none', crisis: crisis || undefined, actions: crisis ? [] : toActions(out?.actions ?? []) },
    })
    .select()
    .single()
  if (error) throw error
  return json({ reply })
}

// ---------- Structured tasks ----------

const s = { type: 'string' }
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const arr = (items: unknown) => ({ type: 'array', items })
const BLOCK = obj({ title: s, start: s, end: s, kind: { type: 'string', enum: ['focus', 'habit', 'meeting', 'break', 'other'] } })

const TASKS: Record<string, { schema: object; effort: Effort; prompt: (p: any) => string }> = {
  onboarding_extract: {
    schema: obj({ facts: arr(obj({ category: { type: 'string', enum: ['life', 'goal', 'weakness', 'trigger', 'routine', 'finance', 'habit', 'pattern', 'relationship', 'other'] }, text: s })) }),
    effort: 'medium',
    prompt: (p) =>
      `Wywiad startowy z Ro (pytanie → odpowiedź, z sugerowaną kategorią). Zamień go na 8–25 krótkich, trwałych faktów o Ro do jego profilu (3. osoba, konkretnie, bez ocen). Nie dopisuj niczego, czego nie powiedział.\n\n${JSON.stringify(p.transcript)}`,
  },
  evaluate_idea: {
    schema: obj({ potential: { type: 'integer' }, risk: { type: 'integer' }, first_step: s, time_to_first_sale: s, verdict: s }),
    effort: 'high',
    prompt: (p) =>
      `Oceń pomysł na biznes Ro pod jego cele i sytuację z danych. potential i risk w skali 1–10. first_step: jedna czynność na dziś. time_to_first_sale: realistyczny czas do pierwszej sprzedaży (np. "2–3 tygodnie"). verdict: 2–4 zdania, szczerze, bez słodzenia.\n\nPomysł: ${p.title}\n${p.description}`,
  },
  weekly_review: {
    schema: obj({ feedback: s }),
    effort: 'medium',
    prompt: (p) =>
      `Przegląd niedzielny tygodnia od ${p.week_start}. Liczby z apki: ${JSON.stringify(p.stats)}\nPozytywy Ro: ${p.positives}\nNegatywy Ro: ${p.negatives}\nPlan Ro na następny tydzień: ${p.plan_next}\n\nDaj zwrot jak starszy brat: co było realnie dobre (tylko z dowodami w liczbach), co leżało, i 3 konkretne poprawki planu. Max 180 słów.`,
  },
  monthly_review: {
    schema: obj({ feedback: s, recommendations: s }),
    effort: 'medium',
    prompt: (p) =>
      `Podsumowanie miesiąca ${p.month}. Liczby z apki: ${JSON.stringify(p.stats)}\nfeedback: ocena miesiąca (nawyki, przychód vs cel 10 tys., wydatki, cele) — tylko na podstawie liczb. recommendations: 3–5 konkretnych rekomendacji na następny miesiąc, każda w nowej linii z myślnikiem.`,
  },
  plan_day: {
    schema: obj({ blocks: arr(BLOCK), steps: arr(s) }),
    effort: 'medium',
    prompt: (p) =>
      `Rozpisz dzień ${p.date} na bloki w kalendarzu (HH:MM, 06:00–23:00), tak żeby zrobić priorytety i nawyki. Nie nakładaj się na zajęte bloki. Bloki 25–90 min, przerwy uwzględnij. steps: dokładne kroki dzienne do priorytetów.\nPriorytety: ${JSON.stringify(p.priorities)}\nZajęte: ${JSON.stringify(p.busy)}`,
  },
  goal_breakdown: {
    schema: obj({ steps: arr(obj({ title: s, scope: { type: 'string', enum: ['milestone', 'week', 'day'] } })) }),
    effort: 'medium',
    prompt: (p) =>
      `Rozbij cel Ro na kroki: 2–4 kamienie milowe, 3–5 kroków na ten tydzień i 2–3 kroki na dziś. Krótko i wykonalnie.\nCel: ${p.title}${p.metric ? ` (${p.metric})` : ''}${p.deadline ? `, termin ${p.deadline}` : ''}\nIstniejące kroki (nie powtarzaj): ${JSON.stringify(p.existing)}`,
  },
}

// deno-lint-ignore no-explicit-any
async function task(sb: any, body: { task: string; payload: any }) {
  const def = TASKS[body.task]
  if (!def) return json({ error: 'task' }, 400)
  const snap = await loadSnapshot(sb)
  const result = await ask<Record<string, unknown>>({
    effort: def.effort,
    schema: def.schema,
    messages: [{ role: 'user', content: [{ type: 'text', text: snapshotText(snap, `task:${body.task}`) }, { type: 'text', text: def.prompt(body.payload) }] }],
  })
  if (result && body.task === 'evaluate_idea') {
    result.potential = Math.min(10, Math.max(1, Number(result.potential) || 1))
    result.risk = Math.min(10, Math.max(1, Number(result.risk) || 1))
  }
  return json({ result })
}
