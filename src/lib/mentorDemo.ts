// Local mentor used when no backend is configured. Rule-based, uses only real app data,
// follows the PRD failure scheme: scold → ask for the explanation → oath → one small step.
// It never invents numbers; tasks that need judgement return null.
import { db } from './db'
import { dayKey, hhmmToMinutes, minutesToHHMM, nowMinutes, todayKey } from './dates'
import { getSettings } from './settings'
import { habitProgress } from './stats'
import type { BlockKind, ChatContext, FactCategory, MentorAction } from './types'

type Stage = 'scold' | 'oath' | 'warm' | 'plan'
interface Reply {
  content: string
  actions?: MentorAction[]
  stage?: Stage
}

const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')

const FAIL =
  /(nie zrobil|nie zrobie|zawalil|olalem|olalam|odpuscil|przegral|nie chcialo|nie chce mi sie|leniw|lenistw|nic nie zrobil|scrollowal|przescrollowal|zapalil|papieros|porn|18\+|przespal|spoznil|nie poszedl|nie poszlo|didn'?t|skipped|failed|lazy|wasted|relapsed|smoked|procrastinat)/
const MONEY = /(zarob|pieniad|kas[aey]|klient|biznes|pomysl|sprzeda|oferta|money|earn|client|business|idea|sell)/

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

function oathDue(): string {
  const now = new Date()
  const d = new Date(now)
  if (now.getHours() < 19) d.setHours(21, 0, 0, 0)
  else {
    d.setDate(d.getDate() + 1)
    d.setHours(12, 0, 0, 0)
  }
  return d.toISOString()
}

function dueLabel(iso: string, en: boolean): string {
  const d = new Date(iso)
  const today = dayKey(d) === todayKey()
  const hh = minutesToHHMM(d.getHours() * 60 + d.getMinutes())
  if (en) return today ? `by ${hh} today` : `by ${hh} tomorrow`
  return today ? `dziś do ${hh}` : `jutro do ${hh}`
}

function smallestStep(en: boolean): string {
  const habits = db.rows('habits').filter((h) => !h.archived && h.period === 'day')
  const logs = db.rows('habit_logs')
  const behind = habits
    .map((h) => ({ h, p: habitProgress(h, logs) }))
    .filter((x) => x.p < 1)
    .sort((a, b) => a.p - b.p)[0]
  if (!behind) return en ? 'Write the first line of your most important task. Now.' : 'Napisz pierwszą linijkę najważniejszego zadania. Teraz.'
  const preset = behind.h.preset
  const steps: Record<string, [string, string]> = {
    water: ['Wstań i wypij szklankę wody. Teraz, nie za 5 minut.', 'Get up and drink a glass of water. Now, not in 5 minutes.'],
    meals: ['Zjedz normalny posiłek, zanim cokolwiek innego.', 'Eat a proper meal before anything else.'],
    guitar: ['Weź gitarę i zagraj 10 minut. Timer na 10 i lecisz.', 'Pick up the guitar and play for 10 minutes. Set a timer and go.'],
    reading: ['Przeczytaj 5 stron. Telefon do drugiego pokoju.', 'Read 5 pages. Phone goes to another room.'],
    outreach: ['Wyślij 3 wiadomości do potencjalnych klientów. Tylko 3.', 'Send 3 messages to potential clients. Just 3.'],
    training: ['20 pompek i 20 przysiadów. Bez dyskusji.', '20 push-ups and 20 squats. No discussion.'],
    learning: ['15 minut nauki, jeden temat, zero kart w przeglądarce.', '15 minutes of learning, one topic, zero extra tabs.'],
    creating: ['Otwórz projekt i zrób jedną małą rzecz. 15 minut.', 'Open the project and ship one small thing. 15 minutes.'],
  }
  const s = preset && steps[preset]
  return s ? (en ? s[1] : s[0]) : en ? `Do 10 minutes of "${behind.h.name}". Now.` : `Zrób 10 minut: „${behind.h.name}”. Teraz.`
}

function scold(intensity: number, en: boolean): string {
  if (en) {
    if (intensity >= 8) return pick(['That was a lazy, pathetic day. Not you — the day. You know better and you still did it.', "Seriously? You had the plan and you threw it away. That's weak behaviour and you know it.", 'Bullshit. You chose comfort over your goals again.'])
    if (intensity >= 4) return pick(['Not good. You know what you should have done and you skipped it.', "That's a step back and we're not pretending otherwise."])
    return 'That didn’t go to plan. Let’s look at it honestly.'
  }
  if (intensity >= 8)
    return pick([
      'Leniwy dzień, żałosne. Nie ty jesteś żałosny — to zachowanie jest. Wiesz lepiej, a i tak to zrobiłeś.',
      'Serio? Miałeś plan i go wyjebałeś do kosza. To słabe zachowanie i dobrze o tym wiesz.',
      'No kurwa. Znowu wygodne zamiast ważnego. Tak się nie dochodzi do 10 koła miesięcznie.',
    ])
  if (intensity >= 4) return pick(['Słabo. Wiesz, co miałeś zrobić, i to olałeś.', 'To jest krok w tył i nie będziemy udawać, że nie.'])
  return 'Nie poszło zgodnie z planem. Spójrzmy na to uczciwie.'
}

const OATHS: [RegExp, [string, string]][] = [
  [/klient|outreach|wiadomo|lead|client|prospect/, ['wyślę 20 wiadomości do potencjalnych klientów', 'I send 20 messages to potential clients']],
  [/scroll|tiktok|insta|youtube|reels|shorts|telefon|phone/, ['zmieszczę się w limicie scrolla, a telefon na noc zostanie poza pokojem', 'I stay under my scroll limit and the phone sleeps outside my room']],
  [/gitar|guitar/, ['zagram 30 minut na gitarze', 'I play guitar for 30 minutes']],
  [/trening|silown|cwicz|gym|workout|train/, ['zrobię pełny trening', 'I do a full workout']],
  [/czyta|ksiaz|read|book/, ['przeczytam 15 stron', 'I read 15 pages']],
  [/zapalil|papieros|fajk|smok|cigar/, ['nie zapalę ani jednego papierosa', "I don't smoke a single cigarette"]],
  [/apk|kod|projekt|produkt|app|code|build/, ['przepracuję 60 minut nad projektem bez telefonu', 'I work 60 minutes on the project with no phone']],
]

function oathFor(story: string): [string, string] {
  return OATHS.find(([re]) => re.test(story))?.[1] ?? ['zrobię wszystkie 3 priorytety', 'I finish all 3 priorities']
}

/** Stage of the mentor's last reply in this context within the last 6 hours ('fresh' = none yet). */
function lastMentorStage(context: ChatContext): Stage | 'fresh' | undefined {
  const since = Date.now() - 6 * 3600_000
  const msgs = db.rows('chat_messages').filter((m) => m.context === context && new Date(m.created_at).getTime() > since)
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'mentor') return msgs[i].meta?.stage
  return 'fresh'
}

