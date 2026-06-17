import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabase'
import { orgQuery } from '../../shared/utils/db'
import { useAuth } from '../auth/useAuth'
import Layout from '../../shared/components/Layout'
import Modal from '../../shared/components/Modal'

interface Customer {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  billing_address: string | null
  notes: string | null
}

interface Draft {
  name: string
  contact_name: string
  phone: string
  email: string
  billing_address: string
  notes: string
}

interface Job {
  id: string
  scheduled_for: string | null
  site_address: string | null
  status: string
  quantity: number | null
  price: number | null
  haul_types: { name: string; unit: string } | null
}

const JOB_STATUS_CLASS: Record<string, string> = {
  scheduled:  'bg-gray-100 text-gray-700',
  assigned:   'bg-blue-100 text-blue-700',
  en_route:   'bg-yellow-100 text-yellow-700',
  on_site:    'bg-orange-100 text-orange-700',
  completed:  'bg-green-100 text-green-700',
  invoiced:   'bg-purple-100 text-purple-700',
  cancelled:  'bg-red-100 text-red-700',
}

function statusLabel(s: string) {
  return s.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>()
  const { org } = useAuth()
  const navigate = useNavigate()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (org && id) load()
  }, [org, id])

  async function load() {
    setLoading(true)
    const [{ data: cData }, { data: jData }] = await Promise.all([
      orgQuery('customers', org!.id, 'id, name, contact_name, phone, email, billing_address, notes')
        .eq('id', id!)
        .single(),
      orgQuery('jobs', org!.id, 'id, scheduled_for, site_address, status, quantity, price, haul_types(name, unit)')
        .eq('customer_id', id!)
        .order('scheduled_for', { ascending: false }),
    ])
    if (!cData) { setNotFound(true); setLoading(false); return }
    setCustomer(cData as Customer)
    setJobs((jData as Job[]) ?? [])
    setLoading(false)
  }

  function openEdit() {
    if (!customer) return
    setDraft({
      name: customer.name,
      contact_name: customer.contact_name ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      billing_address: customer.billing_address ?? '',
      notes: customer.notes ?? '',
    })
    setFormError(null)
  }

  async function save() {
    if (!draft || !customer || !org) return
    if (!draft.name.trim()) { setFormError('Name is required'); return }
    setSaving(true)
    setFormError(null)

    const payload = {
      name: draft.name.trim(),
      contact_name: draft.contact_name.trim() || null,
      phone: draft.phone.trim() || null,
      email: draft.email.trim() || null,
      billing_address: draft.billing_address.trim() || null,
      notes: draft.notes.trim() || null,
    }

    const { error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', customer.id)
      .eq('org_id', org.id)

    if (error) { setFormError(error.message); setSaving(false); return }
    setSaving(false)
    setDraft(null)
    load()
  }

  function set(field: keyof Draft, value: string) {
    setDraft(d => d ? { ...d, [field]: value } : d)
  }

  if (loading) {
    return (
      <Layout>
        <p className="text-sm text-gray-500">Loading…</p>
      </Layout>
    )
  }

  if (notFound || !customer) {
    return (
      <Layout>
        <p className="text-sm text-gray-500">Customer not found.</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              onClick={() => navigate('/customers')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-1"
            >
              ← Customers
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          </div>
          <button
            onClick={openEdit}
            className="shrink-0 bg-white border border-gray-300 text-sm px-4 py-2 rounded hover:bg-gray-50"
          >
            Edit
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Contact info
            </h2>
            <Field label="Contact name" value={customer.contact_name} />
            <Field label="Phone" value={customer.phone} />
            <Field label="Email" value={customer.email} />
            <Field label="Billing address" value={customer.billing_address} multiline />
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Account
            </h2>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Open balance</p>
              <p className="text-2xl font-bold text-gray-900">$0.00</p>
              <p className="text-xs text-gray-400 mt-0.5">Invoicing not yet enabled</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Total jobs</p>
              <p className="text-lg font-semibold text-gray-900">{jobs.length}</p>
            </div>
            {customer.notes && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{customer.notes}</p>
              </div>
            )}
          </section>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Job history</h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-gray-500">No jobs yet for this customer.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Site</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Haul type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Qty</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Price</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobs.map(j => (
                    <tr key={j.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatDate(j.scheduled_for)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {j.site_address ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {j.haul_types
                          ? `${j.haul_types.name}`
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {j.quantity !== null
                          ? `${j.quantity}${j.haul_types ? ' ' + j.haul_types.unit : ''}`
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {j.price !== null
                          ? `$${Number(j.price).toFixed(2)}`
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${JOB_STATUS_CLASS[j.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {statusLabel(j.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {draft !== null && (
        <Modal title="Edit customer" onClose={() => setDraft(null)}>
          <div className="space-y-4">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {formError}
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company name</label>
              <input
                type="text"
                value={draft.name}
                onChange={e => set('name', e.target.value)}
                autoFocus
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={draft.contact_name}
                onChange={e => set('contact_name', e.target.value)}
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={e => set('phone', e.target.value)}
                  className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={draft.email}
                  onChange={e => set('email', e.target.value)}
                  className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Billing address <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={draft.billing_address}
                onChange={e => set('billing_address', e.target.value)}
                rows={2}
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={draft.notes}
                onChange={e => set('notes', e.target.value)}
                rows={2}
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDraft(null)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  )
}

function Field({
  label, value, multiline = false,
}: { label: string; value: string | null; multiline?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      {value
        ? <p className={`text-sm text-gray-900 ${multiline ? 'whitespace-pre-line' : ''}`}>{value}</p>
        : <p className="text-sm text-gray-400">—</p>}
    </div>
  )
}
