import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/useAuth'

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/', label: 'Dispatch' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/customers', label: 'Customers' },
  { to: '/trucks', label: 'Trucks' },
  { to: '/invoicing', label: 'Invoicing' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { org, signOut } = useAuth()
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-1 overflow-x-auto">
          <span className="font-semibold text-gray-900 mr-3 shrink-0 text-sm">
            {org?.name ?? '…'}
          </span>
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`shrink-0 px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap ${
                pathname === to
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </Link>
          ))}
          <button
            onClick={signOut}
            className="ml-auto shrink-0 text-sm text-gray-500 hover:text-gray-800"
          >
            Sign out
          </button>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
