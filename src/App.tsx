import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import ProtectedRoute from './features/auth/ProtectedRoute'
import LoginPage from './features/auth'
import SignupPage from './features/auth/SignupPage'
import DispatchPage from './features/dispatch'
import JobsPage from './features/jobs'
import CustomersPage from './features/customers'
import CustomerProfile from './features/customers/CustomerProfile'
import TrucksPage from './features/trucks'
import DriverPage from './features/driver'
import InvoicingPage from './features/invoicing'
import DashboardPage from './features/dashboard'
import SettingsPage from './features/settings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/" element={<ProtectedRoute><DispatchPage /></ProtectedRoute>} />
          <Route path="/jobs" element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute><CustomerProfile /></ProtectedRoute>} />
          <Route path="/trucks" element={<ProtectedRoute><TrucksPage /></ProtectedRoute>} />
          <Route path="/driver" element={<ProtectedRoute><DriverPage /></ProtectedRoute>} />
          <Route path="/invoicing" element={<ProtectedRoute><InvoicingPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
