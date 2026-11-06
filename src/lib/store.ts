// Tiny reactive store for UI state that isn't table data.
import { useSyncExternalStore } from 'react'

export interface Atom<T> {
  get(): T
  set(next: T | ((prev: T) => T)): void
  subscribe(l: () => void): () => void
  use(): T
}

export function atom<T>(initial: T): Atom<T> {
  let value = initial
  const listeners = new Set<() => void>()
  const a: Atom<T> = {
    get: () => value,
    set(next) {
      const v = typeof next === 'function' ? (next as (p: T) => T)(value) : next
      if (Object.is(v, value)) return
      value = v
      listeners.forEach((l) => l())
    },
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    use() {
      return useSyncExternalStore(a.subscribe, a.get, a.get)
    },
  }
  return a
}
