import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/useAuth'
import BrandMark from './BrandMark'

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
    <div className="min-h-screen bg-canvas">
      <nav className="border-b border-gray-200/80 bg-white">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-0.5 overflow-x-auto px-4">
          <Link to="/dashboard" className="mr-3 flex shrink-0 items-center gap-2">
            <BrandMark />
            <span className="text-sm font-semibold tracking-tight text-gray-900">
              {org?.name ?? 'Hauling'}
            </span>
          </Link>
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-sm font-medium ${
                pathname === to
                  ? 'bg-brand text-white'
                  : 'text-gray-600 hover:bg-brand-soft hover:text-gray-900'
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
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  )
}
