import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext, type AuthResult } from './AuthState'
import { supabase } from '../lib/supabaseClient'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      if (active) {
        setSession(data.session)
        setLoading(false)
      }
    }

    void loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
        setLoading(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }

  async function signUp(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    })

    return {
      error: error?.message ?? null,
      requiresEmailConfirmation: !error && !data.session,
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    return error?.message ?? null
  }

  return <AuthContext value={{ loading, session, user: session?.user ?? null, signIn, signOut, signUp }}>{children}</AuthContext>
}
