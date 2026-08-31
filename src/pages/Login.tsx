import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DEMO_ACCOUNTS, ROLE_ROUTES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('demo123456')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single<{ role: string }>()

    if (profile?.role) {
      navigate(ROLE_ROUTES[profile.role as keyof typeof ROLE_ROUTES])
    } else {
      setError(t('Profile not found. Run seed-demo-users script first.'))
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 font-body text-ink">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="mb-1 font-label text-xs uppercase tracking-wider text-primary-light">
            {t('Staff access')}
          </p>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('PHC Federated Platform')}
          </h1>
          <p className="mt-2 text-sm text-ink/60">
            {t('Code for Communities — Smart Health Centre Management')}
          </p>
        </div>

        <div className="rounded-xl border border-primary/10 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block font-label text-xs font-medium uppercase tracking-wide text-ink/60">
                {t('Email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-primary/15 px-3 py-2 text-sm focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
                required
              />
            </div>
            <div>
              <label className="mb-1 block font-label text-xs font-medium uppercase tracking-wide text-ink/60">
                {t('Password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-primary/15 px-3 py-2 pr-16 text-sm focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 font-label text-xs font-medium text-primary-light hover:text-primary"
                >
                  {showPassword ? t('Hide') : t('Show')}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-primary-dark disabled:opacity-50"
            >
              {loading ? t('Signing in…') : t('Sign in')}
            </button>
          </form>

          <div className="mt-6 border-t border-primary/10 pt-4">
            <p className="mb-2 font-label text-xs font-medium uppercase tracking-wide text-ink/40">
              {t('Demo accounts')}
            </p>
            <ul className="space-y-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email}>
                  <button
                    type="button"
                    className="text-left text-sm text-primary-light hover:text-primary hover:underline"
                    onClick={() => setEmail(a.email)}
                  >
                    {a.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-6 text-center">
          <a href="/" className="font-label text-xs text-ink/40 hover:text-primary">
            {t('← Back to patient finder')}
          </a>
        </p>
      </div>
    </div>
  )
}