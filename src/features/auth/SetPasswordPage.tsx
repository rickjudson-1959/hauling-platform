import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from './useAuth'
import { homePath } from './homePath'
import PasswordInput from './PasswordInput'

/** Copy-only: hash/query hints from expired invite vs password-reset links. */
function invalidLinkCopy(search: string, hash: string) {
  const query = new URLSearchParams(search)
  const fragment = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const type = query.get('type') ?? fragment.get('type')
  const errorDescription =
    query.get('error_description') ?? fragment.get('error_description') ?? ''
  const recovery = type === 'recovery' || /recovery|reset/i.test(errorDescription)

  if (recovery) {
    return {
      title: 'This password-reset link is invalid or expired',
      body: 'Sign in if you already have a password, or ask the office for a new password-reset email.',
    }
  }

  return {
    title: 'This link is invalid or expired',
    body: 'Sign in if you already have a password, or ask the office for a new invite or password-reset email.',
  }
}

export default function SetPasswordPage() {
  const navigate = useNavigate()
  const { search, hash } = useLocation()
  const { session, role, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const noSessionCopy = invalidLinkCopy(search, hash)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    navigate(homePath(role), { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        Loading…
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-lg shadow w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">{noSessionCopy.title}</h1>
          <p className="text-sm text-gray-600">
            {noSessionCopy.body}
          </p>
          <Link
            to="/login"
            className="block w-full text-center bg-blue-600 text-white py-3.5 px-4 rounded-xl text-base font-semibold"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-gray-900">Set your password</h1>
        <p className="text-sm text-gray-600">
          Choose a password, then you will land on your jobs if you are a driver.
        </p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="set-password-new" className="block text-sm font-medium text-gray-700 mb-1">
            New password
          </label>
          <PasswordInput
            id="set-password-new"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="block w-full border border-gray-300 rounded-lg py-3.5 pl-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="set-password-confirm" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm password
          </label>
          <PasswordInput
            id="set-password-confirm"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            showLabel="Show confirm password"
            hideLabel="Hide confirm password"
            className="block w-full border border-gray-300 rounded-lg py-3.5 pl-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white py-3.5 px-4 rounded-xl hover:bg-blue-700 disabled:opacity-50 text-base font-semibold"
        >
          {saving ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </div>
  )
}
