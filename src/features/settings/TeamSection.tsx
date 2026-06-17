import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'

const ROLES = ['admin', 'dispatcher', 'driver'] as const
type Role = typeof ROLES[number]

interface Member {
  membership_id: string
  user_id: string
  role: Role
  email: string
}

interface InviteResult {
  isNew: boolean
  inviteLink?: string
  email: string
}

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  dispatcher: 'Dispatcher',
  driver: 'Driver',
}

export default function TeamSection() {
  const { org, role: myRole, user } = useAuth()
  const isAdmin = myRole === 'admin'

  const [members,     setMembers]     = useState<Member[]>([])
  const [loading,     setLoading]     = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState<Role>('driver')
  const [inviting,    setInviting]    = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [result,      setResult]      = useState<InviteResult | null>(null)
  const [roleErrors,  setRoleErrors]  = useState<Record<string, string>>({})
  const [copied,      setCopied]      = useState(false)

  useEffect(() => {
    if (org) load()
  }, [org])

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('org_members')
    setMembers((data as Member[]) ?? [])
    setLoading(false)
  }

  async function changeRole(membershipId: string, newRole: Role) {
    if (!org) return
    setRoleErrors(e => ({ ...e, [membershipId]: '' }))
    const { error } = await supabase
      .from('memberships')
      .update({ role: newRole })
      .eq('id', membershipId)
      .eq('org_id', org.id)
    if (error) {
      setRoleErrors(e => ({ ...e, [membershipId]: error.message }))
    } else {
      setMembers(prev => prev.map(m =>
        m.membership_id === membershipId ? { ...m, role: newRole } : m
      ))
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError(null)
    setResult(null)

    const { data, error } = await supabase.functions.invoke('invite-member', {
      body: {
        email: inviteEmail.trim(),
        role: inviteRole,
        redirectTo: window.location.origin,
      },
    })

    if (error) {
      // supabase.functions.invoke sets error on non-2xx; the JSON body is in error.context
      let msg = 'Invite failed'
      try {
        const body = await (error as unknown as { context?: Response }).context?.json()
        if (typeof body?.error === 'string') msg = body.error
      } catch { /* body wasn't JSON — keep generic message */ }
      setInviteError(msg)
      setInviting(false)
      return
    }

    if (data?.error) {
      setInviteError(data.error)
      setInviting(false)
      return
    }

    setResult({ isNew: data.isNew, inviteLink: data.inviteLink, email: inviteEmail.trim() })
    setInviteEmail('')
    setInviteRole('driver')
    setInviting(false)
    load()
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Team</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Members of your organisation and their roles.
        </p>
      </div>

      {/* Members list */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map(m => {
                const isMe = m.user_id === user?.id
                const err  = roleErrors[m.membership_id]
                return (
                  <tr key={m.membership_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">
                      <span>{m.email}</span>
                      {isMe && (
                        <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && !isMe ? (
                        <div>
                          <select
                            value={m.role}
                            onChange={e => changeRole(m.membership_id, e.target.value as Role)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {ROLES.map(r => (
                              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                            ))}
                          </select>
                          {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
                        </div>
                      ) : (
                        <span className="text-gray-700">{ROLE_LABEL[m.role] ?? m.role}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite form — admins only */}
      {isAdmin && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Invite someone</h3>
          <form onSubmit={invite} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Email address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => { setInviteEmail(e.target.value); setInviteError(null); setResult(null) }}
                required
                placeholder="driver@example.com"
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as Role)}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {inviting ? 'Inviting…' : 'Invite'}
            </button>
          </form>

          {inviteError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {inviteError}
            </p>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2">
              {result.isNew ? (
                <>
                  <p className="text-sm text-green-800 font-medium">
                    Account created for {result.email}.
                  </p>
                  <p className="text-sm text-green-700">
                    Share this link with them — it lets them set their password and sign in:
                  </p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      readOnly
                      value={result.inviteLink ?? ''}
                      className="flex-1 border border-green-300 rounded px-3 py-1.5 text-xs bg-white font-mono text-gray-700 focus:outline-none"
                      onClick={e => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => result.inviteLink && copyLink(result.inviteLink)}
                      className="shrink-0 px-3 py-1.5 text-xs border border-green-300 rounded bg-white hover:bg-green-50 text-green-800"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-green-800 font-medium">
                  {result.email} has been added to your org. They can log in with their existing account.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
