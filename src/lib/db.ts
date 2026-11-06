// One data API for the whole app. Two adapters behind it:
//  - local: localStorage, works with no backend (demo / before Supabase is set up)
//  - supabase: Postgres behind Row Level Security, same table names
// Screens read through hooks (cached, reactive) and write through db.* (optimistic).

import { useMemo, useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import type { TableName, Tables } from './types'

type Row<K extends TableName> = Tables[K]
type Listener = () => void

interface Adapter {
  load<K extends TableName>(table: K): Promise<Row<K>[]>
  insert<K extends TableName>(table: K, row: Row<K>): Promise<void>
  update<K extends TableName>(table: K, id: string, patch: Partial<Row<K>>): Promise<void>
  remove<K extends TableName>(table: K, id: string): Promise<void>
  clear(): Promise<void>
}

const LS = 'mentor.v1.'

function readLocal(table: TableName): any[] {
  try {
    return JSON.parse(localStorage.getItem(LS + table) || '[]')
  } catch {
    return []
  }
}

const localAdapter: Adapter = {
  async load(table) {
    return readLocal(table)
  },
  async insert(table) {
    persistLocal(table)
  },
  async update(table) {
    persistLocal(table)
  },
  async remove(table) {
    persistLocal(table)
  },
  async clear() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LS))
      .forEach((k) => localStorage.removeItem(k))
  },
}

function persistLocal(table: TableName) {
  try {
    localStorage.setItem(LS + table, JSON.stringify(stores[table]?.rows ?? []))
  } catch (e) {
    emitError(e)
  }
}

// Large/append-only tables load a window, not everything.
const LOAD_LIMIT: Partial<Record<TableName, number>> = { chat_messages: 400 }

const supabaseAdapter: Adapter = {
  async load(table) {
    const sb = supabase!
    const limit = LOAD_LIMIT[table]
    let q = sb.from(table).select('*').order('created_at', { ascending: !limit })
    if (limit) q = q.limit(limit)
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as Row<typeof table>[]
    return limit ? rows.reverse() : rows
  },
  async insert(table, row) {
    const { error } = await supabase!.from(table).insert(row)
    if (error) throw error
  },
  async update(table, id, patch) {
    const { error } = await supabase!.from(table).update(patch as never).eq('id', id)
    if (error) throw error
  },
  async remove(table, id) {
    const { error } = await supabase!.from(table).delete().eq('id', id)
    if (error) throw error
  },
  async clear() {
    // Deleting everything is done server-side via the delete_my_data() RPC (see migration).
    const { error } = await supabase!.rpc('delete_my_data')
    if (error) throw error
  },
}

let adapter: Adapter = localAdapter
export let dbMode: 'local' | 'supabase' = 'local'

