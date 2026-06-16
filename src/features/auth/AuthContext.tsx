import { useCallback, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../../shared/lib/supabase'
import { AuthContext } from './useAuth'
import type { Org } from './useAuth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [org, setOrg] = useState<Org | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMembership = useCallback(async (userId: string) => {
    const { data } = (await supabase
      .from('memberships')
      .select('role, orgs(id, name)')
      .eq('user_id', userId)
      .single()) as { data: { role: string; orgs: Org } | null; error: unknown }

    if (data) {
      setRole(data.role)
      setOrg(data.orgs as Org)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchMembership(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchMembership(session.user.id)
      } else {
        setOrg(null)
        setRole(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchMembership])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, org, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
