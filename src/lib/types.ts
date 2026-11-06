// Data model — mirrors supabase/migrations/0001_schema.sql one-to-one.
// Dates: `date` fields are local calendar days 'YYYY-MM-DD'; timestamps are ISO strings.

export type ID = string
export type Lang = 'pl' | 'en'

export interface Base {
  id: ID
  user_id?: string
  created_at: string
  updated_at?: string
}

export type FactCategory =
  | 'life' | 'goal' | 'weakness' | 'trigger' | 'routine' | 'finance' | 'habit' | 'pattern' | 'relationship' | 'other'

export interface ProfileFact extends Base {
  category: FactCategory
  text: string
  source: 'onboarding' | 'interview' | 'mentor' | 'manual' | 'note'
}

export type HabitKind = 'check' | 'count' | 'duration'
export type HabitPreset = 'water' | 'meals' | 'training' | 'guitar' | 'reading' | 'outreach' | 'learning' | 'creating' | 'brainstorm'

export interface Habit extends Base {
  name: string
  kind: HabitKind
  unit?: string | null // 'ml', 'min', 'str.', 'wiad.' …
  target: number // per period
  period: 'day' | 'week'
  step?: number | null // quick-add increment (e.g. 250 ml)
  reminder_times?: string[] | null // 'HH:MM'
  shield: boolean // rescue shield: one miss doesn't break the series
  preset?: HabitPreset | null
  archived?: boolean
  sort: number
}

export interface HabitLog extends Base {
  habit_id: ID
  date: string
  value: number // check: 0/1; count: units; duration: minutes
  note?: string | null
}

export type LimitKey = 'adult' | 'smoking' | 'scroll' | string

/** Limits — "clean days" counters. Table name: streaks */
export interface Streak extends Base {
  key: LimitKey
  name: string
  started_at: string // ISO — clean since
  best_days: number
  daily_limit_minutes?: number | null // only for scroll
  sort: number
}

export interface Relapse extends Base {
  streak_id: ID
  at: string // ISO
  days_lost: number
  note?: string | null
}

export interface TriggerLog extends Base {
  at: string // ISO
  streak_key?: LimitKey | null
  mood: number // 1–5
  place: string
  before: string // what happened right before
  intensity: number // 1–10
  outcome: 'won' | 'slipped'
  note?: string | null
}

export interface MorningAnswers {
  habits: Record<ID, number> // habit_id -> value yesterday
  water_ml: number
  meals: number
  clean: { adult: boolean; smoking: boolean; scroll_minutes: number }
  mood: number // 1–5
  went_well: string
  went_wrong: string
}

export interface DailyInterview extends Base {
  date: string // the day the interview was done
  about_date: string // the day it's about (yesterday)
  kind: 'morning' | 'onboarding'
  answers: MorningAnswers | Record<string, unknown>
  completed: boolean
}

export interface Priority extends Base {
  date: string
  text: string
  done: boolean
  goal_id?: ID | null
  sort: number
}

export type BlockKind = 'focus' | 'habit' | 'meeting' | 'break' | 'other'

export interface CalendarBlock extends Base {
  date: string
  start_min: number // minutes from 00:00
  end_min: number
  title: string
  kind: BlockKind
  proposed?: boolean // suggested by the mentor, not yet accepted
  goal_id?: ID | null
  done?: boolean
}

export interface Goal extends Base {
  title: string
  description?: string | null
  deadline?: string | null
  status: 'active' | 'done' | 'paused'
  metric?: string | null // e.g. '10000 zł/mies.'
  sort: number
}

export interface GoalStep extends Base {
  goal_id: ID
  title: string
  scope: 'milestone' | 'week' | 'day'
  due?: string | null
  done: boolean
  sort: number
}

export interface Note extends Base {
  title?: string | null
  body: string
  tags: string[]
  kind: 'journal' | 'idea' | 'business' | 'other'
  pinned?: boolean
}

