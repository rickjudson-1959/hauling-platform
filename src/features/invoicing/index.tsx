import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import Layout from '../../shared/components/Layout'
import Modal from '../../shared/components/Modal'

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent:  'bg-blue-100 text-blue-700',
  paid:  'bg-green-100 text-green-700',
  void:  'bg-red-100 text-red-500',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', paid: 'Paid', void: 'Void',
}

interface Invoice {
  id: string
  invoice_number: string
  status: string
  total: number
  created_at: string
  customers: { name: string } | null
}

interface Customer {
  id: string
  name: string
}

interface Job {
  id: string
  scheduled_for: string | null
  site_address: string | null
  price: number | null
  quantity: number | null
  haul_types: { name: string; unit: string } | null
}

function fmt(n: number) { return '$' + n.toFixed(2) }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString() }

export default function InvoicingPage() {
  const { org } = useAuth()
  const navigate = useNavigate()

  const [invoices,    setInvoices]    = useState<Invoice[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [step,        setStep]        = useState<1 | 2>(1)
  const [customers,   setCustomers]   = useState<Customer[]>([])
  const [customerId,  setCustomerId]  = useState('')
  const [jobs,        setJobs]        = useState<Job[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [notes,       setNotes]       = useState('')
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [generating,  setGenerating]  = useState(false)
  const [genError,    setGenError]    = useState<string | null>(null)

  useEffect(() => { if (org) load() }, [org])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, total, created_at, customers(name)')
      .eq('org_id', org!.id)
      .order('created_at', { ascending: false })
    setInvoices((data as Invoice[]) ?? [])
    setLoading(false)
  }

  async function openNew() {
    setStep(1)
    setCustomerId('')
    setSelectedIds(new Set())
    setNotes('')
    setGenError(null)
    setShowModal(true)
    const { data } = await supabase
      .from('customers')
      .select('id, name')
      .eq('org_id', org!.id)
      .order('name')
    setCustomers((data as Customer[]) ?? [])
  }

  async function goStep2() {
    setLoadingJobs(true)
    setStep(2)
    const { data } = await supabase
      .from('jobs')
      .select('id, scheduled_for, site_address, price, quantity, haul_types(name,unit)')
      .eq('org_id', org!.id)
      .eq('customer_id', customerId)
      .eq('status', 'completed')
      .order('scheduled_for')
    const rows = (data as Job[]) ?? []
    setJobs(rows)
    setSelectedIds(new Set(rows.map(j => j.id)))
    setLoadingJobs(false)
  }

  function toggleJob(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function generate() {
    setGenerating(true)
    setGenError(null)
    const { data, error } = await supabase.rpc('create_invoice', {
      p_customer_id: customerId,
      p_job_ids: Array.from(selectedIds),
      p_notes: notes.trim() || null,
    })
    setGenerating(false)
    if (error) { setGenError(error.message); return }
    setShowModal(false)
    navigate(`/invoicing/${data}`)
  }

  const selectedCustomerName = customers.find(c => c.id === customerId)?.name ?? ''

  return (
    <Layout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <button
            onClick={openNew}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            New Invoice
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : invoices.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-500 text-sm">No invoices yet. Select completed jobs to generate one.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Invoice #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map(inv => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(`/invoicing/${inv.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-700">{inv.customers?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[inv.status] ?? STATUS_BADGE.draft}`}>
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(inv.total)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(inv.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title={step === 1 ? 'New Invoice — Select Customer' : `New Invoice — ${selectedCustomerName}`}
          onClose={() => setShowModal(false)}
        >
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <select
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a customer…</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={goStep2}
                  disabled={!customerId}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {loadingJobs ? (
                <p className="text-sm text-gray-500">Loading jobs…</p>
              ) : jobs.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">
                  No completed uninvoiced jobs for this customer.
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-500">Select the completed jobs to include on this invoice.</p>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {jobs.map(j => (
                      <label
                        key={j.id}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(j.id)}
                          onChange={() => toggleJob(j.id)}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {j.haul_types?.name ?? 'Job'}
                            {j.quantity != null ? ` · ${j.quantity} ${j.haul_types?.unit ?? ''}` : ''}
                          </p>
                          {j.site_address && (
                            <p className="text-xs text-gray-500 truncate">{j.site_address}</p>
                          )}
                          {j.scheduled_for && (
                            <p className="text-xs text-gray-400">{fmtDate(j.scheduled_for)}</p>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 shrink-0">
                          {j.price != null ? fmt(j.price) : '—'}
                        </p>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    {selectedIds.size} of {jobs.length} job{jobs.length !== 1 ? 's' : ''} selected
                    {' · '}
                    <span className="font-medium">
                      {fmt(jobs.filter(j => selectedIds.has(j.id)).reduce((s, j) => s + (j.price ?? 0), 0))}
                    </span>
                  </p>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Payment terms, special instructions…"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {genError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{genError}</p>
              )}

              <div className="flex justify-between gap-2 pt-1">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Back
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={generate}
                    disabled={generating || selectedIds.size === 0}
                    className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {generating ? 'Generating…' : 'Generate Invoice'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </Layout>
  )
}
