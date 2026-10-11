import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  clearDemoSession,
  demoUserId,
  readDemoSession,
  writeDemoSession,
  type SessionUser,
} from '../lib/demoStore'

type AuthState = {
  user: SessionUser | null
  loading: boolean
}

const toSessionUser = (email: string | null, id: string | null): SessionUser | null => {
  if (!email || !id) return null
  return { id, email }
}

export type AuthMode = 'signIn' | 'signUp'

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    if (!supabase) {
      setState({ user: readDemoSession(), loading: false })
      return
    }

    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const sessionUser = data.session?.user
      setState({
        user: toSessionUser(sessionUser?.email ?? null, sessionUser?.id ?? null),
        loading: false,
      })
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user
      setState({
        user: toSessionUser(sessionUser?.email ?? null, sessionUser?.id ?? null),
        loading: false,
      })
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const authenticate = useCallback(
    async (mode: AuthMode, email: string, password: string): Promise<string | null> => {
      if (!supabase) {
        if (password.length < 8) return 'Hasło musi mieć co najmniej 8 znaków.'
        const user: SessionUser = { id: demoUserId(email), email }
        writeDemoSession(user)
        setState({ user, loading: false })
        return null
      }

      const { error } =
        mode === 'signIn'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password })

      return error ? error.message : null
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (!supabase) {
      clearDemoSession()
      setState({ user: null, loading: false })
      return
    }

    await supabase.auth.signOut()
  }, [])

  return {
    user: state.user,
    loading: state.loading,
    isSupabaseConfigured,
    authenticate,
    signOut,
  }
}
