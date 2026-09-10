import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabase'
import { homePath } from './homePath'
import AuthShell from './AuthShell'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      setLoading(false)
      setError(error?.message ?? 'Sign in failed.')
      return
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', data.user.id)
      .single()

    setLoading(false)
    navigate(homePath(membership?.role), { replace: true })
  }

  return (
    <AuthShell>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-card bg-white p-8 shadow-card"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">Open the dashboard</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">Sign in</h2>
          <p className="mt-1 text-sm text-gray-600">
            Invited to drive? Use the email your office sent. You will land on My Jobs.
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="block w-full rounded-lg border border-gray-300 px-3 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="block w-full rounded-lg border border-gray-300 px-3 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="min-h-12 w-full rounded-xl bg-brand px-4 py-3.5 text-base font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-gray-500">
          New company?{' '}
          <Link to="/signup" className="text-brand hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
