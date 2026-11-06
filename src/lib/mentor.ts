// Client side of the mentor. The Claude API key never touches the browser:
// with a backend, everything goes through the `mentor` Edge Function; without one,
// a local rule-based mentor answers (clearly marked as demo).
import { db } from './db'
import { detectCrisis } from './crisis'
import { getSettings } from './settings'
import { supabase } from './supabase'
import { demoReply, demoTask } from './mentorDemo'
import { atom } from './store'
import type { ChatContext, ChatMessage, FactCategory, MentorAction, BlockKind } from './types'

/** True while a reply is being generated — drives the orb's "thinking" state. */
export const mentorThinking = atom(false)

export interface AskInput {
  message: string
  context: ChatContext
}

export async function askMentor({ message, context }: AskInput): Promise<ChatMessage> {
  const crisis = detectCrisis(message)
  const userRow: ChatMessage = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    role: 'user',
    content: message,
    context,
    meta: crisis ? { crisis: true } : null,
  }
  mentorThinking.set(true)
  try {
    if (supabase) {
      db.ingest('chat_messages', userRow)
      const { data, error } = await supabase.functions.invoke('mentor', {
        body: { mode: 'chat', context, message, user_message_id: userRow.id, lang: getSettings().lang },
      })
      if (error) throw error
      const reply = (data as { reply: ChatMessage }).reply
      db.ingest('chat_messages', reply)
      return reply
    }
    db.insert('chat_messages', userRow)
    await new Promise((r) => setTimeout(r, 650 + Math.random() * 700))
    const { content, actions, stage } = demoReply(message, context, crisis)
    return db.insert('chat_messages', {
      role: 'mentor',
      content,
      context,
      meta: { demo: true, crisis: crisis || undefined, actions, stage },
    })
  } catch (e) {
    console.error('[mentor]', e)
    const lang = getSettings().lang
    return db.insert('chat_messages', {
      role: 'mentor',
      content: lang === 'en' ? 'I could not reach the server. Check the connection and send it again.' : 'Nie mogę połączyć się z serwerem. Sprawdź internet i wyślij jeszcze raz.',
      context,
      meta: { demo: true },
    })
  } finally {
    mentorThinking.set(false)
  }
}

// ---------- Structured tasks (JSON in, JSON out) ----------

export interface TaskMap {
  onboarding_extract: {
    payload: { transcript: { q: string; a: string; category: FactCategory }[] }
    result: { facts: { category: FactCategory; text: string }[] }
  }
  evaluate_idea: {
    payload: { title: string; description: string }
    result: { potential: number; risk: number; first_step: string; time_to_first_sale: string; verdict: string }
  }
  weekly_review: {
    payload: { week_start: string; stats: Record<string, unknown>; positives: string; negatives: string; plan_next: string }
    result: { feedback: string }
  }
  monthly_review: {
    payload: { month: string; stats: Record<string, unknown> }
    result: { feedback: string; recommendations: string }
  }
  goal_breakdown: {
    payload: { title: string; metric?: string | null; deadline?: string | null; existing: string[] }
    result: { steps: { title: string; scope: 'milestone' | 'week' | 'day' }[] }
  }
  plan_day: {
    payload: { date: string; priorities: string[]; busy: { start: string; end: string; title: string }[] }
    result: { blocks: { title: string; start: string; end: string; kind: BlockKind }[]; steps: string[] }
  }
}

/** Returns null when the task needs the AI and there is no backend (no invented numbers). */
export async function mentorTask<K extends keyof TaskMap>(task: K, payload: TaskMap[K]['payload']): Promise<TaskMap[K]['result'] | null> {
  mentorThinking.set(true)
  try {
    if (supabase) {
      const { data, error } = await supabase.functions.invoke('mentor', {
        body: { mode: 'task', task, payload, lang: getSettings().lang },
      })
      if (error) throw error
      return (data as { result: TaskMap[K]['result'] }).result
    }
    await new Promise((r) => setTimeout(r, 500))
    return demoTask(task, payload) as TaskMap[K]['result'] | null
  } catch (e) {
    console.error('[mentor task]', task, e)
    return null
  } finally {
    mentorThinking.set(false)
  }
}

/** Apply an action the mentor proposed, after Ro taps it. */
export function applyAction(a: MentorAction, sourceMessageId?: string) {
  switch (a.type) {
    case 'oath':
      return db.insert('oaths', { text: a.text, due_at: a.due_at, status: 'open', message_id: sourceMessageId ?? null })
    case 'fact':
      return db.insert('profile_facts', { category: a.category, text: a.text, source: 'mentor' })
    default:
      return null
  }
}

export const isDemoMentor = !supabase
