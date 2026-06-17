import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'

interface Props {
  children: React.ReactNode
  /** When true, drivers are redirected to /driver instead of rendered. */
  staffOnly?: boolean
}

export default function ProtectedRoute({ children, staffOnly }: Props) {
  const { session, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (staffOnly && role === 'driver') return <Navigate to="/driver" replace />

  return <>{children}</>
}
