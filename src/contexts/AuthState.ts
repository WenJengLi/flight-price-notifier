import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthResult = { error: string | null; requiresEmailConfirmation: boolean }

export type AuthContextValue = {
  loading: boolean
  session: Session | null
  user: User | null
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<string | null>
  signUp: (email: string, password: string) => Promise<AuthResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)