export function demoReply(message: string, context: ChatContext, crisis: boolean): Reply {
  const s = getSettings()
  const en = s.lang === 'en'
  const t = strip(message)

  if (crisis) {
    return {
      stage: 'warm',
      content: en
        ? "I'm stopping the hard talk. What you wrote sounds serious, and I'm glad you wrote it. You don't have to handle this alone. If you're in danger right now, call 112. You can also call 116 123 — the adult crisis line in Poland, free and anonymous. Is there someone you trust you can be with or call tonight? I'm here; tell me what's happening."
        : 'Odkładam ostry ton. To, co napisałeś, brzmi poważnie i dobrze, że to napisałeś. Nie musisz zostawać z tym sam. Jeśli coś Ci teraz grozi, dzwoń na 112. Możesz też zadzwonić pod 116 123 — telefon zaufania dla dorosłych w kryzysie, za darmo i anonimowo. Czy jest ktoś zaufany, z kim możesz dziś być albo do kogo zadzwonić? Jestem tu — napisz, co się dzieje.',
    }
  }

  const stage = lastMentorStage(context)
  // Morning: the first reply comments on the report and proposes priorities.
  if (context === 'morning' && stage === 'fresh') return morningReply(en)
  // Coming back after a break: scold + ask for the explanation first.
  if (context === 'return' && stage === 'fresh')
    return {
      stage: 'scold',
      content: `${scold(s.intensity, en)}\n\n${en ? 'Days without a word. Explain: what happened, and why did you disappear instead of telling me?' : 'Dni bez słowa. Wytłumacz: co się stało i czemu zniknąłeś, zamiast napisać?'}`,
    }

  // Step 2 → 3/4: Ro explained, now the oath and one small step.
  if (stage === 'scold') {
    const step = smallestStep(en)
    const due = oathDue()
    // The oath is about what Ro failed at (read from the last two messages), not the step.
    const userMsgs = db.rows('chat_messages').filter((m) => m.context === context && m.role === 'user')
    const story = strip(userMsgs.slice(-2).map((m) => m.content).join(' ') + ' ' + message)
    const [plOath, enOath] = oathFor(story)
    const oathText = en ? `I swear that ${dueLabel(due, en)} ${enOath}.` : `Przysięgam, że ${dueLabel(due, en)} ${plOath}.`
    return {
      stage: 'oath',
      content: en
        ? `Okay. That's the reason, not an excuse — the difference is what you do next. Swear it, then one small step right now.\n\nStep for now: ${step}`
        : `Dobra. To jest powód, nie wymówka — różnica polega na tym, co zrobisz teraz. Przysięgnij, a potem jeden mały krok od razu.\n\nKrok na teraz: ${step}`,
      actions: [
        { type: 'oath', text: oathText, due_at: due },
        { type: 'step', text: step },
      ],
    }
  }

  // Step 1: scold + ask for the explanation.
  if (FAIL.test(t)) {
    return {
      stage: 'scold',
      content: `${scold(s.intensity, en)}\n\n${en ? 'Now explain. What exactly happened, and at what moment did you let go?' : 'Teraz wytłumacz. Co dokładnie się stało i w którym momencie odpuściłeś?'}`,
    }
  }

  if ((context === 'morning' || context === 'return') && stage === 'oath') return morningReply(en)

  if (MONEY.test(t)) {
    return {
      content: en
        ? "Money comes from offers, not ideas. Three moves that fit your goals:\n1. Pick one AI service for small businesses you can deliver this week (e.g. an automated inbox or a website chatbot) and give it a price.\n2. Send 20 messages today to owners who could use it. Count them in the app.\n3. Every reply goes into the leads log — by Friday you'll know if it works.\nWhich one are you doing first?"
        : 'Kasa bierze się z ofert, nie z pomysłów. Trzy ruchy pod Twoje cele:\n1. Wybierz jedną usługę AI dla małych firm, którą dowieziesz w tym tygodniu (np. automatyczna skrzynka albo chatbot na stronę) i daj jej cenę.\n2. Wyślij dziś 20 wiadomości do właścicieli, którym się przyda. Licz je w apce.\n3. Każda odpowiedź ląduje w logu leadów — do piątku będziesz wiedział, czy to działa.\nKtóre robisz pierwsze?',
    }
  }

  return statusNudge(en)
}

