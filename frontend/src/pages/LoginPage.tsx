import { useId, useState, type FormEvent } from 'react'
import { TigerMark } from '../components/TigerMark'
import type { AuthMode } from '../hooks/useAuth'

type LoginPageProps = {
  isSupabaseConfigured: boolean
  onSubmit: (mode: AuthMode, email: string, password: string) => Promise<string | null>
}

export function LoginPage({ isSupabaseConfigured, onSubmit }: LoginPageProps) {
  const emailId = useId()
  const passwordId = useId()

  const [mode, setMode] = useState<AuthMode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setPending(true)

    const message = await onSubmit(mode, email.trim(), password)

    if (message) {
      setError(message)
    } else if (mode === 'signUp' && isSupabaseConfigured) {
      setNotice('Konto założone. Sprawdź skrzynkę i potwierdź adres e-mail.')
    }

    setPending(false)
  }

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-tiger-100 via-white to-tiger-100"
        aria-hidden
      />
      <div className="claw-marks pointer-events-none absolute inset-0 opacity-55 blur-[3px]" aria-hidden />
      <div
        className="animate-prowl pointer-events-none absolute -top-40 -left-32 h-[32rem] w-[32rem] rounded-full bg-tiger-300/50 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-40 -bottom-48 h-[34rem] w-[34rem] rounded-full bg-tiger-400/40 blur-3xl"
        aria-hidden
      />

      <section className="relative w-full max-w-md">
        <div className="rounded-3xl bg-gradient-to-br from-tiger-300 via-tiger-500 to-tiger-700 p-px shadow-2xl shadow-tiger-900/15">
          <div className="rounded-[23px] bg-white/95 px-8 py-10 backdrop-blur-xl">
            <header className="flex flex-col items-center gap-4 text-center">
              <TigerMark className="h-16 w-16 drop-shadow-[0_6px_14px_rgba(249,115,22,0.35)]" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-stripe-900">
                  Aplikacja <span className="text-tiger-600">Supbase Sample</span>
                </h1>
                <p className="mt-1 text-sm text-stripe-700/70">
                  {mode === 'signIn'
                    ? 'Zaloguj się, aby przejrzeć akty prawne.'
                    : 'Załóż konto i zacznij przeglądać.'}
                </p>
              </div>
            </header>

            <div
              className="mt-8 grid grid-cols-2 gap-1 rounded-xl bg-tiger-100/80 p-1"
              role="tablist"
              aria-label="Tryb uwierzytelnienia"
            >
              {(
                [
                  ['signIn', 'Logowanie'],
                  ['signUp', 'Rejestracja'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => switchMode(value)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-tiger-500 focus-visible:outline-none ${
                    mode === value
                      ? 'bg-tiger-500 text-white shadow-md shadow-tiger-600/30'
                      : 'text-stripe-700/70 hover:text-tiger-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label htmlFor={emailId} className="block text-xs font-semibold tracking-wider text-stripe-700/80 uppercase">
                  Adres e-mail
                </label>
                <input
                  id={emailId}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="lead@firma.pl"
                  className="w-full rounded-xl border border-tiger-300 bg-tiger-50/60 px-4 py-3 text-stripe-900 placeholder:text-stripe-700/35 focus:border-tiger-500 focus:bg-white focus:ring-2 focus:ring-tiger-400/40 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor={passwordId} className="block text-xs font-semibold tracking-wider text-stripe-700/80 uppercase">
                  Hasło
                </label>
                <input
                  id={passwordId}
                  type="password"
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="co najmniej 8 znaków"
                  className="w-full rounded-xl border border-tiger-300 bg-tiger-50/60 px-4 py-3 text-stripe-900 placeholder:text-stripe-700/35 focus:border-tiger-500 focus:bg-white focus:ring-2 focus:ring-tiger-400/40 focus:outline-none"
                />
              </div>

              {error && (
                <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </p>
              )}

              {notice && (
                <p role="status" className="rounded-lg border border-tiger-400/60 bg-tiger-100 px-4 py-3 text-sm text-tiger-900">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-gradient-to-r from-tiger-400 via-tiger-500 to-tiger-600 px-4 py-3 font-bold text-white shadow-lg shadow-tiger-600/30 transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-tiger-700 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? 'Chwileczkę…' : mode === 'signIn' ? 'Zaloguj się' : 'Załóż konto'}
              </button>
            </form>

            {!isSupabaseConfigured && (
              <p className="mt-6 rounded-xl border border-tiger-300 bg-tiger-50 px-4 py-3 text-xs leading-relaxed text-stripe-700/80">
                <span className="font-semibold text-tiger-700">Tryb demonstracyjny.</span> Brak
                <code className="mx-1 rounded bg-tiger-200 px-1 py-0.5 text-stripe-900">VITE_SUPABASE_URL</code>
                i
                <code className="mx-1 rounded bg-tiger-200 px-1 py-0.5 text-stripe-900">VITE_SUPABASE_PUBLISHABLE_KEY</code>
                — logowanie jest symulowane lokalnie.
              </p>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-stripe-700/50">
          Aplikacja przykładowa · React + TypeScript + Tailwind CSS + Supabase
        </p>
      </section>
    </main>
  )
}
