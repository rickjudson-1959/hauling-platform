import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'

interface Props {
  children: React.ReactNode
  /** When true, drivers are redirected to /driver instead of rendered. */
  staffOnly?: boolean
}

export default function ProtectedRoute({ children, staffOnly }: Props) {
  const { session, role, membershipError, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (membershipError && !role) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-lg font-semibold text-gray-900">Could not load team access</h1>
          <p className="text-sm text-gray-600">{membershipError}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-10 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-lg font-semibold text-gray-900">No team access</h1>
          <p className="text-sm text-gray-600">
            Your account is not active on a team. Ask your office admin to reactivate you or invite you again.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-10 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (staffOnly && role === 'driver') return <Navigate to="/driver" replace />

  return <>{children}</>
}