export interface Idea extends Base {
  title: string
  description: string
  potential?: number | null // 1–10, mentor
  risk?: number | null // 1–10, mentor
  first_step?: string | null
  time_to_first_sale?: string | null
  mentor_verdict?: string | null
  status: 'new' | 'evaluated' | 'testing' | 'dropped'
}

export interface Category extends Base {
  kind: 'income' | 'expense'
  name: string
  key?: string | null
  monthly_limit?: number | null
  sort: number
}

export interface Income extends Base {
  amount: number
  category_id: ID
  date: string
  note?: string | null
}

export interface Expense extends Base {
  amount: number
  category_id: ID
  date: string
  note?: string | null
}

export interface Budget extends Base {
  month: string // 'YYYY-MM'
  total_limit: number
  income_goal: number
}

export type MeasurementKind = 'weight' | 'skin_photo' | 'guitar' | 'pages' | 'training' | 'focus' | 'scroll'

export interface Measurement extends Base {
  date: string
  kind: MeasurementKind
  value?: number | null
  unit?: string | null
  meta?: Record<string, unknown> | null // training: {type}; focus: {goal_id, block_id}; skin_photo: {path}
  note?: string | null
}

export interface LeadsLog extends Base {
  date: string
  messages: number
  leads: number
  replies: number
  clients: number
  revenue: number
}

export type ChatContext = 'chat' | 'morning' | 'onboarding' | 'sos' | 'review' | 'return'

export interface ChatMessage extends Base {
  role: 'user' | 'mentor'
  content: string
  context: ChatContext
  meta?: {
    crisis?: boolean
    demo?: boolean
    oath_id?: ID
    actions?: MentorAction[]
    stage?: 'scold' | 'oath' | 'warm' | 'plan'
    done_actions?: number[] // indexes of actions Ro already applied
  } | null
}

/** Oath — "przysięgam, że zrobię X do Y" */
export interface Oath extends Base {
  text: string
  due_at: string // ISO
  status: 'open' | 'kept' | 'broken'
  message_id?: ID | null
}

export interface WeeklyReview extends Base {
  week_start: string // Monday
  stats: Record<string, unknown>
  positives: string
  negatives: string
  plan_next: string
  mentor_feedback?: string | null
}

export interface MonthlyReview extends Base {
  month: string
  stats: Record<string, unknown>
  mentor_feedback?: string | null
  recommendations?: string | null
}

export interface PushSubscriptionRow extends Base {
  endpoint: string
  p256dh: string
  auth: string
  ua?: string | null
}

export interface Settings extends Base {
  lang: Lang
  intensity: number // 1–10, default 10
  mentor_paused_until?: string | null
  autolock_min: number // 1–5
  notifications: boolean
  onboarding_done: boolean
  last_open_at?: string | null
  push_backoff?: number // server-managed: grows when pushes go unopened
  last_push_at?: string | null
  dns_note?: string | null // what system-level blocking is configured
  timezone: string
}

/** Structured suggestions the mentor can attach to a reply. */
export type MentorAction =
  | { type: 'oath'; text: string; due_at: string }
  | { type: 'step'; text: string }
  | { type: 'priorities'; items: string[] }
  | { type: 'blocks'; items: { title: string; start: string; end: string; kind?: BlockKind }[] }
  | { type: 'fact'; category: FactCategory; text: string }

export interface Tables {
  profile_facts: ProfileFact
  habits: Habit
  habit_logs: HabitLog
  streaks: Streak
  relapses: Relapse
  triggers_log: TriggerLog
  daily_interviews: DailyInterview
  priorities: Priority
  calendar_blocks: CalendarBlock
  goals: Goal
  goal_steps: GoalStep
  notes: Note
  ideas: Idea
  categories: Category
  incomes: Income
  expenses: Expense
  budgets: Budget
  measurements: Measurement
  leads_log: LeadsLog
  chat_messages: ChatMessage
  oaths: Oath
  weekly_reviews: WeeklyReview
  monthly_reviews: MonthlyReview
  settings: Settings
  push_subscriptions: PushSubscriptionRow
}

export type TableName = keyof Tables
