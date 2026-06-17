import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  id?: string
  name: string
  contact_name: string
  phone: string
  email: string
  billing_address: string
  notes: string
}

const BLANK: Draft = {
  name: '', contact_name: '', phone: '', email: '', billing_address: '', notes: '',
}

export default function CustomersPage() {
  const { org } = useAuth()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (org) load()
  }, [org])

  async function load() {
    setLoading(true)
    const { data } = await orgQuery(
      'customers', org!.id,
      'id, name, contact_name, phone, email, billing_address, notes',
    ).order('name')
    setCustomers((data as Customer[]) ?? [])
    setLoading(false)
  }

  function openAdd() {
    setDraft({ ...BLANK })
    setFormError(null)
  }

  function openEdit(c: Customer, e: React.MouseEvent) {
    e.stopPropagation()
    setDraft({
      id: c.id,
      name: c.name,
      contact_name: c.contact_name ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      billing_address: c.billing_address ?? '',
      notes: c.notes ?? '',
    })
    setFormError(null)
  }

  async function save() {
    if (!draft || !org) return
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

    const { error } = draft.id
      ? await supabase.from('customers').update(payload).eq('id', draft.id).eq('org_id', org.id)
      : await supabase.from('customers').insert({ org_id: org.id, ...payload })

    if (error) { setFormError(error.message); setSaving(false); return }
    setSaving(false)
    setDraft(null)
    load()
  }

  function set(field: keyof Draft, value: string) {
    setDraft(d => d ? { ...d, [field]: value } : d)
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <button
            onClick={openAdd}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700"
          >
            Add customer
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : customers.length === 0 ? (
          <p className="text-sm text-gray-500">No customers yet. Add one to get started.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Email</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/customers/${c.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.contact_name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.phone ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.email ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={e => openEdit(c, e)}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {draft !== null && (
        <Modal
          title={draft.id ? 'Edit customer' : 'Add customer'}
          onClose={() => setDraft(null)}
        >
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
                placeholder="e.g. Acme Contracting"
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
                placeholder="e.g. Jane Smith"
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
                  placeholder="e.g. 555-0100"
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
                  placeholder="e.g. jane@acme.com"
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
                placeholder="Street, City, State/Province, Postal code"
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
                placeholder="Any internal notes about this customer"
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
