import { motion } from 'motion/react'
import { useState } from 'react'
import { useT } from '../../lib/settings'
import { supabase } from '../../lib/supabase'
import { Aurora } from '../../ui/Aurora'
import { Orb } from '../../ui/Orb'
import { materialize } from '../../ui/motion'

/** Cloud sign-in (Supabase Auth, email + password). Single owner account — sign-ups are disabled in Supabase. */
export function SignIn() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setErr(t('Nie udało się zalogować. Sprawdź e-mail i hasło.', 'Sign-in failed. Check the email and password.'))
  }

  return (
    <div className="center" style={{ minHeight: '100dvh', padding: 'calc(var(--safe-t) + 24px) 20px calc(var(--safe-b) + 24px)' }}>
      <Aurora scene="mentor" />
      <motion.form
        onSubmit={submit}
        className="glass glass--strong glass--float pad-l stack gap-5"
        style={{ width: 'min(100%, 400px)' }}
        variants={materialize}
        initial="hidden"
        animate="show"
      >
        <div className="row gap-3">
          <Orb size={44} thinking={busy} />
          <div className="stack">
            <h1 className="t-title2">mentor.ai</h1>
            <p className="t-foot t-2">{t('Zaloguj się do swojej chmury', 'Sign in to your cloud')}</p>
          </div>
        </div>
        <label className="field">
          <span className="field__label">E-mail</span>
          <input className="input" type="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{t('Hasło', 'Password')}</span>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} enterKeyHint="go" />
        </label>
        {err && <p className="t-foot t-pink" role="alert">{err}</p>}
        <button className="btn btn--accent btn--lg btn--block" disabled={busy}>
          {busy ? t('Loguję…', 'Signing in…') : t('Zaloguj', 'Sign in')}
        </button>
      </motion.form>
    </div>
  )
}
