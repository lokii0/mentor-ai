// push-tick — called hourly by pg_cron (see migrations/0002_cron.sql).
// PRD 6.1: at most one push per 2 h in the 06:00–23:00 window, quiet 23:00–06:00,
// backs off (2 h → 4 h → 8 h) while pushes go unopened. Texts are neutral: never
// about 18+ or smoking, nothing sensitive on the lock screen.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { addDays, warsawNow } from '../_shared/context.ts'
import { secretKey } from '../_shared/keys.ts'

const sb = createClient(Deno.env.get('SUPABASE_URL')!, secretKey())

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:owner@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const HOUR = 3600_000

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

async function compose(userId: string, lang: string): Promise<{ title: string; body: string; url: string }> {
  const { date, hour } = warsawNow()
  const en = lang === 'en'
  const [prios, habits, logs, oaths] = await Promise.all([
    sb.from('priorities').select('done').eq('user_id', userId).eq('date', date),
    sb.from('habits').select('id,name,target,unit,period,preset').eq('user_id', userId).eq('archived', false).eq('period', 'day'),
    sb.from('habit_logs').select('habit_id,value').eq('user_id', userId).eq('date', date),
    sb.from('oaths').select('due_at').eq('user_id', userId).eq('status', 'open'),
  ])
  const p = (prios.data ?? []) as Row[]
  const value = (id: string) => ((logs.data ?? []) as Row[]).filter((l) => l.habit_id === id).reduce((a, l) => a + Number(l.value), 0)
  const behind = ((habits.data ?? []) as Row[]).filter((h) => value(h.id) < Number(h.target))
  const overdue = ((oaths.data ?? []) as Row[]).some((o) => new Date(o.due_at) < new Date())
  const water = behind.find((h) => h.preset === 'water')

  const title = 'Check-in'
  if (!p.length) return { title, body: en ? 'No priorities set yet. Two minutes.' : 'Brak priorytetów na dziś. Dwie minuty.', url: '#/today' }
  if (overdue) return { title, body: en ? 'Something is past its deadline.' : 'Coś minęło termin. Zajrzyj.', url: '#/today' }
  const left = p.filter((x) => !x.done).length
  if (left && hour >= 10) return { title, body: en ? `Priorities: ${p.length - left}/${p.length}. Next step?` : `Priorytety: ${p.length - left}/${p.length}. Następny krok?`, url: '#/today' }
  if (water && hour >= 11) return { title, body: en ? `Water: ${(value(water.id) / 1000).toFixed(1)} / ${(Number(water.target) / 1000).toFixed(0)} l` : `Woda: ${(value(water.id) / 1000).toFixed(1).replace('.', ',')} / ${(Number(water.target) / 1000).toFixed(0)} l`, url: '#/habits' }
  if (behind.length) return { title, body: en ? `Waiting for you: ${behind[0].name}` : `Czeka na Ciebie: ${behind[0].name}`, url: '#/habits' }
  return { title, body: en ? 'Quick check-in?' : 'Krótki check-in?', url: '#/mentor' }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 })

  const { hour } = warsawNow()
  if (hour < 6 || hour >= 23) return Response.json({ skipped: 'quiet-hours' })

  const { data: users } = await sb.from('settings').select('*').eq('notifications', true)
  const sent: string[] = []
  for (const st of (users ?? []) as Row[]) {
    if (st.mentor_paused_until && new Date(st.mentor_paused_until) > new Date()) continue
    const lastPush = st.last_push_at ? new Date(st.last_push_at).getTime() : 0
    const lastOpen = st.last_open_at ? new Date(st.last_open_at).getTime() : 0
    // Unopened since the last push → back off; opened → reset.
    const backoff = lastPush && lastOpen < lastPush ? Math.min(2, (st.push_backoff ?? 0) + 1) : 0
    const interval = 2 * HOUR * 2 ** backoff
    if (lastPush && Date.now() - lastPush < interval - 5 * 60_000) continue
    // Opened within the last hour — no need to nudge.
    if (lastOpen && Date.now() - lastOpen < HOUR) continue

    const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', st.user_id)
    if (!subs?.length) continue
    const msg = await compose(st.user_id, st.lang)
    let delivered = false
    for (const sub of subs as Row[]) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ ...msg, tag: 'mentor-checkin' }), { TTL: 3600, urgency: 'normal' })
        delivered = true
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('id', sub.id)
        else console.error('[push]', code, e)
      }
    }
    if (delivered) {
      await sb.from('settings').update({ last_push_at: new Date().toISOString(), push_backoff: backoff }).eq('id', st.id)
      sent.push(st.user_id)
    }
  }
  return Response.json({ sent: sent.length, day: addDays(warsawNow().date, 0) })
})
