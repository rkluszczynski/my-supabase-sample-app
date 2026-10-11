import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { TigerMark } from './TigerMark'
import type { SessionUser } from '../lib/demoStore'

type AppShellProps = {
  user: SessionUser
  isSupabaseConfigured: boolean
  onSignOut: () => void
  children: ReactNode
}

const NAV = [
  { to: '/dashboard', label: 'Akty Prawne' },
  { to: '/notes', label: 'Notatki' },
]

export function AppShell({ user, isSupabaseConfigured, onSignOut, children }: AppShellProps) {
  return (
    <div className="min-h-dvh">
      <header className="relative overflow-hidden border-b border-tiger-200 bg-gradient-to-r from-tiger-100 via-white to-tiger-100">
        <div className="claw-marks pointer-events-none absolute inset-0 opacity-45 blur-[3px]" aria-hidden />

        <div className="relative mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <TigerMark className="h-10 w-10" />
            <span className="text-lg font-bold text-stripe-900">
              <span className="text-tiger-600">S2 App</span>
            </span>
          </div>

          <nav className="flex items-center gap-1" aria-label="Nawigacja główna">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-tiger-600 focus-visible:outline-none ${
                    isActive
                      ? 'bg-tiger-500 text-white shadow-md shadow-tiger-600/30'
                      : 'text-stripe-700/70 hover:bg-white/70 hover:text-tiger-700'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-stripe-700/70 sm:inline">{user.email}</span>
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-lg border border-tiger-500 bg-white/70 px-4 py-2 text-sm font-semibold text-tiger-700 transition hover:bg-tiger-500 hover:text-white focus-visible:ring-2 focus-visible:ring-tiger-600 focus-visible:outline-none"
            >
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      {!isSupabaseConfigured && (
        <p className="border-b border-tiger-300 bg-tiger-100 px-6 py-2 text-center text-xs text-stripe-700/80">
          <span className="font-semibold text-tiger-700">Tryb demonstracyjny</span> — dane trzymane
          lokalnie w przeglądarce. Podaj <code className="rounded bg-tiger-200 px-1">VITE_SUPABASE_URL</code> i{' '}
          <code className="rounded bg-tiger-200 px-1">VITE_SUPABASE_PUBLISHABLE_KEY</code>, aby użyć Supabase.
        </p>
      )}

      <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>
    </div>
  )
}