function statusNudge(en: boolean): Reply {
  const today = todayKey()
  const prios = db.rows('priorities').filter((p) => p.date === today)
  const open = db.rows('oaths').filter((o) => o.status === 'open')
  const habits = db.rows('habits').filter((h) => !h.archived && h.period === 'day')
  const logs = db.rows('habit_logs')
  const done = habits.filter((h) => habitProgress(h, logs) >= 1).length
  const lines: string[] = []
  if (!prios.length) lines.push(en ? 'You have no priorities for today. Set 3 — that is the first job.' : 'Nie masz dziś priorytetów. Ustal 3 — to pierwsza robota.')
  else {
    const left = prios.filter((p) => !p.done)
    lines.push(
      left.length
        ? en
          ? `Priorities: ${prios.length - left.length}/${prios.length} done. Next up: "${left[0].text}".`
          : `Priorytety: ${prios.length - left.length}/${prios.length} zrobione. Następny: „${left[0].text}”.`
        : en
          ? 'All priorities done. That is real — keep the evening clean.'
          : 'Wszystkie priorytety zrobione. To jest konkret — teraz czysty wieczór.',
    )
  }
  lines.push(en ? `Habits today: ${done}/${habits.length}.` : `Nawyki dziś: ${done}/${habits.length}.`)
  if (open[0]) lines.push(en ? `You swore: "${open[0].text}". I'm watching.` : `Przysiągłeś: „${open[0].text}”. Pilnuję.`)
  lines.push(en ? `Step for now: ${smallestStep(en)}` : `Krok na teraz: ${smallestStep(en)}`)
  return { content: lines.join('\n\n') }
}

