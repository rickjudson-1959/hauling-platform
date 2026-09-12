import { useCallback, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../../shared/lib/supabase'
import { fetchActiveMembership } from './activeMembership'
import { AuthContext } from './useAuth'
import type { Org } from './useAuth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [org, setOrg] = useState<Org | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [membershipError, setMembershipError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMembership = useCallback(async () => {
    const result = await fetchActiveMembership()
    if (result.status === 'error') {
      setMembershipError(result.message)
      setLoading(false)
      return
    }

    setMembershipError(null)
    if (result.status === 'active') {
      setRole(result.membership.role)
      setOrg({ id: result.membership.orgId, name: result.membership.orgName })
    } else {
      setRole(null)
      setOrg(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchMembership()
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        if (event === 'SIGNED_IN') setLoading(true)
        fetchMembership()
      } else {
        setOrg(null)
        setRole(null)
        setMembershipError(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchMembership])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, org, role, membershipError, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
