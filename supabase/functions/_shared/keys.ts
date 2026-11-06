// API keys inside Edge Functions. New projects expose SUPABASE_PUBLISHABLE_KEYS /
// SUPABASE_SECRET_KEYS as JSON dictionaries keyed by name; the legacy single-string
// SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are the fallback.

function fromDict(name: string): string | undefined {
  const raw = Deno.env.get(name)
  if (!raw) return undefined
  try {
    const dict = JSON.parse(raw) as Record<string, string>
    return dict.default ?? Object.values(dict)[0]
  } catch {
    return undefined
  }
}

export const publishableKey = (): string => fromDict('SUPABASE_PUBLISHABLE_KEYS') ?? Deno.env.get('SUPABASE_ANON_KEY')!

export const secretKey = (): string => fromDict('SUPABASE_SECRET_KEYS') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