interface Store<K extends TableName> {
  rows: Row<K>[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  listeners: Set<Listener>
  promise?: Promise<void>
}

const stores: { [K in TableName]?: Store<K> } = {}

function store<K extends TableName>(table: K): Store<K> {
  let s = stores[table] as Store<K> | undefined
  if (!s) {
    s = { rows: [], status: 'idle', listeners: new Set() }
    // Local mode reads synchronously so a write can never race the first load.
    if (dbMode === 'local') {
      s.rows = readLocal(table)
      s.status = 'ready'
    }
    ;(stores as Record<string, unknown>)[table] = s
  }
  return s
}

function notify(table: TableName) {
  store(table).listeners.forEach((l) => l())
}

const errorListeners = new Set<(e: unknown) => void>()
function emitError(e: unknown) {
  console.error('[db]', e)
  errorListeners.forEach((l) => l(e))
}
export function onDbError(fn: (e: unknown) => void) {
  errorListeners.add(fn)
  return () => errorListeners.delete(fn)
}

export function ensureLoaded<K extends TableName>(table: K): Promise<void> {
  const s = store(table)
  if (s.status === 'ready') return Promise.resolve()
  if (s.promise) return s.promise
  s.status = 'loading'
  s.promise = adapter
    .load(table)
    .then((rows) => {
      // Keep optimistic rows written while the load was in flight.
      const ids = new Set(rows.map((r) => r.id))
      s.rows = [...rows, ...s.rows.filter((r) => !ids.has(r.id))]
      s.status = 'ready'
      notify(table)
    })
    .catch((e) => {
      s.status = 'error'
      s.promise = undefined
      emitError(e)
    })
  return s.promise
}

export async function loadAll(tables: TableName[]) {
  await Promise.all(tables.map(ensureLoaded))
}

/** Switch backend (after sign-in / sign-out). Drops the cache. */
export function setDbMode(mode: 'local' | 'supabase') {
  dbMode = mode
  adapter = mode === 'supabase' ? supabaseAdapter : localAdapter
  ;(Object.keys(stores) as TableName[]).forEach((t) => {
    const s = store(t)
    s.rows = mode === 'local' ? readLocal(t) : []
    s.status = mode === 'local' ? 'ready' : 'idle'
    s.promise = undefined
    notify(t)
  })
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

const nowIso = () => new Date().toISOString()

type NewRow<K extends TableName> = Omit<Row<K>, 'id' | 'created_at' | 'user_id' | 'updated_at'> & { id?: string; created_at?: string }

export const db = {
  /** Synchronous snapshot (call ensureLoaded first if you need fresh data). */
  rows<K extends TableName>(table: K): Row<K>[] {
    return store(table).rows
  },

  async all<K extends TableName>(table: K): Promise<Row<K>[]> {
    await ensureLoaded(table)
    return store(table).rows
  },

  insert<K extends TableName>(table: K, data: NewRow<K>): Row<K> {
    const row = { id: uid(), created_at: nowIso(), ...data } as Row<K>
    const s = store(table)
    s.rows = [...s.rows, row]
    notify(table)
    adapter.insert(table, row).catch(emitError)
    return row
  },

  /** Add a row the server already stored (e.g. Edge Function output) to the cache only. */
  ingest<K extends TableName>(table: K, row: Row<K>) {
    const s = store(table)
    s.rows = [...s.rows.filter((r) => r.id !== row.id), row]
    notify(table)
  },

  insertMany<K extends TableName>(table: K, data: NewRow<K>[]): Row<K>[] {
    const rows = data.map((d) => ({ id: uid(), created_at: nowIso(), ...d }) as Row<K>)
    const s = store(table)
    s.rows = [...s.rows, ...rows]
    notify(table)
    if (dbMode === 'supabase') {
      supabase!.from(table).insert(rows).then(({ error }) => error && emitError(error))
    } else persistLocal(table)
    return rows
  },

  update<K extends TableName>(table: K, id: string, patch: Partial<Row<K>>) {
    const s = store(table)
    const full = { ...patch, updated_at: nowIso() } as Partial<Row<K>>
    s.rows = s.rows.map((r) => (r.id === id ? ({ ...r, ...full } as Row<K>) : r))
    notify(table)
    adapter.update(table, id, full).catch(emitError)
  },

  remove<K extends TableName>(table: K, id: string) {
    const s = store(table)
    s.rows = s.rows.filter((r) => r.id !== id)
    notify(table)
    adapter.remove(table, id).catch(emitError)
  },

  /** Insert or update by a natural key (e.g. habit_id + date). */
  upsertBy<K extends TableName>(table: K, match: (r: Row<K>) => boolean, data: NewRow<K>): Row<K> {
    const existing = store(table).rows.find(match)
    if (existing) {
      db.update(table, existing.id, data as Partial<Row<K>>)
      return { ...existing, ...data } as Row<K>
    }
    return db.insert(table, data)
  },

  async wipe() {
    await adapter.clear()
    ;(Object.keys(stores) as TableName[]).forEach((t) => {
      const s = store(t)
      s.rows = []
      s.status = 'ready'
      notify(t)
    })
  },

  async exportAll(): Promise<Record<string, unknown[]>> {
    const tables: TableName[] = [
      'profile_facts', 'habits', 'habit_logs', 'streaks', 'relapses', 'triggers_log', 'daily_interviews',
      'priorities', 'calendar_blocks', 'goals', 'goal_steps', 'notes', 'ideas', 'categories', 'incomes',
      'expenses', 'budgets', 'measurements', 'leads_log', 'chat_messages', 'oaths', 'weekly_reviews',
      'monthly_reviews', 'settings',
    ]
    await loadAll(tables)
    return Object.fromEntries(tables.map((t) => [t, store(t).rows]))
  },
}

/** Reactive rows of a table. Triggers the load on first use. */
export function useRows<K extends TableName>(table: K): Row<K>[] {
  const s = store(table)
  if (s.status === 'idle') void ensureLoaded(table)
  return useSyncExternalStore(
    (l) => {
      s.listeners.add(l)
      return () => s.listeners.delete(l)
    },
    () => s.rows,
  )
}

/** Reactive, memoised filter over a table. */
export function useWhere<K extends TableName>(table: K, pred: (r: Row<K>) => boolean, deps: unknown[] = []): Row<K>[] {
  const rows = useRows(table)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => rows.filter(pred), [rows, ...deps])
}

export function useTableReady(table: TableName): boolean {
  const s = store(table)
  useRows(table)
  return s.status === 'ready'
}
