// App lock: PIN (PBKDF2 hash, never stored in clear) + Face ID through a platform passkey.
// The passkey is a local presence check — real data security is Supabase Auth + RLS.

const KEY = 'mentor.pin'
const BIO = 'mentor.bio'

interface PinRecord {
  salt: string
  hash: string
  iter: number
}

const enc = new TextEncoder()
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(pin: string, salt: Uint8Array, iter: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations: iter, hash: 'SHA-256' }, key, 256)
  return b64(bits)
}

export function hasPin(): boolean {
  return !!localStorage.getItem(KEY)
}

export async function setPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iter = 210_000
  const rec: PinRecord = { salt: b64(salt), hash: await derive(pin, salt, iter), iter }
  localStorage.setItem(KEY, JSON.stringify(rec))
}

export async function verifyPin(pin: string): Promise<boolean> {
  const raw = localStorage.getItem(KEY)
  if (!raw) return false
  const rec = JSON.parse(raw) as PinRecord
  return (await derive(pin, unb64(rec.salt), rec.iter)) === rec.hash
}

export function clearPin() {
  localStorage.removeItem(KEY)
  localStorage.removeItem(BIO)
}

// ---------- Face ID / passkey ----------

export async function bioSupported(): Promise<boolean> {
  try {
    return (
      !!window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    )
  } catch {
    return false
  }
}

export function hasBio(): boolean {
  return !!localStorage.getItem(BIO)
}

export async function registerBio(): Promise<boolean> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        rp: { name: 'mentor.ai', id: location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'owner', displayName: 'mentor.ai' },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null
    if (!cred) return false
    localStorage.setItem(BIO, b64(cred.rawId))
    return true
  } catch {
    return false
  }
}

export async function unlockWithBio(): Promise<boolean> {
  const id = localStorage.getItem(BIO)
  if (!id) return false
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(id) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return !!res
  } catch {
    return false
  }
}

export function disableBio() {
  localStorage.removeItem(BIO)
}
