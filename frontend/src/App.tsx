import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { NotesPage } from './pages/NotesPage'

export default function App() {
  const { user, loading, isSupabaseConfigured, authenticate, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-tiger-200 border-t-tiger-500" />
        <span className="sr-only">Ładowanie…</span>
      </div>
    )
  }

  // Brak sesji — żadna trasa poza logowaniem nie istnieje.
  // To jest wygoda interfejsu, nie zabezpieczenie: dostępu do danych broni RLS.
  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={<LoginPage isSupabaseConfigured={isSupabaseConfigured} onSubmit={authenticate} />}
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <AppShell
        user={user}
        isSupabaseConfigured={isSupabaseConfigured}
        onSignOut={() => void signOut()}
      >
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/notes" element={<NotesPage user={user} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
