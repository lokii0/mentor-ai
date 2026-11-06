// Private files (skin photos). Local mode: IndexedDB. Supabase: private bucket `private`,
// path `<user_id>/<name>`, read through short-lived signed URLs.
import { dbMode } from './db'
import { supabase } from './supabase'

const DB = 'mentor-files'

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore('files')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

async function idbPut(key: string, blob: Blob) {
  const d = await idb()
  await new Promise<void>((res, rej) => {
    const tx = d.transaction('files', 'readwrite')
    tx.objectStore('files').put(blob, key)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
}

async function idbGet(key: string): Promise<Blob | undefined> {
  const d = await idb()
  return new Promise((res, rej) => {
    const r = d.transaction('files').objectStore('files').get(key)
    r.onsuccess = () => res(r.result as Blob | undefined)
    r.onerror = () => rej(r.error)
  })
}

async function idbDel(key: string) {
  const d = await idb()
  d.transaction('files', 'readwrite').objectStore('files').delete(key)
}

/** Downscale a photo before storing (max 1600px, JPEG 0.82). */
export async function compressImage(file: Blob, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.82))
}

/** Stores a file and returns its path (save this in a row's meta). */
export async function saveFile(name: string, blob: Blob): Promise<string> {
  if (dbMode === 'supabase' && supabase) {
    const { data } = await supabase.auth.getUser()
    const path = `${data.user!.id}/${name}`
    const { error } = await supabase.storage.from('private').upload(path, blob, { upsert: true, contentType: blob.type })
    if (error) throw error
    return path
  }
  await idbPut(name, blob)
  return name
}

/** Returns an object/signed URL for display. Revoke object URLs when done in local mode. */
export async function fileUrl(path: string): Promise<string | null> {
  if (dbMode === 'supabase' && supabase) {
    const { data } = await supabase.storage.from('private').createSignedUrl(path, 300)
    return data?.signedUrl ?? null
  }
  const blob = await idbGet(path)
  return blob ? URL.createObjectURL(blob) : null
}

export async function deleteFile(path: string) {
  if (dbMode === 'supabase' && supabase) {
    await supabase.storage.from('private').remove([path])
    return
  }
  await idbDel(path)
}