function morningReply(en: boolean): Reply {
  const iv = [...db.rows('daily_interviews')].reverse().find((i) => i.kind === 'morning')
  const a = iv?.answers as { clean?: { adult: boolean; smoking: boolean; scroll_minutes: number }; water_ml?: number; meals?: number } | undefined
  const scrollLimit = db.rows('streaks').find((s) => s.key === 'scroll')?.daily_limit_minutes ?? 60
  const slips: string[] = []
  if (a?.clean && !a.clean.adult) slips.push(en ? '18+' : '18+')
  if (a?.clean && !a.clean.smoking) slips.push(en ? 'cigarettes' : 'papierosy')
  if (a?.clean && a.clean.scroll_minutes > scrollLimit) slips.push(en ? `${a.clean.scroll_minutes} min of scrolling` : `${a.clean.scroll_minutes} min scrolla`)
  const goals = db.rows('goals').filter((g) => g.status === 'active')
  const suggestions = [
    goals[0] ? (en ? `20 outreach messages (${goals[0].title})` : `20 wiadomości do klientów (${goals[0].title})`) : null,
    en ? '60 min of deep work on the app' : '60 min głębokiej pracy nad apką',
    en ? '30 min guitar' : '30 min gitary',
  ].filter(Boolean) as string[]

  const head = slips.length
    ? en
      ? `Yesterday: ${slips.join(', ')}. That's not "a bad day", that's a choice. The counters reset — today you start from zero and you don't repeat it.`
      : `Wczoraj: ${slips.join(', ')}. To nie „gorszy dzień”, to wybór. Liczniki poszły do zera — dziś zaczynasz od nowa i tego nie powtarzasz.`
    : en
      ? 'Clean yesterday. Good — that is earned, not given. Keep it boring and consistent.'
      : 'Wczoraj czysto. Dobrze — to zasłużone, nie dane. Trzymaj to nudno i konsekwentnie.'
  return {
    stage: 'plan',
    content: `${head}\n\n${en ? 'Now the day. Pick 3 priorities — here is my proposal, change what you want:' : 'Teraz dzień. Wybierz 3 priorytety — moja propozycja, zmień, co chcesz:'}`,
    actions: [{ type: 'priorities', items: suggestions }],
  }
}

// ---------- Tasks ----------

export function demoTask(task: string, payload: unknown): unknown {
  const en = getSettings().lang === 'en'
  switch (task) {
    case 'onboarding_extract': {
      const { transcript } = payload as { transcript: { q: string; a: string; category: FactCategory }[] }
      return {
        facts: transcript
          .filter((x) => x.a.trim().length > 1)
          .map((x) => ({ category: x.category, text: x.a.trim().slice(0, 400) })),
      }
    }
    case 'plan_day': {
      const { priorities, busy } = payload as { priorities: string[]; busy: { start: string; end: string }[] }
      const taken = busy.map((b) => [hhmmToMinutes(b.start), hhmmToMinutes(b.end)] as const)
      let t = Math.max(8 * 60, Math.ceil((nowMinutes() + 10) / 30) * 30)
      const blocks: { title: string; start: string; end: string; kind: BlockKind }[] = []
      for (const p of priorities) {
        let guard = 0
        while (taken.some(([a, b]) => t < b && t + 75 > a) && guard++ < 48) t += 30
        if (t + 75 > 23 * 60) break
        blocks.push({ title: p, start: minutesToHHMM(t), end: minutesToHHMM(t + 75), kind: 'focus' })
        taken.push([t, t + 75])
        t += 90
      }
      return { blocks, steps: priorities }
    }
    case 'weekly_review': {
      const { stats } = payload as { stats: Record<string, number> }
      const pct = Number(stats.habits_pct ?? 0)
      return {
        feedback: en
          ? `Habits at ${pct}% this week. ${pct >= 80 ? 'That is solid — now raise one target.' : pct >= 50 ? 'Half-done is not done. Pick the two habits that slipped most and fix only those next week.' : 'That is a weak week. No drama, no excuses: next week the minimum is water, meals and outreach every single day.'}`
          : `Nawyki w tym tygodniu: ${pct}%. ${pct >= 80 ? 'To jest solidne — teraz podnieś jeden cel.' : pct >= 50 ? 'Pół roboty to nie robota. Weź dwa nawyki, które leżały najbardziej, i w przyszłym tygodniu napraw tylko je.' : 'Słaby tydzień. Bez dramatu i bez wymówek: w przyszłym tygodniu minimum to woda, posiłki i outreach każdego dnia.'}`,
      }
    }
    case 'monthly_review': {
      const { stats } = payload as { stats: Record<string, number> }
      const income = Number(stats.income ?? 0)
      const pct = Math.round((income / 10000) * 100)
      return {
        feedback: en ? `Income reached ${pct}% of the 10k goal.` : `Przychód to ${pct}% celu 10 tys.`,
        recommendations: en
          ? 'Connect the AI backend for a full monthly analysis.'
          : 'Podłącz backend AI, żeby dostać pełną analizę miesiąca.',
      }
    }
    default:
      return null
  }
}

