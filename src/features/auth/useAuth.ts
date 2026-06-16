import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface Org {
  id: string
  name: string
}

export interface AuthContextValue {
  session: Session | null
  user: User | null
  org: Org | null
  role: string | null
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
