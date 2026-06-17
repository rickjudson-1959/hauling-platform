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
import JobDetail from './features/driver/JobDetail'
import InvoicingPage from './features/invoicing'
import InvoiceDetail from './features/invoicing/InvoiceDetail'
import DashboardPage from './features/dashboard'
import SettingsPage from './features/settings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/" element={<ProtectedRoute staffOnly><DispatchPage /></ProtectedRoute>} />
          <Route path="/jobs" element={<ProtectedRoute staffOnly><JobsPage /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute staffOnly><CustomersPage /></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute staffOnly><CustomerProfile /></ProtectedRoute>} />
          <Route path="/trucks" element={<ProtectedRoute staffOnly><TrucksPage /></ProtectedRoute>} />
          <Route path="/driver" element={<ProtectedRoute><DriverPage /></ProtectedRoute>} />
          <Route path="/driver/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
          <Route path="/invoicing" element={<ProtectedRoute staffOnly><InvoicingPage /></ProtectedRoute>} />
          <Route path="/invoicing/:id" element={<ProtectedRoute staffOnly><InvoiceDetail /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute staffOnly><DashboardPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute staffOnly><SettingsPage /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
