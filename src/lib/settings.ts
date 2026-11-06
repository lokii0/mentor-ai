import { useCallback } from 'react'
import { db, useRows } from './db'
import type { Lang, Settings } from './types'

export const DEFAULT_SETTINGS: Omit<Settings, 'id' | 'created_at'> = {
  lang: 'pl',
  intensity: 10,
  mentor_paused_until: null,
  autolock_min: 2,
  notifications: false,
  onboarding_done: false,
  last_open_at: null,
  dns_note: null,
  timezone: 'Europe/Warsaw',
}

export function useSettings(): Settings {
  const rows = useRows('settings')
  return (rows[0] ?? { id: '', created_at: '', ...DEFAULT_SETTINGS }) as Settings
}

export function getSettings(): Settings {
  const rows = db.rows('settings')
  return (rows[0] ?? { id: '', created_at: '', ...DEFAULT_SETTINGS }) as Settings
}

export function updateSettings(patch: Partial<Settings>) {
  const row = db.rows('settings')[0]
  if (row) db.update('settings', row.id, patch)
  else db.insert('settings', { ...DEFAULT_SETTINGS, ...patch })
}

export function isMentorPaused(s: Settings = getSettings()): boolean {
  return !!s.mentor_paused_until && new Date(s.mentor_paused_until) > new Date()
}

// ---------- i18n: inline pairs instead of a shared dictionary ----------

export function useLang(): Lang {
  return useSettings().lang
}

/** const t = useT(); t('Dziś', 'Today') */
export function useT() {
  const lang = useLang()
  return useCallback((pl: string, en: string) => (lang === 'en' ? en : pl), [lang])
}

export function tr(pl: string, en: string): string {
  return getSettings().lang === 'en' ? en : pl
}
